import { readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_ORIGIN = new URL("https://zurielst.com");
const PREVIEW_RULE = "https://:version.:subdomain.workers.dev/*";
const LANDING_SECTION_IDS = [
  "identity",
  "intro",
  "brands",
  "capabilities",
  "stack",
  "work",
  "timeline",
  "education",
  "proof",
  "products",
  "testimonials",
  "faq",
  "insights",
  "contact",
];
const LANDING_SECTION_CAPTIONS = [
  "Identity",
  "Introduction",
  "Worked with",
  "Capabilities",
  "Stack",
  "Selected work",
  "Timeline",
  "Education",
  "Accolades",
  "Products",
  "Testimonials",
  "FAQ",
  "Insights",
  "Contact",
];
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const requiredHeaders = new Map([
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  [
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  ],
  ["x-frame-options", "DENY"],
  ["cross-origin-opener-policy", "same-origin"],
]);

const requiredCspDirectives = new Map([
  ["default-src", ["'self'"]],
  ["base-uri", ["'self'"]],
  ["object-src", ["'none'"]],
  ["frame-ancestors", ["'none'"]],
  ["form-action", ["'self'"]],
  ["script-src", ["'self'", "'unsafe-inline'"]],
  ["style-src", ["'self'", "'unsafe-inline'"]],
  ["img-src", ["'self'", "data:"]],
  ["font-src", ["'self'"]],
  ["connect-src", ["'self'"]],
]);

function validateRule(rule, lineNumber) {
  if (rule.headers.size === 0) {
    throw new Error(
      `Header rule ${rule.pattern} at line ${lineNumber} has no headers`,
    );
  }
}

export function parseHeadersFile(source) {
  if (typeof source !== "string" || source.trim() === "") {
    throw new Error("The _headers file is empty");
  }

  const rules = [];
  let currentRule;
  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmedLine = rawLine.trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) continue;
    if (rawLine.length > 2_000) {
      throw new Error(`_headers line ${lineNumber} exceeds 2,000 characters`);
    }

    const isIndented = /^[ \t]/.test(rawLine);
    if (!isIndented) {
      if (!trimmedLine.startsWith("/") && !trimmedLine.startsWith("https://")) {
        if (/^[A-Za-z0-9-]+\s*:/.test(trimmedLine)) {
          throw new Error(`Header at line ${lineNumber} must be indented`);
        }
        throw new Error(`Invalid header rule at line ${lineNumber}: ${trimmedLine}`);
      }
      if (currentRule) validateRule(currentRule, lineNumber - 1);
      currentRule = { pattern: trimmedLine, headers: new Map() };
      rules.push(currentRule);
      continue;
    }

    if (!currentRule) {
      throw new Error(`Header at line ${lineNumber} appears before a rule`);
    }
    const headerMatch = /^([A-Za-z0-9-]+)\s*:\s*(.+)$/.exec(trimmedLine);
    if (!headerMatch) {
      throw new Error(`Malformed header at line ${lineNumber}`);
    }
    const headerName = headerMatch[1].toLowerCase();
    if (currentRule.headers.has(headerName)) {
      throw new Error(
        `Duplicate header ${headerMatch[1]} in rule ${currentRule.pattern}`,
      );
    }
    currentRule.headers.set(headerName, headerMatch[2].trim());
  }

  if (currentRule) validateRule(currentRule, lines.length);
  if (rules.length === 0) throw new Error("The _headers file has no rules");
  if (rules.length > 100) {
    throw new Error("Cloudflare _headers supports at most 100 rules");
  }
  return rules;
}

export function parseContentSecurityPolicy(source) {
  if (typeof source !== "string" || source.trim() === "") {
    throw new Error("Content-Security-Policy is empty");
  }

  const directives = new Map();
  for (const rawDirective of source.split(";")) {
    const directive = rawDirective.trim();
    if (directive === "") continue;
    const [rawName, ...values] = directive.split(/\s+/);
    const name = rawName.toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      throw new Error(`Invalid CSP directive: ${rawName}`);
    }
    if (directives.has(name)) {
      throw new Error(`Duplicate CSP directive: ${name}`);
    }
    if (new Set(values).size !== values.length) {
      throw new Error(`Duplicate source in CSP directive: ${name}`);
    }
    directives.set(name, values);
  }
  return directives;
}

function assertExactSources(policy, directiveName, expectedSources) {
  const actualSources = policy.get(directiveName);
  if (!actualSources) {
    throw new Error(`Content-Security-Policy is missing ${directiveName}`);
  }
  if (
    actualSources.length !== expectedSources.length ||
    expectedSources.some((source) => !actualSources.includes(source))
  ) {
    throw new Error(
      `${directiveName} must be exactly ${expectedSources.join(" ")}`,
    );
  }
}

