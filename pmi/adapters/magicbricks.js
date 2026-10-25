/* MagicBricks adapter. Maps one row of the Apify Actor `memo23/magicbricks-property-scraper` to the raw-listing shape.
   Field choices are based on the real 9-row Jaipur sample in tests/fixtures (2026-10-24).
   Deliberately NOT copied: lister name (personal/business contact detail). Only the role (Agent/Builder) is kept. */

const TYPE_MAP = [
  [/plot|land/i, "plot"],
  [/apartment|flat|penthouse|studio|builder floor/i, "apartment"],
  [/house|villa|kothi/i, "house"],
  [/shop|office|showroom|commercial/i, "commercial"],
];
const mapType = t => (TYPE_MAP.find(([re]) => re.test(t || "")) || [null, null])[1];

export const adapterId = "magicbricks";

export function mapRow(row, ctx = {}) {
  if (!row || row.rowType !== "property") return null;          // skip project rows etc.
  const propertyType = mapType(row.propertyType);
  const isPlot = propertyType === "plot";
  // Apartments/houses: coveredArea is built-up area, NOT plot area. Plots would use plot area.
  const area = row.coveredArea ? { value: row.coveredArea, unit: row.coveredAreaUnit || "sqft", basis: isPlot ? "plot" : "built_up" } : null;
  return {
    sourceId: adapterId,
    sourceListingId: row.listingId ? String(row.listingId) : null,
    sourceUrl: row.propertyUrl || null,
    title: row.title,
    description: row.description || null,
    advertiserType: row.listerType || null,
    propertyType,
    propertySubtype: row.propertyType || null,
    transaction: /sale/i.test(row.transactionType || "") ? "sale" : /rent/i.test(row.transactionType || "") ? "rent" : "unknown",
    // numeric `price` is computed by the Actor (rate x area); `priceDisplay` is the rounded text MagicBricks shows. Both kept.
    price: { value: row.price, text: row.priceDisplay, method: "actor.price" },
    area,
    carpetArea: row.carpetArea ? { value: row.carpetArea, unit: row.carpetAreaUnit || "sqft" } : null,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    city: row.city || null,
    locality: row.locality || null,
    project: row.project || null,
    lat: row.latitude ?? null,
    lng: row.longitude ?? null,
    // Verified from the sample: two different projects in Vaishali Nagar carry identical coordinates, so these are
    // locality centroids, not the property location. Never use them for distance comparisons.
    locationPrecision: "locality",
    listedText: row.postedDate || null,
    reraIds: row.reraIds || [],
  };
}

export const mapRows = (rows, ctx) => rows.map(r => mapRow(r, ctx)).filter(Boolean);
