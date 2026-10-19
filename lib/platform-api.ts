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
const sessionExpiredListeners = new Set<() => void>();
export function onPlatformSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

async function request<T>(path: string, method = "GET", body?: unknown) {
  const generation = sessionGeneration;
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
  if (
    response.status === 401 &&
    path !== "/login" &&
    generation === sessionGeneration
  ) {
    ++sessionGeneration;
    sessionExpiredListeners.forEach((listener) => listener());
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
async function get<T>(path: string) {
  return (await request<T>(path)).data;
}
export const platformApi = {
  me: () => get<Operator>("/me"),
  login: async (accountName: string, password: string) => {
    await request("/login", "POST", { accountName, password });
    ++sessionGeneration;
    return get<Operator>("/me");
  },
  logout: async () => {
    const result = await request("/logout", "POST");
    ++sessionGeneration;
    return result;
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
  updateTenant: (id: string, changes: TenantUpdate) =>
    request(`/tenants/${id}`, "PUT", changes),
  tenantProfile: (id: string) => get<TenantProfile>(`/tenants/${id}/profile`),
  settings: (id: string) => get<Settings>(`/tenants/${id}/settings`),
  subscription: (id: string) =>
    get<Subscription>(`/tenants/${id}/subscription`),
  usage: (id: string) => get<Usage[]>(`/tenants/${id}/usage?current=true`),
};
