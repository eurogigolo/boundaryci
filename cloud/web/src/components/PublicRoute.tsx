import { getPublicPage, normalizePublicPath } from "../content/publicPages";
import { PublicDocumentPage } from "./PublicDocumentPage";
import { PublicSite } from "./PublicSite";

export function PublicRoute({
  pathname,
  baseUrl,
}: {
  pathname: string;
  baseUrl: string;
}) {
  const normalizedPath = normalizePublicPath(pathname);
  if (normalizedPath === "/") return <PublicSite baseUrl={baseUrl} />;

  const page = getPublicPage(normalizedPath);
  if (page) return <PublicDocumentPage page={page} baseUrl={baseUrl} />;

  return <PublicSite baseUrl={baseUrl} />;
}
