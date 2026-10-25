/* Idempotent ingestion planner. PURE: takes what was collected + what is already stored, returns the exact writes to
   perform. A separate writer (firestore-writer.js) commits them. This split makes every rule below unit-testable.

   Guarantees
   - Same advertisement -> same listingId, so re-ingesting never creates a second record.
   - Observation ids are deterministic (listingId + runId), so replaying a run overwrites identical docs.
   - A price/area/content change creates a NEW observation; earlier observations are never modified.
   - A failed run changes nothing. A partial run never marks anything as missing.
   - "Not seen" is only ever concluded after N consecutive COMPLETE runs for the same scope, and is labelled
     `not_observed`, never "sold". */

import { normalizeListing, makeObservationId } from "./schema.js";

export const DEFAULT_CONFIG = {
  missesBeforeNotObserved: 2,
  freshnessDays: { recentlyObserved: 3, aging: 14, staleCandidate: 30 },   // beyond staleCandidate -> needs_reverification
};

const CRITICAL = ["askingPrice", "areaSqFt", "localityKey"];

function observationFor(l, now, run, changedFields, priceChange) {
  return {
    observationId: makeObservationId(l.listingId, run.runId),
    listingId: l.listingId,
    observedAt: now,
    askingPrice: l.askingPrice ?? null,
    advertisedArea: l.advertisedArea ?? null,
    areaSqFt: l.areaSqFt ?? null,
    pricePerGaj: l.pricePerGaj ?? null,
    pricePerSqFt: l.pricePerSqFt ?? null,
    listingStatus: "active",
    sourceAvailability: "listed",
    sourceTitleHash: l.titleHash,
    sourceContentHash: l.contentHash,
    changedFields,
    priceChange: priceChange || null,
    flags: l.flags,
    collectionRunId: run.runId,
    sourceId: l.sourceId,
  };
}

/**
 * @param {{run:{runId,sourceId,scopeKey,status:'complete'|'partial'|'failed'}, rawListings:Array, existing:Map|Object, now:string, config?:object}} a
 * @returns {{listingWrites:Array, observationWrites:Array, summary:object, rejected:Array, seenIds:Set}}
 */
export function planIngest({ run, rawListings, existing, now, config = DEFAULT_CONFIG }) {
  const get = id => (existing instanceof Map ? existing.get(id) : existing?.[id]);
  const summary = {
    runId: run.runId, sourceId: run.sourceId, runStatus: run.status,
    received: rawListings.length, parsed: 0, rejected: 0, new: 0, changed: 0, unchanged: 0,
    priceDrops: 0, priceIncreases: 0, reappeared: 0, duplicatesInBatch: 0,
    invalidPrices: 0, invalidAreas: 0, missingCritical: { askingPrice: 0, areaSqFt: 0, localityKey: 0 },
    flagCounts: {},
  };
  const out = { listingWrites: [], observationWrites: [], summary, rejected: [], seenIds: new Set() };
  if (run.status === "failed") { summary.note = "failed run: no listing was touched"; return out; }

  // one record per listingId inside a batch (later row wins)
  const byId = new Map();
  for (const raw of rawListings) {
    const r = normalizeListing(raw, { observedAt: now, runId: run.runId });
    if (!r.ok) { summary.rejected++; out.rejected.push({ reason: r.reason, flags: r.flags, title: raw?.title ?? null }); continue; }
    if (byId.has(r.listing.listingId)) summary.duplicatesInBatch++;
    byId.set(r.listing.listingId, r.listing);
  }

  for (const l of byId.values()) {
    summary.parsed++;
    out.seenIds.add(l.listingId);
    for (const f of l.flags) summary.flagCounts[f] = (summary.flagCounts[f] || 0) + 1;
    if (l.flags.some(f => /^price_(invalid|unparseable|is_range)/.test(f))) summary.invalidPrices++;
    if (l.flags.some(f => /^area_(unparseable|zero|missing_or_invalid|unit_unknown|unit_missing)|bigha_needs/.test(f))) summary.invalidAreas++;
    for (const k of CRITICAL) if (l[k] == null) summary.missingCritical[k]++;

    const old = get(l.listingId);
    if (!old) {
      const data = {
        ...l, listingStatus: "active", missedRuns: 0, priceChangeCount: 0, previousPrice: null, lastPriceChangeAt: null,
        firstSeenAt: now, lastSeenAt: now, lastSuccessfulCheckAt: now, createdAt: now, updatedAt: now,
        lastRunId: run.runId, scopeKey: run.scopeKey ?? null,
      };
      const obs = observationFor(l, now, run, ["new"]);
      data.firstObservationId = obs.observationId;
      out.listingWrites.push({ id: l.listingId, op: "create", data });
      out.observationWrites.push(obs);
      summary.new++;
      continue;
    }

    const changed = [];
    let priceChange = null;
    const keepOldPrice = l.askingPrice == null && old.askingPrice > 0;
    const newPrice = keepOldPrice ? old.askingPrice : l.askingPrice;

    if (keepOldPrice) changed.push("price_unavailable");
    else if (l.askingPrice != null && old.askingPrice != null && l.askingPrice !== old.askingPrice) {
      changed.push("askingPrice");
      priceChange = { from: old.askingPrice, to: l.askingPrice, amount: l.askingPrice - old.askingPrice, pct: Math.round(((l.askingPrice - old.askingPrice) / old.askingPrice) * 10000) / 100 };
      priceChange.pct < 0 ? summary.priceDrops++ : summary.priceIncreases++;
    } else if (l.askingPrice != null && old.askingPrice == null) changed.push("askingPrice");

    if ((l.areaSqFt ?? null) !== (old.areaSqFt ?? null)) changed.push("areaSqFt");
    if (l.sourceTitle !== old.sourceTitle) changed.push("title");
    if (l.description !== old.description) changed.push("description");
    const reappeared = old.listingStatus === "not_observed";
    if (reappeared) { changed.push("reappeared"); summary.reappeared++; }

    const data = {
      ...l,
      createdAt: old.createdAt, firstSeenAt: old.firstSeenAt, firstObservationId: old.firstObservationId ?? null,
      lastSeenAt: now, lastSuccessfulCheckAt: now, updatedAt: now,
      listingStatus: "active", missedRuns: 0, lastRunId: run.runId, scopeKey: run.scopeKey ?? old.scopeKey ?? null,
      priceChangeCount: old.priceChangeCount || 0, previousPrice: old.previousPrice ?? null, lastPriceChangeAt: old.lastPriceChangeAt ?? null,
    };
    if (keepOldPrice) {
      Object.assign(data, { askingPrice: old.askingPrice, priceType: old.priceType, pricePerGaj: old.pricePerGaj ?? null, pricePerSqFt: old.pricePerSqFt ?? null, pricePerSqFtBasis: old.pricePerSqFtBasis ?? null });
      data.flags = [...new Set([...data.flags, "price_missing_in_latest_observation"])];
    }
    if (priceChange) { data.previousPrice = old.askingPrice; data.lastPriceChangeAt = now; data.priceChangeCount = (old.priceChangeCount || 0) + 1; }
    out.listingWrites.push({ id: l.listingId, op: "update", data });

    if (changed.length) {
      out.observationWrites.push(observationFor({ ...l, askingPrice: l.askingPrice }, now, run, changed, priceChange));
      summary.changed++;
    } else summary.unchanged++;
  }
  return out;
}

