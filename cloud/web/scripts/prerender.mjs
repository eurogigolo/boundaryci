import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

const projectDirectory = resolve(import.meta.dirname, "..");
const distDirectory = resolve(projectDirectory, "dist");
const templatePath = resolve(distDirectory, "index.html");
const rootPlaceholder = '<div id="root"></div>';
const articleMetaPlaceholder = "<!-- boundaryci:article-meta -->";
const baseUrl = "/";
const siteOrigin = "https://boundaryci.com";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function replaceMeta(document, attribute, name, content) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="[^"]*"\\s*\\/?>`);
  if (!pattern.test(document)) throw new Error(`Missing ${attribute}=${name} metadata placeholder.`);
  return document.replace(pattern, `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`);
}

function applyMetadata(document, route, structuredData) {
  const pageUrl = new URL(route.path, siteOrigin).toString();
  const articleType = route.kind === "guide" || route.kind === "documentation" || route.kind === "rule";
  const articleMeta = articleType
    ? [
        `<meta property="article:published_time" content="${route.publishedAt}" />`,
        `<meta property="article:modified_time" content="${route.modifiedAt}" />`,
      ].join("\n    ")
    : "";

  let updated = document.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`);
  updated = replaceMeta(updated, "name", "description", route.description);
  updated = replaceMeta(updated, "property", "og:type", articleType ? "article" : "website");
  updated = replaceMeta(updated, "property", "og:title", route.title);
  updated = replaceMeta(updated, "property", "og:description", route.description);
  updated = replaceMeta(updated, "property", "og:url", pageUrl);
  updated = replaceMeta(updated, "name", "twitter:title", route.title);
  updated = replaceMeta(updated, "name", "twitter:description", route.description);

  const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/;
  if (!canonicalPattern.test(updated)) throw new Error("Missing canonical URL placeholder.");
  updated = updated.replace(canonicalPattern, `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`);

  if (!updated.includes(articleMetaPlaceholder)) throw new Error("Missing article metadata placeholder.");
  updated = updated.replace(articleMetaPlaceholder, articleMeta);

  const jsonLdPattern = /<script type="application\/ld\+json" id="boundaryci-structured-data">[\s\S]*?<\/script>/;
  if (!jsonLdPattern.test(updated)) throw new Error("Missing structured-data placeholder.");
  const serializedData = JSON.stringify(structuredData, null, 2).replaceAll("<", "\\u003c");
  return updated.replace(
    jsonLdPattern,
    `<script type="application/ld+json" id="boundaryci-structured-data">\n${serializedData}\n    </script>`,
  );
}

function outputPathForRoute(pathname) {
  if (pathname === "/") return templatePath;
  const routeDirectory = pathname.replace(/^\//, "").replace(/\/$/, "");
  return resolve(distDirectory, routeDirectory, "index.html");
}

function renderSitemap(routes) {
  const entries = routes.map((route) => [
    "  <url>",
    `    <loc>${escapeXml(new URL(route.path, siteOrigin).toString())}</loc>`,
    `    <lastmod>${escapeXml(route.modifiedAt)}</lastmod>`,
    "  </url>",
  ].join("\n")).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n");
}

const vite = await createServer({
  configFile: resolve(projectDirectory, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const module = await vite.ssrLoadModule("/src/prerender.tsx");
  const routes = module.PUBLIC_ROUTES;
  const template = await readFile(templatePath, "utf8");
  if (!template.includes(rootPlaceholder)) {
    throw new Error("The production HTML does not contain the public-site placeholder.");
  }

  const uniquePaths = new Set(routes.map((route) => route.path));
  if (uniquePaths.size !== routes.length) throw new Error("Public routes must have unique paths.");

  for (const route of routes) {
    const rendered = module.renderPublicRoute(route.path, baseUrl);
    const metadata = module.metadataForPublicRoute(route.path);
    const outputPath = outputPathForRoute(route.path);
    const document = applyMetadata(
      template.replace(rootPlaceholder, `<div id="root">${rendered}</div>`),
      metadata.route,
      metadata.structuredData,
    );
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, document);
  }

  await writeFile(resolve(distDirectory, "sitemap.xml"), renderSitemap(routes));
  console.log(`Pre-rendered ${routes.length} indexable BoundaryCI pages.`);
} finally {
  await vite.close();
}
