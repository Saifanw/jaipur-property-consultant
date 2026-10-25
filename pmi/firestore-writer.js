/* Thin Firestore adapter. The Firebase SDK functions are INJECTED so this file has no import of the SDK, works with the
   browser modular SDK (as used by admin.html) and can be unit-tested with a fake.
   Usage (browser):
     import * as fs from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
     await commitPlan({ db, sdk: fs }, plan, missing);
   Firestore limits respected: <= 500 writes per batch (we use 400), `in` queries <= 30 ids. */

export const COLLECTIONS = {
  sources: "pmiSources", runs: "pmiCollectionRuns", listings: "pmiListings", properties: "pmiProperties",
  observations: "pmiObservations", duplicateGroups: "pmiDuplicateGroups", flags: "pmiOpportunityFlags",
  audit: "pmiAuditLogs", settings: "pmiSettings",
};
export const BATCH_SIZE = 400;
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

/** Read already-stored listings for the ids we are about to ingest (30 per query, no collection scans). */
export async function fetchExisting({ db, sdk }, ids) {
  const out = new Map();
  for (const part of chunk([...new Set(ids)], 30)) {
    const q = sdk.query(sdk.collection(db, COLLECTIONS.listings), sdk.where(sdk.documentId(), "in", part));
    const snap = await sdk.getDocs(q);
    snap.forEach(d => out.set(d.id, d.data()));
  }
  return out;
}

/** Commit a plan. set(merge) is idempotent: replaying the same plan gives the same documents. */
export async function commitPlan({ db, sdk }, plan, missing = { updates: [] }, opts = {}) {
  const ops = [
    ...plan.listingWrites.map(w => ({ col: COLLECTIONS.listings, id: w.id, data: w.data })),
    ...missing.updates.map(w => ({ col: COLLECTIONS.listings, id: w.id, data: w.data })),
    ...plan.observationWrites.map(o => ({ col: COLLECTIONS.observations, id: o.observationId, data: o })),
  ];
  let committed = 0;
  for (const part of chunk(ops, opts.batchSize || BATCH_SIZE)) {
    const batch = sdk.writeBatch(db);
    for (const op of part) batch.set(sdk.doc(db, op.col, op.id), op.data, { merge: true });
    await batch.commit();
    committed += part.length;
  }
  return { committed, batches: Math.ceil(ops.length / (opts.batchSize || BATCH_SIZE)) };
}

/** Run record written at start (status "running") and finalised at the end, so failures are visible. */
export function runDoc({ runId, sourceId, scopeKey, trigger, startedAt, params = {} }) {
  return { runId, sourceId, scopeKey, trigger, startedAt, finishedAt: null, status: "running", params, summary: null, error: null, costUsd: null, apifyRunId: null };
}
export const finishRun = (run, { status, summary, error = null, finishedAt, costUsd = null, apifyRunId = null }) => ({ ...run, status, summary, error, finishedAt, costUsd, apifyRunId });
