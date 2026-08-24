import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const url = process.env.OIT_CLOUDFLARE_URL || "https://oit-certificate-bulk-printer.pages.dev/";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const namesFile = process.env.OIT_NAMES_FILE || path.resolve(root, "../outputs/oit-certificate-bulk-2026-08-24/OIT_Certificate_PASS_Names.xlsx");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(url, { waitUntil: "networkidle" });
  if (!(await page.locator('body[data-design="vitalis-certificate"]').count())) throw new Error("Cloudflare is not serving the redesigned interface.");
  await page.setInputFiles("#namesFile", namesFile);
  await page.waitForFunction(() => document.querySelector("#namesFileStatus")?.dataset.tone === "success");
  const count = await page.locator(".certificate-page").count();
  if (count !== 48) throw new Error(`Expected 48 certificate pages on Cloudflare, found ${count}.`);
  console.log(`CLOUDFLARE_URL=${url}`);
  console.log(`CLOUDFLARE_NAMES_FILE_PAGES=${count}`);
  console.log("CLOUDFLARE_DEPLOYMENT: PASS");
} finally {
  await browser.close();
}
