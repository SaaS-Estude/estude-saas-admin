// Independent control-plane client. Never uses tenant auth or browser storage.
export type Operator = { id: string; accountName: string; active: boolean };
export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
};
export type Overview = {
  total: number;
  active: number;
  suspended: number;
  pending: number;
  failed: number;
};
export type Plan = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  limits: Record<string, number>;
  features: Record<string, boolean>;
};
export type ProvisionRequest = {
  id: string;
  slug: string;
  name: string;
  baseDomain: string | null;
  adminAccount: string;
  status: string;
  errorCode: string | null;
  tenantId: string | null;
  createdAt: string;
};
export type Subscription = {
  tenantId: string;
  planId: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  revision: number;
};
export type Settings = {
  displayName: string;
  primaryColor: string;
  timezone: string;
  revision: number;
};
export type DomainSettings = {
  baseDomain: string;
  revision: number;
};
export type Usage = {
  resource: string;
  periodStart: string;
  used: number;
  reserved: number;
};
export type TenantDetail = {
  tenant: Tenant;
  domains: { hostname: string; portal: string }[];
};
export type TenantProfile = {
  name: string;
  slug: string;
  baseDomain: string;
  revision: number;
};
export type TenantAdminAccount = {
  id: string;
  accountName: string;
  fullName: string;
  status: string;
};
export type TenantUpdate = {
  profile?: Omit<TenantProfile, "revision"> & { expectedRevision: number };
  settings?: Pick<Settings, "displayName" | "primaryColor"> & {
    expectedRevision: number;
  };
  subscription?: Pick<Subscription, "planId" | "status"> & {
    expectedRevision: number;
  };
  status?: { status: string; expectedStatus: string };
  renewal?: {
    periodStart: string;
    periodEnd: string;
    expectedRevision: number;
  };
};
export class PlatformError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// One session boundary for every console request, including nested forms/jobs.
// A generation prevents late responses from an old session from signing out a
// newly authenticated operator or dispatching several expiry notifications.
let sessionGeneration = 0;
let refreshRevision = 0;
let sessionEnded = false;
let refreshInFlight: { generation: number; promise: Promise<void> } | null =
  null;
const sessionExpiredListeners = new Set<() => void>();
export function onPlatformSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function expireSession(generation: number) {
  if (generation !== sessionGeneration || sessionEnded) return;
  ++sessionGeneration;
  sessionEnded = true;
  sessionExpiredListeners.forEach((listener) => listener());
}

// Serialize cookie rotation, login and logout across tabs. Tokens remain in
// host-only HttpOnly cookies; no credential is stored or broadcast in JS.
async function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("estude:platform-auth", action);
  if (typeof window !== "undefined")
    throw new PlatformError(
      "Trình duyệt cần hỗ trợ Web Locks và kết nối HTTPS để đăng nhập.",
      0,
    );
  return action();
}

async function send<T>(path: string, method = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/platform/v1${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PlatformError(
      "Không kết nối được dịch vụ quản trị. Kiểm tra control API ở port 8092.",
      0,
    );
  }
  let envelope: { success?: boolean; message?: string; data: T };
  try {
    envelope = await response.json();
  } catch {
    throw new PlatformError("Dịch vụ quản trị chưa sẵn sàng.", response.status);
  }
  if (!response.ok || !envelope.success)
    throw new PlatformError(
      envelope.message ?? "Không thể xử lý yêu cầu.",
      response.status,
    );
  return {
    data: envelope.data,
    total: Number(response.headers.get("X-Total-Count") ?? 0),
  };
}

async function refreshSession(generation: number) {
  if (sessionEnded || generation !== sessionGeneration)
    throw new PlatformError("Vui lòng đăng nhập lại.", 401);
  if (!refreshInFlight || refreshInFlight.generation !== generation) {
    const promise = withSessionLock(async () => {
      if (sessionEnded || generation !== sessionGeneration)
        throw new PlatformError("Vui lòng đăng nhập lại.", 401);
      await send("/refresh-token", "POST");
      if (generation !== sessionGeneration)
        throw new PlatformError("Phiên quản trị đã kết thúc.", 401);
      ++refreshRevision;
    })
      .catch((error: unknown) => {
        // A temporary network/service failure must not discard a live session.
        if (error instanceof PlatformError && error.status === 401)
          expireSession(generation);
        throw error;
      })
      .finally(() => {
        if (refreshInFlight?.promise === promise) refreshInFlight = null;
      });
    refreshInFlight = { generation, promise };
  }
  await refreshInFlight.promise;
}

