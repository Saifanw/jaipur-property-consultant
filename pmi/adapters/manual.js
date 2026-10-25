/* Manual / file-import adapter: maps one row of a CSV/Excel/JSON export you are allowed to use.
   Accepts flexible headers (case-insensitive). Required: some stable id or URL, locality, price.
   Example columns: id, url, title, type, transaction, locality, city, price, area, unit, dimensions, bedrooms, project, listed, advertiser */

const pick = (row, ...names) => {
  const map = new Map(Object.keys(row).map(k => [k.trim().toLowerCase(), k]));
  for (const n of names) { const k = map.get(n); if (k !== undefined && row[k] !== "" && row[k] != null) return row[k]; }
  return null;
};
const TYPES = [[/plot|land/i, "plot"], [/apartment|flat/i, "apartment"], [/house|villa|kothi/i, "house"], [/shop|office|commercial/i, "commercial"]];

export const adapterId = "manual";

export function mapRow(row) {
  const type = pick(row, "type", "property type", "propertytype");
  const tx = String(pick(row, "transaction", "deal", "for") || "sale").toLowerCase();
  const unit = pick(row, "unit", "area unit", "areaunit");
  return {
    sourceId: adapterId,
    sourceListingId: pick(row, "id", "listing id", "listingid"),
    sourceUrl: pick(row, "url", "link"),
    title: pick(row, "title", "name"),
    description: pick(row, "description", "details"),
    advertiserType: pick(row, "advertiser", "advertiser type"),
    propertyType: type ? (TYPES.find(([re]) => re.test(type)) || [null, String(type).toLowerCase()])[1] : null,
    transaction: /rent/i.test(tx) ? "rent" : "sale",
    price: { value: pick(row, "price", "asking price", "askingprice") },
    area: pick(row, "area", "size") != null ? { value: pick(row, "area", "size"), unit, basis: /plot|land/i.test(type || "") ? "plot" : undefined } : null,
    dimensionsText: pick(row, "dimensions", "dimension"),
    bedrooms: pick(row, "bedrooms", "bhk"),
    city: pick(row, "city") || "Jaipur",
    locality: pick(row, "locality", "area name", "location"),
    project: pick(row, "project", "society"),
    locationPrecision: "locality",
    listedText: pick(row, "listed", "posted", "date"),
  };
}
export const mapRows = rows => rows.map(mapRow);
