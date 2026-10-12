// Cloudflare Pages Function: makes WhatsApp/Facebook/Telegram link previews show the
// PROPERTY (title + price + photo) instead of the generic website name.
// Route: /property?id=XXXX   (property.html is served at /property on Cloudflare Pages)
const PROJECT = "jaipur-property-consultant";
const SITE = "Jaipur Property Consultant";

const val = f => f == null ? undefined :
  f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue ??
  (f.arrayValue ? (f.arrayValue.values || []).map(val) : undefined);

const tidy = t => String(t || "").replace(/\s+/g, " ").trim();
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cleanArea = a => {
  let x = tidy(String(a || "").split(/[|\n]/)[0]).split(",")[0].trim();
  if (x.length > 2 && x === x.toUpperCase()) x = x.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
  return x.length > 48 ? x.slice(0, 46).trim() + "…" : (x || "Jaipur");
};
const inr = n => {
  n = Number(n); if (!n) return "";
  if (n >= 1e7) return "₹" + +(n / 1e7).toFixed(2) + " Crore";
  if (n >= 1e5) return "₹" + +(n / 1e5).toFixed(2) + " Lakh";
  return "₹" + n.toLocaleString("en-IN");
};

export async function onRequest(context) {
  const res = await context.next();
  try {
    const id = new URL(context.request.url).searchParams.get("id");
    if (!id || !/^[\w-]{3,64}$/.test(id)) return res;

    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/publicRequirements/${id}`,
      { cf: { cacheTtl: 120, cacheEverything: true } });
    if (!r.ok) return res;
    const raw = (await r.json()).fields || {};
    const p = {}; for (const k in raw) p[k] = val(raw[k]);
    if (["rejected", "hidden", "draft", "deleted"].includes(String(p.status || "").toLowerCase())) return res;

    const seller = p.type === "seller";
    const area = cleanArea(p.area), type = p.propertyType || (seller ? "Property" : "Requirement");
    const size = tidy(p.size);
    const title = seller ? `${size ? size + " " : ""}${type} in ${area}` : `Looking for ${size ? size + " " : ""}${type} in ${area}`;
    const price = inr(p.budgetMax ?? p.budgetMin);
    const city = tidy(p.city) || "Jaipur";
    const desc = [price, `${area}, ${city}`, tidy(p.details).slice(0, 110)].filter(Boolean).join(" • ");
    const img = [...(Array.isArray(p.imageUrls) ? p.imageUrls : [])].find(u => /^https:\/\//.test(u || ""));
    const pageTitle = `${title}${price ? " – " + price : ""}`;

    const meta = [
      ["og:type", "website"], ["og:site_name", SITE], ["og:title", pageTitle], ["og:description", desc],
      ["og:url", context.request.url], img && ["og:image", img],
      ["twitter:card", img ? "summary_large_image" : "summary"], ["twitter:title", pageTitle], ["twitter:description", desc], img && ["twitter:image", img],
    ].filter(Boolean).map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`).join("");

    return new HTMLRewriter()
      .on("title", { element(e) { e.setInnerContent(`${pageTitle} | ${SITE}`); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
      .on("head", { element(e) { e.append(meta, { html: true }); } })
      .transform(res);
  } catch (e) { return res; }
}
