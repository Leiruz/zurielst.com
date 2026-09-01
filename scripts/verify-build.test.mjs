import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

let buildVerifier = {};
try {
  buildVerifier = await import("./verify-build.mjs");
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const nextConfigModule = await import("../next.config.mjs");

const temporaryDirectories = new Set();

test("prefers BUILD_SHA over other environment sources and Git", () => {
  const resolveBuildSha = Reflect.get(nextConfigModule, "resolveBuildSha");
  let gitCallCount = 0;
  const successfulGit = () => {
    gitCallCount += 1;
    return "git-sha\n";
  };

  assert.equal(typeof resolveBuildSha, "function");
  if (typeof resolveBuildSha !== "function") return;

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: " build-sha ",
    GITHUB_SHA: "github-sha",
    CF_PAGES_COMMIT_SHA: "cloudflare-sha",
  }), "build-sha");
  assert.equal(gitCallCount, 0);
});

test("prefers GITHUB_SHA after skipping an empty BUILD_SHA", () => {
  const resolveBuildSha = Reflect.get(nextConfigModule, "resolveBuildSha");
  let gitCallCount = 0;
  const successfulGit = () => {
    gitCallCount += 1;
    return "git-sha\n";
  };

  assert.equal(typeof resolveBuildSha, "function");
  if (typeof resolveBuildSha !== "function") return;

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: " ",
    GITHUB_SHA: " github-sha ",
    CF_PAGES_COMMIT_SHA: "cloudflare-sha",
  }), "github-sha");
  assert.equal(gitCallCount, 0);
});

test("uses CF_PAGES_COMMIT_SHA after skipping empty higher-priority values", () => {
  const resolveBuildSha = Reflect.get(nextConfigModule, "resolveBuildSha");
  let gitCallCount = 0;
  const successfulGit = () => {
    gitCallCount += 1;
    return "git-sha\n";
  };

  assert.equal(typeof resolveBuildSha, "function");
  if (typeof resolveBuildSha !== "function") return;

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: "",
    GITHUB_SHA: "\t",
    CF_PAGES_COMMIT_SHA: " cloudflare-sha ",
  }), "cloudflare-sha");
  assert.equal(gitCallCount, 0);
});

test("falls back to dev locally without consulting Git", () => {
  const resolveBuildSha = Reflect.get(nextConfigModule, "resolveBuildSha");
  let gitCallCount = 0;
  const successfulGit = () => {
    gitCallCount += 1;
    return "git-sha\n";
  };

  assert.equal(typeof resolveBuildSha, "function");
  if (typeof resolveBuildSha !== "function") return;

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: " ",
    GITHUB_SHA: "",
    CF_PAGES_COMMIT_SHA: "\n",
  }), "dev");
  assert.equal(gitCallCount, 0);
});

test("returns dev when Git is unavailable and no deployment environment value exists", () => {
  const resolveBuildSha = Reflect.get(nextConfigModule, "resolveBuildSha");
  const throwingGit = () => {
    throw new Error("git unavailable");
  };

  assert.equal(typeof resolveBuildSha, "function");
  if (typeof resolveBuildSha !== "function") return;

  assert.equal(resolveBuildSha(throwingGit, {}), "dev");
});

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

const validStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://zurielst.com/#person",
      name: "Zuriel Shanley Tanyory",
      url: "https://zurielst.com",
      jobTitle: "Forward Deployed AI & Automation Security Engineer",
      sameAs: [
        "https://github.com/Leiruz",
        "https://www.linkedin.com/in/zuriel-shanley/",
        "https://www.instagram.com/zureal.st",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://zurielst.com/#website",
      url: "https://zurielst.com",
    },
    {
      "@type": "ProfilePage",
      "@id": "https://zurielst.com/#profile",
      url: "https://zurielst.com",
      dateModified: "2026-08-31T04:05:06.000Z",
      mainEntity: { "@id": "https://zurielst.com/#person" },
      isPartOf: { "@id": "https://zurielst.com/#website" },
    },
  ],
};

