// Registered domains come from Go; local school UI has its own listener.
export function tenantPortalUrl(hostname: string) {
  if (!hostname.endsWith(".localhost")) return `https://${hostname}/login`;
  const port = process.env.NEXT_PUBLIC_TENANT_PORTAL_PORT ?? "8091";
  return `http://${hostname}${port ? `:${port}` : ""}/login`;
}
