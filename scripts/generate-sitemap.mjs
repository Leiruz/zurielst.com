import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_ORIGIN = "https://zurielst.com";

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findHtmlFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
    }),
  );
  return nestedFiles.flat();
}

function encodeRouteSegment(segment) {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function routeFromHtmlFile(outputDirectory, htmlFile) {
  const relativeFile = path
    .relative(outputDirectory, htmlFile)
    .split(path.sep)
    .join("/");
  const segments = relativeFile.split("/");
  if (
    segments.some((segment) => segment.startsWith("_")) ||
    relativeFile === "404.html"
  ) {
    return null;
  }

  const isNestedIndex = relativeFile.endsWith("/index.html");
  let routePath;
  if (relativeFile === "index.html") {
    routePath = "";
  } else if (isNestedIndex) {
    routePath = relativeFile.slice(0, -"/index.html".length);
  } else {
    routePath = relativeFile.slice(0, -".html".length);
  }
  const encodedPath = routePath
    .split("/")
    .filter(Boolean)
    .map(encodeRouteSegment)
    .join("/");
  return encodedPath === ""
    ? "/"
    : `/${encodedPath}${isNestedIndex ? "/" : ""}`;
}

export async function discoverExportedRoutes(outputDirectory = path.resolve("out")) {
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const htmlFiles = await findHtmlFiles(resolvedOutputDirectory);
  return [
    ...new Set(
      htmlFiles
        .map((htmlFile) => routeFromHtmlFile(resolvedOutputDirectory, htmlFile))
        .filter(Boolean),
    ),
  ].sort();
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderSitemap(routes) {
  const entries = routes
    .map(
      (route) =>
        `  <url>\n    <loc>${escapeXml(new URL(route, PRODUCTION_ORIGIN).href)}</loc>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export async function generateSitemap(outputDirectory = path.resolve("out")) {
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const routes = await discoverExportedRoutes(resolvedOutputDirectory);
  if (routes.length === 0) {
    throw new Error(`No exported routes found in ${resolvedOutputDirectory}`);
  }
  const sitemapPath = path.join(resolvedOutputDirectory, "sitemap.xml");
  await writeFile(sitemapPath, renderSitemap(routes), "utf8");
  return sitemapPath;
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    const sitemapPath = await generateSitemap(process.argv[2]);
    console.log(`Generated ${sitemapPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
