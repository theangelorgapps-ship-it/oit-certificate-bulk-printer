import {
  cleanDisplayName,
  findNamesSheet,
  findResultsSheet,
  parseCorrectionsMatrix,
  parseResultsMatrix,
  reconcileCertificateNames,
  workbookFirstMatrix,
} from "./reconcile.js";

const PAGE_WIDTH = 595.2756;
const PAGE_HEIGHT = 841.8898;
const BASELINE_Y = PAGE_HEIGHT * 0.54;
const REFERENCE_SIZE = 66;
const MAXIMUM_NAME_WIDTH = PAGE_WIDTH * 0.8;
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  results: null,
  corrections: null,
  reconciliation: null,
};

const elements = {
  resultsFile: document.getElementById("resultsFile"),
  namesFile: document.getElementById("namesFile"),
  namesFileStatus: document.getElementById("namesFileStatus"),
  correctionsFile: document.getElementById("correctionsFile"),
  resultsStatus: document.getElementById("resultsStatus"),
  correctionsStatus: document.getElementById("correctionsStatus"),
  processButton: document.getElementById("processButton"),
  names: document.getElementById("names"),
  printMode: document.getElementById("printMode"),
  offsetX: document.getElementById("offsetX"),
  offsetY: document.getElementById("offsetY"),
  printButton: document.getElementById("printButton"),
  resetButton: document.getElementById("resetButton"),
  downloadCsvButton: document.getElementById("downloadCsvButton"),
  downloadXlsxButton: document.getElementById("downloadXlsxButton"),
  summary: document.getElementById("summary"),
  issues: document.getElementById("issues"),
  namesTableBody: document.querySelector("#namesTable tbody"),
  pages: document.getElementById("pages"),
  pageCount: document.getElementById("pageCount"),
  pageTemplate: document.getElementById("pageTemplate"),
  importMessage: document.getElementById("importMessage"),
};

function setNamesForPrinting(names, sourceLabel) {
  elements.names.value = names.join("\n");
  const records = names.map((printName) => ({ printName, correctionApplied: false, sourceName: printName }));
  renderNamesTable(records, sourceLabel);
  elements.downloadCsvButton.disabled = false;
  elements.downloadXlsxButton.disabled = false;
  elements.printButton.disabled = false;
  elements.importMessage.textContent = `${names.length} certificate names are ready for bulk printing.`;
  elements.importMessage.dataset.tone = "success";
  elements.summary.replaceChildren();
  [["Names imported", names.length], ["A4 print pages", names.length]].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    const number = document.createElement("strong");
    number.textContent = String(value);
    const caption = document.createElement("span");
    caption.textContent = label;
    card.append(number, caption);
    elements.summary.appendChild(card);
  });
  elements.issues.replaceChildren();
  renderPages();
}

async function importNamesFile(file) {
  setStatus(elements.namesFileStatus, "Reading names file…", "working");
  const workbook = await readSpreadsheet(file);
  const { parsed } = findNamesSheet(workbook);
  setNamesForPrinting(parsed.names, "Imported names file");
  const skipped = parsed.skippedRows.length ? `; ${parsed.skippedRows.length} invalid rows skipped` : "";
  setStatus(elements.namesFileStatus, `${file.name}: ${parsed.names.length} names${skipped}`, "success");
}

function setStatus(target, message, tone = "neutral") {
  target.textContent = message;
  target.dataset.tone = tone;
}

async function readSpreadsheet(file) {
  if (!file) throw new Error("Choose a spreadsheet file first.");
  const bytes = await file.arrayBuffer();
  return globalThis.XLSX.read(bytes, { cellDates: false, raw: false });
}

async function importResults(file) {
  setStatus(elements.resultsStatus, "Reading file…", "working");
  const workbook = await readSpreadsheet(file);
  const { sheetName, matrix } = findResultsSheet(workbook);
  const parsed = parseResultsMatrix(matrix, { sheetName });
  state.results = parsed;
  state.reconciliation = null;
  setStatus(
    elements.resultsStatus,
    `${file.name}: ${parsed.records.length} records, ${parsed.passRecords.length} PASS (${sheetName})`,
    "success",
  );
}

async function importCorrections(file) {
  setStatus(elements.correctionsStatus, "Reading file…", "working");
  const workbook = await readSpreadsheet(file);
  const { sheetName, matrix } = workbookFirstMatrix(workbook);
  const parsed = parseCorrectionsMatrix(matrix, { sheetName });
  state.corrections = parsed;
  state.reconciliation = null;
  setStatus(elements.correctionsStatus, `${file.name}: ${parsed.records.length} correction requests`, "success");
}

