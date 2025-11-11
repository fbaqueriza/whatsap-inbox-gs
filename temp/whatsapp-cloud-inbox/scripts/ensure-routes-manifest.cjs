const fs = require("fs");
const path = require("path");

const DIST_DIR = process.env.NEXT_DIST_DIR || process.env.NEXT_OUTPUT_DIR || ".next";
const cwd = process.cwd();
const manifestPath = path.join(cwd, DIST_DIR, "routes-manifest.json");
const appManifestPath = path.join(cwd, DIST_DIR, "app-path-routes-manifest.json");
const legacyDistDir = `${DIST_DIR}.`;
const legacyManifestPath = path.join(cwd, legacyDistDir, "routes-manifest.json");

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");

const staticRoutes = [];
const dynamicRoutes = [];

if (fs.existsSync(appManifestPath)) {
  const appManifest = JSON.parse(fs.readFileSync(appManifestPath, "utf8"));
  Object.values(appManifest).forEach((route) => {
    if (typeof route !== "string") {
      return;
    }

    const normalized = route === "/page" ? "/" : route;

    if (normalized.includes("[") && normalized.includes("]")) {
      const paramMatch = normalized.match(/\[([\.]{3})?(.+?)\]/);
      if (!paramMatch) return;

      const isCatchAll = Boolean(paramMatch[1]);
      const paramName = paramMatch[2];
      const routeKey = `nxtP${paramName}`;

      const regexFragment = isCatchAll ? "(.+?)" : "([^/]+?)";
      const regex = `^${escapeRegex(normalized).replace(/\\\[.+?\\\]/, regexFragment)}(?:/)?$`;
      const namedRegex = `^${escapeRegex(normalized)
        .replace(/\\\[.+?\\\]/, isCatchAll ? `(?<${paramName}>.+?)` : `(?<${paramName}>[^/]+?)`)}(?:/)?$`;

      dynamicRoutes.push({
        page: normalized,
        regex,
        routeKeys: { [routeKey]: routeKey },
        namedRegex,
      });
    } else {
      const regex =
        normalized === "/"
          ? "^/(?:/)?$"
          : `^${escapeRegex(normalized)}(?:/)?$`;

      staticRoutes.push({
        page: normalized,
        regex,
        routeKeys: {},
        namedRegex: regex,
      });
    }
  });
} else {
  console.warn("[ensure-routes-manifest] No se encontró app-path-routes-manifest.json; se generará un manifest vacío.");
}

const manifest = {
  version: 3,
  pages404: true,
  caseSensitive: false,
  basePath: "",
  redirects: [],
  headers: [],
  dynamicRoutes,
  staticRoutes,
  dataRoutes: [],
  rewrites: {
    beforeFiles: [],
    afterFiles: [],
    fallback: [],
  },
  rsc: {
    header: "rsc",
    varyHeader: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
    prefetchHeader: "next-router-prefetch",
    didPostponeHeader: "x-nextjs-postponed",
    contentTypeHeader: "text/x-component",
    suffix: ".rsc",
    prefetchSuffix: ".prefetch.rsc",
    prefetchSegmentHeader: "next-router-segment-prefetch",
    prefetchSegmentSuffix: ".segment.rsc",
    prefetchSegmentDirSuffix: ".segments",
  },
  rewriteHeaders: {
    pathHeader: "x-nextjs-rewritten-path",
    queryHeader: "x-nextjs-rewritten-query",
  },
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[ensure-routes-manifest] routes-manifest.json generado en ${manifestPath}`);

try {
  if (!fs.existsSync(path.join(cwd, legacyDistDir))) {
    fs.mkdirSync(path.join(cwd, legacyDistDir), { recursive: true });
  }
  fs.writeFileSync(legacyManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[ensure-routes-manifest] routes-manifest.json duplicado en ${legacyManifestPath} para compatibilidad.`);
} catch (error) {
  console.warn("[ensure-routes-manifest] No se pudo crear copia legacy de routes-manifest.json:", error);
}


