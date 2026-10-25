import test from "node:test";
import assert from "node:assert/strict";
import { mapRows, mapRow } from "../adapters/magicbricks.js";
import { mapRow as manualRow } from "../adapters/manual.js";
import { normalizeListing } from "../schema.js";
import { loadFixture, clone, T0 } from "./helpers.js";

const norm = raws => raws.map(r => normalizeListing(r, { observedAt: T0, runId: "r1" }));

test("real MagicBricks sample: all 9 rows normalise", () => {
  const rows = norm(mapRows(loadFixture()));
  assert.equal(rows.length, 9);
  assert.ok(rows.every(r => r.ok));
  const l = rows[0].listing;
  assert.equal(l.listingId, "magicbricks_86785825");
  assert.equal(l.askingPrice, 13886000);
  assert.equal(l.areaSqFt, 2042);
  assert.equal(l.transaction, "sale");
  assert.equal(l.propertyType, "apartment");
});

test("apartments never get a price per gaj; they get a LABELLED price per sq ft", () => {
  for (const { listing: l } of norm(mapRows(loadFixture()))) {
    assert.equal(l.pricePerGaj, null);
    assert.equal(l.pricePerSqFtBasis, "built_up");
    assert.ok(l.rateNotes.includes("pricePerGaj_needs_plot_area"));
  }
});

test("derived price per sq ft agrees with the source's own pricePerSqft within 1%", () => {
  const fx = loadFixture();
  norm(mapRows(fx)).forEach(({ listing: l }, i) => {
    const src = fx[i].pricePerSqft;
    assert.ok(Math.abs(l.pricePerSqFt - src) / src < 0.01, `${l.listingId}: ${l.pricePerSqFt} vs ${src}`);
  });
});

test("fixture evidence: two different projects share identical coordinates -> locality-level precision", () => {
  const fx = loadFixture();
  const a = fx.find(r => r.project === "Vardhman Kings Court"), b = fx.find(r => r.project === "Lucky Heights 4 and 5");
  assert.equal(a.latitude, b.latitude); assert.equal(a.longitude, b.longitude); assert.notEqual(a.project, b.project);
  for (const { listing: l } of norm(mapRows(fx))) {
    assert.equal(l.locationPrecision, "locality");
    assert.ok(l.flags.includes("location_approximate"));
  }
});

test("listed date: explicit kept, relative derived, and it agrees with the Actor's postedDateExact day", () => {
  const fx = loadFixture();
  norm(mapRows(fx)).forEach(({ listing: l }, i) => {
    assert.equal(l.listedAt, fx[i].postedDateExact.slice(0, 10), l.listingId);
    assert.equal(l.listedAtDerived, /yesterday/i.test(fx[i].postedDate));
  });
});

test("no personal contact data is copied: lister name and phone are dropped", () => {
  const row = { ...clone(loadFixture()[0]), listerName: "Ramesh Sharma", phone: "9876543210", contactNumber: "9876543210" };
  const json = JSON.stringify(norm([mapRow(row)])[0].listing);
  assert.ok(!/Ramesh|9876543210|listerName/.test(json));
  assert.equal(JSON.parse(json).advertiserType, "Agent");
});

test("non-property rows are skipped; a row with no id or url is rejected, not guessed", () => {
  assert.equal(mapRow({ rowType: "project" }), null);
  const r = clone(loadFixture()[0]); delete r.listingId; delete r.propertyUrl;
  const n = normalizeListing(mapRow(r), { observedAt: T0, runId: "r1" });
  assert.equal(n.ok, false);
});

test("manual adapter: plot with gaj + dimensions, ambiguous area is flagged", () => {
  const plot = normalizeListing(manualRow({ ID: "P1", Type: "Residential Plot", Locality: "Jhotwara", Price: "35 lakh", Area: 100, Unit: "gaj", Dimensions: "30x30 ft" }), { observedAt: T0, runId: "r1" }).listing;
  assert.equal(plot.askingPrice, 3500000);
  assert.equal(plot.areaGaj, 100);
  assert.equal(plot.pricePerGaj, 35000);                         // plot area -> per-gaj allowed
  assert.ok(!plot.flags.includes("area_dimension_mismatch"));    // 30x30 = 900 sqft = 100 gaj
  const bad = normalizeListing(manualRow({ ID: "P2", Type: "plot", Locality: "Jhotwara", Price: "35 lakh", Area: 100 }), { observedAt: T0, runId: "r1" }).listing;
  assert.equal(bad.pricePerGaj, null);
  assert.ok(bad.flags.includes("area_unit_missing"));
  const mismatch = normalizeListing(manualRow({ ID: "P3", Type: "plot", Locality: "Jhotwara", Price: "35 lakh", Area: 120, Unit: "gaj", Dimensions: "30x30 ft" }), { observedAt: T0, runId: "r1" }).listing;
  assert.ok(mismatch.flags.includes("area_dimension_mismatch"));
  const noPrice = normalizeListing(manualRow({ ID: "P4", Type: "plot", Locality: "Jhotwara", Price: "On Request", Area: 100, Unit: "gaj" }), { observedAt: T0, runId: "r1" }).listing;
  assert.equal(noPrice.askingPrice, null);
  assert.equal(noPrice.pricePerGaj, null);
  assert.ok(noPrice.dataQuality.score < plot.dataQuality.score);
});
