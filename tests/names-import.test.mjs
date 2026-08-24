import test from "node:test";
import assert from "node:assert/strict";
import { parseNamesMatrix } from "../src/reconcile.js";

test("imports a names-only sheet with a Student Name header", () => {
  const parsed = parseNamesMatrix([["Student Name"], ["Ada Lovelace"], ["Grace Hopper"]]);
  assert.deepEqual(parsed.names, ["Ada Lovelace", "Grace Hopper"]);
  assert.equal(parsed.headerRowNumber, 1);
});

test("finds a recognized name column when it is not the first column", () => {
  const parsed = parseNamesMatrix([["Number", "Certificate Name"], [1, "Katherine Johnson"], [2, "Dorothy Vaughan"]]);
  assert.deepEqual(parsed.names, ["Katherine Johnson", "Dorothy Vaughan"]);
  assert.equal(parsed.nameColumnNumber, 2);
});

test("accepts a headerless first-column list", () => {
  const parsed = parseNamesMatrix([["Mary Jackson"], ["Annie Easley"], ["Jean-Pierre O'Connor"]]);
  assert.deepEqual(parsed.names, ["Mary Jackson", "Annie Easley", "Jean-Pierre O'Connor"]);
  assert.equal(parsed.headerRowNumber, 0);
});

test("rejects contact-data sheets without a recognized name column", () => {
  assert.throws(() => parseNamesMatrix([["Email Address", "Phone"], ["person@example.test", "12345"]]), /Could not find a name column/);
});

test("skips invalid values but does not silently remove duplicate names", () => {
  const parsed = parseNamesMatrix([["Full Name"], ["Ada Lovelace"], ["ada@example.test"], ["Ada Lovelace"]]);
  assert.deepEqual(parsed.names, ["Ada Lovelace", "Ada Lovelace"]);
  assert.deepEqual(parsed.skippedRows, [3]);
});