export function validateHeadersFile(source) {
  const rules = parseHeadersFile(source);
  for (const rule of rules) {
    if (rule.headers.has("strict-transport-security")) {
      throw new Error("_headers must not set Strict-Transport-Security");
    }
  }

  const globalRules = rules.filter((rule) => rule.pattern === "/*");
  if (globalRules.length !== 1) {
    throw new Error("_headers must contain exactly one /* rule");
  }
  const globalRule = globalRules[0];
  for (const [headerName, expectedValue] of requiredHeaders) {
    if (globalRule.headers.get(headerName) !== expectedValue) {
      throw new Error(`${headerName} must be exactly ${expectedValue}`);
    }
  }

  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  for (const [directiveName, expectedSources] of requiredCspDirectives) {
    assertExactSources(policy, directiveName, expectedSources);
  }
  for (const directiveName of policy.keys()) {
    if (!requiredCspDirectives.has(directiveName)) {
      throw new Error(`Unexpected CSP directive: ${directiveName}`);
    }
  }

  const previewRules = rules.filter((rule) => rule.pattern === PREVIEW_RULE);
  if (
    previewRules.length !== 1 ||
    previewRules[0].headers.get("x-robots-tag") !== "noindex"
  ) {
    throw new Error("Preview workers.dev URLs must send X-Robots-Tag: noindex");
  }

  return { policy, rules };
}

function findTagEnd(html, startIndex) {
  let quote;
  for (let index = startIndex; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (match, rawCodePoint) => {
      const isHexadecimal = rawCodePoint[0].toLowerCase() === "x";
      const codePoint = Number.parseInt(
        isHexadecimal ? rawCodePoint.slice(1) : rawCodePoint,
        isHexadecimal ? 16 : 10,
      );
      if (!Number.isInteger(codePoint) || codePoint > 0x10ffff) return match;
      return String.fromCodePoint(codePoint);
    })
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&colon;", ":")
    .replaceAll("&Tab;", "\t")
    .replaceAll("&NewLine;", "\n")
    .replaceAll("&sol;", "/")
    .replaceAll("&period;", ".");
}

function parseTag(tagSource) {
  const tagNameMatch = /^\s*([A-Za-z][A-Za-z0-9:-]*)/.exec(tagSource);
  if (!tagNameMatch) return null;

  const attributes = new Map();
  let cursor = tagNameMatch[0].length;
  while (cursor < tagSource.length) {
    while (/\s|\//.test(tagSource[cursor] ?? "")) cursor += 1;
    if (cursor >= tagSource.length) break;

    const nameStart = cursor;
    while (!/[\s=/>]/.test(tagSource[cursor] ?? ">")) cursor += 1;
    const attributeName = tagSource.slice(nameStart, cursor).toLowerCase();
    while (/\s/.test(tagSource[cursor] ?? "")) cursor += 1;

    let value = "";
    if (tagSource[cursor] === "=") {
      cursor += 1;
      while (/\s/.test(tagSource[cursor] ?? "")) cursor += 1;
      const quote = tagSource[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < tagSource.length && tagSource[cursor] !== quote) {
          cursor += 1;
        }
        value = tagSource.slice(valueStart, cursor);
        if (tagSource[cursor] === quote) cursor += 1;
      } else {
        const valueStart = cursor;
        while (!/[\s>]/.test(tagSource[cursor] ?? ">")) cursor += 1;
        value = tagSource.slice(valueStart, cursor);
      }
    }
    if (attributeName && !attributes.has(attributeName)) {
      attributes.set(attributeName, decodeHtmlAttribute(value));
    }
  }

  return {
    attributes,
    name: tagNameMatch[1].toLowerCase(),
    content: "",
  };
}

function extractTags(html) {
  const tags = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart === -1) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(html, tagStart + 1);
    if (tagEnd === -1) break;
    const tag = parseTag(html.slice(tagStart + 1, tagEnd));
    cursor = tagEnd + 1;
    if (!tag) continue;

    if (tag.name === "script" || tag.name === "style") {
      const closingStart = lowerHtml.indexOf(`</${tag.name}`, cursor);
      if (closingStart !== -1) {
        tag.content = html.slice(cursor, closingStart);
        const closingEnd = html.indexOf(">", closingStart);
        cursor = closingEnd === -1 ? html.length : closingEnd + 1;
      }
    }
    tags.push(tag);
  }

  return tags;
}

function sourceListFor(policy, directiveName) {
  if (policy.has(directiveName)) return policy.get(directiveName);
  if (["base-uri", "form-action", "frame-ancestors"].includes(directiveName)) {
    return [];
  }
  return policy.get("default-src") ?? [];
}

function isResourceAllowed(resourceUrl, sources) {
  if (resourceUrl === "" || resourceUrl.startsWith("#")) return true;
  if (sources.includes("*")) return true;
  if (sources.includes("'none'")) return false;

  let resolvedUrl;
  try {
    resolvedUrl = new URL(resourceUrl, PRODUCTION_ORIGIN);
  } catch {
    return false;
  }

  for (const source of sources) {
    if (source === "'self'" && resolvedUrl.origin === PRODUCTION_ORIGIN.origin) {
      return true;
    }
    if (/^[a-z][a-z0-9+.-]*:$/.test(source) && resolvedUrl.protocol === source) {
      return true;
    }
    if (source.startsWith("https://*.")) {
      const sourceHost = source.slice("https://*.".length);
      if (
        resolvedUrl.protocol === "https:" &&
        resolvedUrl.hostname.endsWith(`.${sourceHost}`)
      ) {
        return true;
      }
    }
    try {
      const sourceUrl = new URL(source);
      if (sourceUrl.origin === resolvedUrl.origin) return true;
    } catch {
      // Keywords and unsupported source expressions cannot allow this URL.
    }
  }
  return false;
}

