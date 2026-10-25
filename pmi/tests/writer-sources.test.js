import test from "node:test";
import assert from "node:assert/strict";
import { commitPlan, fetchExisting, COLLECTIONS, runDoc, finishRun } from "../firestore-writer.js";
import { DEFAULT_SOURCES, validateSource } from "../sources.js";

function fakeSdk() {
  const calls = { batches: [], queries: [] };
  return {
    calls,
    collection: (_db, name) => ({ name }),
    doc: (_db, col, id) => ({ col, id }),
    documentId: () => "__id__",
    where: (f, op, v) => ({ f, op, v }),
    query: (c, w) => ({ c, w }),
    getDocs: async q => { calls.queries.push(q.w.v.length); return { forEach: fn => q.w.v.slice(0, 1).forEach(id => fn({ id, data: () => ({ listingId: id }) })) }; },
    writeBatch: () => { const b = { n: 0, set() { b.n++; }, commit: async () => { calls.batches.push(b.n); } }; return b; },
  };
}

test("commitPlan splits into <=400-write batches and covers every write", async () => {
  const sdk = fakeSdk();
  const plan = { listingWrites: Array.from({ length: 700 }, (_, i) => ({ id: "l" + i, data: {} })), observationWrites: Array.from({ length: 300 }, (_, i) => ({ observationId: "o" + i })) };
  const r = await commitPlan({ db: {}, sdk }, plan);
  assert.deepEqual(sdk.calls.batches, [400, 400, 200]);
  assert.equal(r.committed, 1000);
});

test("fetchExisting reads ids 30 at a time (Firestore 'in' limit) and de-duplicates ids", async () => {
  const sdk = fakeSdk();
  const ids = Array.from({ length: 65 }, (_, i) => "id" + i).concat(["id0"]);
  const m = await fetchExisting({ db: {}, sdk }, ids);
  assert.deepEqual(sdk.calls.queries, [30, 30, 5]);
  assert.ok(m instanceof Map);
});

test("collections are all new pmi* names; none collide with existing CRM collections", () => {
  const existing = ["crmContacts", "publicRequirements", "publicSubmissions", "publicReviews", "publicQuestions", "crmMatches", "crmInterests", "websiteAnalytics", "websiteEvents"];
  for (const c of Object.values(COLLECTIONS)) { assert.ok(c.startsWith("pmi")); assert.ok(!existing.includes(c)); }
});

test("run documents record status transitions", () => {
  const r = runDoc({ runId: "r1", sourceId: "manual", scopeKey: "s", trigger: "manual", startedAt: "t0" });
  assert.equal(r.status, "running");
  const f = finishRun(r, { status: "failed", error: "timeout", summary: null, finishedAt: "t1" });
  assert.equal(f.status, "failed"); assert.equal(f.error, "timeout"); assert.equal(f.startedAt, "t0");
});

test("source registry: defaults are valid; MagicBricks is OFF until the owner decides", () => {
  for (const s of DEFAULT_SOURCES) assert.deepEqual(validateSource(s), [], s.sourceId);
  const mb = DEFAULT_SOURCES.find(s => s.sourceId === "magicbricks");
  assert.equal(mb.enabled, false);
  assert.ok(validateSource({ ...mb, enabled: true }).some(e => /pending_owner_decision/.test(e)));
  assert.ok(validateSource({ sourceId: "BAD id", name: "x", adapter: "a", collectionMethod: "apify_actor", enabled: false, limits: { maxRowsPerRun: 0 } }).length >= 3);
});
