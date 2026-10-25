/* Two-stage duplicate detection. Nothing is ever merged automatically.
   Stage 1: same ADVERTISEMENT (ids/urls/hashes)  -> "confirmed_same_listing"
   Stage 2: possible same PROPERTY (scored, explained) -> high_confidence_possible | needs_manual_review | probably_different
   Decisions are stored with history so any merge can be undone. */

import { localityKey } from "./normalize.js";

/* ------------------------------------------------------------ stage 1 */
export function sameAdvertisement(a, b) {
  if (a.listingId === b.listingId) return { same: true, reason: "same listingId" };
  if (a.sourceId === b.sourceId && a.sourceListingId && a.sourceListingId === b.sourceListingId) return { same: true, reason: "same source listing id" };
  if (a.canonicalUrl && a.canonicalUrl === b.canonicalUrl) return { same: true, reason: "same canonical URL" };
  if (a.sourceId === b.sourceId && a.contentHash && a.contentHash === b.contentHash && a.localityKey === b.localityKey) return { same: true, reason: "identical content hash within the same source" };
  return { same: false };
}

/* ------------------------------------------------------------ stage 2 */
const tokens = s => new Set(String(s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(w => w.length > 2));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
const within = (x, y, tol) => x > 0 && y > 0 && Math.abs(x - y) / Math.max(x, y) <= tol;

export const WEIGHTS = { locality: 20, type: 10, area: 25, price: 15, project: 15, bedrooms: 5, text: 10 };

/**
 * Returns {score 0..100, category, reasons[], conflicts[]}. A different locality, type or transaction caps the score low.
 * Shared coordinates are NOT used when precision is not "exact" (locality centroids are shared by many properties).
 */
export function scorePair(a, b) {
  const reasons = [], conflicts = [];
  const adv = sameAdvertisement(a, b);
  if (adv.same) return { score: 100, category: "confirmed_same_listing", reasons: [adv.reason], conflicts };

  if (a.transaction !== b.transaction) return { score: 0, category: "probably_different", reasons: [], conflicts: ["sale vs rent"] };
  const la = a.localityKey || localityKey(a.locality), lb = b.localityKey || localityKey(b.locality);
  if (!la || !lb) conflicts.push("locality missing on one side");
  else if (la !== lb) return { score: 0, category: "probably_different", reasons: [], conflicts: ["different locality"] };
  if (a.propertyType && b.propertyType && a.propertyType !== b.propertyType) return { score: 0, category: "probably_different", reasons: [], conflicts: ["different property type"] };

  let s = 0;
  if (la && la === lb) { s += WEIGHTS.locality; reasons.push(`same locality (${a.locality})`); }
  if (a.propertyType && a.propertyType === b.propertyType) { s += WEIGHTS.type; reasons.push(`same type (${a.propertyType})`); }

  if (a.areaSqFt && b.areaSqFt) {
    if (within(a.areaSqFt, b.areaSqFt, 0.03)) { s += WEIGHTS.area; reasons.push(`area within 3% (${a.areaSqFt} vs ${b.areaSqFt} sq ft)`); }
    else if (within(a.areaSqFt, b.areaSqFt, 0.1)) { s += WEIGHTS.area * 0.4; reasons.push("area within 10%"); }
    else conflicts.push(`area differs (${a.areaSqFt} vs ${b.areaSqFt} sq ft)`);
  }
  if (a.askingPrice && b.askingPrice) {
    if (within(a.askingPrice, b.askingPrice, 0.05)) { s += WEIGHTS.price; reasons.push("asking price within 5%"); }
    else if (within(a.askingPrice, b.askingPrice, 0.15)) { s += WEIGHTS.price * 0.4; reasons.push("asking price within 15%"); }
    else conflicts.push("asking prices differ by more than 15%");
  }
  if (a.project && b.project) {
    if (localityKey(a.project) === localityKey(b.project)) { s += WEIGHTS.project; reasons.push(`same project (${a.project})`); }
    else conflicts.push("different project");
  }
  if (a.bedrooms != null && b.bedrooms != null) {
    if (Number(a.bedrooms) === Number(b.bedrooms)) { s += WEIGHTS.bedrooms; reasons.push("same bedrooms"); }
    else conflicts.push(`bedrooms differ (${a.bedrooms} vs ${b.bedrooms})`);
  }
  const sim = jaccard(tokens(a.sourceTitle), tokens(b.sourceTitle));
  if (sim >= 0.5) { s += WEIGHTS.text; reasons.push(`titles similar (${Math.round(sim * 100)}%)`); } else if (sim >= 0.3) s += WEIGHTS.text * 0.4;

  if (a.lat != null && b.lat != null && a.locationPrecision === "exact" && b.locationPrecision === "exact") {
    const d = Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180));
    if (d < 100) { s += 5; reasons.push(`exact coordinates ~${Math.round(d)} m apart`); }
  }

  // any hard conflict stops a pair from reaching "high confidence"
  // 100 is reserved for stage-1 "confirmed same listing"; a similarity score alone never proves identity
  let score = Math.round(Math.min(99, s));
  if (conflicts.length) score = Math.min(score, 74);
  const category = score >= 85 ? "high_confidence_possible" : score >= 60 ? "needs_manual_review" : "probably_different";
  return { score, category, reasons, conflicts };
}

