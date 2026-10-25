import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePrice, parseArea, parseDimensions, checkAreaConsistency, computeRates,
  parseListedDate, canonicalUrl, safeCell, localityKey, priceKindFromText,
} from "../normalize.js";

test("price: lakh / lacs / crore / plain INR all give the same canonical number", () => {
  assert.equal(parsePrice("₹35 lakh").value, 3500000);
  assert.equal(parsePrice("Rs. 35 Lacs").value, 3500000);
  assert.equal(parsePrice("0.35 crore").value, 3500000);
  assert.equal(parsePrice("3500000 INR").value, 3500000);
  assert.equal(parsePrice("1.38 Cr").value, 13800000);
  assert.equal(parsePrice("79.9 Lac").value, 7990000);
  assert.equal(parsePrice(3500000).value, 3500000);
  assert.equal(parsePrice("₹35 lakh").raw, "₹35 lakh");
});

test("price: ambiguous / missing never guessed", () => {
  assert.equal(parsePrice("35").value, null);
  assert.ok(parsePrice("35").flags.includes("price_ambiguous_no_unit"));
  assert.ok(parsePrice("On Request").flags.includes("price_on_request"));
  assert.ok(parsePrice(null).flags.includes("price_missing"));
  assert.ok(parsePrice("").flags.includes("price_missing"));
  assert.ok(parsePrice(0).flags.includes("price_invalid"));
  assert.ok(parsePrice("35-40 lakh").flags.includes("price_is_range"));
  assert.equal(parsePrice("35-40 lakh").value, null);
});

test("price: rent, deposit, per-area are not mistaken for a sale price", () => {
  assert.equal(parsePrice("₹25,000 per month").kind, "rent_monthly");
  assert.equal(parsePrice("2 lakh deposit").kind, "deposit");
  assert.equal(parsePrice("₹45,000 per gaj").kind, "per_area");
  assert.equal(priceKindFromText("Token amount 1 lakh"), "token");
  assert.equal(parsePrice("35 lakh").kind, "total");
});

test("area: unit conversions use the documented constants", () => {
  assert.equal(parseArea(100, "gaj").areaSqFt, 900);
  assert.equal(parseArea(100, "gaj").areaGaj, 100);
  assert.equal(parseArea(900, "sq ft").areaGaj, 100);
  assert.equal(parseArea("72 sq yd").areaSqFt, 648);
  assert.equal(parseArea(100, "sqm").areaSqFt, 1076.39);
  assert.equal(parseArea(1, "acre").areaGaj, 4840);
});

test("area: bigha is never silently converted", () => {
  const a = parseArea(1, "bigha");
  assert.equal(a.areaSqFt, null);
  assert.ok(a.flags.includes("bigha_needs_conversion_basis"));
  assert.equal(parseArea(1, "bigha", { bighaSqYd: 3025 }).areaGaj, 3025);
});

test("area: zero, negative, unknown or missing unit are flagged, not computed", () => {
  assert.ok(parseArea(0, "gaj").flags.includes("area_zero"));
  assert.ok(parseArea(-5, "gaj").flags.length);
  assert.ok(parseArea(100, "marla").flags.includes("area_unit_unknown"));
  assert.ok(parseArea(100, "").flags.includes("area_unit_missing"));
  assert.equal(parseArea(null, "gaj").areaGaj, null);
});

test("dimensions: 15x40 ft = 600 sq ft = 66.67 gaj; unit missing is flagged", () => {
  const d = parseDimensions("15 x 40 ft");
  assert.equal(d.areaSqFt, 600);
  assert.equal(parseArea(d.areaSqFt, "sqft").areaGaj, 66.67);
  assert.equal(parseDimensions("15×40 feet").areaSqFt, 600);
  const noUnit = parseDimensions("15x40");
  assert.equal(noUnit.areaSqFt, null);
  assert.ok(noUnit.flags.includes("dimension_unit_unspecified"));
  assert.equal(parseDimensions("no dims here").a, null);
});

test("dimension vs advertised area mismatch is flagged", () => {
  assert.deepEqual(checkAreaConsistency(600, 600), []);
  assert.deepEqual(checkAreaConsistency(700, 600), ["area_dimension_mismatch"]);
  assert.deepEqual(checkAreaConsistency(null, 600), []);
});

test("rates: price per gaj only for sale + total price + PLOT area", () => {
  const ok = computeRates({ transaction: "sale", priceKind: "total", priceInr: 3500000, areaSqFt: 900, areaBasis: "plot" });
  assert.equal(ok.pricePerGaj, 35000);
  const flat = computeRates({ transaction: "sale", priceKind: "total", priceInr: 13886000, areaSqFt: 2042, areaBasis: "built_up" });
  assert.equal(flat.pricePerGaj, null);
  assert.equal(flat.pricePerSqFt, 6800);
  assert.equal(flat.pricePerSqFtBasis, "built_up");
  assert.ok(flat.reasons.includes("pricePerGaj_needs_plot_area"));
  assert.equal(computeRates({ transaction: "rent", priceKind: "total", priceInr: 25000, areaSqFt: 900, areaBasis: "plot" }).pricePerGaj, null);
  assert.equal(computeRates({ transaction: "sale", priceKind: "deposit", priceInr: 25000, areaSqFt: 900, areaBasis: "plot" }).pricePerGaj, null);
  assert.equal(computeRates({ transaction: "sale", priceKind: "total", priceInr: 3500000, areaSqFt: 0, areaBasis: "plot" }).pricePerGaj, null);
  assert.equal(computeRates({ transaction: "sale", priceKind: "total", priceInr: 3500000, areaSqFt: 900, areaBasis: "unknown" }).pricePerGaj, null);
});

test("listed date: explicit date kept; relative marked derived; unknown -> null (never first-seen)", () => {
  const obs = "2026-10-24T15:11:13.787Z";
  assert.deepEqual(
    (({ listedAt, derived }) => ({ listedAt, derived }))(parseListedDate("Posted: Oct 20, '26", obs)),
    { listedAt: "2026-10-20", derived: false });
  const y = parseListedDate("Posted Yesterday", obs);
  assert.equal(y.listedAt, "2026-10-23");
  assert.equal(y.derived, true);
  assert.equal(parseListedDate("3 days ago", obs).listedAt, "2026-10-21");
  assert.equal(parseListedDate("Ready to move", obs).listedAt, null);
  assert.equal(parseListedDate("", obs).listedAt, null);
  assert.equal(parseListedDate("Posted Yesterday", null).listedAt, null);
});

test("urls, locality keys, spreadsheet safety", () => {
  assert.equal(canonicalUrl("https://x.com/a?id=1&utm_source=fb#top"), "https://x.com/a?id=1");
  assert.equal(canonicalUrl("not a url"), null);
  assert.equal(localityKey("  Vaishali  Nagar. "), "vaishali nagar");
  assert.notEqual(localityKey("Jhotwara"), localityKey("Jhotwara Extension"));
  assert.equal(safeCell("=HYPERLINK(\"http://evil\")"), "'=HYPERLINK(\"http://evil\")");
  assert.equal(safeCell("+91 63505"), "'+91 63505");
  assert.equal(safeCell("Plot"), "Plot");
  assert.equal(safeCell(12), 12);
});
