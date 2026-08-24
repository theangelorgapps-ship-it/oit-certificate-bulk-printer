const SPACE_PATTERN = /\s+/g;

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(SPACE_PATTERN, " ").trim();
}

export function normalizeHeader(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeEmail(value) {
  return text(value).toLowerCase();
}

export function normalizeNameKey(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(SPACE_PATTERN, " ")
    .trim();
}

function titleCaseWord(word) {
  return word
    .split(/([-'])/)
    .map((part) => {
      if (part === "-" || part === "'") return part;
      if (!part) return part;
      return part.charAt(0).toLocaleUpperCase("en") + part.slice(1).toLocaleLowerCase("en");
    })
    .join("");
}

export function cleanDisplayName(value) {
  const cleaned = text(value).replace(/\s*,\s*/g, " ").replace(SPACE_PATTERN, " ").trim();
  if (!cleaned) return "";
  const letters = cleaned.replace(/[^\p{L}]/gu, "");
  const isUniformCase = letters && (letters === letters.toLocaleUpperCase("en") || letters === letters.toLocaleLowerCase("en"));
  if (!isUniformCase) return cleaned;
  return cleaned.split(" ").map(titleCaseWord).join(" ");
}

function looksLikeName(value) {
  const candidate = cleanDisplayName(value);
  if (!candidate || candidate.includes("@") || /\d/.test(candidate)) return false;
  const words = candidate.split(" ").filter(Boolean);
  return words.length >= 1 && words.length <= 10 && /\p{L}/u.test(candidate);
}

function isNameHeader(value) {
  const header = normalizeHeader(value);
  return ["name", "full name", "student name", "certificate name", "print name", "student full name"].includes(header)
    || (header.includes("name") && (header.includes("student") || header.includes("certificate") || header.includes("official")));
}

export function parseNamesMatrix(matrix, { sheetName = "Names Only" } = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) throw new Error("The names file is empty.");
  const scanLimit = Math.min(matrix.length, 10);
  let headerRowIndex = -1;
  let nameColumnIndex = -1;
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const columnIndex = row.findIndex(isNameHeader);
    if (columnIndex >= 0) {
      headerRowIndex = rowIndex;
      nameColumnIndex = columnIndex;
      break;
    }
  }

  if (nameColumnIndex < 0) {
    const firstDataRowIndex = matrix.findIndex((row) => !isBlankRow(row));
    if (firstDataRowIndex < 0) throw new Error("The names file contains no names.");
    const firstRow = matrix[firstDataRowIndex] || [];
    const commonHeaders = firstRow.map(normalizeHeader);
    if (commonHeaders.some((header) => /email|address|phone|score|result|status/.test(header))) {
      throw new Error("Could not find a name column. Use a header such as Student Name or Full Name.");
    }
    nameColumnIndex = firstRow.findIndex(looksLikeName);
    if (nameColumnIndex < 0) throw new Error("Could not find a valid name column in this file.");
    headerRowIndex = firstDataRowIndex - 1;
  }

  const names = [];
  const skippedRows = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const raw = matrix[rowIndex]?.[nameColumnIndex];
    if (text(raw) === "") continue;
    if (!looksLikeName(raw)) {
      skippedRows.push(rowIndex + 1);
      continue;
    }
    names.push(cleanDisplayName(raw));
  }
  if (names.length === 0) throw new Error("No valid certificate names were found in the selected column.");
  return { sheetName, headerRowNumber: headerRowIndex >= 0 ? headerRowIndex + 1 : 0, nameColumnNumber: nameColumnIndex + 1, names, skippedRows };
}

function includesEvery(header, terms) {
  return terms.every((term) => header.includes(term));
}

function findColumn(headers, predicates) {
  const normalized = headers.map(normalizeHeader);
  for (const predicate of predicates) {
    const index = normalized.findIndex(predicate);
    if (index >= 0) return index;
  }
  return -1;
}

function findHeaderRow(matrix, type) {
  const limit = Math.min(matrix.length, 15);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = (matrix[rowIndex] || []).map(normalizeHeader);
    const hasEmail = headers.some((header) => header === "email" || header.includes("email address"));
    if (type === "results") {
      const hasStatus = headers.some((header) => header.includes("pass") && header.includes("fail")) || headers.some((header) => header === "result" || header === "overall result");
      const hasName = headers.some((header) => header === "first name" || header === "student name" || header === "full name");
      if (hasStatus && hasName) return rowIndex;
    } else {
      const hasName = headers.some((header) => header.includes("full name") || header === "student name" || header === "name");
      if (hasName && hasEmail) return rowIndex;
    }
  }
  return -1;
}