function srcsetUrls(value) {
  const urls = [];
  let cursor = 0;

  while (cursor < value.length) {
    while (/[\s,]/.test(value[cursor] ?? "")) cursor += 1;
    if (cursor >= value.length) break;

    const urlStart = cursor;
    const isDataUrl = value.slice(cursor, cursor + 5).toLowerCase() === "data:";
    while (
      cursor < value.length &&
      !/\s/.test(value[cursor]) &&
      (isDataUrl || value[cursor] !== ",")
    ) {
      cursor += 1;
    }
    const resourceUrl = value.slice(urlStart, cursor).replace(/,+$/, "");
    if (resourceUrl) urls.push(resourceUrl);

    let parenthesesDepth = 0;
    while (cursor < value.length) {
      const character = value[cursor];
      if (character === "(") parenthesesDepth += 1;
      if (character === ")") parenthesesDepth = Math.max(0, parenthesesDepth - 1);
      cursor += 1;
      if (character === "," && parenthesesDepth === 0) break;
    }
  }

  return urls;
}

function collectResources(tag) {
  const resources = [];
  const add = (attributeName, directiveName, values) => {
    for (const value of Array.isArray(values) ? values : [values]) {
      if (value) resources.push({ attributeName, directiveName, value });
    }
  };
  const attribute = (name) => tag.attributes.get(name);

  if (tag.name === "script") {
    add("src", "script-src", attribute("src"));
    add("href", "script-src", attribute("href"));
    add("xlink:href", "script-src", attribute("xlink:href"));
  }
  if (tag.name === "img") {
    add("src", "img-src", attribute("src"));
    if (attribute("srcset")) {
      add("srcset", "img-src", srcsetUrls(attribute("srcset")));
    }
  }
  if (tag.name === "source") {
    add("src", "media-src", attribute("src"));
    if (attribute("srcset")) {
      add("srcset", "img-src", srcsetUrls(attribute("srcset")));
    }
  }
  if (tag.name === "video" || tag.name === "audio" || tag.name === "track") {
    add("src", "media-src", attribute("src"));
  }
  if (tag.name === "video") add("poster", "img-src", attribute("poster"));
  if (tag.name === "iframe") add("src", "frame-src", attribute("src"));
  if (tag.name === "object") add("data", "object-src", attribute("data"));
  if (tag.name === "embed") add("src", "object-src", attribute("src"));
  if (tag.name === "form") add("action", "form-action", attribute("action"));
  if (tag.name === "button" || tag.name === "input") {
    add("formaction", "form-action", attribute("formaction"));
  }
  if (tag.name === "base") add("href", "base-uri", attribute("href"));
  if (tag.name === "image") add("href", "img-src", attribute("href"));
  if (tag.name === "input" && attribute("type")?.toLowerCase() === "image") {
    add("src", "img-src", attribute("src"));
  }

  if (tag.name === "link" && attribute("href")) {
    const relations = new Set((attribute("rel") ?? "").toLowerCase().split(/\s+/));
    const preloadType = (attribute("as") ?? "").toLowerCase();
    const preloadDirectives = {
      audio: "media-src",
      fetch: "connect-src",
      font: "font-src",
      image: "img-src",
      script: "script-src",
      style: "style-src",
      video: "media-src",
    };

    if (relations.has("stylesheet")) {
      add("href", "style-src", attribute("href"));
    } else if (relations.has("modulepreload")) {
      add("href", "script-src", attribute("href"));
    } else if (relations.has("preload") || relations.has("prefetch")) {
      add(
        "href",
        preloadDirectives[preloadType] ?? "default-src",
        attribute("href"),
      );
    } else if (
      relations.has("icon") ||
      relations.has("apple-touch-icon") ||
      relations.has("mask-icon")
    ) {
      add("href", "img-src", attribute("href"));
    } else if (relations.has("manifest")) {
      add("href", "manifest-src", attribute("href"));
    } else if (relations.has("preconnect") || relations.has("dns-prefetch")) {
      add("href", "connect-src", attribute("href"));
    }
  }

  return resources;
}

function cssRanges(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => ({
    end: match.index + match[0].length,
    start: match.index,
  }));
}

