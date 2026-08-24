# OIT Certificate Bulk Printer

A static, privacy-preserving A4 certificate printer. It imports the Certificate results workbook and the submitted correction list in the browser, keeps only explicit `PASS` rows, applies exact email matches with exact normalized-name fallback, and prints one certificate per name.

No spreadsheet data is uploaded or stored by the site.

## Use

1. Choose the results Excel workbook.
2. Choose the corrections CSV or Excel file.
3. Select **Match PASS names**, review the list, and optionally download a names-only CSV/XLSX.
4. Choose **Names only** for pre-printed certificates or **Complete certificate design** for blank A4 paper.
5. Print at A4 portrait, actual size / 100%, one-sided, with browser headers and footers disabled.

## Matching safety

- PASS status comes only from the explicit PASS / FAIL column.
- Corrections match by normalized email first, then by exact normalized name.
- Ambiguous matches are not applied automatically.
- FAIL and unmatched correction records are never added to the print list.

Run `npm test` for the reconciliation unit tests.
