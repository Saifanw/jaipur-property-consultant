/* PMI normalizer — pure functions, no I/O, runs in browser, Cloudflare Worker and Node.
   Rules (from the master prompt): never guess, never invent, flag ambiguity, keep raw text. */

export const SQFT_PER_SQYD = 9;            // 1 sq yd (gaj) = 9 sq ft
export const SQFT_PER_SQM = 10.7639;
export const SQYD_PER_ACRE = 4840;

const r2 = n => Math.round(n * 100) / 100;
const num = s => Number(String(s).replace(/,/g, ""));

/* ---------------------------------------------------------------- PRICE */

const MULT = [
  [/^(crore|crores|cr|cr\.)$/i, 1e7],
  [/^(lakh|lakhs|lac|lacs|lak|l|lk)$/i, 1e5],
  [/^(thousand|k)$/i, 1e3],
];

/** Classify what a price string/number is about, from surrounding words.
 *  Returns one of: total | per_area | rent_monthly | deposit | token | brokerage | maintenance | unknown */
export function priceKindFromText(t) {
  const s = String(t || "").toLowerCase();
  if (/(per|\/)\s*(month|mo\b|mth)|monthly|\brent\b/.test(s)) return "rent_monthly";
  if (/deposit/.test(s)) return "deposit";
  if (/token|booking amount/.test(s)) return "token";
  if (/brokerage/.test(s)) return "brokerage";
  if (/maintenance/.test(s)) return "maintenance";
  if (/(per|\/)\s*(gaj|sq\.?\s?y|sq\.?\s?ft|sqft|sq\.?\s?m|sqm|yard|bigha|acre)/.test(s)) return "per_area";
  return "total";
}

/**
 * parsePrice("₹35 lakh") -> {value:3500000, kind:"total", raw, flags:[]}
 * Numbers are accepted as already-INR. Ambiguous input returns value:null plus a flag, never a guess.
 */
export function parsePrice(input, opts = {}) {
  const raw = input == null ? null : String(input);
  const out = { value: null, kind: opts.kind || "unknown", raw, flags: [] };
  if (input == null || raw.trim() === "") { out.flags.push("price_missing"); return out; }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) { out.flags.push("price_invalid"); return out; }
    out.value = Math.round(input);
    out.kind = opts.kind || "total";
    return out;
  }

  const s = raw.toLowerCase().replace(/₹|rs\.?|inr/g, " ").replace(/\s+/g, " ").trim();
  if (/on request|call for price|ask for price|contact for price|negotiable only|^-+$/.test(s)) { out.flags.push("price_on_request"); return out; }
  out.kind = opts.kind || priceKindFromText(raw);

  const m = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lacs?|lak|lk|l\b|thousand|k\b)?/i);
  if (!m) { out.flags.push("price_unparseable"); return out; }
  let v = num(m[1]);
  const unit = m[2] ? m[2].replace(/\.$/, "") : "";
  if (unit) { const hit = MULT.find(([re]) => re.test(unit)); if (hit) v *= hit[1]; }
  // a range like "35-40 lakh" is not one price
  if (/\d\s*(?:-|–|to)\s*\d/.test(s.slice(m.index, m.index + m[0].length + 12))) { out.flags.push("price_is_range"); return out; }
  if (!Number.isFinite(v) || v <= 0) { out.flags.push("price_invalid"); return out; }
  // a bare small number with no unit (e.g. "35") cannot be told apart from lakh/crore: refuse to guess
  if (!unit && v < 1000 && out.kind !== "per_area") { out.flags.push("price_ambiguous_no_unit"); return out; }
  out.value = Math.round(v);
  return out;
}

/* ----------------------------------------------------------------- AREA */

