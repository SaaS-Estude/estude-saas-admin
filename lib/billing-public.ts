// Public sales client. No operator session, no browser storage of credentials:
// prices and amounts always come from the server, never from this module.
export type Cycle = "MONTH" | "YEAR";
export type Offer = {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: number;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  prices: Partial<Record<Cycle, number>>;
};
export type Catalog = { plans: Offer[]; paymentsEnabled: boolean };
export type CreatedOrder = {
  orderCode: number;
  accessToken?: string;
  checkoutUrl: string;
  amount: number;
  kind: string;
  expiresAt: string;
};
export type OrderStatus = {
  orderCode: number;
  kind: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  fulfilmentStatus: "NONE" | "PENDING" | "DONE" | "FAILED";
  amount: number;
  cycle: Cycle;
  planName: string;
  periodEnd?: string;
  expiresAt: string;
  checkoutUrl?: string;
  schoolName?: string;
  portalUrl?: string;
  domainStatus?: string;
  setupRequired?: boolean;
};
export type BuyInput = {
  planCode: string;
  cycle: Cycle;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  idempotencyKey: string;
};
export type SchoolSetupInput = {
  schoolName: string;
  slug: string;
  adminAccount: string;
  adminPassword: string;
};
export type SchoolSetupValues = SchoolSetupInput & { confirmPassword: string };
export type SchoolSetupErrors = Partial<Record<keyof SchoolSetupValues, string>>;
export type CheckoutValues = Omit<BuyInput, "idempotencyKey"> & { accepted: boolean };
export type CheckoutErrors = Partial<Record<keyof CheckoutValues, string>>;

export class BillingError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "",
  ) {
    super(message);
  }
}