const validStructuredDataMarkup = `<script type="application/ld+json">${JSON.stringify(validStructuredData)}</script>`;

const validLandingPage = `<!doctype html>
  <head><link rel="icon" type="image/svg+xml" href="/favicon.svg">${validStructuredDataMarkup}</head>
  <main>
    <section id="identity"><p class="fig-label">Fig. 1. Identity</p></section>
    <section id="intro"><p class="fig-label">Fig. 2. Introduction</p></section>
    <section id="brands"><p class="fig-label">Fig. 3. Worked with</p></section>
    <section id="capabilities"><p class="fig-label">Fig. 4. Capabilities</p></section>
    <section id="stack"><p class="fig-label">Fig. 5. Stack</p></section>
    <section id="work"><p class="fig-label">Fig. 6. Selected work</p></section>
    <section id="timeline"><p class="fig-label">Fig. 7. Timeline</p><div data-slot="experience-01" class="max-w-screen overflow-x-clip"><div class="container mx-auto px-4"><div class="border-x border-line py-8"><h2 class="screen-line-top screen-line-bottom">Timeline</h2><div data-slot="work-experience"><article data-work-organization="true"><h3>Singtel</h3><ol><li data-work-position="true"><h4>Forward Deployed AI &amp; Automation Security Engineer</h4><p>Aug 2026 to present</p><details data-copy-disclosure="timeline" data-copy-id="singtel-fd-engineer"><summary aria-expanded="false">Read more</summary><p>I build customised AI and automation solutions for Singtel MSSP with SMEs.</p></details></li><li data-work-position="true"><h4>Cybersecurity Consultant Intern</h4><p>May 2026 to Aug 2026</p><details data-copy-disclosure="timeline" data-copy-id="singtel-intern"><summary aria-expanded="false">Read more</summary><p>Akamai WAF API automation for reporting; developed ConfigProof AI for vendor security risk assurance.</p></details></li></ol></article><article data-work-organization="true"><h3>CiTaDel Cybersecurity Solutions</h3><ol><li data-work-position="true"><h4>Founder</h4><p>Mar 2023 to May 2026</p><details data-copy-disclosure="timeline" data-copy-id="citadel-founder"><summary aria-expanded="false">Read more</summary><p>Affordable, open-source SOC for SMEs: 80% lower SOC cost, up to 90% detection uplift, deep learning in SOC workflows cutting false positives by 20%.</p></details></li></ol></article><article data-work-organization="true"><h3>Singapore Armed Forces</h3><ol><li data-work-position="true"><h4>Full-Stack Web Developer</h4><p>Jan 2023 to Mar 2023</p><details data-copy-disclosure="timeline" data-copy-id="saf-developer"><summary aria-expanded="false">Read more</summary><p>Led a four-person team digitizing paper-based processes with a 3-tier web application; efficiency and cost improved by up to 20%.</p></details></li></ol></article><article data-work-organization="true"><h3>NCS Pte Ltd</h3><ol><li data-work-position="true"><h4>Cybersecurity Consultant Intern</h4><p>Aug 2021 to Feb 2022</p><details data-copy-disclosure="timeline" data-copy-id="ncs-intern"><summary aria-expanded="false">Read more</summary><p>Installed, configured and troubleshot EDR for government-managed endpoints: 40% increase in threat detection, 99.9% uptime, and recognition as the Carbon Black subject matter expert.</p></details></li></ol></article><article data-work-organization="true"><h3>NullSec</h3><ol><li data-work-position="true"><h4>Head of Publicity</h4><p>Apr 2019 to May 2021</p><details data-copy-disclosure="timeline" data-copy-id="nullsec"><summary aria-expanded="false">Read more</summary><p>Helped organize the Lag n Crash inter-poly CTF and plan the YCEP CTF and the annual Hack'n'Flag CTF.</p></details></li></ol></article><article data-work-organization="true"><h3>Genesis</h3><ol><li data-work-position="true"><h4>Vice-President of Startup</h4><p>Apr 2019 to May 2021</p><details data-copy-disclosure="timeline" data-copy-id="genesis"><summary aria-expanded="false">Read more</summary><p>Nominated into the Zero to One Entrepreneurship Program with Meet Ventures and NUS Business School; the runway CiTaDel launched from.</p></details></li></ol></article><article data-work-organization="true"><h3>Homeless Hearts of Singapore</h3><ol><li data-work-position="true"><h4>Volunteer</h4><p>Jun 2021 to Dec 2022</p><details data-copy-disclosure="timeline" data-copy-id="homeless-hearts"><summary aria-expanded="false">Read more</summary><p>Befriended and distributed food and basic necessities to people in need during the pandemic.</p></details></li></ol></article></div></div></div></div></section>
    <section id="education"><p class="fig-label">Fig. 8. Education</p></section>
    <section id="proof"><p class="fig-label">Fig. 9. Accolades</p></section>
    <section id="products"><p class="fig-label">Fig. 10. Products</p></section>
    <section id="testimonials"><p class="fig-label">Fig. 11. Testimonials</p></section>
    <section id="faq"><p class="fig-label">Fig. 12. FAQ</p></section>
    <section id="insights">
      <p class="fig-label">Fig. 13. Insights</p>
      <div data-registry-block="metrics-01" class="screen-line-top screen-line-bottom">
        <div data-metrics-divider="true"></div>
        <dl>
          <div data-insight-metric="visits"><dt>30-day visits</dt><dd>40</dd></div>
          <div data-insight-metric="views"><dt>30-day views</dt><dd>60</dd></div>
          <div data-insight-metric="busiest-day"><dt>Busiest day</dt><dd><time datetime="2026-08-30">30 Aug</time><span>40 visits</span></dd></div>
        </dl>
        <p data-analytics-summary="true" class="sr-only">Over the trailing 30 days, Cloudflare Web Analytics recorded 40 visits and 60 views. The busiest day was 30 Aug 2026 with 40 visits.</p>
        <div data-bklit-line-chart="true" data-series="visits views"></div>
        <figcaption>Fig. 13. Daily visits and views, trailing 30 days. Source: Cloudflare Web Analytics, committed snapshot.</figcaption>
        <p>Sampled estimate: at least one daily count was reported from an adaptively sampled interval.</p>
      </div>
    </section>
    <section id="contact"><p class="fig-label">Fig. 14. Contact</p></section>
  </main>`;

