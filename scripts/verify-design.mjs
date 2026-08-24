import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const requiredDesign = [
  'data-design="vitalis-certificate"',
  "--bg:#f0f8fc",
  "--blue:#3ea2e8",
  "--lime:#d2e659",
  "--olive-nav:#94a103",
  ".rail{",
  ".dashboard-grid{",
  ".import-card{",
  ".metric-card{",
  ".card{border-radius:var(--radius-card)",
  "@media(max-width:700px)",
  "@media(prefers-reduced-motion:reduce)",
];
const combined = `${html}\n${css}`;
for (const marker of requiredDesign) {
  if (!combined.includes(marker)) throw new Error(`Missing design marker: ${marker}`);
}
if (!/background:linear-gradient\(145deg,#3199e5/.test(css)) throw new Error("Primary import card is missing its blue reference gradient.");
if (!/border-radius:2\.5rem/.test(css)) throw new Error("Rounded application shell is missing.");

const requiredCopy = [
  "Certificate printing workspace",
  "Import certificate names",
  "Choose names file",
  "Review certificate names",
  "Set up certificate printing",
  "Print certificates",
  "Names only for pre-printed certificates",
  "Complete certificate design on blank paper",
  "Match PASS names",
  "Private in your browser",
];
for (const text of requiredCopy) {
  if (!html.includes(text)) throw new Error(`Missing contextual copy: ${text}`);
}
const forbiddenCopy = ["Vitalis", "Hydration", "Calories", "Deep sleep", "Daily Activity", "Workout", "healthy metrics", "2.15L", "2.350", "82kg"];
const visibleText = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
for (const text of forbiddenCopy) {
  if (visibleText.toLowerCase().includes(text.toLowerCase())) throw new Error(`Health-dashboard copy leaked into the certificate tool: ${text}`);
}
if (/[—–]/.test(html)) throw new Error("Visible copy contains a forbidden long dash.");
if (process.argv.includes("--copy")) console.log("CONTEXT_COPY: PASS");
else console.log("DESIGN_SYSTEM: PASS");
