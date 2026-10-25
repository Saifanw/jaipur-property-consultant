import test from "node:test";
import assert from "node:assert/strict";
import { mapRows } from "../adapters/magicbricks.js";
import { normalizeListing } from "../schema.js";
import { sameAdvertisement, scorePair, findCandidates, proposeGroup, decide } from "../dedupe.js";
import { loadFixture, T0, T1, T2 } from "./helpers.js";

const L = (over = {}) => ({
  listingId: "x_1", sourceId: "x", sourceListingId: "1", canonicalUrl: "https://x.com/1", contentHash: "h1",
  localityKey: "vaishali nagar", locality: "Vaishali Nagar", propertyType: "apartment", transaction: "sale",
  areaSqFt: 1756, askingPrice: 13170000, project: "Lucky Heights", bedrooms: 3, sourceTitle: "3BHK apartment Lucky Heights Vaishali Nagar", ...over,
});
const real = () => mapRows(loadFixture()).map(r => normalizeListing(r, { observedAt: T0, runId: "r1" }).listing);

test("stage 1: same source id / canonical URL are the same advertisement", () => {
  assert.equal(sameAdvertisement(L(), L({ listingId: "y_9", sourceId: "y", sourceListingId: "9", canonicalUrl: "https://x.com/1", contentHash: "z" })).same, true);
  assert.equal(sameAdvertisement(L(), L({ listingId: "x_2", sourceListingId: "2", canonicalUrl: "https://x.com/2", contentHash: "h2" })).same, false);
});

test("real sample: nine different projects produce NO duplicate candidates", () => {
  assert.deepEqual(findCandidates(real(), { minScore: 60 }), []);
});

test("stage 2: same project, bedrooms, area, price on another portal -> high-confidence POSSIBLE, never 'confirmed'", () => {
  const b = L({ listingId: "y_7", sourceId: "y", sourceListingId: "7", canonicalUrl: "https://y.com/7", contentHash: "h7", areaSqFt: 1750, askingPrice: 13000000 });
  const r = scorePair(L(), b);
  assert.equal(r.category, "high_confidence_possible");
  assert.ok(r.score >= 85 && r.score < 100);
  assert.ok(r.reasons.length >= 4);
  assert.deepEqual(r.conflicts, []);
});

test("stage 2: a different flat in the same project with a very different price can never reach high confidence", () => {
  const b = L({ listingId: "y_8", sourceId: "y", sourceListingId: "8", canonicalUrl: "https://y.com/8", contentHash: "h8", askingPrice: 20000000 });
  const r = scorePair(L(), b);
  assert.notEqual(r.category, "high_confidence_possible");
  assert.ok(r.score <= 74);
  assert.ok(r.conflicts.some(c => /price/.test(c)));
});

test("stage 2: different locality / type / sale vs rent are probably different", () => {
  const base = L({ listingId: "y_1", sourceId: "y", sourceListingId: "1", canonicalUrl: "https://y.com/1", contentHash: "q" });
  assert.equal(scorePair(L(), { ...base, localityKey: "ajmer road", locality: "Ajmer Road" }).category, "probably_different");
  assert.equal(scorePair(L(), { ...base, propertyType: "plot" }).category, "probably_different");
  assert.equal(scorePair(L(), { ...base, transaction: "rent" }).category, "probably_different");
});

test("coordinates are ignored unless precision is exact (locality centroids are shared)", () => {
  const a = L({ lat: 26.9, lng: 75.7, locationPrecision: "locality" }), b = L({ listingId: "y_1", sourceId: "y", sourceListingId: "1", canonicalUrl: "https://y.com/1", contentHash: "q", bedrooms: null, sourceTitle: "zzz yyy", lat: 26.9, lng: 75.7, locationPrecision: "locality" });
  const exactA = { ...a, locationPrecision: "exact" }, exactB = { ...b, locationPrecision: "exact" };
  assert.ok(scorePair(exactA, exactB).score > scorePair(a, b).score);
});

test("5/6. review workflow: propose -> reject, and the reason is visible", () => {
  const b = L({ listingId: "y_7", sourceId: "y", sourceListingId: "7", canonicalUrl: "https://y.com/7", contentHash: "h7" });
  const c = findCandidates([L(), b])[0];
  let g = proposeGroup(c, T0);
  assert.equal(g.status, "proposed");
  assert.ok(g.reasons.length);
  g = decide(g, "reject", "admin", T1).group;
  assert.equal(g.status, "rejected");
  g = decide(g, "undo", "admin", T2).group;
  assert.equal(g.status, "proposed");
});

test("7. confirm -> merge -> undo restores the previous state; history is kept; merge needs confirm", () => {
  const b = L({ listingId: "y_7", sourceId: "y", sourceListingId: "7", canonicalUrl: "https://y.com/7", contentHash: "h7" });
  let g = proposeGroup(findCandidates([L(), b])[0], T0);
  assert.equal(decide(g, "merge", "admin", T1).ok, false);       // cannot merge an unconfirmed match
  g = decide(g, "confirm", "admin", T1).group;
  g = decide(g, "merge", "admin", T1).group;
  assert.equal(g.status, "merged");
  assert.ok(g.mergedPropertyId);
  assert.equal(decide(g, "reject", "admin", T1).ok, false);       // must undo merge first
  g = decide(g, "undo", "admin", T2).group;
  assert.equal(g.status, "confirmed");
  assert.equal(g.mergedPropertyId, null);
  assert.deepEqual(g.listingIds.sort(), ["x_1", "y_7"]);          // original listing references preserved
  assert.deepEqual(g.history.map(h => h.action), ["proposed", "confirm", "merge", "undo"]);   // failed attempts are not logged as actions
  assert.equal(decide(proposeGroup(findCandidates([L(), b])[0], T0), "undo", "admin", T1).ok, false);
});
