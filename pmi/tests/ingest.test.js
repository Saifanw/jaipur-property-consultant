import test from "node:test";
import assert from "node:assert/strict";
import { mapRows } from "../adapters/magicbricks.js";
import { planIngest, planMissing, applyPlanToMemory, newMemoryStore, freshness } from "../ingest.js";
import { loadFixture, clone, T0, T1, T2, T3, run } from "./helpers.js";

const ingest = (store, rows, r, now, { applyMissing = true } = {}) => {
  const plan = planIngest({ run: r, rawListings: mapRows(rows), existing: store.listings, now });
  const missing = applyMissing ? planMissing({ run: r, sourceListings: [...store.listings.values()], seenIds: plan.seenIds, now }) : { updates: [] };
  applyPlanToMemory(store, plan, missing);
  return { plan, missing };
};

test("1. a valid collection is ingested: 9 listings + 9 first observations", () => {
  const s = newMemoryStore();
  const { plan } = ingest(s, loadFixture(), run("r1"), T0);
  assert.equal(s.listings.size, 9);
  assert.equal(s.observations.size, 9);
  assert.equal(plan.summary.new, 9);
  assert.equal(plan.summary.rejected, 0);
  const l = s.listings.get("magicbricks_86785825");
  assert.equal(l.firstSeenAt, T0);
  assert.equal(l.listingStatus, "active");
});

test("2a. replaying the SAME run creates no duplicates and the stored state is identical", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const snap = JSON.stringify([...s.listings].sort(), (k, v) => v);
  const obsBefore = s.observations.size;
  ingest(s, loadFixture(), run("r1"), T0);
  assert.equal(s.listings.size, 9);
  assert.equal(s.observations.size, obsBefore);
  assert.equal(JSON.stringify([...s.listings].sort()), snap);
});

test("2b. a NEW run with unchanged data: no new observation, lastSeenAt moves, firstSeenAt stays", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const { plan } = ingest(s, loadFixture(), run("r2"), T1);
  assert.equal(plan.summary.unchanged, 9);
  assert.equal(plan.observationWrites.length, 0);
  assert.equal(s.observations.size, 9);
  const l = s.listings.get("magicbricks_86785825");
  assert.equal(l.firstSeenAt, T0);
  assert.equal(l.lastSeenAt, T1);
});

test("2c. the same listing twice inside one batch is stored once", () => {
  const s = newMemoryStore();
  const rows = loadFixture(); rows.push(clone(rows[0]));
  const { plan } = ingest(s, rows, run("r1"), T0);
  assert.equal(s.listings.size, 9);
  assert.equal(plan.summary.duplicatesInBatch, 1);
});

test("3. a price reduction creates a new observation and keeps the old price in history", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const rows = loadFixture(); rows[0].price = 12500000; rows[0].priceDisplay = "1.25 Cr";
  const { plan } = ingest(s, rows, run("r2"), T1);
  assert.equal(plan.summary.priceDrops, 1);
  assert.equal(plan.summary.changed, 1);
  assert.equal(s.observations.size, 10);
  const id = "magicbricks_86785825";
  const first = s.observations.get(`${id}__r1`), second = s.observations.get(`${id}__r2`);
  assert.equal(first.askingPrice, 13886000);                 // original NOT overwritten
  assert.equal(second.askingPrice, 12500000);
  assert.deepEqual(second.changedFields.includes("askingPrice"), true);
  assert.equal(second.priceChange.from, 13886000);
  assert.equal(second.priceChange.pct, -9.98);
  const l = s.listings.get(id);
  assert.equal(l.askingPrice, 12500000);
  assert.equal(l.previousPrice, 13886000);
  assert.equal(l.lastPriceChangeAt, T1);
  assert.equal(l.priceChangeCount, 1);
});

test("3b. a price increase is recorded as an increase", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const rows = loadFixture(); rows[1].price = 8500000;
  const { plan } = ingest(s, rows, run("r2"), T1);
  assert.equal(plan.summary.priceIncreases, 1);
  assert.ok(plan.observationWrites[0].priceChange.pct > 0);
});

test("4a. a brand-new listing with a missing price is stored safely and flagged", () => {
  const s = newMemoryStore();
  const rows = loadFixture(); rows[0].price = null; rows[0].priceDisplay = null;
  const { plan } = ingest(s, rows, run("r1"), T0);
  const l = s.listings.get("magicbricks_86785825");
  assert.equal(l.askingPrice, null);
  assert.equal(l.pricePerSqFt, null);
  assert.ok(l.flags.includes("price_missing"));
  assert.equal(plan.summary.missingCritical.askingPrice, 1);
});

