# OIT Certificate Bulk Printer

A static, privacy-preserving A4 certificate printer. Its main workflow imports a names-only CSV/XLSX and prints one certificate per name. An optional source-matching workflow can also import the Certificate results workbook and submitted correction list, keep only explicit `PASS` rows, and apply exact corrections.

No spreadsheet data is uploaded or stored by the site.

## Use

1. Choose a names-only CSV or Excel file with a `Student Name`, `Full Name`, `Certificate Name`, `Print Name`, or `Name` column. A headerless first column also works.
2. Review the imported list; one A4 preview is created per valid name.
3. Choose **Names only** for pre-printed certificates or **Complete certificate design** for blank A4 paper.
4. Print at A4 portrait, actual size / 100%, one-sided, with browser headers and footers disabled.

Open the optional source-matching panel if you need to rebuild the PASS list from results and correction files.

## Matching safety

- PASS status comes only from the explicit PASS / FAIL column.
- Corrections match by normalized email first, then by exact normalized name.
- Ambiguous matches are not applied automatically.
- FAIL and unmatched correction records are never added to the print list.

Run `npm test` for the reconciliation unit tests.
