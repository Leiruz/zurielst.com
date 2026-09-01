import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getChromePath } from "chrome-launcher";
import puppeteer from "puppeteer-core";

import { createStaticServer } from "./perf-gate.mjs";

const HOST = "127.0.0.1";
const DESKTOP_VIEWPORT_WIDTHS = [1280, 1440, 1600, 1920, 2560];
const MOBILE_VIEWPORT_WIDTH = 375;
const VIEWPORT_HEIGHT = 1200;
const MAX_SHELL_WIDTH_PX = 80 * 16;
const GEOMETRY_TOLERANCE_PX = 1;

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Layout gate server did not expose a TCP port");
  }
  return `http://${HOST}:${address.port}/`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function measureViewport(browser, siteUrl, viewportWidth) {
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: viewportWidth,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
    });
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.goto(siteUrl, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);

    return await page.evaluate(() => {
      const shell = document.querySelector("#intro .dossier-shell");
      const lineNav = document.querySelector("[data-section-line-nav='true']");
      const introLayout = document.querySelector("[data-intro-layout='true']") ??
        document.querySelector("#intro .grid");
      const introText = document.querySelector("[data-intro-copy-column='true']") ??
        introLayout?.children[0];
      const introCopy = document.querySelector("[data-intro-copy='true']") ??
        document.querySelector("#intro ul");
      const contributions =
        document.querySelector("[data-intro-contributions-column='true']") ??
        introLayout?.children[1];
      const introBullet = document.querySelector("[data-intro-bullet='true']");
      const targets = [
        shell,
        lineNav,
        introText,
        introCopy,
        contributions,
        introBullet,
      ];
      if (!targets.every((target) => target instanceof HTMLElement)) {
        throw new Error("Layout gate could not find every measurement target");
      }

      const gutterProbe = document.createElement("div");
      gutterProbe.style.cssText = [
        "position:fixed",
        "inset:0 auto auto 0",
        "height:0",
        "width:var(--section-line-nav-gutter)",
        "visibility:hidden",
      ].join(";");
      document.body.append(gutterProbe);

      const shellRect = shell.getBoundingClientRect();
      const lineNavRect = lineNav.getBoundingClientRect();
      const introTextRect = introText.getBoundingClientRect();
      const introCopyRect = introCopy.getBoundingClientRect();
      const contributionsRect = contributions.getBoundingClientRect();
      const shellStyle = getComputedStyle(shell);
      const introCopyStyle = getComputedStyle(introCopy);
      const introBulletStyle = getComputedStyle(introBullet);
      const navGutter = gutterProbe.getBoundingClientRect().width;
      gutterProbe.remove();

      return {
        viewportWidth: innerWidth,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        navGutter,
        navRight: lineNavRect.right,
        shellLeft: shellRect.left,
        shellRight: shellRect.right,
        shellWidth: shellRect.width,
        shellPaddingLeft: Number.parseFloat(shellStyle.paddingLeft),
        shellPaddingRight: Number.parseFloat(shellStyle.paddingRight),
        shellRightGap: innerWidth - shellRect.right,
        introTextTop: introTextRect.top,
        introTextBottom: introTextRect.bottom,
        introTextCenter: introTextRect.top + (introTextRect.height / 2),
        introCopyWidth: introCopyRect.width,
        introCopyMaxWidth: Number.parseFloat(introCopyStyle.maxWidth),
        contributionsTop: contributionsRect.top,
        contributionsCenter:
          contributionsRect.top + (contributionsRect.height / 2),
        introBulletFontSize: Number.parseFloat(introBulletStyle.fontSize),
      };
    });
  } finally {
    await page.close();
  }
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) <= GEOMETRY_TOLERANCE_PX,
    `${message}: expected ${expected}px, received ${actual}px`,
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyAnalyticsConsentPersistence(browser, siteUrl) {
  const page = await browser.newPage();
  const browserDiagnostics = [];
  let countConsentReloads = false;
  let consentReloads = 0;
  const countLoadedDocuments = () => {
    if (countConsentReloads) consentReloads += 1;
  };
  page.on("load", countLoadedDocuments);
  page.on("console", (message) => {
    if (message.type() === "error") browserDiagnostics.push(message.text());
  });
  page.on("pageerror", (error) => browserDiagnostics.push(error.message));

  try {
    await page.setViewport({
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
    });
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      try {
        if (request.url().includes("cloudflareinsights.com")) {
          await request.abort("blockedbyclient");
        } else {
          await request.continue();
        }
      } catch {
        // Navigation can settle an intercepted request before this handler does.
      }
    });

    const devtoolsSession = await page.createCDPSession();
    await devtoolsSession.send("Network.clearBrowserCookies");
    await devtoolsSession.send("Storage.clearDataForOrigin", {
      origin: new URL(siteUrl).origin,
      storageTypes: "all",
    });
    await devtoolsSession.detach();

    await page.goto(siteUrl, { waitUntil: "networkidle0" });
    await page.evaluate(
      () => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
    );
    await page.keyboard.press("Tab");
    await page.waitForSelector('[data-testid="cookie-banner-accept-button"]');

    await page.click('[data-testid="cookie-banner-accept-button"]');
    await page.waitForSelector('[data-testid="cookie-banner-root"]', {
      hidden: true,
    });
    await page.waitForSelector('[data-zst-cloudflare-analytics="true"]');
    await page.waitForFunction(() => {
      const stored = window.localStorage.getItem("c15t");
      if (!stored) return false;
      return JSON.parse(stored).consents?.measurement === true;
    });

    await page.click('[data-footer-privacy-choices="true"]');
    try {
      await page.waitForSelector('[data-testid="consent-manager-dialog-card"]', {
        timeout: 5000,
      });
    } catch (error) {
      const state = await page.evaluate(() => ({
        consentTestIds: [...document.querySelectorAll('[data-testid*="consent"]')]
          .map((element) => element.getAttribute("data-testid")),
        pendingRequests: window.__dossierPendingOpenRequests ?? null,
      }));
      throw new Error(
        `Real footer privacy control did not open the c15t dialog; state: ${JSON.stringify(state)}; browser errors: ${JSON.stringify(browserDiagnostics)}`,
        { cause: error },
      );
    }
    const measurementSwitch =
      '[data-testid="consent-manager-widget-switch-measurement"]';
    const switchWasGranted = await page.$eval(
      measurementSwitch,
      (element) =>
        element.getAttribute("aria-checked") === "true" ||
        element.getAttribute("data-state") === "checked",
    );
    assert.equal(
      switchWasGranted,
      true,
      "Measurement switch was not granted before the revocation scenario",
    );
    await page.click(measurementSwitch);
    const switchIsDenied = await page.$eval(
      measurementSwitch,
      (element) =>
        element.getAttribute("aria-checked") === "false" ||
        element.getAttribute("data-state") === "unchecked",
    );
    assert.equal(
      switchIsDenied,
      true,
      "Measurement switch did not turn off in the real c15t dialog",
    );
    await page.evaluate(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay = 0, ...arguments_) =>
        nativeSetTimeout(callback, delay === 0 ? 250 : delay, ...arguments_);
    });

    countConsentReloads = true;
    const reloadFinished = page.waitForNavigation({
      waitUntil: "domcontentloaded",
    });
    await page.click(
      '[data-testid="consent-manager-widget-footer-save-button"]',
    );
    await reloadFinished;
    await delay(250);
    assert.equal(
      consentReloads,
      1,
      `Analytics revocation reloaded ${consentReloads} times instead of once`,
    );

    const effectiveStoredConsent = await page.evaluate(() => {
      const cookieValue = document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("c15t="))
        ?.slice("c15t=".length);
      const localValue = window.localStorage.getItem("c15t");
      const localConsent = localValue ? JSON.parse(localValue) : null;

      if (cookieValue !== undefined) {
        return {
          measurement: cookieValue
            .split(",")
            .some((entry) => entry === "c.measurement:1"),
          source: "cookie",
        };
      }

      return {
        measurement: localConsent?.consents?.measurement,
        source: localConsent ? "localStorage" : "none",
      };
    });
    assert.notEqual(
      effectiveStoredConsent.source,
      "none",
      "Analytics revocation left no persisted c15t consent",
    );
    assert.equal(
      effectiveStoredConsent.measurement,
      false,
      `Effective ${effectiveStoredConsent.source} consent remained granted after reload`,
    );

    await page.click('[data-footer-privacy-choices="true"]');
    await page.waitForSelector('[data-testid="consent-manager-dialog-card"]');
    await delay(250);
    assert.equal(
      await page.$('[data-zst-cloudflare-analytics="true"]'),
      null,
      "Denied measurement consent reinjected the analytics beacon",
    );
    assert.equal(
      consentReloads,
      1,
      "Denied measurement consent triggered a second reload",
    );
  } finally {
    page.off("load", countLoadedDocuments);
    await page.close();
  }
}

