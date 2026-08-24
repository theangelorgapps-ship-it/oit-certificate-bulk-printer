import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSheetJs, readMatrix } from "./load-sheetjs.mjs";
import { parseCorrectionsMatrix, parseResultsMatrix, reconcileCertificateNames } from "../src/reconcile.js";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const resultsPath = process.env.OIT_RESULTS_FILE || path.join(os.homedir(), "Downloads", "OIT RESUlTS.xlsx");
const correctionsPath = process.env.OIT_CORRECTIONS_FILE || path.join(os.homedir(), "Downloads", "GraduationCertificateForm_Report.csv");
const outputDir = process.env.OIT_OUTPUT_DIR || path.resolve(root, "../outputs/oit-certificate-bulk-2026-08-24");
const XLSX = loadSheetJs();
const results = parseResultsMatrix(readMatrix(XLSX, resultsPath, "Sheet1"), { sheetName: "Sheet1" });
const corrections = parseCorrectionsMatrix(readMatrix(XLSX, correctionsPath), { sheetName: "Corrections" });
const report = reconcileCertificateNames(results, corrections);

if (results.records.length !== 74) throw new Error(`Expected 74 result rows, found ${results.records.length}.`);
if (corrections.records.length !== 35) throw new Error(`Expected 35 correction rows, found ${corrections.records.length}.`);
if (report.names.length !== results.passRecords.length) throw new Error("PASS output count changed during reconciliation.");
if (report.stats.ambiguousCorrections || report.stats.resultConflicts) throw new Error("An ambiguous or conflicting correction was detected.");
if (report.names.some((row) => !row.printName || /@|\d{5,}/.test(row.printName))) throw new Error("A non-name value reached the print list.");

if (report.stats.correctionsApplied !== 29 || report.stats.changedNames !== 8) {
  throw new Error("The verified correction totals changed; review the supplied sources.");
}

const printNames = report.names.map((row) => row.printName);
if (new Set(printNames).size !== printNames.length) throw new Error("Duplicate print names require review.");

if (process.argv.includes("--outputs") || process.argv.length === 2) {
  const csvPath = path.join(outputDir, "OIT_Certificate_PASS_Names.csv");
  const xlsxPath = path.join(outputDir, "OIT_Certificate_PASS_Names.xlsx");
  if (!fs.existsSync(csvPath) || !fs.existsSync(xlsxPath)) throw new Error("Names-only output files are missing.");
  const csvText = fs.readFileSync(csvPath, "utf8");
  const forbidden = ["@", "Address", "Phone", "Street"];
  if (forbidden.some((term) => csvText.includes(term))) throw new Error("Personal contact data leaked into the names-only CSV.");
  const csvRows = readMatrix(XLSX, csvPath).slice(1).filter((row) => row?.[0]);
  const xlsxRows = readMatrix(XLSX, xlsxPath, "Names Only").slice(1).filter((row) => row?.[0]);
  if (csvRows.length !== printNames.length || xlsxRows.length !== printNames.length) throw new Error("Output row count does not equal PASS count.");
  console.log("OUTPUTS: PASS");
}

console.log(`RESULT_ROWS=${results.records.length}`);
console.log(`PASS_NAMES=${report.names.length}`);
console.log(`CORRECTION_ROWS=${corrections.records.length}`);
console.log(`CORRECTIONS_APPLIED=${report.stats.correctionsApplied}`);
console.log(`NAMES_CHANGED=${report.stats.changedNames}`);
console.log(`MATCHED_NON_PASS=${report.stats.matchedNonPassCorrections}`);
console.log(`UNMATCHED_CORRECTIONS=${report.stats.unmatchedCorrections}`);
if (process.argv.includes("--report") || process.argv.length === 2) console.log("DATA_AUDIT: PASS");
if (process.argv.includes("--reconcile") || process.argv.length === 2) console.log("RECONCILIATION: PASS");
if (process.argv.length === 2) console.log("BULK_IMPORT_TESTS: PASS");
