import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

let buildVerifier = {};
try {
  buildVerifier = await import("./verify-build.mjs");
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const temporaryDirectories = new Set();

const validHeaders = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  X-Frame-Options: DENY
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'

https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex
`;

function requireSubjectFunction(name) {
  assert.equal(
    typeof buildVerifier[name],
    "function",
    `scripts/verify-build.mjs must export ${name}`,
  );
  return buildVerifier[name];
}

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "verify-build-"));
  temporaryDirectories.add(directory);
  return directory;
}

after(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

test("parses path and absolute-host Cloudflare header rules", () => {
  const parseHeadersFile = requireSubjectFunction("parseHeadersFile");

  const rules = parseHeadersFile(validHeaders);

  assert.equal(rules.length, 2);
  assert.equal(rules[0].pattern, "/*");
  assert.equal(rules[0].headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    rules[1].pattern,
    "https://:version.:subdomain.workers.dev/*",
  );
  assert.equal(rules[1].headers.get("x-robots-tag"), "noindex");
});

test("rejects malformed and duplicate Cloudflare header entries", () => {
  const parseHeadersFile = requireSubjectFunction("parseHeadersFile");

  assert.throws(
    () => parseHeadersFile("/*\nX-Frame-Options: DENY\n"),
    /must be indented/,
  );
  assert.throws(
    () =>
      parseHeadersFile(
        "/*\n  X-Frame-Options: DENY\n  x-frame-options: SAMEORIGIN\n",
      ),
    /duplicate header/i,
  );
});

test("rejects a Cloudflare headers file with more than 100 rules", () => {
  const parseHeadersFile = requireSubjectFunction("parseHeadersFile");
  const oversizedHeaders = Array.from(
    { length: 101 },
    (_, index) => `/route-${index}\n  X-Test: value`,
  ).join("\n\n");

  assert.throws(() => parseHeadersFile(oversizedHeaders), /at most 100 rules/);
});

test("accepts the required global security policy and preview noindex rule", () => {
  const validateHeadersFile = requireSubjectFunction("validateHeadersFile");

  assert.doesNotThrow(() => validateHeadersFile(validHeaders));
});

test("rejects HSTS and missing preview noindex coverage", () => {
  const validateHeadersFile = requireSubjectFunction("validateHeadersFile");

  assert.throws(
    () =>
      validateHeadersFile(
        validHeaders.replace(
          "  Referrer-Policy: strict-origin-when-cross-origin\n",
          "  Referrer-Policy: strict-origin-when-cross-origin\n  Strict-Transport-Security: max-age=31536000\n",
        ),
      ),
    /must not set Strict-Transport-Security/,
  );
  assert.throws(
    () => validateHeadersFile(validHeaders.split("\nhttps://")[0]),
    /preview.*noindex/i,
  );
});

test("allows self-hosted resources, inline Next scripts, data images, and outbound links", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html = `<!doctype html>
    <html><head>
      <link rel="stylesheet" href="/_next/static/app.css">
      <link rel="preload" as="font" href="/_next/static/font.woff2" crossorigin>
    </head><body style="color: black">
      <a href="https://github.com/Leiruz">GitHub</a>
      <img src="data:image/svg+xml;base64,PHN2Zy8+" alt="fixture">
      <script src="/_next/static/app.js"></script>
      <script>self.__next_f = [];</script>
    </body></html>`;

  assert.deepEqual(findCspViolations(html, policy, "index.html"), []);
});

test("reports external script, stylesheet, and image hosts blocked by CSP", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html = `<!doctype html>
    <link rel="stylesheet" href="https://styles.example/app.css">
    <img src="https://images.example/portrait.png" alt="fixture">
    <script src="https://scripts.example/app.js"></script>`;

  const violations = findCspViolations(html, policy, "nested/page.html");

  assert.equal(violations.length, 3);
  assert.match(violations.join("\n"), /styles\.example.*style-src/);
  assert.match(violations.join("\n"), /images\.example.*img-src/);
  assert.match(violations.join("\n"), /scripts\.example.*script-src/);
});

test("decodes numeric URL entities before applying CSP", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );

  const violations = findCspViolations(
    '<script src="https&#58;//cdn.example/app.js"></script>',
    policy,
    "encoded.html",
  );

  assert.equal(violations.length, 1);
  assert.match(violations[0], /https:\/\/cdn\.example.*script-src/);
});

test("decodes browser URL whitespace entities before applying CSP", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html = `
    <script src="htt&Tab;ps://tabs.example/app.js"></script>
    <script src="htt&NewLine;ps://lines.example/app.js"></script>`;

  const violations = findCspViolations(html, policy, "entities.html");

  assert.equal(violations.length, 2);
  assert.match(violations.join("\n"), /tabs\.example.*script-src/);
  assert.match(violations.join("\n"), /lines\.example.*script-src/);
});

test("checks every srcset candidate after a data URL", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html =
    '<img srcset="data:image/svg+xml;base64,PHN2Zy8+ 1x, https://images.example/large.png 2x" alt="fixture">';

  const violations = findCspViolations(html, policy, "srcset.html");

  assert.equal(violations.length, 1);
  assert.match(violations[0], /images\.example.*img-src/);
});

test("uses the browser-effective first duplicate resource attribute", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html =
    '<script src="https://cdn.example/app.js" src="/app.js"></script>';

  const violations = findCspViolations(html, policy, "duplicate.html");

  assert.equal(violations.length, 1);
  assert.match(violations[0], /cdn\.example.*script-src/);
});

test("checks manifest, form target, and SVG script resource URLs", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html = `
    <link rel="manifest" href="https://manifest.example/site.webmanifest">
    <button formaction="https://forms.example/submit">Submit</button>
    <svg><script href="https://scripts.example/app.js"></script></svg>`;

  const violations = findCspViolations(html, policy, "resources.html");

  assert.equal(violations.length, 3);
  assert.match(violations.join("\n"), /manifest\.example.*manifest-src/);
  assert.match(violations.join("\n"), /forms\.example.*form-action/);
  assert.match(violations.join("\n"), /scripts\.example.*script-src/);
});

test("checks fetched URLs inside inline CSS", () => {
  const findCspViolations = requireSubjectFunction("findCspViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const html = `
    <style>
      @import url("https://styles.example/theme.css");
      @font-face { font-family: Fixture; src: url("https://fonts.example/font.woff2"); }
    </style>
    <div style="background-image: url('https://images.example/bg.png')"></div>`;

  const violations = findCspViolations(html, policy, "styles.html");

  assert.equal(violations.length, 3);
  assert.match(violations.join("\n"), /styles\.example.*style-src/);
  assert.match(violations.join("\n"), /fonts\.example.*font-src/);
  assert.match(violations.join("\n"), /images\.example.*img-src/);
});

test("decodes CSS escapes and checks image-set string candidates", () => {
  const findCssViolations = requireSubjectFunction("findCssViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const css = String.raw`
    @import "https\3a //styles.example/theme.css";
    .fixture {
      background-image: image-set("https://images.example/one.png" 1x, url("/two.png") 2x);
    }`;

  const violations = findCssViolations(css, policy, "encoded.css");

  assert.equal(violations.length, 2);
  assert.match(violations.join("\n"), /styles\.example.*style-src/);
  assert.match(violations.join("\n"), /images\.example.*img-src/);
});

test("does not treat comment markers inside CSS strings as comments", () => {
  const findCssViolations = requireSubjectFunction("findCssViolations");
  const parseContentSecurityPolicy = requireSubjectFunction(
    "parseContentSecurityPolicy",
  );
  const globalRule = requireSubjectFunction("parseHeadersFile")(validHeaders)[0];
  const policy = parseContentSecurityPolicy(
    globalRule.headers.get("content-security-policy"),
  );
  const css = `
    .before::before { content: "/*"; }
    .fixture { background-image: url("https://images.example/bg.png"); }
    .after::after { content: "*/"; }`;

  const violations = findCssViolations(css, policy, "comments.css");

  assert.equal(violations.length, 1);
  assert.match(violations[0], /images\.example.*img-src/);
});

test("verifies every exported HTML file, not only the landing page", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeFile(path.join(outputDirectory, "_headers"), validHeaders);
  await writeFile(
    path.join(outputDirectory, "index.html"),
    '<!doctype html><script src="/app.js"></script>',
  );
  await mkdir(path.join(outputDirectory, "nested"));
  await writeFile(
    path.join(outputDirectory, "nested", "page.html"),
    '<!doctype html><script src="https://cdn.example/app.js"></script>',
  );

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /nested[\\/]page\.html.*cdn\.example/,
  );
});

test("verifies URLs fetched by exported stylesheets", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeFile(path.join(outputDirectory, "_headers"), validHeaders);
  await writeFile(
    path.join(outputDirectory, "index.html"),
    '<!doctype html><link rel="stylesheet" href="/app.css">',
  );
  await writeFile(
    path.join(outputDirectory, "app.css"),
    '.fixture { background: url("https://images.example/bg.png"); }',
  );

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /app\.css.*images\.example.*img-src/,
  );
});

test("checks exported HTML and CSS extensions case-insensitively", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeFile(path.join(outputDirectory, "_headers"), validHeaders);
  await writeFile(path.join(outputDirectory, "index.html"), "<!doctype html>");
  await writeFile(
    path.join(outputDirectory, "EXTRA.HTML"),
    '<!doctype html><script src="https://scripts.example/app.js"></script>',
  );
  await writeFile(
    path.join(outputDirectory, "APP.CSS"),
    '.fixture { background: url("https://images.example/bg.png"); }',
  );

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /(?:EXTRA\.HTML.*scripts\.example|APP\.CSS.*images\.example)/,
  );
});

test("the authored public headers pass the same production validator", async () => {
  const validateHeadersFile = requireSubjectFunction("validateHeadersFile");
  const source = await readFile(
    new URL("../public/_headers", import.meta.url),
    "utf8",
  ).catch((error) => (error?.code === "ENOENT" ? "" : Promise.reject(error)));

  assert.doesNotThrow(() => validateHeadersFile(source));
});