function validateDesktopMeasurement(measurement) {
  assert.equal(
    measurement.horizontalOverflow,
    0,
    `${measurement.viewportWidth}px viewport has horizontal overflow`,
  );
  assert.ok(
    measurement.shellRightGap + GEOMETRY_TOLERANCE_PX >=
      measurement.shellPaddingRight,
    `${measurement.viewportWidth}px shell right gap is smaller than page padding`,
  );
  assert.ok(
    measurement.shellWidth <= MAX_SHELL_WIDTH_PX + GEOMETRY_TOLERANCE_PX,
    `${measurement.viewportWidth}px shell exceeds its 80rem maximum`,
  );
  assertClose(
    measurement.shellLeft - measurement.navGutter,
    measurement.shellRightGap,
    `${measurement.viewportWidth}px shell is not balanced beside the line nav`,
  );
  assert.ok(
    measurement.shellLeft + measurement.shellPaddingLeft > measurement.navRight,
    `${measurement.viewportWidth}px content overlaps the line nav`,
  );
  assertClose(
    measurement.contributionsCenter,
    measurement.introTextCenter,
    `${measurement.viewportWidth}px contributions block is not vertically centered`,
  );
  assert.ok(
    measurement.introCopyWidth <=
      measurement.introCopyMaxWidth + GEOMETRY_TOLERANCE_PX,
    `${measurement.viewportWidth}px intro copy exceeds its maximum measure`,
  );
}

