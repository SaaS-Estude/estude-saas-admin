export const tenantPortals = [
  { id: "admin", label: "Quản trị trường" },
  { id: "teacher", label: "Giáo viên" },
  { id: "student", label: "Học sinh" },
  { id: "parent", label: "Phụ huynh" },
] as const;

export function previewTenantDomains(slug: string, baseDomain: string) {
  const subdomain = slug.trim().toLowerCase();
  const base = baseDomain.trim().toLowerCase().replace(/\.$/, "");
  if (!subdomain || !base) return [];
  return tenantPortals.map((portal) => ({
    ...portal,
    hostname: `${portal.id}.${subdomain}.${base}`,
  }));
}
