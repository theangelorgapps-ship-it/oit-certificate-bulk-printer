const url = process.env.OIT_PAGES_URL || "https://theangelorgapps-ship-it.github.io/oit-certificate-bulk-printer/";
const response = await fetch(url, { redirect: "follow" });
if (!response.ok) throw new Error(`Pages returned HTTP ${response.status}: ${url}`);
const html = await response.text();
if (!html.includes("OIT Certificate Bulk Printer") || !html.includes("Bulk certificate printer")) {
  throw new Error("The deployed page does not contain the expected application markers.");
}
console.log(`PAGES_URL=${url}`);
console.log("PAGES_DEPLOYMENT: PASS");
