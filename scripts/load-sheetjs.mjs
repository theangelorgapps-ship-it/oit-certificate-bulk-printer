import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export function loadSheetJs() {
  const vendorPath = fileURLToPath(new URL("../assets/xlsx.full.min.js", import.meta.url));
  const sandbox = { console, setTimeout, clearTimeout, TextDecoder, TextEncoder, ArrayBuffer, Uint8Array };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(vendorPath, "utf8"), sandbox, { filename: vendorPath });
  if (!sandbox.XLSX) throw new Error("Could not load the local SheetJS parser.");
  return sandbox.XLSX;
}

export function readMatrix(XLSX, filePath, sheetName) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { raw: false });
  const selected = sheetName || workbook.SheetNames[0];
  if (!workbook.Sheets[selected]) throw new Error(`Worksheet not found: ${selected}`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[selected], { header: 1, defval: null, raw: false });
}