const validNotFoundPage = '<!doctype html><html><head><title>Page Not Found</title></head><body><p>FIG. 404. MISSING DOCUMENT</p><p data-not-found-mark="true">ZST</p><h1>The requested record is absent.</h1><a href="/">Return to the dossier</a></body></html>';

// The fixture markup encodes these analytics values; binding them as the
// test default decouples fixture tests from the weekly-refreshed committed
// snapshot, which only the real build pipeline validates against.
const fixtureAnalyticsSnapshot = {
  days: [{ date: "2026-08-30", views: 60, visits: 40, sampled: true }],
};

function requireSubjectFunction(name) {
  assert.equal(
    typeof buildVerifier[name],
    "function",
    `scripts/verify-build.mjs must export ${name}`,
  );
  const fn = buildVerifier[name];
  if (name === "validateLandingPageContract" || name === "validateInsightsContract") {
    return (html, snapshot = fixtureAnalyticsSnapshot) => fn(html, snapshot);
  }
  if (name === "verifyBuildOutput") {
    return (outputDirectory, snapshot = fixtureAnalyticsSnapshot) =>
      fn(outputDirectory, snapshot);
  }
  return fn;
}

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "verify-build-"));
  temporaryDirectories.add(directory);
  return directory;
}

async function readOptionalSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8")
    .catch((error) => (error?.code === "ENOENT" ? "" : Promise.reject(error)));
}

