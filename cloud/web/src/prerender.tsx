import { renderToStaticMarkup } from "react-dom/server";
import { PublicSite } from "./components/PublicSite";

export function renderPublicSite(baseUrl: string): string {
  return renderToStaticMarkup(<PublicSite baseUrl={baseUrl} />);
}