function isInsideRange(index, ranges) {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function stripCssComments(source) {
  let result = "";
  let quote;
  let cursor = 0;

  while (cursor < source.length) {
    const character = source[cursor];
    if (quote) {
      result += character;
      if (character === "\\" && cursor + 1 < source.length) {
        result += source[cursor + 1];
        cursor += 2;
        continue;
      }
      if (character === quote) quote = undefined;
      cursor += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      result += character;
      cursor += 1;
      continue;
    }
    if (character === "/" && source[cursor + 1] === "*") {
      const commentEnd = source.indexOf("*/", cursor + 2);
      const end = commentEnd === -1 ? source.length : commentEnd + 2;
      result += " ".repeat(end - cursor);
      cursor = end;
      continue;
    }

    result += character;
    cursor += 1;
  }

  return result;
}

function decodeCssEscapes(source) {
  return source.replace(
    /\\(?:([0-9a-f]{1,6})(?:\r\n|[ \n\r\t\f])?|(\r\n|[\n\r\f])|(.))/gis,
    (match, hexadecimal, escapedNewline, escapedCharacter) => {
      if (hexadecimal) {
        const codePoint = Number.parseInt(hexadecimal, 16);
        if (codePoint === 0 || codePoint > 0x10ffff) return "\ufffd";
        return String.fromCodePoint(codePoint);
      }
      if (escapedNewline) return "";
      return escapedCharacter ?? match;
    },
  );
}

function findCssFunctionContents(source, functionNamePattern) {
  const contents = [];
  const openingPattern = new RegExp(`${functionNamePattern}\\s*\\(`, "gi");

  for (const openingMatch of source.matchAll(openingPattern)) {
    let cursor = openingMatch.index + openingMatch[0].length;
    const contentStart = cursor;
    let parenthesesDepth = 1;
    let quote;
    while (cursor < source.length && parenthesesDepth > 0) {
      const character = source[cursor];
      if (quote) {
        if (character === "\\") {
          cursor += 2;
          continue;
        }
        if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "(") {
        parenthesesDepth += 1;
      } else if (character === ")") {
        parenthesesDepth -= 1;
      }
      cursor += 1;
    }
    if (parenthesesDepth === 0) {
      contents.push(source.slice(contentStart, cursor - 1));
    }
  }

  return contents;
}

function collectCssResources(css) {
  const source = decodeCssEscapes(stripCssComments(css));
  const resources = [];
  const importRanges = [];
  const importPattern =
    /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^'"\s);]+))\s*\)?[^;]*;/gi;

  for (const match of source.matchAll(importPattern)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value) {
      resources.push({ directiveName: "style-src", value });
      importRanges.push({
        end: match.index + match[0].length,
        start: match.index,
      });
    }
  }

  const fontFaceRanges = cssRanges(source, /@font-face\s*\{[^}]*\}/gi);
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"\s)]*))\s*\)/gi;
  for (const match of source.matchAll(urlPattern)) {
    if (isInsideRange(match.index, importRanges)) continue;
    const value = match[1] ?? match[2] ?? match[3];
    if (!value) continue;
    resources.push({
      directiveName: isInsideRange(match.index, fontFaceRanges)
        ? "font-src"
        : "img-src",
      value,
    });
  }

  for (const imageSet of findCssFunctionContents(
    source,
    "(?:-webkit-)?image-set",
  )) {
    const stringPattern = /(?:^|[,\s])(?:"([^"]*)"|'([^']*)')/g;
    for (const match of imageSet.matchAll(stringPattern)) {
      const value = match[1] ?? match[2];
      if (value) resources.push({ directiveName: "img-src", value });
    }
  }

  return [
    ...new Map(
      resources.map((resource) => [
        `${resource.directiveName}\u0000${resource.value}`,
        resource,
      ]),
    ).values(),
  ];
}

export function findCssViolations(css, policy, relativeFile = "styles.css") {
  const violations = [];
  for (const resource of collectCssResources(css)) {
    const sources = sourceListFor(policy, resource.directiveName);
    if (!isResourceAllowed(resource.value, sources)) {
      violations.push(
        `${relativeFile}: ${resource.value} from CSS is blocked by ${resource.directiveName}`,
      );
    }
  }
  return violations;
}

export function findCspViolations(html, policy, relativeFile = "index.html") {
  const violations = [];
  for (const tag of extractTags(html)) {
    const scriptSources = sourceListFor(policy, "script-src");
    const styleSources = sourceListFor(policy, "style-src");
    if (
      tag.name === "script" &&
      !tag.attributes.has("src") &&
      tag.content.trim() !== "" &&
      !scriptSources.includes("'unsafe-inline'")
    ) {
      violations.push(`${relativeFile}: inline script is blocked by script-src`);
    }
    if (
      ((tag.name === "style" && tag.content.trim() !== "") ||
        tag.attributes.has("style")) &&
      !styleSources.includes("'unsafe-inline'")
    ) {
      violations.push(`${relativeFile}: inline style is blocked by style-src`);
    }
    if (
      [...tag.attributes.keys()].some((attributeName) =>
        attributeName.startsWith("on"),
      ) &&
      !scriptSources.includes("'unsafe-inline'")
    ) {
      violations.push(
        `${relativeFile}: inline event handler is blocked by script-src`,
      );
    }

    if (tag.name === "style" && tag.content.trim() !== "") {
      violations.push(...findCssViolations(tag.content, policy, relativeFile));
    }
    if (tag.attributes.has("style")) {
      violations.push(
        ...findCssViolations(tag.attributes.get("style"), policy, relativeFile),
      );
    }

    for (const resource of collectResources(tag)) {
      const sources = sourceListFor(policy, resource.directiveName);
      if (!isResourceAllowed(resource.value, sources)) {
        violations.push(
          `${relativeFile}: ${resource.value} from ${tag.name}[${resource.attributeName}] is blocked by ${resource.directiveName}`,
        );
      }
    }
  }
  return violations;
}

