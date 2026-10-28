export const quotaResources = ["ai_tokens", "email_messages", "storage_bytes"] as const;
export type QuotaResource = (typeof quotaResources)[number];
export type QuotaDraft = Record<QuotaResource, string>;
export const quotaLabels: Record<QuotaResource, string> = {
  ai_tokens: "AI tokens",
  email_messages: "Email",
  storage_bytes: "Dung lượng",
};
export const quotaMaximum = 1_000_000_000_000;
export const mib = 1024 ** 2;

export function quotaDraft(additional: Record<string, number>): QuotaDraft {
  return Object.fromEntries(
    quotaResources.map((resource) => {
      const value = additional[resource] ?? 0;
      // Bytes / 2^20 has at most 20 decimal places. Avoid exponent notation for
      // small existing additions so they round-trip through the MiB input.
      return [
        resource,
        resource === "storage_bytes"
          ? (value / mib).toFixed(20).replace(/\.?0+$/, "") || "0"
          : String(value),
      ];
    }),
  ) as QuotaDraft;
}

export function parseQuotaValue(resource: QuotaResource, value: string): number {
  const amount = Number(value) * (resource === "storage_bytes" ? mib : 1);
  if (
    !/^\d+(?:\.\d+)?$/.test(value.trim()) ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > quotaMaximum
  ) {
    throw new Error(
      resource === "storage_bytes"
        ? "Vui lòng nhập dung lượng bổ sung hợp lệ theo MiB."
        : `${quotaLabels[resource]} bổ sung phải là số nguyên từ 0 đến 1.000.000.000.000.`,
    );
  }
  return amount;
}

export function parseQuotaDraft(draft: QuotaDraft): Record<QuotaResource, number> {
  return Object.fromEntries(
    quotaResources.map((resource) => [resource, parseQuotaValue(resource, draft[resource])]),
  ) as Record<QuotaResource, number>;
}
