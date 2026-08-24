import test from "node:test";
import assert from "node:assert/strict";
import { cleanDisplayName, parseCorrectionsMatrix, parseResultsMatrix, reconcileCertificateNames } from "../src/reconcile.js";

const resultsMatrix = [
  ["First Name", "Last Name", "PASS / FAIL", "Email"],
  ["Alice", "Example", "PASS", "alice@example.test"],
  ["Bob", "Failure", "FAIL", "bob@example.test"],
  ["CHARLENE", "BOWEN", "PASS", "old@example.test"],
  ["Sushma", "Rayala", "PASS", ""],
];
const correctionMatrix = [
  ["Please enter your full name as it appears on your official documents", "Email Address"],
  ["Alice, M. Example", "alice@example.test"],
  ["Bob Corrected", "bob@example.test"],
  ["Charlene Bowen", "new@example.test"],
  ["SUSHMA RAYALA", "missing@example.test"],
  ["Nobody Here", "nobody@example.test"],
];

test("keeps every PASS and excludes FAIL", () => {
  const parsed = parseResultsMatrix(resultsMatrix);
  assert.equal(parsed.records.length, 4);
  assert.equal(parsed.passRecords.length, 3);
});

test("matches corrections by email, then exact normalized name", () => {
  const report = reconcileCertificateNames(parseResultsMatrix(resultsMatrix), parseCorrectionsMatrix(correctionMatrix));
  assert.deepEqual(report.names.map((row) => row.printName), ["Alice M. Example", "Charlene Bowen", "Sushma Rayala"]);
  assert.equal(report.stats.matchedPassCorrections, 3);
  assert.equal(report.stats.matchedNonPassCorrections, 1);
  assert.equal(report.stats.unmatchedCorrections, 1);
});

test("cleans commas and uniform casing without reversing names", () => {
  assert.equal(cleanDisplayName("EDSON, VEREMU"), "Edson Veremu");
  assert.equal(cleanDisplayName("Anne-Marie O'NEIL"), "Anne-Marie O'NEIL");
});

test("does not silently apply an ambiguous email match", () => {
  const duplicate = parseResultsMatrix([resultsMatrix[0], resultsMatrix[1], ["Alicia", "Other", "PASS", "alice@example.test"]]);
  const corrections = parseCorrectionsMatrix([correctionMatrix[0], correctionMatrix[1]]);
  const report = reconcileCertificateNames(duplicate, corrections);
  assert.equal(report.stats.ambiguousCorrections, 1);
  assert.deepEqual(report.names.map((row) => row.printName), ["Alice Example", "Alicia Other"]);
});