async function findStaticFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findStaticFiles(entryPath);
      return entry.isFile() && /\.(?:css|html)$/i.test(entry.name)
        ? [entryPath]
        : [];
    }),
  );
  return nestedFiles.flat().sort();
}

function topLevelSections(html) {
  const mainOpeningTag = /<main\b[^>]*>/i.exec(html);
  if (!mainOpeningTag) return [];
  const mainContentStart = mainOpeningTag.index + mainOpeningTag[0].length;
  const mainContentEnd = html.indexOf("</main>", mainContentStart);
  if (mainContentEnd === -1) return [];

  const stack = [];
  const sections = [];
  const tagPattern = /<\/?([a-z][\w:-]*)\b[^>]*>/gi;
  const mainContent = html.slice(mainContentStart, mainContentEnd);
  for (const match of mainContent.matchAll(tagPattern)) {
    const tag = match[0];
    const name = match[1].toLowerCase();
    if (tag.startsWith("</")) {
      let openingIndex = -1;
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].name === name) {
          openingIndex = index;
          break;
        }
      }
      if (openingIndex === -1) continue;
      const openingTag = stack[openingIndex];
      if (name === "section" && openingIndex === 0 && openingTag.id) {
        sections.push({
          id: openingTag.id,
          markup: mainContent.slice(openingTag.start, match.index + tag.length),
        });
      }
      stack.length = openingIndex;
      continue;
    }

    if (name === "section" && stack.length === 0) {
      const id = /\bid=(["'])([^"']+)\1/i.exec(tag)?.[2];
      stack.push({ id, name, start: match.index });
      continue;
    }
    if (!VOID_ELEMENTS.has(name) && !/\/\s*>$/.test(tag)) stack.push({ name });
  }
  return sections;
}

function topLevelSectionIds(html) {
  return topLevelSections(html).map((section) => section.id);
}