async function request<T>(path: string, method = "GET", body?: unknown) {
  const generation = sessionGeneration;
  const revision = refreshRevision;
  try {
    return await send<T>(path, method, body);
  } catch (error) {
    if (
      !(error instanceof PlatformError) ||
      error.status !== 401 ||
      generation !== sessionGeneration ||
      sessionEnded
    )
      throw error;
    if (revision === refreshRevision) await refreshSession(generation);
    if (generation !== sessionGeneration)
      throw new PlatformError("Phiên quản trị đã kết thúc.", 401);
    try {
      // Replay once only; the server rejects expired credentials before mutations.
      return await send<T>(path, method, body);
    } catch (retryError) {
      if (retryError instanceof PlatformError && retryError.status === 401)
        expireSession(generation);
      throw retryError;
    }
  }
}
async function get<T>(path: string) {
  return (await request<T>(path)).data;
}
export const platformApi = {
  me: () => get<Operator>("/me"),
  login: async (accountName: string, password: string) => {
    await withSessionLock(async () => {
      await send("/login", "POST", { accountName, password });
      ++sessionGeneration;
      refreshRevision = 0;
      sessionEnded = false;
    });
    return get<Operator>("/me");
  },
  logout: async () => {
    const generation = ++sessionGeneration;
    sessionEnded = true;
    try {
      return await withSessionLock(async () => {
        try {
          return await send("/logout", "POST");
        } catch (error) {
          if (!(error instanceof PlatformError) || error.status !== 401)
            throw error;
          // An expired access cookie must not prevent revoking the refresh session.
          await send("/refresh-token", "POST");
          return send("/logout", "POST");
        }
      });
    } catch (error) {
      if (generation === sessionGeneration) sessionEnded = false;
      if (error instanceof PlatformError && error.status === 401)
        expireSession(generation);
      throw error;
    }
  },
  overview: () => get<Overview>("/overview"),
  tenants: (q: string, status: string, page: number) =>
    request<Tenant[]>(
      `/tenants?${new URLSearchParams({ q, status, limit: "20", offset: String(page * 20) })}`,
    ),
  plans: () => get<Plan[]>("/plans"),
  createPlan: (input: {
    code: string;
    name: string;
    limits: Record<string, number>;
    features: Record<string, boolean>;
  }) => request<Plan>("/plans", "POST", input),
  domainSettings: () => get<DomainSettings>("/domain-settings"),
  setDomainSettings: (settings: DomainSettings) =>
    request("/domain-settings", "PUT", {
      baseDomain: settings.baseDomain,
      expectedRevision: settings.revision,
    }),
  createTenant: (input: {
    slug: string;
    name: string;
    baseDomain: string;
    adminAccount: string;
    adminPassword: string;
  }) => request<ProvisionRequest>("/tenants", "POST", input),
  tenant: (id: string) => get<TenantDetail>(`/tenants/${id}`),
  tenantAdminAccounts: (id: string) =>
    get<TenantAdminAccount[]>(`/tenants/${id}/admin-accounts`),
  resetTenantAdminPassword: (
    id: string,
    userId: string,
    newPassword: string,
    confirmNewPassword: string,
  ) =>
    request(`/tenants/${id}/admin-accounts/${userId}/password`, "POST", {
      newPassword,
      confirmNewPassword,
    }),
  updateTenant: (id: string, changes: TenantUpdate) =>
    request(`/tenants/${id}`, "PUT", changes),
  tenantProfile: (id: string) => get<TenantProfile>(`/tenants/${id}/profile`),
  settings: (id: string) => get<Settings>(`/tenants/${id}/settings`),
  subscription: (id: string) =>
    get<Subscription>(`/tenants/${id}/subscription`),
  usage: (id: string) => get<Usage[]>(`/tenants/${id}/usage?current=true`),
};
