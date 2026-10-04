const ORIGIN = "https://zurielst.com";

function acceptsMarkdown(accept) {
  // Wildcards alone keep the browser representation. Bound parsing work.
  if (!accept || accept.length > 8192) return false;
  const ranges = accept.toLowerCase().split(",").map((entry) => {
    const [media, ...parameters] = entry.trim().split(";");
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const qualityText = qualityParameter?.trim().slice(2).trim() ?? "1";
    const quality = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(qualityText)
      ? Number(qualityText) : 0;
    return { media: media.trim(), quality };
  });
  if (!ranges.some((range) => range.media === "text/markdown" && range.quality > 0)) return false;

  function qualityFor(media) {
    for (const matching of [media, "text/*", "*/*"]) {
      const matches = ranges.filter((range) => range.media === matching);
      if (matches.length) return Math.max(...matches.map((range) => range.quality));
    }
    return 0;
  }
  const markdown = qualityFor("text/markdown");
  return markdown > 0 && markdown >= qualityFor("text/html");
}

function globalHeaders(text) {
  const headers = new Headers();
  let inGlobalBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inGlobalBlock = line.trim() === "/*";
    } else if (inGlobalBlock) {
      const separator = line.indexOf(":");
      if (separator < 0) throw new Error("Invalid global static header");
      headers.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return headers;
}

export function createSiteHandler(staticHeadersText) {
  // Read the existing static policy once; clone response headers per request.
  const securityHeaders = globalHeaders(staticHeadersText);
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname !== "/" || !["GET", "HEAD"].includes(request.method)) {
        return env.ASSETS.fetch(request);
      }

      const markdown = acceptsMarkdown(request.headers.get("Accept"));
      const assetRequest = markdown
        ? new Request(new URL("/dossier.md", url), request) : request;
      const response = await env.ASSETS.fetch(assetRequest);
      const headers = new Headers(response.headers);
      for (const [name, value] of securityHeaders) headers.set(name, value);
      if (url.hostname.endsWith(".workers.dev")) headers.set("X-Robots-Tag", "noindex");

      const vary = headers.get("Vary");
      if (!vary?.split(",").some((name) => ["accept", "*"].includes(name.trim().toLowerCase()))) {
        headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
      }
      // Cloudflare's general shared cache does not key on arbitrary Vary.
      // The binding still caches the two underlying assets independently.
      headers.set("Cache-Control", "no-store");

      if ([200, 206, 304].includes(response.status)) {
        if (markdown) {
          headers.set("Content-Type", "text/markdown; charset=utf-8");
          headers.set("Content-Location", `${ORIGIN}/dossier.md`);
        }
        headers.set("Link", [
          `<${ORIGIN}/>; rel="canonical"`,
          markdown
            ? `<${ORIGIN}/>; rel="alternate"; type="text/html"`
            : `<${ORIGIN}/dossier.md>; rel="alternate"; type="text/markdown"`,
          `<${ORIGIN}/llms.txt>; rel="describedby"; type="text/plain"`,
        ].join(", "));
      }
      return new Response(request.method === "HEAD" ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  };
}
