/* Source registry. One entry per data source; adapters are looked up by `adapter`.
   Stored in Firestore `pmiSources` (editable by the admin); this file is the default seed.
   Nothing here contains credentials. */

export const COLLECTION_METHODS = {
  manual_import: "Rows the owner already has the right to use (CSV/JSON/Excel export, own listings, partner feed)",
  apify_actor: "Public pages collected through an Apify Actor (terms and blocking risk are the owner's decision)",
  official_api: "Documented API or feed provided by the source",
};

export const DEFAULT_SOURCES = [
  {
    sourceId: "manual",
    name: "Manual / file import",
    domain: null,
    adapter: "manual",
    collectionMethod: "manual_import",
    actorId: null,
    enabled: true,
    propertyTypes: ["plot", "house", "apartment", "commercial"],
    locations: ["Jaipur"],
    limits: { maxRowsPerRun: 2000 },
    costNote: "No external cost.",
    lastSuccessfulRun: null, lastError: null,
    fieldMapping: {},
  },
  {
    sourceId: "magicbricks",
    name: "MagicBricks",
    domain: "magicbricks.com",
    adapter: "magicbricks",
    collectionMethod: "apify_actor",
    actorId: "memo23/magicbricks-property-scraper",
    enabled: false,                       // OFF until the owner explicitly accepts the terms/blocking risk (audit §9)
    enabledReason: "pending_owner_decision",
    propertyTypes: ["apartment", "house", "plot"],
    locations: ["Jaipur"],
    limits: { maxRowsPerRun: 100, maxTotalChargeUsd: 0.1, freeTierRowCap: 100 },
    costNote: "Observed 2026-10-24: ~$0.0015 per row + $0.00005 start. 9 rows cost under 1 cent. Re-check pricing before large runs.",
    lastSuccessfulRun: null, lastError: null,
    fieldMapping: { sourceListingId: "listingId", price: "price", area: "coveredArea|carpetArea" },
  },
];

const REQUIRED = ["sourceId", "name", "adapter", "collectionMethod", "enabled", "limits"];

export function validateSource(s) {
  const errors = [];
  for (const k of REQUIRED) if (s[k] === undefined || s[k] === null) errors.push(`missing ${k}`);
  if (s.sourceId && !/^[a-z0-9_-]{2,40}$/.test(s.sourceId)) errors.push("sourceId must be lowercase letters, digits, _ or -");
  if (s.collectionMethod && !COLLECTION_METHODS[s.collectionMethod]) errors.push("unknown collectionMethod");
  if (s.collectionMethod === "apify_actor" && !s.actorId) errors.push("apify_actor source needs actorId");
  if (s.limits && !(s.limits.maxRowsPerRun > 0)) errors.push("limits.maxRowsPerRun must be > 0");
  if (s.enabled && s.enabledReason === "pending_owner_decision") errors.push("cannot be enabled while pending_owner_decision");
  return errors;
}