function isBlankRow(row) {
  return !row || row.every((value) => text(value) === "");
}

export function parseResultsMatrix(matrix, { sheetName = "Sheet1" } = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error("The results sheet is empty.");
  }
  const headerRowIndex = findHeaderRow(matrix, "results");
  if (headerRowIndex < 0) {
    throw new Error("Could not find a results header containing student name and PASS / FAIL columns.");
  }

  const headers = matrix[headerRowIndex] || [];
  const firstNameIndex = findColumn(headers, [(header) => header === "first name", (header) => includesEvery(header, ["first", "name"])]);
  const lastNameIndex = findColumn(headers, [(header) => header === "last name", (header) => includesEvery(header, ["last", "name"])]);
  const fullNameIndex = findColumn(headers, [(header) => header === "student name", (header) => header === "full name", (header) => header === "name"]);
  const statusIndex = findColumn(headers, [
    (header) => header.includes("pass") && header.includes("fail"),
    (header) => header === "overall result",
    (header) => header === "result",
    (header) => header === "status",
  ]);
  const emailIndex = findColumn(headers, [(header) => header === "email", (header) => header.includes("email address")]);

  if (statusIndex < 0 || (fullNameIndex < 0 && firstNameIndex < 0)) {
    throw new Error("The results sheet is missing a usable name or PASS / FAIL column.");
  }

  const records = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    if (isBlankRow(row)) continue;
    const sourceName = fullNameIndex >= 0
      ? cleanDisplayName(row[fullNameIndex])
      : cleanDisplayName(`${text(row[firstNameIndex])} ${lastNameIndex >= 0 ? text(row[lastNameIndex]) : ""}`);
    const status = text(row[statusIndex]).toLocaleUpperCase("en");
    if (!sourceName && !status) continue;
    records.push({
      id: `result-${rowIndex + 1}`,
      sheetName,
      rowNumber: rowIndex + 1,
      sourceName,
      nameKey: normalizeNameKey(sourceName),
      email: emailIndex >= 0 ? normalizeEmail(row[emailIndex]) : "",
      status,
      passed: status === "PASS",
    });
  }

  return {
    sheetName,
    headerRowNumber: headerRowIndex + 1,
    records,
    passRecords: records.filter((record) => record.passed),
  };
}

export function parseCorrectionsMatrix(matrix, { sheetName = "Corrections" } = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { sheetName, headerRowNumber: 0, records: [] };
  }
  const headerRowIndex = findHeaderRow(matrix, "corrections");
  if (headerRowIndex < 0) {
    throw new Error("Could not find correction columns for full name and email address.");
  }
  const headers = matrix[headerRowIndex] || [];
  const nameIndex = findColumn(headers, [
    (header) => header.includes("full name"),
    (header) => header === "student name",
    (header) => header === "name",
  ]);
  const emailIndex = findColumn(headers, [(header) => header === "email", (header) => header.includes("email address")]);
  if (nameIndex < 0 || emailIndex < 0) {
    throw new Error("The correction file must contain full-name and email columns.");
  }

  const records = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    if (isBlankRow(row)) continue;
    const requestedName = cleanDisplayName(row[nameIndex]);
    const email = normalizeEmail(row[emailIndex]);
    if (!requestedName && !email) continue;
    records.push({
      id: `correction-${rowIndex + 1}`,
      sheetName,
      rowNumber: rowIndex + 1,
      requestedName,
      nameKey: normalizeNameKey(requestedName),
      email,
    });
  }

  return { sheetName, headerRowNumber: headerRowIndex + 1, records };
}

function addToMap(map, key, value) {
  if (!key) return;
  const current = map.get(key) || [];
  current.push(value);
  map.set(key, current);
}