/**
 * After a COMPLETE run, listings of the same source+scope that were not seen get a miss counted.
 * Only after `missesBeforeNotObserved` consecutive misses is the status changed, and only to "not_observed".
 */
export function planMissing({ run, sourceListings, seenIds, now, config = DEFAULT_CONFIG }) {
  if (run.status !== "complete") return { updates: [], skipped: `run_${run.status}_does_not_prove_absence` };
  const updates = [];
  for (const l of sourceListings) {
    if (l.sourceId !== run.sourceId || (l.scopeKey ?? null) !== (run.scopeKey ?? null)) continue;
    if (seenIds.has(l.listingId) || l.listingStatus === "not_observed") continue;
    const missedRuns = (l.missedRuns || 0) + 1;
    const data = { missedRuns, lastMissedRunId: run.runId, updatedAt: now };
    if (missedRuns >= config.missesBeforeNotObserved) data.listingStatus = "not_observed";
    updates.push({ id: l.listingId, op: "update", data });
  }
  return { updates };
}

/** Freshness comes from when we last SAW the listing, never from the source's listing date. */
export function freshness(listing, nowIso, config = DEFAULT_CONFIG) {
  if (listing.listingStatus === "not_observed") return "no_longer_observed";
  const last = Date.parse(listing.lastSeenAt || "");
  if (Number.isNaN(last)) return "needs_reverification";
  const days = (Date.parse(nowIso) - last) / 86400000;
  const f = config.freshnessDays;
  return days <= f.recentlyObserved ? "recently_observed" : days <= f.aging ? "aging" : days <= f.staleCandidate ? "stale_candidate" : "needs_reverification";
}

/** In-memory store used by tests and local dry-runs. Mirrors what the Firestore writer does (set + merge). */
export function applyPlanToMemory(store, plan, missing = { updates: [] }) {
  for (const w of plan.listingWrites) store.listings.set(w.id, w.op === "create" ? w.data : { ...store.listings.get(w.id), ...w.data });
  for (const w of missing.updates) store.listings.set(w.id, { ...store.listings.get(w.id), ...w.data });
  for (const o of plan.observationWrites) store.observations.set(o.observationId, o);
  return store;
}
export const newMemoryStore = () => ({ listings: new Map(), observations: new Map() });