export function validateLandingPageContract(html) {
  const sections = topLevelSections(html);
  const sectionIds = sections.map((section) => section.id);
  if (JSON.stringify(sectionIds) !== JSON.stringify(LANDING_SECTION_IDS)) {
    throw new Error(
      `Landing-page section IDs must be ${LANDING_SECTION_IDS.join(", ")} in order; found ${sectionIds.join(", ")}`,
    );
  }

  const referencesSvgFavicon = extractTags(html).some((tag) => {
    if (tag.name !== "link") return false;
    const relations = new Set(
      (tag.attributes.get("rel") ?? "").toLowerCase().split(/\s+/),
    );
    if (!relations.has("icon")) return false;
    if ((tag.attributes.get("type") ?? "").toLowerCase() !== "image/svg+xml") {
      return false;
    }

    try {
      return new URL(
        tag.attributes.get("href") ?? "",
        PRODUCTION_ORIGIN,
      ).pathname === "/favicon.svg";
    } catch {
      return false;
    }
  });
  if (!referencesSvgFavicon) {
    throw new Error("Landing-page HTML must reference /favicon.svg as an SVG favicon");
  }

  for (const [index, section] of sections.entries()) {
    const expectedLabel = `Fig. ${index + 1}. ${LANDING_SECTION_CAPTIONS[index]}`;
    const figureLabels = [...section.markup.matchAll(
      /<[^>]*\bclass=(["'])[^"']*\bfig-label\b[^"']*\1[^>]*>\s*([^<]+?)\s*<\/[^>]+>/gi,
    )].map((match) => match[2]);
    if (figureLabels.length !== 1 || figureLabels[0] !== expectedLabel) {
      throw new Error(
        `Landing-page figure labels must contain exactly "${expectedLabel}" in section ${section.id}; found ${figureLabels.join(", ") || "none"}`,
      );
    }
  }

  if (html.includes("\u2014")) {
    throw new Error("Landing-page HTML must not contain an em dash");
  }

  validateTimelineContract(html);
  validateInsightsContract(html);
}

export function validateTimelineContract(html) {
  const timeline = topLevelSections(html).find((section) => section.id === "timeline")?.markup ?? "";
  if (!/\bdata-slot=(['"])experience-01\1/i.test(timeline)) {
    throw new Error("Timeline must use the experience-01 registry block");
  }
  if (!/class=(['"])[^'"]*\bscreen-line-top\b[^'"]*\bscreen-line-bottom\b[^'"]*\1/i.test(timeline)) {
    throw new Error("Timeline experience-01 must preserve its top and bottom structural lines");
  }

  const organizationCount = [...timeline.matchAll(/\bdata-work-organization=(['"])true\1/gi)].length;
  const positionCount = [...timeline.matchAll(/\bdata-work-position=(['"])true\1/gi)].length;
  if (organizationCount !== 7 || positionCount !== 8) {
    throw new Error("Timeline must export seven organizations and eight profile positions");
  }

  const expectedPositionIds = [
    "singtel-fd-engineer",
    "singtel-intern",
    "citadel-founder",
    "saf-developer",
    "ncs-intern",
    "nullsec",
    "genesis",
    "homeless-hearts",
  ];
  const positionIds = [...timeline.matchAll(/\bdata-copy-id=(['"])([^'"]+)\1/gi)].map((match) => match[2]);
  if (JSON.stringify(positionIds) !== JSON.stringify(expectedPositionIds)) {
    throw new Error("Timeline must preserve every profile position in source order");
  }

  const disclosures = timeline.match(/<details(?=[^>]*\bdata-copy-disclosure=(['"])timeline\1)[\s\S]*?<\/details>/gi) ?? [];
  if (disclosures.length !== 8) {
    throw new Error("Timeline must export eight native summary disclosures");
  }
  for (const disclosure of disclosures) {
    if (/\sopen(?:=|\s|>)/i.test(disclosure.match(/^<details[^>]*>/)?.[0] ?? "")) {
      throw new Error("Timeline disclosures must be collapsed initially");
    }
    if (!/^<details[^>]*><summary[^>]*\baria-expanded=(['"])false\1/i.test(disclosure)) {
      throw new Error("Timeline disclosures must expose a collapsed native summary");
    }
    if (/<button\b/i.test(disclosure)) {
      throw new Error("Timeline disclosures must not add nested buttons");
    }
  }

  if (/shadcncraft|quaric|assets\.chanhdai\.com|<img\b/i.test(timeline)) {
    throw new Error("Timeline must not export registry demo organizations or external logos");
  }
}

const ANALYTICS_MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const committedAnalyticsSnapshot = JSON.parse(
  readFileSync(new URL("../content/analytics-snapshot.json", import.meta.url), "utf8"),
);

// Independent recomputation over the committed snapshot; mirrors
// lib/analytics-snapshot.ts, which this plain node script cannot import.
export function summarizeCommittedAnalytics(snapshot) {
  const [firstDay] = snapshot.days;
  return snapshot.days.reduce(
    (summary, day) => ({
      busiestDay: day.visits > summary.busiestDay.visits ? day : summary.busiestDay,
      sampled: summary.sampled || day.sampled,
      views: summary.views + day.views,
      visits: summary.visits + day.visits,
    }),
    { busiestDay: firstDay, sampled: false, views: 0, visits: 0 },
  );
}

export function formatCommittedAnalyticsDate(date) {
  const month = ANALYTICS_MONTH_LABELS[Number.parseInt(date.slice(5, 7), 10) - 1] ?? "";
  return [date.slice(8, 10), month, date.slice(0, 4)].filter(Boolean).join(" ");
}

export function validateInsightsContract(html, snapshot = committedAnalyticsSnapshot) {
  const summary = summarizeCommittedAnalytics(snapshot);
  const insights = topLevelSections(html).find((section) => section.id === "insights")?.markup ?? "";
  if (!insights.includes('data-registry-block="metrics-01"')) {
    throw new Error("Insights must use the metrics-01 registry block");
  }
  if (!/class=(['"])[^'"]*\bscreen-line-top\b[^'"]*\bscreen-line-bottom\b[^'"]*\1/i.test(insights)) {
    throw new Error("Insights metrics-01 must preserve its top and bottom structural lines");
  }
  if (!insights.includes('data-metrics-divider="true"')) {
    throw new Error("Insights metrics-01 must preserve its header divider");
  }

  const metricNames = [...insights.matchAll(/\bdata-insight-metric=(['"])([^'"]+)\1/gi)]
    .map((match) => match[2]);
  if (
    metricNames.length !== 3 ||
    JSON.stringify(metricNames) !== JSON.stringify(["visits", "views", "busiest-day"])
  ) {
    throw new Error("Insights must contain exactly visits, views, and busiest-day metrics");
  }

  const visitsMetric = insights.slice(
    insights.indexOf('data-insight-metric="visits"'),
    insights.indexOf('data-insight-metric="views"'),
  );
  const viewsMetric = insights.slice(
    insights.indexOf('data-insight-metric="views"'),
    insights.indexOf('data-insight-metric="busiest-day"'),
  );
  const busiestMetric = insights.slice(
    insights.indexOf('data-insight-metric="busiest-day"'),
    insights.indexOf('data-analytics-summary="true"'),
  );
  if (!new RegExp(`>30-day visits</dt>[\\s\\S]*>${summary.visits}</dd>`, "i").test(visitsMetric)) {
    throw new Error(`Insights must export the committed ${summary.visits}-visit total`);
  }
  if (!new RegExp(`>30-day views</dt>[\\s\\S]*>${summary.views}</dd>`, "i").test(viewsMetric)) {
    throw new Error(`Insights must export the committed ${summary.views}-view total`);
  }
  if (
    !/>Busiest day<\/dt>/i.test(busiestMetric) ||
    !new RegExp(`<time\\b[^>]*\\bdatetime=(['"])${summary.busiestDay.date}\\1`, "i").test(busiestMetric) ||
    !new RegExp(`>${summary.busiestDay.visits}(?:<!-- -->)? visits</span>`, "i").test(busiestMetric)
  ) {
    throw new Error(`Insights must export ${summary.busiestDay.date} as the committed busiest day`);
  }

  const expectedSummary = `Over the trailing 30 days, Cloudflare Web Analytics recorded ${summary.visits} visits and ${summary.views} views. The busiest day was ${formatCommittedAnalyticsDate(summary.busiestDay.date)} with ${summary.busiestDay.visits} visits.`;
  const escapedSummary = expectedSummary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(
    `<p[^>]*data-analytics-summary=(['"])true\\1[^>]*>${escapedSummary}</p>\\s*<div[^>]*data-bklit-line-chart=(['"])true\\2`,
    "i",
  ).test(insights)) {
    throw new Error("Insights must place the unchanged screen-reader summary immediately before the Bklit chart");
  }
  if (!/data-bklit-line-chart=(['"])true\1[^>]*data-series=(['"])visits views\2/i.test(insights)) {
    throw new Error("Insights Bklit chart must contain only visits and views series");
  }
  if (!insights.includes("Fig. 13. Daily visits and views, trailing 30 days. Source: Cloudflare Web Analytics, committed snapshot.")) {
    throw new Error("Insights must preserve the committed Cloudflare source caption");
  }
  if (summary.sampled !== insights.includes("Sampled estimate:")) {
    throw new Error(
      summary.sampled
        ? "Insights must preserve the sampled-data note"
        : "Insights must omit the sampled-data note for an unsampled snapshot",
    );
  }
  if (/<table\b|data-analytics-table|Daily data table|data-analytics-day/i.test(insights)) {
    throw new Error("Insights must not export a daily data table");
  }
  if (/Unique visitors|Sessions|Session duration|totalSessions|totalScreenViews|13,573|16,017|100,563|380\.563/i.test(insights)) {
    throw new Error("Insights must not export metrics-01 demo terminology or values");
  }
}

export function validateStructuredData(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter((match) => /\btype\s*=\s*(["'])application\/ld\+json\1/i.test(match[1]));

  if (scripts.length !== 1) {
    throw new Error(
      "JSON-LD must contain exactly one script with Person, WebSite, and ProfilePage",
    );
  }

  let structuredData;
  try {
    structuredData = JSON.parse(scripts[0][2]);
  } catch {
    throw new Error(
      "JSON-LD must contain exactly one script with Person, WebSite, and ProfilePage",
    );
  }

  const graph = structuredData?.["@graph"];
  const requiredTypes = ["Person", "WebSite", "ProfilePage"];
  if (
    structuredData?.["@context"] !== "https://schema.org" ||
    !Array.isArray(graph) ||
    requiredTypes.some((type) => graph.filter((entry) => entry?.["@type"] === type).length !== 1)
  ) {
    throw new Error(
      "JSON-LD must contain exactly one script with Person, WebSite, and ProfilePage",
    );
  }

  const person = graph.find((entry) => entry["@type"] === "Person");
  const website = graph.find((entry) => entry["@type"] === "WebSite");
  const profilePage = graph.find((entry) => entry["@type"] === "ProfilePage");
  const expectedSameAs = [
    "https://github.com/Leiruz",
    "https://www.linkedin.com/in/zuriel-shanley/",
  ];

  if (
    person.name !== "Zuriel Shanley Tanyory" ||
    person.url !== PRODUCTION_ORIGIN.origin ||
    typeof person.jobTitle !== "string" ||
    JSON.stringify(person.sameAs) !== JSON.stringify(expectedSameAs) ||
    profilePage.mainEntity?.["@id"] !== person["@id"] ||
    profilePage.isPartOf?.["@id"] !== website["@id"] ||
    typeof profilePage.dateModified !== "string" ||
    !Number.isFinite(Date.parse(profilePage.dateModified))
  ) {
    throw new Error("JSON-LD profile graph contains invalid public-profile values");
  }
}

export function validateNotFoundPage(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((match) => match[1].trim());

  if (titles.at(-1) !== "Page Not Found") {
    throw new Error("404.html must use Page Not Found as its effective head title");
  }
  if (
    !html.includes("FIG. 404. MISSING DOCUMENT") ||
    !/<a\b[^>]*\bhref=(["'])\/\1[^>]*>[\s\S]*?Return to the dossier[\s\S]*?<\/a>/i.test(html)
  ) {
    throw new Error("404.html must contain the branded dossier return route");
  }
  if (
    !/\bdata-not-found-mark=(?:["'])true(?:["'])/i.test(html) ||
    !/>\s*ZST\s*</i.test(html)
  ) {
    throw new Error("404.html must contain the static ZST mark");
  }
  if (!html.includes("The requested record is absent.")) {
    throw new Error("404.html must contain the missing-page copy");
  }
  if (
    /chanhdai|ncdai|daikanoid|departuremono|assets\.chanhdai\.com/i.test(html)
  ) {
    throw new Error("404.html must not contain upstream identity, artwork, or media");
  }
}

export function validateLandingRouteIsolation(html) {
  if (/\bp5\b|not-found-game/i.test(html)) {
    throw new Error("Landing HTML must not reference p5 or the not-found game");
  }
}

async function readRequiredExportFile(outputDirectory, relativePath) {
  const filePath = path.join(outputDirectory, relativePath);
  let fileStatus;
  try {
    fileStatus = await stat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`${filePath} is missing`);
    throw error;
  }
  if (!fileStatus.isFile()) throw new Error(`${filePath} is not a file`);
  return readFile(filePath, "utf8");
}

async function validateCapstoneExports(outputDirectory) {
  const [dossier, llms, vcard, notFound] = await Promise.all([
    readRequiredExportFile(outputDirectory, "dossier.md"),
    readRequiredExportFile(outputDirectory, "llms.txt"),
    readRequiredExportFile(outputDirectory, "zurielst.vcf"),
    readRequiredExportFile(outputDirectory, "404.html"),
  ]);

  if (
    !dossier.includes("Zuriel Shanley Tanyory") ||
    !dossier.includes("Forward Deployed AI & Automation Security Engineer")
  ) {
    throw new Error("dossier.md must contain Zuriel Shanley Tanyory and the primary role");
  }
  if (!llms.includes("https://zurielst.com/dossier.md")) {
    throw new Error("llms.txt must point to https://zurielst.com/dossier.md");
  }
  for (const value of [
    "BEGIN:VCARD",
    "FN:Zuriel Shanley Tanyory",
    "TITLE:Forward Deployed AI & Automation Security Engineer",
    "EMAIL:zurielst@u.nus.edu",
    "URL:https://zurielst.com",
    "https://www.linkedin.com/in/zuriel-shanley/",
  ]) {
    if (!vcard.includes(value)) throw new Error(`zurielst.vcf must contain ${value}`);
  }
  validateNotFoundPage(notFound);
}

export async function verifyBuildOutput(outputDirectory = path.resolve("out")) {
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const headersPath = path.join(resolvedOutputDirectory, "_headers");
  let headersStatus;
  try {
    headersStatus = await stat(headersPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${headersPath} is missing`);
    }
    throw error;
  }
  if (!headersStatus.isFile()) throw new Error(`${headersPath} is not a file`);

  const { policy } = validateHeadersFile(await readFile(headersPath, "utf8"));
  const staticFiles = await findStaticFiles(resolvedOutputDirectory);
  const htmlFiles = staticFiles.filter((file) =>
    file.toLowerCase().endsWith(".html"),
  );
  const cssFiles = staticFiles.filter((file) =>
    file.toLowerCase().endsWith(".css"),
  );
  const indexPath = path.join(resolvedOutputDirectory, "index.html");
  if (!htmlFiles.includes(indexPath)) {
    throw new Error(`${indexPath} is missing`);
  }

  const violations = [];
  for (const htmlFile of htmlFiles) {
    const relativeFile = path.relative(resolvedOutputDirectory, htmlFile);
    violations.push(
      ...findCspViolations(
        await readFile(htmlFile, "utf8"),
        policy,
        relativeFile,
      ),
    );
  }
  for (const cssFile of cssFiles) {
    const relativeFile = path.relative(resolvedOutputDirectory, cssFile);
    violations.push(
      ...findCssViolations(
        await readFile(cssFile, "utf8"),
        policy,
        relativeFile,
      ),
    );
  }
  if (violations.length > 0) {
    throw new Error(`CSP compatibility check failed:\n${violations.join("\n")}`);
  }

  const landingPage = await readFile(indexPath, "utf8");
  validateLandingPageContract(landingPage);
  validateLandingRouteIsolation(landingPage);
  validateStructuredData(landingPage);

  const resumePath = path.join(resolvedOutputDirectory, "media", "resume.pdf");
  let resumeStatus;
  try {
    resumeStatus = await stat(resumePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${resumePath} is missing`);
    }
    throw error;
  }
  if (!resumeStatus.isFile()) throw new Error(`${resumePath} is not a file`);

  await validateCapstoneExports(resolvedOutputDirectory);

  return { cssFileCount: cssFiles.length, htmlFileCount: htmlFiles.length, headersPath };
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    const result = await verifyBuildOutput(process.argv[2]);
    console.log(
      `Verified ${result.htmlFileCount} HTML files, ${result.cssFileCount} stylesheets, and out/_headers`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