function formatIssueName(match) {
  return match?.correction?.requestedName || "Unnamed record";
}

function renderIssues(reconciliation) {
  const items = [];
  reconciliation.issues.matchedNonPassCorrections.forEach((match) => {
    items.push({ tone: "warning", label: `${formatIssueName(match)} matched a non-PASS result and was not printed.` });
  });
  reconciliation.issues.unmatchedCorrections.forEach((match) => {
    items.push({ tone: "warning", label: `${formatIssueName(match)} was not found in the results workbook.` });
  });
  reconciliation.issues.ambiguousCorrections.forEach((match) => {
    items.push({ tone: "danger", label: `${formatIssueName(match)} matched more than one result and needs manual review.` });
  });
  reconciliation.issues.resultConflicts.forEach((record) => {
    items.push({ tone: "danger", label: `${record.sourceName} has conflicting correction names; the original result name was kept.` });
  });
  reconciliation.issues.duplicatePrintNames.forEach(([, records]) => {
    items.push({ tone: "warning", label: `${records[0].printName} appears ${records.length} times in the PASS list.` });
  });

  elements.issues.replaceChildren();
  if (items.length === 0) {
    const clear = document.createElement("p");
    clear.className = "issue-clear";
    clear.textContent = "No ambiguous matches or duplicate printable names detected.";
    elements.issues.appendChild(clear);
    return;
  }
  const list = document.createElement("ul");
  items.forEach((item) => {
    const row = document.createElement("li");
    row.dataset.tone = item.tone;
    row.textContent = item.label;
    list.appendChild(row);
  });
  elements.issues.appendChild(list);
}

function renderSummary(reconciliation) {
  const cards = [
    ["Result rows", reconciliation.stats.resultRows],
    ["PASS names", reconciliation.stats.passCount],
    ["Correction requests", reconciliation.stats.correctionRows],
    ["Corrections applied", reconciliation.stats.correctionsApplied],
    ["Names changed", reconciliation.stats.changedNames],
    ["Needs review", reconciliation.stats.unmatchedCorrections + reconciliation.stats.ambiguousCorrections + reconciliation.stats.resultConflicts],
  ];
  elements.summary.replaceChildren();
  cards.forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    const number = document.createElement("strong");
    number.textContent = String(value);
    const caption = document.createElement("span");
    caption.textContent = label;
    card.append(number, caption);
    elements.summary.appendChild(card);
  });
}

function renderNamesTable(names, directSource = "") {
  elements.namesTableBody.replaceChildren();
  names.forEach((record, index) => {
    const row = document.createElement("tr");
    const position = document.createElement("td");
    position.textContent = String(index + 1);
    const name = document.createElement("td");
    name.textContent = record.printName;
    const source = document.createElement("td");
    source.textContent = directSource || (record.correctionApplied
      ? `Updated from ${record.sourceName} (${record.matchMethod} match)`
      : "Original PASS name");
    row.append(position, name, source);
    elements.namesTableBody.appendChild(row);
  });
}

elements.namesFile.addEventListener("change", async (event) => {
  try {
    await importNamesFile(event.target.files?.[0]);
  } catch (error) {
    setStatus(elements.namesFileStatus, error.message, "danger");
    showError(error);
  }
});

function processImportedFiles() {
  if (!state.results) {
    throw new Error("Add the results workbook before matching names.");
  }
  const reconciliation = reconcileCertificateNames(state.results, state.corrections || { records: [] });
  state.reconciliation = reconciliation;
  elements.names.value = reconciliation.names.map((record) => record.printName).join("\n");
  renderSummary(reconciliation);
  renderIssues(reconciliation);
  renderNamesTable(reconciliation.names);
  elements.downloadCsvButton.disabled = false;
  elements.downloadXlsxButton.disabled = false;
  elements.printButton.disabled = false;
  elements.importMessage.textContent = `${reconciliation.names.length} PASS names are ready for bulk printing.`;
  elements.importMessage.dataset.tone = "success";
  renderPages();
}

function normalizedNames() {
  return elements.names.value
    .split(/\r?\n/)
    .map(cleanDisplayName)
    .filter(Boolean);
}