const UNIT_ALIASES = [
  ["sqft", /^(sq\.?\s?-?ft\.?|sqft|sq\s*feet|square\s*feet|square\s*foot|sft|ft2|feet|sq-ft)$/i],
  ["sqyd", /^(sq\.?\s?-?y(?:d|ard)s?\.?|sqyd|sq\s*yards?|square\s*yards?|gaj|गज|वर्ग\s*गज|yards?)$/i],
  ["sqm", /^(sq\.?\s?-?m(?:tr|eter|etre)?s?\.?|sqm|square\s*met(?:er|re)s?|m2)$/i],
  ["acre", /^(acres?)$/i],
  ["bigha", /^(bigha|bighas|बीघा)$/i],
];
export function canonicalAreaUnit(u) {
  const s = String(u || "").trim();
  if (!s) return null;
  for (const [k, re] of UNIT_ALIASES) if (re.test(s)) return k;
  return null;
}

/**
 * parseArea(100, "gaj") or parseArea("1200 sq ft")
 * Bigha is region dependent: returns null area with a flag unless opts.bighaSqYd is supplied.
 */
export function parseArea(value, unit, opts = {}) {
  const out = { value: null, unit: null, areaSqFt: null, areaGaj: null, raw: { value, unit }, flags: [] };
  let v = value, u = unit;
  if (typeof value === "string") {
    const m = value.match(/(\d[\d,]*(?:\.\d+)?)\s*([A-Za-z.ऀ-ॿ][A-Za-z.\sऀ-ॿ-]*)?/);
    if (!m) { out.flags.push("area_unparseable"); return out; }
    v = num(m[1]); if (!u && m[2]) u = m[2].trim();
  }
  v = Number(v);
  if (!Number.isFinite(v) || v <= 0) { out.flags.push(v === 0 ? "area_zero" : "area_missing_or_invalid"); return out; }
  const cu = canonicalAreaUnit(u);
  if (!cu) { out.flags.push(u ? "area_unit_unknown" : "area_unit_missing"); return out; }
  out.value = v; out.unit = cu;
  let sqft;
  if (cu === "sqft") sqft = v;
  else if (cu === "sqyd") sqft = v * SQFT_PER_SQYD;
  else if (cu === "sqm") sqft = v * SQFT_PER_SQM;
  else if (cu === "acre") sqft = v * SQYD_PER_ACRE * SQFT_PER_SQYD;
  else if (cu === "bigha") {
    if (!(opts.bighaSqYd > 0)) { out.flags.push("bigha_needs_conversion_basis"); return out; }
    sqft = v * opts.bighaSqYd * SQFT_PER_SQYD;
  }
  out.areaSqFt = r2(sqft);
  out.areaGaj = r2(sqft / SQFT_PER_SQYD);
  return out;
}

