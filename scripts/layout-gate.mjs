import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

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
  } finally {
    try {
      await browser?.close();
    } finally {
      await closeServer(server);
    }
  }
}

const entryPoint = process.argv[1]
  ? new URL(`file:///${path.resolve(process.argv[1]).replaceAll("\\", "/")}`).href
  : "";
if (import.meta.url === entryPoint) {
  runLayoutGate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
