import { renderToStaticMarkup } from "react-dom/server";
import { PublicRoute } from "./components/PublicRoute";
import {
  getPublicRoute,
  PUBLIC_ROUTES,
  type PublicRouteMetadata,
} from "./content/publicPages";
import { structuredDataForRoute } from "./lib/seo";

export { PUBLIC_ROUTES };

export function renderPublicRoute(pathname: string, baseUrl: string): string {
  return renderToStaticMarkup(<PublicRoute pathname={pathname} baseUrl={baseUrl} />);
}

export function metadataForPublicRoute(pathname: string): {
  route: PublicRouteMetadata;
  structuredData: Record<string, unknown>;
} {
  const route = getPublicRoute(pathname);
  if (!route) throw new Error(`Unknown public route: ${pathname}`);
  return { route, structuredData: structuredDataForRoute(route) };
}