export async function runLayoutGate() {
  const outputDirectory = path.resolve("out");
  if (!existsSync(path.join(outputDirectory, "index.html"))) {
    throw new Error("Missing out/index.html. Run npm run build before the layout gate");
  }

  const server = createStaticServer(outputDirectory);
  const siteUrl = await listen(server);
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: getChromePath(),
      headless: true,
      args: ["--no-sandbox"],
    });

    const desktopMeasurements = [];
    for (const viewportWidth of DESKTOP_VIEWPORT_WIDTHS) {
      const measurement = await measureViewport(browser, siteUrl, viewportWidth);
      validateDesktopMeasurement(measurement);
      desktopMeasurements.push(measurement);
    }

    assert.ok(
      desktopMeasurements[0].introBulletFontSize <
        desktopMeasurements.at(-1).introBulletFontSize,
      "Intro bullet type does not scale down at the smallest desktop width",
    );

    const mobileMeasurement = await measureViewport(
      browser,
      siteUrl,
      MOBILE_VIEWPORT_WIDTH,
    );
    assert.equal(
      mobileMeasurement.horizontalOverflow,
      0,
      "375px viewport has horizontal overflow",
    );
    assert.ok(
      mobileMeasurement.contributionsTop >= mobileMeasurement.introTextBottom,
      "375px contributions block no longer stacks below the intro copy",
    );
    assertClose(
      mobileMeasurement.introBulletFontSize,
      16,
      "375px intro bullet type changed",
    );

    await verifyAnalyticsConsentPersistence(browser, siteUrl);

    console.log("Five-width Chromium layout gate:");
    for (const measurement of desktopMeasurements) {
      console.log(
        `${measurement.viewportWidth}px: right gap ${measurement.shellRightGap.toFixed(1)}px, ` +
        `shell width ${measurement.shellWidth.toFixed(1)}px`,
      );
    }
    console.log(
      `${MOBILE_VIEWPORT_WIDTH}px: horizontal overflow ` +
      `${mobileMeasurement.horizontalOverflow.toFixed(1)}px`,
    );
    console.log(
      "Analytics consent gate: real dialog denial persisted before one reload",
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      await closeServer(server);
    }
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPoint) {
  runLayoutGate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