/** "15 x 40 ft", "15×40", "30x60 feet" -> {a,b,unit,areaSqFt}. Unit missing => no area (flag), never assume feet. */
export function parseDimensions(text) {
  const out = { a: null, b: null, unit: null, areaSqFt: null, flags: [] };
  const s = String(text || "").replace(/[×*]/g, "x");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')?\s*x\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|mtr|m|meter|metre|meters|metres|yd|yard|yards)?/i);
  if (!m) return out;
  out.a = Number(m[1]); out.b = Number(m[2]);
  const hasFeetOnFirst = /\d\s*(ft|feet|foot|')\s*x/i.test(s);
  const u = (m[3] || (hasFeetOnFirst ? "ft" : "")).toLowerCase();
  if (!u) { out.flags.push("dimension_unit_unspecified"); return out; }
  const per = /^(ft|feet|foot|')$/.test(u) ? 1 : /^(mtr|m|meter|metre|meters|metres)$/.test(u) ? SQFT_PER_SQM ** 0.5 : /^(yd|yard|yards)$/.test(u) ? 3 : null;
  out.unit = /^(ft|feet|foot|')$/.test(u) ? "ft" : /^(yd|yard|yards)$/.test(u) ? "yd" : "m";
  out.areaSqFt = r2(out.a * per * out.b * per);
  return out;
}

/** Flag when dimensions and the advertised area disagree by more than tolerance (default 5%). */
export function checkAreaConsistency(advertisedSqFt, dimsSqFt, tol = 0.05) {
  if (!(advertisedSqFt > 0) || !(dimsSqFt > 0)) return [];
  return Math.abs(advertisedSqFt - dimsSqFt) / dimsSqFt > tol ? ["area_dimension_mismatch"] : [];
}

/* ---------------------------------------------------------------- RATES */

/**
 * Rates are computed only when valid. Price per gaj requires: sale listing, total price, and PLOT area.
 * A flat's covered/carpet area is NOT plot area, so it never produces pricePerGaj; it gets a labelled pricePerSqFt instead.
 * areaBasis: "plot" | "built_up" | "carpet" | "super" | "unknown"
 */
export function computeRates({ transaction, priceKind, priceInr, areaSqFt, areaBasis }) {
  const out = { pricePerGaj: null, pricePerSqFt: null, pricePerSqFtBasis: null, reasons: [] };
  if (transaction !== "sale") { out.reasons.push("not_a_sale_listing"); return out; }
  if (priceKind !== "total") { out.reasons.push("price_is_not_total_price"); return out; }
  if (!(priceInr > 0)) { out.reasons.push("price_missing_or_invalid"); return out; }
  if (!(areaSqFt > 0)) { out.reasons.push("area_missing_or_invalid"); return out; }
  if (!areaBasis || areaBasis === "unknown") { out.reasons.push("area_basis_unknown"); return out; }
  if (areaBasis === "plot") out.pricePerGaj = Math.round(priceInr / (areaSqFt / SQFT_PER_SQYD));
  else out.reasons.push("pricePerGaj_needs_plot_area");
  out.pricePerSqFt = Math.round(priceInr / areaSqFt);
  out.pricePerSqFtBasis = areaBasis;
  return out;
}

/* ---------------------------------------------------------------- DATES */

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const iso = d => d.toISOString().slice(0, 10);

/**
 * parseListedDate("Posted: Oct 20, '26", scrapedAtIso) -> {listedAt:"2026-10-20", precision:"day", derived:false}
 * "Posted Yesterday" / "3 days ago" are relative to the observation time, so they are marked derived:true.
 * Anything else -> listedAt:null. Never falls back to first-seen date.
 */
export function parseListedDate(text, observedAtIso) {
  const out = { listedAt: null, precision: null, derived: false, raw: text ?? null };
  const s = String(text || "").trim();
  if (!s) return out;
  let m = s.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s*'?(\d{2,4})/);
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) {
    let y = Number(m[3]); if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, MONTHS[m[1].toLowerCase()], Number(m[2])));
    if (!Number.isNaN(d.getTime())) { out.listedAt = iso(d); out.precision = "day"; return out; }
  }
  const base = observedAtIso ? new Date(observedAtIso) : null;
  if (!base || Number.isNaN(base.getTime())) return out;
  const day = n => { const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - n)); return iso(d); };
  if (/\btoday\b|just now|few (hours|minutes)/i.test(s)) { out.listedAt = day(0); out.precision = "day"; out.derived = true; return out; }
  if (/\byesterday\b/i.test(s)) { out.listedAt = day(1); out.precision = "day"; out.derived = true; return out; }
  m = s.match(/(\d+)\s*(day|week)s?\s*ago/i);
  if (m) { out.listedAt = day(Number(m[1]) * (/week/i.test(m[2]) ? 7 : 1)); out.precision = /week/i.test(m[2]) ? "week" : "day"; out.derived = true; }
  return out;
}

/* ----------------------------------------------------------------- TEXT */

export const normText = t => String(t ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
/** Lower-cased, punctuation-free key for matching localities. Does NOT merge different names. */
export const localityKey = t => normText(t).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

/** Remove query-string/hash noise so the same advertisement has one canonical URL. */
export function canonicalUrl(u) {
  try {
    const x = new URL(u);
    x.hash = ""; x.hostname = x.hostname.toLowerCase().replace(/^www\./, "www.");
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) x.searchParams.delete(k);
    x.searchParams.sort();
    return x.toString();
  } catch { return null; }
}

/** Neutralise spreadsheet formula injection for untrusted text going into CSV/XLSX. */
export const safeCell = v => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