function measureName(name, size = REFERENCE_SIZE) {
  const canvas = measureName.canvas || (measureName.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = `${size}px "OIT Award Script"`;
  return context.measureText(name).width;
}

function balancedNameLines(name) {
  if (!name || measureName(name) <= MAXIMUM_NAME_WIDTH) return [name];
  const words = name.split(" ");
  if (words.length < 2) return [name];
  let best = [words[0], words.slice(1).join(" ")];
  let bestWidest = Number.POSITIVE_INFINITY;
  let bestImbalance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const candidate = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
    const widths = candidate.map((line) => measureName(line));
    const widest = Math.max(...widths);
    const imbalance = Math.abs(widths[0] - widths[1]);
    if (widest < bestWidest || (widest === bestWidest && imbalance < bestImbalance)) {
      best = candidate;
      bestWidest = widest;
      bestImbalance = imbalance;
    }
  }
  return best;
}

function addName(group, name) {
  const lines = balancedNameLines(name);
  const widest = Math.max(...lines.map((line) => measureName(line)));
  const size = REFERENCE_SIZE * Math.min(1, MAXIMUM_NAME_WIDTH / widest);
  const lineGap = size * 0.95;
  lines.forEach((line, index) => {
    const text = document.createElementNS(SVG_NS, "text");
    const offset = lines.length === 2 ? (index === 0 ? -lineGap / 2 : lineGap / 2) : 0;
    text.setAttribute("x", PAGE_WIDTH / 2);
    text.setAttribute("y", BASELINE_Y + offset);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", size);
    text.textContent = line;
    group.appendChild(text);
  });
}

function renderPages() {
  const names = normalizedNames();
  const xPoints = (Number(elements.offsetX.value) || 0) * 72 / 25.4;
  const yPoints = (Number(elements.offsetY.value) || 0) * 72 / 25.4;
  const overlayOnly = elements.printMode.value === "overlay";
  document.body.classList.toggle("overlay-only", overlayOnly);
  elements.pages.replaceChildren();

  names.forEach((name) => {
    const fragment = elements.pageTemplate.content.cloneNode(true);
    const group = fragment.querySelector(".name-group");
    const chip = fragment.querySelector(".mode-chip");
    group.setAttribute("transform", `translate(${xPoints} ${yPoints})`);
    addName(group, name);
    chip.hidden = !overlayOnly;
    elements.pages.appendChild(fragment);
  });
  elements.pageCount.textContent = `${names.length} ${names.length === 1 ? "page" : "pages"}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function namesOnlyRows() {
  return [["Student Name"], ...normalizedNames().map((name) => [name])];
}

function downloadCsv() {
  const sheet = globalThis.XLSX.utils.aoa_to_sheet(namesOnlyRows());
  const csv = globalThis.XLSX.utils.sheet_to_csv(sheet);
  downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), "OIT_Certificate_PASS_Names.csv");
}

function downloadXlsx() {
  const sheet = globalThis.XLSX.utils.aoa_to_sheet(namesOnlyRows());
  sheet["!cols"] = [{ wch: 42 }];
  const workbook = globalThis.XLSX.utils.book_new();
  globalThis.XLSX.utils.book_append_sheet(workbook, sheet, "Names Only");
  globalThis.XLSX.writeFile(workbook, "OIT_Certificate_PASS_Names.xlsx", { compression: true });
}

function showError(error) {
  elements.importMessage.textContent = error instanceof Error ? error.message : String(error);
  elements.importMessage.dataset.tone = "danger";
}

elements.resultsFile.addEventListener("change", async (event) => {
  try {
    await importResults(event.target.files?.[0]);
  } catch (error) {
    state.results = null;
    setStatus(elements.resultsStatus, error.message, "danger");
    showError(error);
  }
});

elements.correctionsFile.addEventListener("change", async (event) => {
  try {
    await importCorrections(event.target.files?.[0]);
  } catch (error) {
    state.corrections = null;
    setStatus(elements.correctionsStatus, error.message, "danger");
    showError(error);
  }
});

elements.processButton.addEventListener("click", () => {
  try {
    processImportedFiles();
  } catch (error) {
    showError(error);
  }
});

elements.names.addEventListener("input", renderPages);
[elements.printMode, elements.offsetX, elements.offsetY].forEach((control) => {
  control.addEventListener("input", renderPages);
  control.addEventListener("change", renderPages);
});
elements.downloadCsvButton.addEventListener("click", downloadCsv);
elements.downloadXlsxButton.addEventListener("click", downloadXlsx);
elements.printButton.addEventListener("click", () => {
  renderPages();
  window.print();
});
elements.resetButton.addEventListener("click", () => {
  elements.offsetX.value = "0";
  elements.offsetY.value = "0";
  renderPages();
});
window.addEventListener("beforeprint", renderPages);

await document.fonts.load('66px "OIT Award Script"');
await document.fonts.ready;
renderPages();
