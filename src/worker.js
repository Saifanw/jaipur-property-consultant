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

// "1.3 Crore" -> {num:"1.3", unit:"Crore"} (used for the price tag drawn on the preview photo)
const priceParts = n => {
  n = Number(n); if (!n) return null;
  const r = v => String(+v.toFixed(2));
  return n >= 1e7 ? { num: r(n / 1e7), unit: "Crore" } : n >= 1e5 ? { num: r(n / 1e5), unit: "Lakh" } : { num: n.toLocaleString("en-IN"), unit: "" };
};

// Premium price tag (SVG). Cloudflare draws it on top of the property photo for WhatsApp/Facebook previews.
function tagSvg(t) {
  const txt = esc(`${t.num}${t.unit ? " " + t.unit : ""}`);
  const w = 120 + (t.num.length + (t.unit ? t.unit.length + 1 : 0)) * 27;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="104" viewBox="0 0 ${w} 104">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0f1b2d" stop-opacity=".96"/><stop offset="1" stop-color="#1a2b44" stop-opacity=".9"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c45c"/><stop offset="1" stop-color="#b98a1e"/></linearGradient></defs>
<path d="M0 0H${w - 26}a26 26 0 0 1 26 26V78a26 26 0 0 1-26 26H0Z" fill="url(#g)" stroke="#e8c45c" stroke-opacity=".6" stroke-width="2"/>
<rect width="12" height="104" fill="url(#b)"/>
<text x="38" y="68" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="600" fill="#e8c45c">₹</text>
<text x="72" y="70" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="800" fill="#ffffff">${txt}</text></svg>`;
}

async function ogImage(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const fallback = () => Response.redirect(new URL("/storefront.jpg", url).href, 302);
  try {
    if (!id || !/^[\w-]{3,64}$/.test(id)) return fallback();
    const p = await loadProperty(id); if (!p) return fallback();
    const img = (Array.isArray(p.imageUrls) ? p.imageUrls : []).find(u => /^https:\/\//.test(u || ""));
    if (!img) return fallback();
    const t = priceParts(p.budgetMax ?? p.budgetMin);
    const opts = { cf: { cacheTtl: 300, cacheEverything: true } };
    if (t) opts.cf.image = { width: 1200, height: 630, fit: "cover", quality: 85, draw: [{ url: new URL(`/tag.svg?n=${encodeURIComponent(t.num)}&u=${encodeURIComponent(t.unit)}`, url).href, left: 0, bottom: 40, opacity: 1 }] };
    const r = await fetch(img, opts);
    if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) return Response.redirect(img, 302);
    return new Response(r.body, { headers: { "content-type": r.headers.get("content-type"), "cache-control": "public, max-age=300" } });
  } catch (e) { return fallback(); }
}

async function loadProperty(id) {
  // no edge caching: price edits must show up in the next preview straight away
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/publicRequirements/${id}`, { cf: { cacheTtl: 0 } });
  if (!r.ok) return null;
  const raw = (await r.json()).fields || {};
  const p = {}; for (const k in raw) p[k] = val(raw[k]);
  return p;
}

async function propertyPage(request, env) {
  const url = new URL(request.url);
  // "/property" is how the assets server resolves property.html (no redirect for the visitor)
  const res = await env.ASSETS.fetch(new Request(new URL("/property", url), { headers: request.headers }));
  try {
    const id = url.searchParams.get("id");
    if (!res.ok || !id || !/^[\w-]{3,64}$/.test(id)) return res;

    const p = await loadProperty(id); if (!p) return res;
    if (["rejected", "hidden", "draft", "deleted"].includes(String(p.status || "").toLowerCase())) return res;

    const seller = p.type === "seller";
    const area = cleanArea(p.area), type = p.propertyType || (seller ? "Property" : "Requirement");
    const size = tidy(p.size);
    const title = seller ? `${size ? size + " " : ""}${type} in ${area}` : `Looking for ${size ? size + " " : ""}${type} in ${area}`;
    const price = inr(p.budgetMax ?? p.budgetMin);
    const desc = [price, `${area}, ${tidy(p.city) || "Jaipur"}`, plain(p.details).slice(0, 110)].filter(Boolean).join(" • ");
    const img = (Array.isArray(p.imageUrls) ? p.imageUrls : []).find(u => /^https:\/\//.test(u || ""));
    // price first, so it stays visible even when WhatsApp cuts a long title
    const pageTitle = price ? `${price} | ${title}` : title;

    const meta = [
      ["og:type", "website"], ["og:site_name", SITE], ["og:title", pageTitle], ["og:description", desc],
      ["og:url", request.url], ["og:image", img ? new URL(`/og?id=${encodeURIComponent(id)}&v=${encodeURIComponent(url.searchParams.get("v") || "")}`, url).href : new URL("/storefront.jpg", url).href],
      ["og:image:width", "1200"], ["og:image:height", "630"],
      ["twitter:card", "summary_large_image"], ["twitter:title", pageTitle], ["twitter:description", desc],
    ].filter(Boolean).map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`).join("");

    const out = new HTMLRewriter()
      .on("title", { element(e) { e.setInnerContent(`${pageTitle} | ${SITE}`); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
      .on('meta[property^="og:"]', { element(e) { e.remove(); } })   // drop the generic defaults
      .on("head", { element(e) { e.append(meta, { html: true }); } })
      .transform(res);
    const h = new Headers(out.headers); h.set("cache-control", "public, max-age=0, must-revalidate");
    return new Response(out.body, { status: out.status, headers: h });
  } catch (e) { return res; }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && (pathname === "/property" || pathname === "/property.html")) return propertyPage(request, env);
    if (request.method === "GET" && pathname === "/og") return ogImage(request, env);
    if (request.method === "GET" && pathname === "/tag.svg") {
      const u = new URL(request.url);
      return new Response(tagSvg({ num: (u.searchParams.get("n") || "").slice(0, 12), unit: (u.searchParams.get("u") || "").slice(0, 8) }), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
    }
    return env.ASSETS.fetch(request);
  },
};
