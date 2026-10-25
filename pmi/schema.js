/* PMI canonical schema: turns a source-agnostic "raw listing" (produced by an adapter) into the
   canonical Listing document. Three separate concepts are kept apart:
     Property   (pmiProperties)   the physical thing, only when identity is established
     Listing    (pmiListings)     one advertisement on one source
     Observation(pmiObservations) one dated sighting of a listing (price history lives here)
   Pure functions; no I/O. */

import {
  parsePrice, parseArea, parseDimensions, checkAreaConsistency, computeRates,
  parseListedDate, canonicalUrl, normText, localityKey, SQFT_PER_SQYD,
} from "./normalize.js";

/** Fast non-cryptographic 53-bit hash (cyrb53) -> 14 hex chars. For change detection / ids, not security. */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

const idSafe = s => String(s).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 120);

/** Stable, deterministic document id: same advertisement -> same id on every run. */
export function makeListingId(sourceId, sourceListingId, url) {
  if (sourceListingId) return idSafe(`${sourceId}_${sourceListingId}`);
  const cu = canonicalUrl(url);
  return cu ? idSafe(`${sourceId}_u${hash(cu)}`) : null;
}
export const makeObservationId = (listingId, runId) => idSafe(`${listingId}__${runId}`);

const PLOT = /plot|land|farm/i;

export function inferAreaBasis(propertyType, declared) {
  if (declared && declared !== "unknown") return declared;
  if (PLOT.test(propertyType || "")) return "plot";
  return "unknown";
}

/**
 * Data quality is about the RECORD (is it usable, complete, consistent). It is not a verdict that the property
 * is legitimate and it is not the opportunity score.
 */
export function dataQuality(l) {
  const c = {
    price: l.askingPrice > 0 && l.priceType === "total" ? 30 : 0,
    area: l.areaSqFt > 0 ? 25 : 0,
    location: (l.localityKey ? 10 : 0) + (l.lat != null && l.locationPrecision === "exact" ? 5 : 0),
    type: l.propertyType ? 10 : 0,
    source: l.canonicalUrl ? 10 : 0,
    date: l.listedAt ? 5 : 0,
    text: l.sourceTitle ? 5 : 0,
  };
  const warnings = [];
  const W = {
    price_missing: "Price missing", price_on_request: "Price on request", price_ambiguous_no_unit: "Price has no unit; not guessed",
    price_is_range: "Price is a range; not used", price_invalid: "Invalid price", price_unparseable: "Price could not be read",
    area_dimension_mismatch: "Advertised area and plot dimensions disagree", area_basis_unknown: "Area type (plot/built-up) unknown",
    bigha_needs_conversion_basis: "Bigha area needs a conversion basis", area_unit_unknown: "Area unit not recognised",
    area_unit_missing: "Area unit missing", area_missing_or_invalid: "Area missing or invalid", area_zero: "Area is zero",
    listed_date_derived: "Listing date was derived from relative text (e.g. 'Yesterday')", listed_date_unknown: "No listing date from source",
    price_missing_in_latest_observation: "Latest observation had no usable price; last known price kept",
    location_approximate: "Location is locality-level only",
  };
  for (const f of l.flags) if (W[f]) warnings.push({ flag: f, text: W[f] });
  const score = Math.max(0, Math.min(100, Object.values(c).reduce((a, b) => a + b, 0)));
  return { score, components: c, warnings };
}

/**
 * raw (from an adapter):
 *  { sourceId, sourceListingId, sourceUrl, title, description, advertiserType, propertyType, propertySubtype,
 *    transaction:"sale"|"rent"|"unknown", price:{value|text}, area:{value,unit,basis}, carpetArea:{value,unit},
 *    dimensionsText, bedrooms, bathrooms, city, locality, subLocality, project, lat, lng, locationPrecision,
 *    listedText, reraIds, rawExtract }
 * ctx: { observedAt, runId }
 */
