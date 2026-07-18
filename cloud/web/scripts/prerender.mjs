import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const projectDirectory = resolve(import.meta.dirname, "..");
const outputPath = resolve(projectDirectory, "dist", "index.html");
const placeholder = '<div id="root"></div>';
const baseUrl = "/";

const vite = await createServer({
  configFile: resolve(projectDirectory, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const module = await vite.ssrLoadModule("/src/prerender.tsx");
  const rendered = module.renderPublicSite(baseUrl);
  const document = await readFile(outputPath, "utf8");
  if (!document.includes(placeholder)) {
    throw new Error("The production HTML does not contain the public-site placeholder.");
  }
  await writeFile(outputPath, document.replace(placeholder, `<div id="root">${rendered}</div>`));
  console.log("Pre-rendered the BoundaryCI public launch page.");
} finally {
  await vite.close();
}