function uniqueById(records) {
  const seen = new Set();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export function reconcileCertificateNames(results, corrections = { records: [] }) {
  const resultRecords = results?.records || [];
  const passRecords = results?.passRecords || resultRecords.filter((record) => record.passed);
  const correctionRecords = corrections?.records || [];
  const byEmail = new Map();
  const byName = new Map();
  resultRecords.forEach((record) => {
    addToMap(byEmail, record.email, record);
    addToMap(byName, record.nameKey, record);
  });

  const correctionMatches = [];
  for (const correction of correctionRecords) {
    const emailCandidates = uniqueById(byEmail.get(correction.email) || []);
    const candidates = emailCandidates.length > 0 ? emailCandidates : uniqueById(byName.get(correction.nameKey) || []);
    const method = emailCandidates.length > 0 ? "email" : candidates.length > 0 ? "name" : "none";
    correctionMatches.push({ correction, candidates, method });
  }

  const correctionsByResultId = new Map();
  correctionMatches.forEach((match) => {
    if (match.candidates.length !== 1) return;
    const result = match.candidates[0];
    const current = correctionsByResultId.get(result.id) || [];
    current.push(match);
    correctionsByResultId.set(result.id, current);
  });

  const names = passRecords.map((result) => {
    const matches = correctionsByResultId.get(result.id) || [];
    const conflict = matches.length > 1 && new Set(matches.map((match) => normalizeNameKey(match.correction.requestedName))).size > 1;
    const appliedMatch = !conflict && matches.length > 0 ? matches[0] : null;
    const printName = appliedMatch?.correction.requestedName || result.sourceName;
    return {
      resultId: result.id,
      resultRowNumber: result.rowNumber,
      sourceName: result.sourceName,
      printName,
      correctionApplied: Boolean(appliedMatch),
      matchMethod: appliedMatch?.method || "original",
      conflict,
    };
  });

  const matchedPassCorrections = correctionMatches.filter((match) => match.candidates.length === 1 && match.candidates[0].passed);
  const matchedNonPassCorrections = correctionMatches.filter((match) => match.candidates.length === 1 && !match.candidates[0].passed);
  const ambiguousCorrections = correctionMatches.filter((match) => match.candidates.length > 1);
  const unmatchedCorrections = correctionMatches.filter((match) => match.candidates.length === 0);
  const resultConflicts = names.filter((record) => record.conflict);
  const duplicatePrintNames = [...names.reduce((map, record) => {
    const key = normalizeNameKey(record.printName);
    const current = map.get(key) || [];
    current.push(record);
    map.set(key, current);
    return map;
  }, new Map()).entries()].filter(([, records]) => records.length > 1);

  return {
    names,
    stats: {
      resultRows: resultRecords.length,
      passCount: passRecords.length,
      correctionRows: correctionRecords.length,
      matchedPassCorrections: matchedPassCorrections.length,
      matchedNonPassCorrections: matchedNonPassCorrections.length,
      unmatchedCorrections: unmatchedCorrections.length,
      ambiguousCorrections: ambiguousCorrections.length,
      correctionsApplied: names.filter((record) => record.correctionApplied).length,
      changedNames: names.filter((record) => record.correctionApplied && normalizeNameKey(record.sourceName) !== normalizeNameKey(record.printName)).length,
      resultConflicts: resultConflicts.length,
      duplicatePrintNames: duplicatePrintNames.length,
    },
    issues: {
      matchedNonPassCorrections,
      unmatchedCorrections,
      ambiguousCorrections,
      resultConflicts,
      duplicatePrintNames,
    },
  };
}

export function findResultsSheet(workbook) {
  if (!workbook?.SheetNames?.length) throw new Error("The workbook contains no worksheets.");
  for (const sheetName of workbook.SheetNames) {
    const matrix = globalThis.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
    try {
      parseResultsMatrix(matrix, { sheetName });
      return { sheetName, matrix };
    } catch {
      // Keep looking for a sheet with the required headers.
    }
  }
  throw new Error("No worksheet contains student names and a PASS / FAIL column.");
}

export function workbookFirstMatrix(workbook) {
  if (!workbook?.SheetNames?.length) throw new Error("The file contains no worksheets.");
  const sheetName = workbook.SheetNames[0];
  return {
    sheetName,
    matrix: globalThis.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false }),
  };
}

export function findNamesSheet(workbook) {
  if (!workbook?.SheetNames?.length) throw new Error("The file contains no worksheets.");
  const preferred = workbook.SheetNames.find((name) => /names?\s*only|certificate\s*names?/i.test(name));
  const ordered = preferred ? [preferred, ...workbook.SheetNames.filter((name) => name !== preferred)] : workbook.SheetNames;
  for (const sheetName of ordered) {
    const matrix = globalThis.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
    try {
      return { sheetName, matrix, parsed: parseNamesMatrix(matrix, { sheetName }) };
    } catch {
      // Try the next worksheet.
    }
  }
  throw new Error("No worksheet contains a usable certificate-name column.");
}
