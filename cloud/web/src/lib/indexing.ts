export function isPrivateApplicationUrl(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return query.has("auth") || query.get("type") === "recovery" || fragment.get("type") === "recovery";
}

export function protectPrivateRoutesFromIndexing(
  location: Pick<Location, "search" | "hash"> = window.location,
  documentRoot: Document = document,
): void {
  if (!isPrivateApplicationUrl(location.search, location.hash)) return;
  const robots = documentRoot.querySelector<HTMLMetaElement>('meta[name="robots"]');
  robots?.setAttribute("content", "noindex, nofollow, noarchive");
}