test("4b. a later row with no usable price does NOT erase the last known price", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const rows = loadFixture(); rows[0].price = null; rows[0].priceDisplay = "Call for Price";
  const { plan } = ingest(s, rows, run("r2"), T1);
  const l = s.listings.get("magicbricks_86785825");
  assert.equal(l.askingPrice, 13886000);
  assert.ok(l.flags.includes("price_missing_in_latest_observation"));
  assert.equal(plan.summary.priceDrops, 0);
  assert.ok(plan.observationWrites[0].changedFields.includes("price_unavailable"));
});

test("10a. a FAILED run changes nothing and marks nothing unavailable", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const before = JSON.stringify([...s.listings]);
  const { plan, missing } = ingest(s, [], run("r2", "failed"), T1);
  assert.equal(plan.listingWrites.length, 0);
  assert.deepEqual(missing.updates, []);
  assert.equal(JSON.stringify([...s.listings]), before);
});

test("10b. a PARTIAL run that returned fewer rows does not mark the rest as missing", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const { missing } = ingest(s, loadFixture().slice(0, 3), run("r2", "partial"), T1);
  assert.deepEqual(missing.updates, []);
  assert.ok(missing.skipped);
  for (const l of s.listings.values()) assert.equal(l.listingStatus, "active");
});

test("10c. a COMPLETE run: one miss is only counted; second consecutive miss => not_observed (never 'sold')", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const rows = loadFixture().slice(1);                         // first listing disappears
  ingest(s, rows, run("r2"), T1);
  let l = s.listings.get("magicbricks_86785825");
  assert.equal(l.missedRuns, 1);
  assert.equal(l.listingStatus, "active");
  ingest(s, rows, run("r3"), T2);
  l = s.listings.get("magicbricks_86785825");
  assert.equal(l.listingStatus, "not_observed");
  assert.ok(!JSON.stringify(l).includes("sold"));
  assert.equal(freshness(l, T2), "no_longer_observed");
});

test("10d. a listing in a DIFFERENT scope is not affected by a complete run for another scope", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1", "complete", "magicbricks|jaipur|sale"), T0);
  const { missing } = ingest(s, loadFixture().slice(0, 1), run("r2", "complete", "magicbricks|jaipur|rent"), T1);
  assert.deepEqual(missing.updates, []);
});

test("10e. a listing that comes back is reactivated and the observation says 'reappeared'", () => {
  const s = newMemoryStore();
  ingest(s, loadFixture(), run("r1"), T0);
  const rows = loadFixture().slice(1);
  ingest(s, rows, run("r2"), T1); ingest(s, rows, run("r3"), T2);
  const { plan } = ingest(s, loadFixture(), run("r4"), T3);
  assert.equal(plan.summary.reappeared, 1);
  const l = s.listings.get("magicbricks_86785825");
  assert.equal(l.listingStatus, "active");
  assert.equal(l.missedRuns, 0);
  assert.ok(s.observations.get("magicbricks_86785825__r4").changedFields.includes("reappeared"));
});

test("freshness uses last-seen, not the source's listing date", () => {
  const l = { listingStatus: "active", lastSeenAt: "2026-10-24T00:00:00Z", listedAt: "2020-01-01" };
  assert.equal(freshness(l, "2026-10-25T00:00:00Z"), "recently_observed");
  assert.equal(freshness(l, "2026-11-01T00:00:00Z"), "aging");
  assert.equal(freshness(l, "2026-11-20T00:00:00Z"), "stale_candidate");
  assert.equal(freshness(l, "2027-01-20T00:00:00Z"), "needs_reverification");
});

test("run summary reports quality counters", () => {
  const s = newMemoryStore();
  const rows = loadFixture(); rows[2].price = "35"; rows[2].priceDisplay = "35";
  const { plan } = ingest(s, rows, run("r1"), T0);
  assert.equal(plan.summary.received, 9);
  assert.equal(plan.summary.parsed, 9);
  assert.ok(plan.summary.flagCounts.location_approximate === 9);
  assert.ok(plan.summary.flagCounts.listed_date_derived >= 1);
});
