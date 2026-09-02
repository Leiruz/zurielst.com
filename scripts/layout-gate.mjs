import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getChromePath } from "chrome-launcher";
import puppeteer from "puppeteer-core";

import { createStaticServer } from "./perf-gate.mjs";

const HOST = "127.0.0.1";
const DESKTOP_VIEWPORT_WIDTHS = [1280, 1440, 1600, 1920, 2560];
const GREETING_VIEWPORT_WIDTHS = [375, 768, 1280, 1920];
const LONGEST_GREETING = "Good afternoon";
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
    await page.evaluate(() => {
      const footerIdentityEffect = document.querySelector(
        "[data-footer-identity-effect='true']",
      );
      if (!(footerIdentityEffect instanceof HTMLElement)) {
        throw new Error("Layout gate could not find the gradient wordmark wrapper");
      }
      footerIdentityEffect.scrollIntoView({ block: "center" });
    });
    await page.waitForSelector(
      "[data-footer-identity-effect='true'] [data-slot='fluid-gradient-text']",
      { timeout: 10_000, visible: true },
    );
    await page.evaluate(async () => {
      scrollTo(0, 0);
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });

    return await page.evaluate(async (longestGreeting) => {
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
      const introHeading = document.querySelector("#intro-title");
      const introGreeting = document.querySelector("[data-local-greeting='true']");
      const introAnchor = introHeading?.querySelector(".dossier-anchor");
      const footerIdentityEffect = document.querySelector(
        "[data-footer-identity-effect='true']",
      );
      const fluidGradientText = footerIdentityEffect?.querySelector(
        "[data-slot='fluid-gradient-text']",
      );
      const colophon = document.querySelector("[data-colophon='true']");
      const timelineTargets = [
        ["heading", document.querySelector("#timeline-title")],
        [
          "first organization",
          document.querySelector("#timeline [data-work-organization='true']"),
        ],
        [
          "first role card",
          document.querySelector("#timeline [data-work-position='true']"),
        ],
      ];
      const targets = [
        shell,
        lineNav,
        introText,
        introCopy,
        contributions,
        introBullet,
        introHeading,
        introGreeting,
        introAnchor,
        footerIdentityEffect,
        fluidGradientText,
        colophon,
        ...timelineTargets.map(([, target]) => target),
      ];
      if (!targets.every((target) => target instanceof HTMLElement)) {
        throw new Error("Layout gate could not find every measurement target");
      }

      introGreeting.textContent = longestGreeting;

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
      const footerIdentityRect = footerIdentityEffect.getBoundingClientRect();
      const fluidGradientRect = fluidGradientText.getBoundingClientRect();
      const colophonRect = colophon.getBoundingClientRect();
      const shellStyle = getComputedStyle(shell);
      const introCopyStyle = getComputedStyle(introCopy);
      const introBulletStyle = getComputedStyle(introBullet);
      const introHeadingStyle = getComputedStyle(introHeading);
      const introHeadingRect = introHeading.getBoundingClientRect();
      const introGreetingRect = introGreeting.getBoundingClientRect();
      const introAnchorRect = introAnchor.getBoundingClientRect();
      const navGutter = gutterProbe.getBoundingClientRect().width;
      gutterProbe.remove();

      const measureRailIntersection = async (name, target) => {
        target.scrollIntoView({ block: "center" });
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        const currentLineNavRect = lineNav.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const overlapX = Math.max(
          0,
          Math.min(currentLineNavRect.right, targetRect.right) -
            Math.max(currentLineNavRect.left, targetRect.left),
        );
        const overlapY = Math.max(
          0,
          Math.min(currentLineNavRect.bottom, targetRect.bottom) -
            Math.max(currentLineNavRect.top, targetRect.top),
        );
        return {
          name,
          intersects: overlapX > 0 && overlapY > 0,
          navRight: currentLineNavRect.right,
          overlapX,
          overlapY,
          targetLeft: targetRect.left,
        };
      };

      const timelineIntersections = [];
      for (const [name, target] of timelineTargets) {
        timelineIntersections.push(await measureRailIntersection(name, target));
      }
      const footerIdentityIntersection = await measureRailIntersection(
        "footer gradient wordmark",
        footerIdentityEffect,
      );

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
        introGreetingText: introGreeting.textContent,
        introGreetingFontSize: Number.parseFloat(introHeadingStyle.fontSize),
        introGreetingHeadingHeight: introHeadingRect.height,
        introGreetingLineHeight: Number.parseFloat(introHeadingStyle.lineHeight),
        introGreetingLineCount: introGreeting.getClientRects().length,
        introGreetingContentWidth: introAnchorRect.right - introGreetingRect.left,
        introGreetingAvailableWidth: introHeadingRect.width,
        introGreetingLeft: introGreetingRect.left,
        introGreetingHeadingLeft: introHeadingRect.left,
        introGreetingAnchorRight: introAnchorRect.right,
        introGreetingHeadingRight: introHeadingRect.right,
        introGreetingTop: introGreetingRect.top,
        introGreetingBottom: introGreetingRect.bottom,
        introGreetingAnchorTop: introAnchorRect.top,
        introGreetingAnchorBottom: introAnchorRect.bottom,
        footerIdentityBeforeColophon: Boolean(
          footerIdentityEffect.compareDocumentPosition(colophon) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ),
        footerIdentityBottom: footerIdentityRect.bottom,
        footerIdentityHeight: footerIdentityRect.height,
        footerIdentityLeft: footerIdentityRect.left,
        footerIdentityRight: footerIdentityRect.right,
        fluidGradientHeight: fluidGradientRect.height,
        fluidGradientWidth: fluidGradientRect.width,
        fluidGradientAriaLabel: fluidGradientText.getAttribute("aria-label"),
        fluidGradientMotion: fluidGradientText.dataset.gradientMotion,
        colophonLeft: colophonRect.left,
        colophonRight: colophonRect.right,
        colophonTop: colophonRect.top,
        footerIdentityIntersection,
        timelineIntersections,
      };
    }, LONGEST_GREETING);
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

