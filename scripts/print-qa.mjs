import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifacts = path.join(root, "test-artifacts");
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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  const outputDir = process.env.OIT_OUTPUT_DIR || path.resolve(root, "../outputs/oit-certificate-bulk-2026-08-24");
  for (const filename of ["OIT_Certificate_PASS_Names.csv", "OIT_Certificate_PASS_Names.xlsx"]) {
    await page.setInputFiles("#namesFile", path.join(outputDir, filename));
    await page.waitForFunction(() => document.querySelector("#namesFileStatus")?.dataset.tone === "success");
    const importedCount = await page.locator(".certificate-page").count();
    assert.equal(importedCount, 48, `${filename} should create 48 certificate pages.`);
    assert.equal(await page.locator("#names").inputValue().then((value) => value.trim().split(/\r?\n/).length), 48);
  }

  await page.locator("details.source-card").evaluate((element) => { element.open = true; });
  await page.setInputFiles("#resultsFile", process.env.OIT_RESULTS_FILE || path.join(os.homedir(), "Downloads", "OIT RESUlTS.xlsx"));
  await page.setInputFiles("#correctionsFile", process.env.OIT_CORRECTIONS_FILE || path.join(os.homedir(), "Downloads", "GraduationCertificateForm_Report.csv"));
  await page.click("#processButton");
  await page.waitForFunction(() => document.querySelector("#importMessage")?.textContent?.includes("48 PASS names"));
  const count = await page.locator(".certificate-page").count();
  assert.equal(count, 48, "Two-file reconciliation should still create 48 PASS pages.");

  await page.locator("#names").fill("Ada Lovelace\nJean-Pierre O'Connor\nAlexandria Catherine Montgomery-Worthington");
  await page.locator("#printMode").selectOption("complete");
  const fullPdf = path.join(artifacts, "complete-design-a4.pdf");
  await page.pdf({ path: fullPdf, format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  await page.locator("#printMode").selectOption("overlay");
  const overlayPdf = path.join(artifacts, "name-overlay-a4.pdf");
  await page.pdf({ path: overlayPdf, format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  const info = execFileSync("pdfinfo", [overlayPdf], { encoding: "utf8" });
  assert.match(info, /Pages:\s+3/);
  assert.match(info, /Page size:\s+59\d\.\d+ x 84\d\.\d+ pts \(A4\)/);
  await page.screenshot({ path: path.join(artifacts, "browser-preview.png"), fullPage: true });
  console.log(`PRINT_PAGES=${count}`);
  console.log("NAMES_FILE_CSV_PAGES=48");
  console.log("NAMES_FILE_XLSX_PAGES=48");
  console.log("PRINT_QA: PASS");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
