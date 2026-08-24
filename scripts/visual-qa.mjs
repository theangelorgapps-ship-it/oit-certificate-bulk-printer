import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifacts = path.join(root, "test-artifacts");
const namesFile = process.env.OIT_NAMES_FILE || path.resolve(root, "../outputs/oit-certificate-bulk-2026-08-24/OIT_Certificate_PASS_Names.xlsx");
fs.mkdirSync(artifacts, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".ttf": "font/ttf" };
const server = http.createServer((request, response) => {
  const urlPath = request.url === "/" ? "/index.html" : decodeURIComponent(request.url.split("?")[0]);
  const target = path.resolve(root, `.${urlPath}`);
  if (!target.startsWith(root) || !fs.existsSync(target)) { response.writeHead(404).end(); return; }
  response.setHeader("Content-Type", types[path.extname(target)] || "application/octet-stream");
  fs.createReadStream(target).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function checkViewport(viewport, filename) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.matches("a, button, input, select, textarea, summary")), true, `Keyboard focus should reach an interactive control at ${viewport.width}px.`);
  await page.setInputFiles("#namesFile", namesFile);
  await page.waitForFunction(() => document.querySelector("#namesFileStatus")?.dataset.tone === "success");
  for (const selector of [".topbar", ".import-card", ".metric-card", ".names-card", ".print-card", ".rail"]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    assert(await page.locator(selector).isVisible(), `${selector} is not visible at ${viewport.width}px.`);
  }
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    pageCount: document.querySelectorAll(".certificate-page").length,
    printDisabled: document.querySelector("#printButton")?.disabled,
  }));
  assert(layout.scrollWidth <= layout.innerWidth + 1, `Horizontal overflow at ${viewport.width}px: ${layout.scrollWidth}px document width.`);
  assert.equal(layout.pageCount, 48);
  assert.equal(layout.printDisabled, false);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(artifacts, filename) });
  await page.close();
}

async function checkAccessibilityPreferences() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto");
  assert.equal(await page.locator(".nav-key > span").first().evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
  await page.close();
}

try {
  await checkViewport({ width: 1440, height: 1100 }, "redesign-desktop.png");
  await checkViewport({ width: 390, height: 844 }, "redesign-mobile.png");
  await checkAccessibilityPreferences();
  console.log("DESKTOP_LAYOUT=1440x1100 PASS");
  console.log("MOBILE_LAYOUT=390x844 PASS");
  console.log("VISUAL_QA: PASS");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
