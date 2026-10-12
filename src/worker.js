// Cloudflare Worker (with static assets).
// Serves the whole site as-is, but for property.html?id=XXXX it fills the link-preview tags
// (title, price, photo) from Firestore so WhatsApp/Facebook/Telegram show THAT property.
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
// remove WhatsApp-style formatting (*bold*, _italic_) and emojis so the preview text is clean
const plain = t => tidy(String(t || "").replace(/[*_#`~>]/g, " ").replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " "));
const inr = n => {
  n = Number(n); if (!n) return "";
  if (n >= 1e7) return "₹" + +(n / 1e7).toFixed(2) + " Crore";
  if (n >= 1e5) return "₹" + +(n / 1e5).toFixed(2) + " Lakh";
  return "₹" + n.toLocaleString("en-IN");
};

async function propertyPage(request, env) {
  const url = new URL(request.url);
  // "/property" is how the assets server resolves property.html (no redirect for the visitor)
  const res = await env.ASSETS.fetch(new Request(new URL("/property", url), { headers: request.headers }));
  try {
    const id = url.searchParams.get("id");
    if (!res.ok || !id || !/^[\w-]{3,64}$/.test(id)) return res;

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
    const desc = [price, `${area}, ${tidy(p.city) || "Jaipur"}`, plain(p.details).slice(0, 110)].filter(Boolean).join(" • ");
    const img = (Array.isArray(p.imageUrls) ? p.imageUrls : []).find(u => /^https:\/\//.test(u || ""));
    const pageTitle = `${title}${price ? " – " + price : ""}`;

    const meta = [
      ["og:type", "website"], ["og:site_name", SITE], ["og:title", pageTitle], ["og:description", desc],
      ["og:url", request.url], img && ["og:image", img] || ["og:image", new URL("/storefront.jpg", url).href],
      ["twitter:card", "summary_large_image"], ["twitter:title", pageTitle], ["twitter:description", desc],
    ].filter(Boolean).map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`).join("");

    return new HTMLRewriter()
      .on("title", { element(e) { e.setInnerContent(`${pageTitle} | ${SITE}`); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
      .on('meta[property^="og:"]', { element(e) { e.remove(); } })   // drop the generic defaults
      .on("head", { element(e) { e.append(meta, { html: true }); } })
      .transform(res);
  } catch (e) { return res; }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && (pathname === "/property" || pathname === "/property.html")) return propertyPage(request, env);
    return env.ASSETS.fetch(request);
  },
};
