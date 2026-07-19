import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  getPublicPage,
  getPublicRoute,
  PUBLIC_PAGES,
  PUBLIC_ROUTES,
} from "./publicPages";
import { renderPublicRoute } from "../prerender";
import { isPrivateApplicationUrl } from "../lib/indexing";
import { structuredDataForRoute } from "../lib/seo";

describe("public discovery pages", () => {
  it("defines a unique, descriptive route for every indexable page", () => {
    expect(PUBLIC_ROUTES).toHaveLength(18);
    expect(new Set(PUBLIC_ROUTES.map((route) => route.path)).size).toBe(PUBLIC_ROUTES.length);
    expect(new Set(PUBLIC_ROUTES.map((route) => route.title)).size).toBe(PUBLIC_ROUTES.length);
    expect(new Set(PUBLIC_ROUTES.map((route) => route.description)).size).toBe(PUBLIC_ROUTES.length);

    for (const route of PUBLIC_ROUTES) {
      expect(route.path).toMatch(/^\/.+\/$|^\/$/);
      expect(route.title.length).toBeGreaterThan(20);
      expect(route.title.length).toBeLessThanOrEqual(70);
      expect(route.description.length).toBeGreaterThan(70);
      expect(route.description.length).toBeLessThanOrEqual(160);
      expect(getPublicRoute(route.path)).toEqual(route);
    }
  });

  it("pre-renders a useful page with one primary heading for every route", () => {
    for (const route of PUBLIC_ROUTES) {
      const markup = renderPublicRoute(route.path, "/");
      expect(markup).toContain("BoundaryCI");
      expect(markup.match(/<h1/g)).toHaveLength(1);
      if (route.kind === "home") {
        expect(markup).toContain("Stop one customer from seeing");
        expect(markup).toContain("another customer&#x27;s data.");
      } else {
        expect(markup).toContain(renderToStaticMarkup(<h1>{route.heading}</h1>));
      }
    }
  });

  it("publishes structured data tied to each canonical route", () => {
    for (const route of PUBLIC_ROUTES) {
      const serialized = JSON.stringify(structuredDataForRoute(route));
      expect(serialized).toContain(absoluteUrl(route.path));
      expect(serialized).toContain("BoundaryCI");
      expect(serialized).not.toContain("undefined");
    }
  });

  it("labels guide breadcrumbs with the current article", () => {
    const markup = renderPublicRoute("/guides/test-supabase-rls/", "/");
    expect(markup).toContain("<span>Supabase RLS testing</span>");
    expect(markup).not.toContain("<span>Guides</span>");
  });

  it("keeps the sitemap and llms catalog aligned with the route source", () => {
    const sitemap = readFileSync(new URL("../../public/sitemap.xml", import.meta.url), "utf8");
    const llms = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8");
    const robots = readFileSync(new URL("../../public/robots.txt", import.meta.url), "utf8");

    for (const route of PUBLIC_ROUTES) {
      expect(sitemap).toContain(`<loc>${absoluteUrl(route.path)}</loc>`);
      if (route.path !== "/") expect(llms).toContain(absoluteUrl(route.path));
    }
    expect(sitemap.match(/<loc>/g)).toHaveLength(PUBLIC_ROUTES.length);
    expect(robots).toContain("User-agent: OAI-SearchBot");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Sitemap: https://boundaryci.com/sitemap.xml");
  });

  it("does not publish orphaned internal links", () => {
    const knownPaths = new Set(PUBLIC_ROUTES.map((route) => route.path));
    for (const route of PUBLIC_ROUTES) {
      const markup = renderPublicRoute(route.path, "/");
      const links = [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      for (const link of links) {
        if (!link?.startsWith("/") || link.startsWith("/?") || link.startsWith("/#")) continue;
        const normalized = link === "/" ? link : link.split(/[?#]/, 1)[0];
        expect(knownPaths, `${route.path} links to unknown route ${link}`).toContain(normalized);
      }
    }
  });

  it("makes every document route resolvable from the typed content catalog", () => {
    for (const page of PUBLIC_PAGES) expect(getPublicPage(page.path)).toEqual(page);
  });

  it("publishes first-party billing policies without a conversion prompt", () => {
    const terms = renderPublicRoute("/terms/", "/");
    expect(terms).toContain("Prices, currency, and automatic renewal");
    expect(terms).toContain("Cancellation and refunds");
    expect(terms).not.toContain("Make tenant isolation a release gate");

    expect(renderPublicRoute("/privacy/", "/")).toContain("Optional Cloud upload");
    expect(renderPublicRoute("/support/", "/")).toContain("Billing and subscription help");
  });
});

describe("private application indexing", () => {
  it("marks authentication and password-recovery URLs as private", () => {
    expect(isPrivateApplicationUrl("?auth=signup", "")).toBe(true);
    expect(isPrivateApplicationUrl("?auth=signin", "")).toBe(true);
    expect(isPrivateApplicationUrl("?type=recovery", "")).toBe(true);
    expect(isPrivateApplicationUrl("", "#type=recovery&access_token=redacted")).toBe(true);
  });

  it("leaves public discovery routes indexable", () => {
    expect(isPrivateApplicationUrl("", "")).toBe(false);
    expect(isPrivateApplicationUrl("?utm_source=launch", "#what-it-checks")).toBe(false);
  });
});
