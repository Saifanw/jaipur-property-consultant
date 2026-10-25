# Property Market Intelligence (PMI) — Phase 1: Data foundation

Status: **Phase 1 complete in the working copy. Nothing is deployed. No UI, no Apify call, no Firestore write has been made yet.**

## What exists
| File | Purpose |
|---|---|
| `pmi/normalize.js` | Price (lakh/crore/INR), area (sq ft/gaj/sq m/acre; bigha refused without a basis), plot dimensions, price per gaj, listing dates, URL canonicalisation, spreadsheet-injection guard |
| `pmi/schema.js` | Raw listing -> canonical Listing; stable ids; hashes; data-quality score (record quality only, not an opportunity score) |
| `pmi/sources.js` | Source registry + validation. MagicBricks is `enabled:false` (`pending_owner_decision`) |
| `pmi/adapters/magicbricks.js`, `manual.js` | One adapter per source. Lister names/phones are never copied |
| `pmi/ingest.js` | Pure, idempotent ingest planner, history, missing-listing and freshness rules |
| `pmi/dedupe.js` | Stage 1 (same ad) + stage 2 (possible same property, explained); confirm / reject / merge / undo |
| `pmi/firestore-writer.js` | Batched commit (<=400 writes), `in` queries (<=30 ids), run documents. Firebase SDK is injected |
| `pmi/tests/` | 47 tests + a real 9-row MagicBricks fixture (Jaipur, 2026-10-24) |
| `firestore.rules` | **Appended** `pmi*` block (admin only). Nothing existing was removed or edited |
| `.assetsignore` | Renamed from `assetsignore` (missing dot); added `pmi/tests`, `pmi/package.json`, `docs` |

## Data flow (Phase 1)
`file/Actor rows -> adapter.mapRows -> normalizeListing -> planIngest(existing) -> {listingWrites, observationWrites, summary} -> commitPlan`

- Listing id = `<sourceId>_<sourceListingId>` (or hash of canonical URL). Observation id = `<listingId>__<runId>`. Replays overwrite identical docs.
- An observation is written for: new listing, price/area/title/description change, price unavailable, reappeared. Unchanged sightings only update `lastSeenAt` (cost control). Earlier observations are never edited.
- Failed run: nothing touched. Partial run: upserts only, never marks missing. Complete run: 2 consecutive misses for the same source+scope -> `not_observed` (never "sold").

## Firestore collections (all new, admin only)
`pmiSources, pmiCollectionRuns, pmiListings, pmiProperties, pmiObservations, pmiDuplicateGroups, pmiOpportunityFlags, pmiAuditLogs, pmiSettings`. `pmiObservations` and `pmiAuditLogs` are append-only (an existing doc may only be re-written with identical content; delete is denied).
Only `pmiListings`, `pmiObservations`, `pmiCollectionRuns`, `pmiDuplicateGroups` are used by Phase 1 code. No composite index is needed yet.

## Run the tests
`cd pmi && node --test tests/*.test.js` (Node 20+, no dependencies). Result when written: 47 pass, 0 fail.

## Security rules — NOT yet tested against the emulator
The emulator could not be installed in the build environment, so the new rules are verified only by diff (no existing line removed) and brace balance. Before publishing, in the Firebase console Rules Playground or the emulator, confirm:
1. Signed out: read/write any `pmi*` doc -> **denied**.
2. Signed in as a non-admin Google user: read/write `pmiListings` -> **denied**.
3. Anonymous visitor (analytics): read `pmiListings` -> **denied**.
4. Admin: create `pmiObservations/x`, re-write with identical data -> allowed; change a field -> **denied**; delete -> **denied**.
5. Existing behaviour unchanged: public read of `publicRequirements`, public create in `publicSubmissions`, analytics create.
Export the currently deployed rules from the console **first** (the repo file may differ from what is live).

## Known limitations
- Only apartment/new-launch rows have been seen from a real source. Plot rows and `price per gaj` are tested with the manual adapter only; no Actor has been proven to return plots.
- MagicBricks coordinates are locality centroids (two different projects share identical coordinates), so they are marked `locationPrecision:"locality"` and ignored for distance.
- Source listing dates are sometimes relative ("Posted Yesterday"); stored as derived day-precision, never replaced by first-seen date.
- Numeric `price` from the MagicBricks Actor is computed by the Actor (rate x area), not the exact advertised text; the raw `priceDisplay` is kept in provenance.
- Dedupe is rule-based scoring; photo similarity is not implemented. Nothing is merged automatically.
- Firestore writer and `fetchExisting` are tested with a fake SDK, not against a live project.

## Cost
Phase 1 code makes no paid calls. Observed Actor cost for the 9-row sample: under 1 cent.

## Rollback
Delete `pmi/`, `docs/PMI.md`; restore previous `firestore.rules` (console rules history); `.assetsignore` can be deleted, original name was `assetsignore`. No existing page or collection was modified.

## Implemented vs pending
Done: normalization, schema, registry, 2 adapters, idempotent ingest, observations/history, freshness, missing-run safety, dedupe + review workflow logic, writer, rules block, tests.
Pending: Phase 2 protected backend + Apify run (blocked on owner decision), Phase 3 comparables/opportunity score, Phase 4 dashboard/exports, Phase 5 CRM matching/alerts, Phase 6 SaaS.