async function call<T>(path: string, method = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/platform/v1/public/billing${path}`, {
      method,
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new BillingError(
      "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.",
      0,
    );
  }
  let envelope: {
    success?: boolean;
    message?: string;
    code?: string;
    data: T;
  };
  try {
    envelope = await response.json();
  } catch {
    throw new BillingError("Dịch vụ chưa sẵn sàng.", response.status);
  }
  if (!response.ok || !envelope.success)
    throw new BillingError(
      envelope.message ?? "Không thể xử lý yêu cầu.",
      response.status,
      envelope.code ?? "",
    );
  return envelope.data;
}

export const billingPublic = {
  plans: () => call<Catalog>("/plans"),
  slugCheck: (slug: string) =>
    call<{ available: boolean; reason: string }>(
      `/slug-check?slug=${encodeURIComponent(slug)}`,
    ),
  createOrder: (input: BuyInput) =>
    call<CreatedOrder>("/orders", "POST", input),
  status: (code: number, token: string) =>
    call<OrderStatus>(
      `/orders/${code}?token=${encodeURIComponent(token)}`,
    ),
  cancel: (code: number, token: string) =>
    call<OrderStatus>(`/orders/${code}/cancel`, "POST", { token }),
  setup: (code: number, token: string, school: SchoolSetupInput) =>
    call<OrderStatus>(`/orders/${code}/setup`, "POST", { token, ...school }),
};

export const formatVnd = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")} ₫`;
export const cycleLabel = (cycle: Cycle) =>
  cycle === "YEAR" ? "năm" : "tháng";

export function formatStorage(bytes: number) {
  const gib = bytes / 1024 ** 3;
  return gib >= 1
    ? `${gib.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;
}
export function formatCount(value: number) {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`;
  return value.toLocaleString("vi-VN");
}

export const resourceRows = [
  { key: "storage_bytes", label: "Dung lượng lưu trữ", format: formatStorage },
  { key: "ai_tokens", label: "AI tokens mỗi tháng", format: formatCount },
  { key: "email_messages", label: "Email mỗi tháng", format: formatCount },
] as const;

/** Share saved by paying yearly instead of twelve months, rounded down. */
export function yearlySavings(offer: Offer) {
  const month = offer.prices.MONTH;
  const year = offer.prices.YEAR;
  if (!month || !year || year >= month * 12) return { amount: 0, percent: 0 };
  const amount = month * 12 - year;
  return { amount, percent: Math.floor((amount / (month * 12)) * 100) };
}

export function monthlyEquivalent(offer: Offer, cycle: Cycle) {
  const price = offer.prices[cycle];
  if (price === undefined) return undefined;
  return cycle === "YEAR" ? Math.round(price / 12) : price;
}

const reservedSlugs = new Set([
  "admin",
  "api",
  "app",
  "www",
  "platform",
  "teacher",
  "student",
  "parent",
  "localhost",
  "public",
  "pg-catalog",
]);
export const slugPattern = /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/;
export const accountPattern = /^[a-z0-9._-]{3,50}$/;
export const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Turns a school name into a suggested address ("Trường THPT Lê Quý Đôn" -> "truong-thpt-le-quy-don"). */
export function suggestSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export type BuyValues = CheckoutValues & SchoolSetupValues;
export type BuyErrors = Partial<Record<keyof BuyValues, string>>;

/** Client-side hints only; the server validates everything again. */
export function validateSchoolSetup(values: SchoolSetupValues): SchoolSetupErrors {
  const errors: SchoolSetupErrors = {};
  if (values.schoolName.trim().length < 2)
    errors.schoolName = "Nhập tên trường (ít nhất 2 ký tự).";
  if (!slugPattern.test(values.slug) || reservedSlugs.has(values.slug))
    errors.slug =
      "Địa chỉ gồm chữ thường, số, dấu gạch ngang; bắt đầu bằng chữ cái, 3–50 ký tự và không thuộc danh sách dành riêng.";
  if (!accountPattern.test(values.adminAccount))
    errors.adminAccount =
      "Tên đăng nhập 3–50 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.";
  if (values.adminPassword.length < 8 || values.adminPassword.length > 128)
    errors.adminPassword = "Mật khẩu cần từ 8 đến 128 ký tự.";
  else if (
    /\s/.test(values.adminPassword) ||
    !/[a-z]/.test(values.adminPassword) ||
    !/[A-Z]/.test(values.adminPassword) ||
    !/[0-9]/.test(values.adminPassword) ||
    !/[^a-zA-Z0-9]/.test(values.adminPassword)
  )
    errors.adminPassword =
      "Mật khẩu cần có chữ hoa, chữ thường, chữ số, ký tự đặc biệt và không chứa khoảng trắng.";
  if (values.confirmPassword !== values.adminPassword)
    errors.confirmPassword = "Mật khẩu nhập lại không khớp.";
  return errors;
}

export function validateCheckout(values: CheckoutValues): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (!values.planCode) errors.planCode = "Chọn gói dịch vụ.";
  if (values.cycle !== "MONTH" && values.cycle !== "YEAR") errors.cycle = "Chọn chu kỳ thanh toán.";
  if (values.contactName.trim().length < 2)
    errors.contactName = "Nhập họ tên người liên hệ.";
  if (!emailPattern.test(values.contactEmail.trim()))
    errors.contactEmail = "Email không hợp lệ.";
  if (values.contactPhone && !/^[0-9+ ().-]{8,20}$/.test(values.contactPhone))
    errors.contactPhone = "Số điện thoại không hợp lệ.";
  if (!values.accepted) errors.accepted = "Vui lòng đồng ý với điều khoản.";
  return errors;
}

export function validateBuy(values: BuyValues): BuyErrors {
  return { ...validateCheckout(values), ...validateSchoolSetup(values) };
}

/** A retry of the same form reuses the key; changed input must use a new one. */
export function newIdempotencyKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `buy-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function isFinalStatus(order: OrderStatus) {
  if (order.status === "CANCELLED" || order.status === "EXPIRED") return true;
  return (
    order.status === "PAID" &&
    (order.setupRequired || (order.fulfilmentStatus === "DONE" && (!order.domainStatus || order.domainStatus === "READY")) || order.fulfilmentStatus === "FAILED")
  );
}

/** 2s, 3s, 4.5s … capped at 10s. */
export function pollDelay(attempt: number) {
  return Math.min(10000, Math.round(2000 * 1.5 ** attempt));
}
export const maxPollAttempts = 24;

export type ResultView =
  | "success"
  | "setup"
  | "provisioning"
  | "unpaid"
  | "cancelled"
  | "expired"
  | "needs-support";

export function resultView(order: OrderStatus): ResultView {
  if (order.status === "PAID") {
    if (order.fulfilmentStatus === "DONE") return order.domainStatus && order.domainStatus !== "READY" ? "provisioning" : "success";
    if (order.setupRequired) return "setup";
    if (order.fulfilmentStatus === "FAILED") return "needs-support";
    return "provisioning";
  }
  if (order.status === "CANCELLED") return "cancelled";
  if (order.status === "EXPIRED") return "expired";
  return "unpaid";
}