/** Compare listings only inside blocks (same locality + type + transaction) so cost stays ~O(n * block size). */
export function findCandidates(listings, { minScore = 60 } = {}) {
  const blocks = new Map();
  for (const l of listings) {
    const k = [l.localityKey || localityKey(l.locality) || "?", l.propertyType || "?", l.transaction].join("|");
    (blocks.get(k) || blocks.set(k, []).get(k)).push(l);
  }
  const out = [];
  for (const arr of blocks.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const r = scorePair(arr[i], arr[j]);
    if (r.score >= minScore) out.push({ a: arr[i].listingId, b: arr[j].listingId, ...r });
  }
  return out.sort((x, y) => y.score - x.score);
}

/* ------------------------------------------------------- review workflow */
export const groupIdFor = ids => "dg_" + [...ids].sort().join("+").replace(/[^A-Za-z0-9_+-]/g, "-").slice(0, 140);

export function proposeGroup(candidate, at) {
  return {
    groupId: groupIdFor([candidate.a, candidate.b]), listingIds: [candidate.a, candidate.b],
    status: "proposed", score: candidate.score, category: candidate.category, reasons: candidate.reasons, conflicts: candidate.conflicts,
    mergedPropertyId: null, history: [{ action: "proposed", by: "system", at, prevStatus: null }],
  };
}

/** actions: confirm | reject | merge | undo. Merge needs a prior confirm. Undo restores the previous status. */
export function decide(group, action, by, at, extra = {}) {
  const g = { ...group, history: [...group.history] };
  const push = prev => g.history.push({ action, by, at, prevStatus: prev });
  if (action === "undo") {
    let idx = -1;
    for (let i = g.history.length - 1; i >= 0; i--) { const h = g.history[i]; if (h.action !== "undo" && h.action !== "proposed" && !h.undone) { idx = i; break; } }
    if (idx < 0) return { ok: false, error: "nothing to undo", group };
    const target = g.history[idx];
    g.history[idx] = { ...target, undone: true };
    if (target.action === "merge") g.mergedPropertyId = null;
    const prev = g.status; g.status = target.prevStatus;
    g.history.push({ action: "undo", by, at, prevStatus: prev, undoes: target.action });
    return { ok: true, group: g };
  }
  if (action === "confirm") { if (g.status === "merged") return { ok: false, error: "already merged", group }; const p = g.status; g.status = "confirmed"; push(p); return { ok: true, group: g }; }
  if (action === "reject") { if (g.status === "merged") return { ok: false, error: "undo the merge first", group }; const p = g.status; g.status = "rejected"; push(p); return { ok: true, group: g }; }
  if (action === "merge") {
    if (g.status !== "confirmed") return { ok: false, error: "merge requires a confirmed match", group };
    const p = g.status; g.status = "merged"; g.mergedPropertyId = extra.propertyId || ("prop_" + g.groupId.slice(3)); push(p);
    return { ok: true, group: g };
  }
  return { ok: false, error: "unknown action", group };
}
