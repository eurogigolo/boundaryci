export function canManageOrganization(role: string | null): boolean {
  return role === "owner" || role === "admin";
}