export function normalizeListing(raw, ctx) {
  const flags = [];
  const listingId = makeListingId(raw.sourceId, raw.sourceListingId, raw.sourceUrl);
  if (!listingId) return { ok: false, reason: "no_stable_identity", flags: ["no_source_id_or_url"] };
  if (!raw.sourceId) return { ok: false, reason: "no_source", flags: ["no_source_id"] };

  const transaction = raw.transaction || "unknown";
  const price = parsePrice(raw.price?.value ?? raw.price?.text, { kind: raw.price?.kind });
  flags.push(...price.flags);
  const priceType = price.value ? (transaction === "rent" && price.kind === "total" ? "rent_monthly" : price.kind) : null;

  const area = parseArea(raw.area?.value, raw.area?.unit, { bighaSqYd: raw.area?.bighaSqYd });
  flags.push(...area.flags);
  const basis = inferAreaBasis(raw.propertyType, raw.area?.basis);
  if (area.areaSqFt && basis === "unknown") flags.push("area_basis_unknown");

  const dims = parseDimensions(raw.dimensionsText);
  flags.push(...dims.flags);
  if (area.areaSqFt && dims.areaSqFt) flags.push(...checkAreaConsistency(area.areaSqFt, dims.areaSqFt));

  const carpet = raw.carpetArea ? parseArea(raw.carpetArea.value, raw.carpetArea.unit) : null;
  const listed = parseListedDate(raw.listedText, ctx.observedAt);
  if (listed.derived) flags.push("listed_date_derived");
  if (!listed.listedAt) flags.push("listed_date_unknown");
  if (raw.locationPrecision && raw.locationPrecision !== "exact") flags.push("location_approximate");

  const rates = computeRates({
    transaction, priceKind: price.kind, priceInr: price.value, areaSqFt: area.areaSqFt, areaBasis: basis,
  });

  const l = {
    listingId,
    sourceId: raw.sourceId,
    sourceListingId: raw.sourceListingId ?? null,
    sourceUrl: raw.sourceUrl ?? null,
    canonicalUrl: canonicalUrl(raw.sourceUrl),
    sourceTitle: normText(raw.title) || null,
    description: normText(raw.description) || null,
    advertiserType: raw.advertiserType ?? null,           // role only; no names or phone numbers are stored
    propertyType: raw.propertyType ?? null,
    propertySubtype: raw.propertySubtype ?? null,
    transaction,
    city: raw.city ?? null,
    locality: raw.locality ?? null,
    localityKey: raw.locality ? localityKey(raw.locality) : null,
    subLocality: raw.subLocality ?? null,
    project: raw.project ?? null,
    bedrooms: raw.bedrooms ?? null,
    bathrooms: raw.bathrooms ?? null,
    advertisedArea: area.value ? { value: area.value, unit: area.unit, basis } : null,
    areaSqFt: area.areaSqFt, areaGaj: area.areaGaj,
    carpetAreaSqFt: carpet?.areaSqFt ?? null,
    dimensions: dims.a ? { a: dims.a, b: dims.b, unit: dims.unit, areaSqFt: dims.areaSqFt } : null,
    askingPrice: price.value, currency: "INR", priceType,
    pricePerGaj: rates.pricePerGaj, pricePerSqFt: rates.pricePerSqFt, pricePerSqFtBasis: rates.pricePerSqFtBasis,
    rateNotes: rates.reasons,
    lat: raw.lat ?? null, lng: raw.lng ?? null,
    locationPrecision: raw.lat != null ? (raw.locationPrecision || "unknown") : null,
    listedAt: listed.listedAt, listedAtPrecision: listed.precision, listedAtDerived: listed.derived,
    reraIds: raw.reraIds || [],
    flags: [...new Set(flags)],
    provenance: {
      price: { sourceUrl: raw.sourceUrl ?? null, sourceId: raw.sourceId, extractedAt: ctx.observedAt, raw: price.raw, normalized: price.value, method: raw.price?.method || "parsePrice", flags: price.flags },
      area: { raw: area.raw, normalized: area.areaSqFt, method: "parseArea", flags: area.flags },
      listedAt: { raw: listed.raw, normalized: listed.listedAt, method: "parseListedDate", derived: listed.derived },
    },
  };
  l.contentHash = hash(JSON.stringify([l.sourceTitle, l.askingPrice, l.areaSqFt, l.description, l.bedrooms]));
  l.titleHash = hash(l.sourceTitle || "");
  l.dataQuality = dataQuality(l);
  return { ok: true, listing: l };
}

export const gajFromSqFt = s => (s > 0 ? Math.round((s / SQFT_PER_SQYD) * 100) / 100 : null);