async function writeValidCapstoneExport(
  outputDirectory,
  { landingPage = validLandingPage, omit = [] } = {},
) {
  const omitted = new Set(omit);
  await writeFile(path.join(outputDirectory, "_headers"), validHeaders);
  await writeFile(path.join(outputDirectory, "index.html"), landingPage);
  await mkdir(path.join(outputDirectory, "media"), { recursive: true });
  await writeFile(path.join(outputDirectory, "media", "resume.pdf"), "resume");

  const files = new Map([
    ["404.html", validNotFoundPage],
    ["dossier.md", "# Zuriel Shanley Tanyory\n\nForward Deployed AI & Automation Security Engineer\n"],
    ["llms.txt", "# zurielst.com\n\n- [Full public dossier](https://zurielst.com/dossier.md)\n"],
    ["zurielst.vcf", "BEGIN:VCARD\nFN:Zuriel Shanley Tanyory\nTITLE:Forward Deployed AI & Automation Security Engineer\nEMAIL:zurielst@u.nus.edu\nURL:https://zurielst.com\nURL;TYPE=LinkedIn:https://www.linkedin.com/in/zuriel-shanley/\nEND:VCARD\n"],
  ]);

  await Promise.all(
    [...files].filter(([name]) => !omitted.has(name)).map(([name, contents]) =>
      writeFile(path.join(outputDirectory, name), contents),
    ),
  );
}

test("keeps the staged not-found registry manifest byte-exact", async () => {
  const manifest = await readFile(
    new URL("../registry-stage/not-found-01.json", import.meta.url),
  );

  assert.equal(manifest.byteLength, 21688);
  assert.equal(
    createHash("sha256").update(manifest).digest("hex"),
    "fba756a446d848845eba5b2edd12d07b1697f27dcf7fa2b71bd4dd9dcc4a4f34",
  );
});

test("keeps the staged Bklit line-chart payload byte-exact", async () => {
  const manifest = await readFile(
    new URL("../registry-stage/bklit-line-chart.json", import.meta.url),
  );

  assert.equal(manifest.byteLength, 101750);
  assert.equal(
    createHash("sha256").update(manifest).digest("hex"),
    "5f02c2f5c45c8a8405d452fae901e018b4a7c05e4c33127e86528ff0173653ff",
  );
});

test("retains the Bklit MIT notice and the imported line-chart closure", async () => {
  const bklitRoot = new URL("../components/registry/bklit/", import.meta.url);
  const license = await readFile(new URL("LICENSE", bklitRoot), "utf8");
  const adapter = await readFile(new URL("analytics-line-chart.tsx", bklitRoot), "utf8");
  const paths = await readdir(bklitRoot, { recursive: true });
  const sourcePaths = paths.filter((relativePath) => /\.(?:ts|tsx)$/.test(relativePath));
  const sources = await Promise.all(sourcePaths.map((relativePath) =>
    readFile(new URL(relativePath.replaceAll("\\", "/"), bklitRoot), "utf8"),
  ));

  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 uixmat/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
  assert.equal(sourcePaths.length, 67);
  assert.ok(sourcePaths.includes(path.join("charts", "line-chart.tsx")));
  assert.ok(sourcePaths.includes("analytics-line-chart.tsx"));
  assert.ok(sourcePaths.includes("analytics-line-chart-loader.tsx"));
  assert.ok(!sourcePaths.includes(path.join("charts", "x-axis.tsx")));
  assert.ok(sources.every((source) => !source.includes("packages/studio")));
  assert.deepEqual(
    [...adapter.matchAll(/dataKey="([^"]+)"/g)].map((match) => match[1]),
    ["views", "visits"],
  );
});