function validateGreetingMeasurement(measurement) {
  assert.equal(
    measurement.introGreetingText,
    LONGEST_GREETING,
    `${measurement.viewportWidth}px greeting measurement did not use the longest variant`,
  );
  assert.equal(
    measurement.introGreetingLineCount,
    1,
    `${measurement.viewportWidth}px greeting wraps across multiple lines`,
  );
  assertClose(
    measurement.introGreetingHeadingHeight,
    measurement.introGreetingLineHeight,
    `${measurement.viewportWidth}px greeting heading is taller than one line`,
  );
  assert.ok(
    measurement.introGreetingLeft + GEOMETRY_TOLERANCE_PX >=
      measurement.introGreetingHeadingLeft &&
      measurement.introGreetingAnchorRight <=
        measurement.introGreetingHeadingRight + GEOMETRY_TOLERANCE_PX,
    `${measurement.viewportWidth}px greeting and anchor do not fit inside their heading`,
  );
  assert.ok(
    measurement.introGreetingAnchorTop < measurement.introGreetingBottom &&
      measurement.introGreetingAnchorBottom > measurement.introGreetingTop,
    `${measurement.viewportWidth}px introduction anchor is not on the greeting line`,
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
  assert.equal(
    measurement.footerIdentityBeforeColophon,
    true,
    `${measurement.viewportWidth}px gradient wordmark does not precede the colophon`,
  );
  assert.ok(
    measurement.footerIdentityBottom <=
      measurement.colophonTop + GEOMETRY_TOLERANCE_PX,
    `${measurement.viewportWidth}px gradient wordmark is not above the colophon`,
  );
  assertClose(
    measurement.footerIdentityLeft,
    measurement.colophonLeft,
    `${measurement.viewportWidth}px gradient and colophon left edges differ`,
  );
  assertClose(
    measurement.footerIdentityRight,
    measurement.colophonRight,
    `${measurement.viewportWidth}px gradient and colophon right edges differ`,
  );
  assert.ok(
    measurement.footerIdentityHeight >= 80 &&
      measurement.fluidGradientHeight > 0 &&
      measurement.fluidGradientWidth > 0,
    `${measurement.viewportWidth}px gradient wordmark has no large rendered box`,
  );
  assert.equal(
    measurement.fluidGradientAriaLabel,
    "Zuriel",
    `${measurement.viewportWidth}px gradient wordmark lost its accessible label`,
  );
  assert.equal(
    measurement.fluidGradientMotion,
    "static",
    `${measurement.viewportWidth}px reduced-motion gradient is not static`,
  );
  assert.equal(
    measurement.footerIdentityIntersection.intersects,
    false,
    `${measurement.viewportWidth}px footer gradient wordmark intersects ` +
      `the line-nav rail by ${measurement.footerIdentityIntersection.overlapX.toFixed(1)}px ` +
      `horizontally and ${measurement.footerIdentityIntersection.overlapY.toFixed(1)}px vertically`,
  );
  for (const intersection of measurement.timelineIntersections) {
    assert.equal(
      intersection.intersects,
      false,
      `${measurement.viewportWidth}px Timeline ${intersection.name} intersects ` +
        `the line-nav rail by ${intersection.overlapX.toFixed(1)}px horizontally ` +
        `and ${intersection.overlapY.toFixed(1)}px vertically`,
    );
  }
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
    const tabletMeasurement = await measureViewport(browser, siteUrl, 768);
    const greetingMeasurements = GREETING_VIEWPORT_WIDTHS.map((viewportWidth) => {
      if (viewportWidth === MOBILE_VIEWPORT_WIDTH) return mobileMeasurement;
      if (viewportWidth === 768) return tabletMeasurement;
      return desktopMeasurements.find(
        (measurement) => measurement.viewportWidth === viewportWidth,
      );
    });
    assert.ok(
      greetingMeasurements.every(Boolean),
      "Missing a required greeting viewport measurement",
    );
    for (const measurement of greetingMeasurements) {
      validateGreetingMeasurement(measurement);
    }
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
    const mobileTimelineHeading = mobileMeasurement.timelineIntersections.find(
      ({ name }) => name === "heading",
    );
    assert.ok(
      mobileTimelineHeading,
      "375px Timeline heading measurement is missing",
    );
    assertClose(
      mobileTimelineHeading.targetLeft,
      17,
      "375px Timeline inset changed",
    );

    await verifyAnalyticsConsentPersistence(browser, siteUrl);

    console.log("Five-width Chromium layout gate:");
    for (const measurement of desktopMeasurements) {
      console.log(
        `${measurement.viewportWidth}px: right gap ${measurement.shellRightGap.toFixed(1)}px, ` +
        `shell width ${measurement.shellWidth.toFixed(1)}px, ` +
        `Timeline overlap ${Math.max(
          ...measurement.timelineIntersections.map(({ overlapX, intersects }) =>
            intersects ? overlapX : 0),
        ).toFixed(1)}px, gradient overlap ${(
          measurement.footerIdentityIntersection.intersects
            ? measurement.footerIdentityIntersection.overlapX
            : 0
        ).toFixed(1)}px`,
      );
    }
    console.log(
      `${MOBILE_VIEWPORT_WIDTH}px: horizontal overflow ` +
      `${mobileMeasurement.horizontalOverflow.toFixed(1)}px`,
    );
    console.log(`Longest greeting forced to "${LONGEST_GREETING}":`);
    for (const measurement of greetingMeasurements) {
      console.log(
        `${measurement.viewportWidth}px: heading ` +
        `${measurement.introGreetingHeadingHeight.toFixed(1)}px / ` +
        `${measurement.introGreetingLineHeight.toFixed(1)}px line, content ` +
        `${measurement.introGreetingContentWidth.toFixed(1)}px / ` +
        `${measurement.introGreetingAvailableWidth.toFixed(1)}px available, ` +
        `greeting y ${measurement.introGreetingTop.toFixed(1)}` +
        `-${measurement.introGreetingBottom.toFixed(1)}px, anchor y ` +
        `${measurement.introGreetingAnchorTop.toFixed(1)}` +
        `-${measurement.introGreetingAnchorBottom.toFixed(1)}px`,
      );
    }
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