test("routes metrics-01 chart data through the shared analytics builder", async () => {
  const [analyticsSource, metricsSource, adapterSource] = await Promise.all([
    readFile(new URL("../lib/analytics-snapshot.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/registry/metrics-01.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/registry/bklit/analytics-line-chart.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(analyticsSource, /series:\s*AnalyticsChartSeriesPoint\[\]/);
  assert.match(metricsSource, /const chart = buildAnalyticsChart\(data\.days\)/);
  assert.match(metricsSource, /<AnalyticsLineChartLoader data=\{chart\.series\}/);
  assert.doesNotMatch(adapterSource, /\.map\(/);
});

test("declares the manifest-pinned p5 runtime and type packages", async () => {
  const packageJson = JSON.parse(await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));

  assert.equal(packageJson.dependencies.p5, "^1.9.4");
  assert.equal(packageJson.devDependencies["@types/p5"], "^1.7.7");
});

test("guards the route-only game import before loading its canvas", async () => {
  const loader = await readOptionalSource(
    "../components/registry/not-found-game-loader.tsx",
  );

  assert.match(loader, /matchMedia\(['"]\(prefers-reduced-motion: reduce\)['"]\)\.matches/);
  assert.match(loader, /import\(['"]\.\/not-found-game-canvas['"]\)/);
  assert.match(loader, /if\s*\([^)]*(?:reducedMotion|prefersReducedMotion)[^)]*\)\s*(?:\{|return)/);
  assert.match(loader, /<button\b/);
});

test("keeps keyboard control focus-scoped and the p5 game primitive-only", async () => {
  const canvas = await readOptionalSource(
    "../components/registry/not-found-game-canvas.tsx",
  );

  assert.match(canvas, /onKeyDown=/);
  assert.match(canvas, /onKeyUp=/);
  assert.match(canvas, /aria-live=["']polite["']/);
  assert.match(canvas, /\bp\.(?:rect|circle|ellipse|line|text)\s*\(/);
  assert.doesNotMatch(canvas, /(?:window|document)\.addEventListener\([^\n]*(?:key|keypress)/i);
  assert.doesNotMatch(canvas, /\b(?:loadImage|loadFont|loadSound|createAudio)\s*\(|https?:\/\//i);
});

test("keeps adapted 404 runtime source free of upstream identity and media", async () => {
  const sources = await Promise.all([
    readOptionalSource("../app/not-found.tsx"),
    readOptionalSource("../components/registry/not-found-game-loader.tsx"),
    readOptionalSource("../components/registry/not-found-game-canvas.tsx"),
  ]);
  const runtime = sources.join("\n");

  assert.doesNotMatch(
    runtime,
    /chanhdai|ncdai|daikanoid|departuremono|assets\.chanhdai\.com|\b(?:loadImage|loadFont|loadSound|createAudio)\b/i,
  );
});

test("rejects p5 or not-found game references from landing HTML", () => {
  const validateLandingRouteIsolation = requireSubjectFunction(
    "validateLandingRouteIsolation",
  );

  assert.throws(
    () => validateLandingRouteIsolation(`${validLandingPage}<script src="/p5-game.js"></script>`),
    /landing.*(?:p5|not-found game)/i,
  );
  assert.doesNotThrow(() => validateLandingRouteIsolation(validLandingPage));
});

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

test("accepts the ordered landing-page section and figure contract", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.doesNotThrow(() => validateLandingPageContract(validLandingPage));
});

test("requires the exported experience-01 Timeline shell and every profile position", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.doesNotThrow(() => validateLandingPageContract(validLandingPage));
  for (const [needle, replacement] of [
    ['data-slot="experience-01"', 'data-slot="other"'],
    ['screen-line-top screen-line-bottom', 'screen-line-top'],
    ['data-work-organization="true"', 'data-work-organization="false"'],
    ['data-work-position="true"', 'data-work-position="false"'],
    ['data-copy-id="homeless-hearts"', 'data-copy-id="missing-position"'],
    ['aria-expanded="false"', 'aria-expanded="true"'],
    ['<details data-copy-disclosure="timeline"', '<details open data-copy-disclosure="timeline"'],
    ['<h3>Singtel</h3>', '<h3>shadcncraft</h3>'],
    ['<h3>Singtel</h3>', '<img src="https://assets.chanhdai.com/images/companies/shadcncraft.svg"><h3>Singtel</h3>'],
  ]) {
    assert.throws(
      () => validateLandingPageContract(validLandingPage.replace(needle, replacement)),
      /Timeline/i,
    );
  }
});

test("requires the exported metrics-01 Insights values and chart contract", () => {
  const validateInsightsContract = requireSubjectFunction(
    "validateInsightsContract",
  );

  assert.doesNotThrow(() => validateInsightsContract(validLandingPage));
  for (const [needle, replacement] of [
    ['data-registry-block="metrics-01"', 'data-registry-block="other"'],
    [">40</dd>", ">41</dd>"],
    [">60</dd>", ">61</dd>"],
    ['datetime="2026-08-30"', 'datetime="2026-08-29"'],
    ['data-series="visits views"', 'data-series="sessions views"'],
    ["Source: Cloudflare Web Analytics, committed snapshot.", "Source: demo."],
    ["Sampled estimate:", "Estimate:"],
  ]) {
    assert.throws(
      () => validateInsightsContract(validLandingPage.replace(needle, replacement)),
      /Insights/i,
    );
  }
});

test("insights contract derives its expectations from the provided snapshot", () => {
  const validateInsightsContract = requireSubjectFunction(
    "validateInsightsContract",
  );
  const shifted = {
    days: [{ ...fixtureAnalyticsSnapshot.days[0], visits: 41 }],
  };
  assert.throws(() => validateInsightsContract(validLandingPage, shifted), /Insights/i);

  const unsampled = {
    days: [{ ...fixtureAnalyticsSnapshot.days[0], sampled: false }],
  };
  assert.throws(
    () => validateInsightsContract(validLandingPage, unsampled),
    /omit the sampled-data note/i,
  );
  assert.doesNotThrow(() => validateInsightsContract(
    validLandingPage.replace(/<p[^>]*>\s*Sampled estimate:[\s\S]*?<\/p>/i, ""),
    unsampled,
  ));
});

test("requires the exported landing page to reference the SVG favicon", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.throws(
    () => validateLandingPageContract(
      validLandingPage.replace(/\s*<link rel="icon"[^>]*>/, ""),
    ),
    /favicon/i,
  );
});

test("rejects missing and unordered landing-page section IDs", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.throws(
    () => validateLandingPageContract(validLandingPage.replace(/\s*<section id="brands">[\s\S]*?<\/section>/, "")),
    /section IDs/i,
  );
  assert.throws(
    () => validateLandingPageContract(validLandingPage
      .replace('id="stack"', 'id="section-swap"')
      .replace('id="brands"', 'id="stack"')
      .replace('id="section-swap"', 'id="brands"')),
    /section IDs/i,
  );
  assert.throws(
    () => validateLandingPageContract(validLandingPage
      .replace('</section>\n    <section id="brands">', '<section id="brands"></section></section>\n    <section>')),
    /section IDs/i,
  );
});

test("rejects incorrect landing-page figure numbers", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.throws(
    () => validateLandingPageContract(validLandingPage.replace("Fig. 8. Education", "Fig. 7. Education")),
    /figure labels/i,
  );
});

test("rejects an orphaned figure label when its required section has none", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );
  const workSection = '<section id="work"><p class="fig-label">Fig. 6. Selected work</p></section>';

  assert.throws(
    () => validateLandingPageContract(validLandingPage.replace(
      workSection,
      '<p class="fig-label">Fig. 6. Selected work</p><section id="work"></section>',
    )),
    /figure labels/i,
  );
});

test("rejects a figure label with the right number and wrong caption", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.throws(
    () => validateLandingPageContract(
      validLandingPage.replace("Fig. 6. Selected work", "Fig. 6. Timeline"),
    ),
    /figure labels/i,
  );
});

test("rejects an em dash in exported landing-page HTML", () => {
  const validateLandingPageContract = requireSubjectFunction(
    "validateLandingPageContract",
  );

  assert.throws(
    () => validateLandingPageContract(`${validLandingPage}<p>not allowed \u2014 here</p>`),
    /em dash/i,
  );
});

test("requires the exported resume PDF to be a file", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeFile(path.join(outputDirectory, "_headers"), validHeaders);
  await writeFile(path.join(outputDirectory, "index.html"), validLandingPage);

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /media[\\/]resume\.pdf.*missing/i,
  );
});

for (const requiredFile of ["dossier.md", "llms.txt", "zurielst.vcf", "404.html"]) {
  test(`requires the exported ${requiredFile} capstone artifact`, async () => {
    const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
    const outputDirectory = await createTemporaryDirectory();
    await writeValidCapstoneExport(outputDirectory, { omit: [requiredFile] });

    await assert.rejects(
      verifyBuildOutput(outputDirectory),
      new RegExp(requiredFile.replace(".", "\\."), "i"),
    );
  });
}

test("requires one valid Person, WebSite, and ProfilePage JSON-LD graph", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeValidCapstoneExport(outputDirectory, {
    landingPage: validLandingPage.replace(validStructuredDataMarkup, ""),
  });

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /JSON-LD.*Person.*WebSite.*ProfilePage/i,
  );
});

test("accepts all three approved public profiles in the JSON-LD graph", () => {
  const validateStructuredData = requireSubjectFunction("validateStructuredData");

  assert.doesNotThrow(() => validateStructuredData(validStructuredDataMarkup));
  assert.throws(
    () => validateStructuredData(
      validStructuredDataMarkup.replace(
        ',"https://www.instagram.com/zureal.st"',
        "",
      ),
    ),
    /JSON-LD.*public-profile values/i,
  );
});

test("requires the effective exported 404 head title", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeValidCapstoneExport(outputDirectory);
  await writeFile(
    path.join(outputDirectory, "404.html"),
    "<!doctype html><html><head><title>Wrong title</title></head><body>FIG. 404. MISSING DOCUMENT</body></html>",
  );

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /404.*Page Not Found/i,
  );
});

test("requires the ZST mark and missing-page copy in exported 404 HTML", () => {
  const validateNotFoundPage = requireSubjectFunction("validateNotFoundPage");

  assert.throws(
    () => validateNotFoundPage(validNotFoundPage.replace(' data-not-found-mark="true">ZST', ">404")),
    /404.*ZST/i,
  );
  assert.throws(
    () => validateNotFoundPage(validNotFoundPage.replace("The requested record is absent.", "Missing")),
    /404.*missing-page copy/i,
  );
});

test("rejects upstream identity, artwork, and media from exported 404 HTML", () => {
  const validateNotFoundPage = requireSubjectFunction("validateNotFoundPage");

  for (const prohibited of [
    "ChanhDai",
    "Daikanoid",
    "departuremono.com",
    "https://assets.chanhdai.com/images/ball.png",
    "https://assets.chanhdai.com/sounds/bounce.mp3",
  ]) {
    assert.throws(
      () => validateNotFoundPage(validNotFoundPage.replace("</body>", `<p>${prohibited}</p></body>`)),
      /404.*upstream/i,
    );
  }
});

test("requires key public-profile strings in the generated artifacts", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeValidCapstoneExport(outputDirectory);
  await writeFile(path.join(outputDirectory, "dossier.md"), "# Incomplete dossier\n");

  await assert.rejects(
    verifyBuildOutput(outputDirectory),
    /dossier\.md.*Zuriel Shanley Tanyory/i,
  );
});

test("accepts a complete capstone static export", async () => {
  const verifyBuildOutput = requireSubjectFunction("verifyBuildOutput");
  const outputDirectory = await createTemporaryDirectory();
  await writeValidCapstoneExport(outputDirectory);

  await assert.doesNotReject(verifyBuildOutput(outputDirectory));
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
