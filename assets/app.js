/* Shared helpers + page chrome for Jaipur Property Consultant (and the future Apna Ghar app).
   Classic script: exposes window.JPC. Page modules (Firebase) import nothing from here, they just use JPC. */
(function(){
"use strict";
const SITE = window.SITE || {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const ico = (n, cls="") => `<svg class="icon ${cls}"><use href="#i-${n}"/></svg>`;
const wa = txt => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(txt)}`;
const hidden = s => ["rejected","hidden","draft","deleted"].includes(String(s||"").toLowerCase());
const millis = v => (v && typeof v.toMillis === "function") ? v.toMillis() : (v && v.seconds ? v.seconds*1000 : 0);
const EMOJI = /[^\p{L}\p{M}\p{N}\s.,:;!?()\-\/₹%&'"+]/gu;
const tidy = t => String(t ?? "").replace(EMOJI," ").replace(/\s+/g," ").trim();
function cleanArea(a){
  let x = tidy(String(a||"").split(/[|\n]/)[0]).split(",")[0].trim();
  if(x.length>2 && x===x.toUpperCase()) x = x.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
  return x.length>38 ? x.slice(0,36).trim()+"…" : (x || "Jaipur");
}
const unitSize = z => /[a-zऀ-ॿ]/i.test(String(z||""));
function inr(n){
  n = Number(n); if(!isFinite(n)) return "";
  if(n >= 1e7) return "₹" + (Math.round(n/1e7*100)/100) + " Cr";
  if(n >= 1e5) return "₹" + (Math.round(n/1e5*100)/100) + " Lakh";
  return "₹" + n.toLocaleString("en-IN");
}
function priceText(min, max, fallback){
  const a = min == null || min === "" ? null : Number(min), b = max == null || max === "" ? null : Number(max);
  if(a != null && b != null) return a === b ? inr(a) : `${inr(a)} – ${inr(b)}`;
  if(b != null) return `Up to ${inr(b)}`;
  if(a != null) return `From ${inr(a)}`;
  return fallback;
}
function photosOf(p){
  const list = [...(Array.isArray(p.imageUrls) ? p.imageUrls : []), ...(Array.isArray(p.imageDataUrls) ? p.imageDataUrls : [])];
  if(p.imageDataUrl) list.push(p.imageDataUrl);
  return [...new Set(list.filter(Boolean))].slice(0, 10);
}
const availClass = a => { a = String(a||"Available"); return a==="Available" ? "" : a==="Under Offer" ? "offer" : a==="Sold" ? "sold" : "off"; };
/* price per Gaj (only when size is a plain number of Gaj and we have one firm price) */
function perGaj(p){
  const m = String(p.size||"").match(/(\d+(?:\.\d+)?)/); const g = m ? Number(m[1]) : 0;
  const price = p.budgetMax ?? p.budgetMin; if(!g || !price || g < 10 || g > 5000) return "";
  const v = Math.round(price / g); return v > 500 ? `${inr(v).replace(" Lakh"," L")} / Gaj` : "";
}
const titleOf = p => `${unitSize(p.size) ? tidy(p.size)+" " : ""}${p.propertyType || "Property"} in ${cleanArea(p.area)}`;

/* ---------------- saved (favourites) ---------------- */
const KEY = "jpc_saved";
function savedList(){ try{ const v = JSON.parse(localStorage.getItem(KEY)||"[]"); return Array.isArray(v) ? v : []; }catch(_){ return mem; } }
let mem = [];
function setSaved(a){ mem = a; try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(_){} }
const isSaved = id => savedList().includes(id);
function toggleSaved(id){
  const a = savedList(); const i = a.indexOf(id);
  if(i>=0) a.splice(i,1); else a.unshift(id);
  setSaved(a); paintSaved(); toast(i>=0 ? "Removed from saved" : "Saved — find it under ♥ Saved");
  document.dispatchEvent(new CustomEvent("jpc:saved"));
}
function paintSaved(){
  const a = savedList();
  document.querySelectorAll("[data-save]").forEach(b => { const on = a.includes(b.dataset.save); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Remove from saved" : "Save property"); });
  document.querySelectorAll(".saved-count").forEach(c => { c.textContent = a.length || ""; c.style.display = a.length ? "inline-grid" : "none"; });
}

/* ---------------- toast ---------------- */
let tt;
function toast(msg){
  let t = $("jpcToast"); if(!t){ t = document.createElement("div"); t.id = "jpcToast"; t.className = "toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2200);
}

/* ---------------- share ---------------- */
const META = {};
function pageUrl(id){ return new URL("property.html?id=" + encodeURIComponent(id), location.href).href; }
async function share(id){
  const m = META[id] || {}, url = pageUrl(id);
  const text = `${m.title || "Property in Jaipur"}${m.price ? " — " + m.price : ""}\nJaipur Property Consultant`;
  if(navigator.share){ try{ await navigator.share({ title: m.title || "Property", text, url }); return; }catch(e){ if(e && e.name === "AbortError") return; } }
  let s = $("shareSheet");
  if(!s){
    s = document.createElement("div"); s.id = "shareSheet"; s.className = "sheet"; s.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-label="Share property"><div class="sheet-head"><b>Share this property</b><button type="button" class="sheet-x" data-sheet-close aria-label="Close">${ico("close")}</button></div><div class="sheet-title" id="shTitle"></div><div class="sheet-acts"><a id="shWa" class="btn btn-green" target="_blank" rel="noopener">${ico("wa")}WhatsApp</a><button id="shCopy" class="btn btn-light" type="button">${ico("link")}Copy link</button></div></div>`;
    document.body.appendChild(s);
    s.addEventListener("click", e => { if(e.target === s || e.target.closest("[data-sheet-close]")) s.classList.remove("open"); });
    $("shCopy").onclick = async () => { try{ await navigator.clipboard.writeText($("shCopy").dataset.url); toast("Link copied"); }catch(_){ window.prompt("Copy this link", $("shCopy").dataset.url); } s.classList.remove("open"); };
  }
  $("shTitle").textContent = m.title || "";
  $("shWa").href = "https://wa.me/?text=" + encodeURIComponent(text + "\n" + url);
  $("shCopy").dataset.url = url; s.classList.add("open");
}

/* ---------------- gallery slider + cards ---------------- */
const GALLERY = {};
function sliderHTML(p, opts = {}){
  const imgs = photosOf(p); GALLERY[p.id] = imgs;
  META[p.id] = { title: titleOf(p), price: priceText(p.budgetMin, p.budgetMax, "") };
  const a = String(p.availability || "Available");
  const badge = `<span class="avail ${availClass(a)}">${esc(a)}</span>`;
  const fab = opts.noFab ? "" : `<div class="fabs"><button type="button" class="fab" data-save="${esc(p.id)}" aria-pressed="false" aria-label="Save property">${ico("heart")}</button><button type="button" class="fab" data-share="${esc(p.id)}" aria-label="Share property">${ico("share")}</button></div>`;
  if(!imgs.length) return `<div class="slider">${badge}${fab}<div class="no-photo">${ico("camera")}<span>Photos on request</span></div></div>`;
  const slides = imgs.map((u,i) => `<div class="slide" data-zoom="${esc(p.id)}" data-i="${i}"><img class="bg" src="${esc(u)}" alt="" aria-hidden="true" loading="lazy"><img class="fg" src="${esc(u)}" alt="${esc(titleOf(p))} — photo ${i+1}" loading="${i?"lazy":"lazy"}"></div>`).join("");
  const multi = imgs.length > 1;
  return `<div class="slider" data-n="${imgs.length}">${badge}${fab}<div class="slides">${slides}</div>${multi ? `<button class="s-btn prev" type="button" data-slide="-1" aria-label="Previous photo">${ico("left")}</button><button class="s-btn next" type="button" data-slide="1" aria-label="Next photo">${ico("right")}</button><div class="dots">${imgs.map((_,i)=>`<span class="dot${i===0?" on":""}"></span>`).join("")}</div><span class="s-count">${ico("camera")}<span><b>1</b> / ${imgs.length}</span></span>` : ""}</div>`;
}
function propertyCard(p){
  const area = cleanArea(p.area), title = titleOf(p);
  const msg = `Hello, I am interested in the ${p.propertyType || "property"} in ${area}${p.code ? " (Ref " + p.code + ")" : ""} listed on your website. Please share details.`;
  const n = photosOf(p).length, pg = perGaj(p);
  const chips = [
    p.code ? `<span class="chip refc">Ref ${esc(p.code)}</span>` : "",
    p.size ? `<span class="chip">${ico("ruler")}${esc(tidy(p.size))}</span>` : "",
    p.roadFacing ? `<span class="chip">${esc(tidy(p.roadFacing))}</span>` : "",
    n > 1 ? `<span class="chip">${ico("camera")}${n} photos</span>` : "",
    p.videoUrl ? `<span class="chip">${ico("video")}Video</span>` : ""
  ].join("");
  return `<article class="pcard">${sliderHTML(p)}<div class="pbody"><div class="ptype">${esc(p.propertyType || "Property")}</div><h3><a href="property.html?id=${encodeURIComponent(p.id)}">${esc(title)}</a></h3><div class="ploc">${ico("pin")}${esc(area)}, ${esc(tidy(p.city) || "Jaipur")}</div>${chips ? `<div class="chips">${chips}</div>` : ""}${tidy(p.details) ? `<div class="pdesc">${esc(tidy(p.details))}</div>` : ""}<div class="pfoot"><div><div class="price">${esc(priceText(p.budgetMin, p.budgetMax, "Price on enquiry"))}</div>${pg ? `<div class="pergaj">${esc(pg)}</div>` : ""}</div><div class="pactions"><a class="btn btn-green btn-sm" target="_blank" rel="noopener" href="${wa(msg)}">${ico("wa")}Enquire</a><a class="btn btn-dark btn-sm" href="property.html?id=${encodeURIComponent(p.id)}">View details</a></div></div></div></article>`;
}

/* ---------------- lightbox ---------------- */
let lb = { id:null, i:0 };
function ensureLightbox(){
  if($("lightbox")) return;
  const d = document.createElement("div"); d.id = "lightbox"; d.className = "lightbox"; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-label","Photo viewer");
  d.innerHTML = `<button class="lb-btn lb-close" type="button" id="lbClose" aria-label="Close">${ico("close")}</button><button class="lb-btn lb-prev" type="button" id="lbPrev" aria-label="Previous photo">${ico("left")}</button><img id="lbImg" alt="Property photo"><button class="lb-btn lb-next" type="button" id="lbNext" aria-label="Next photo">${ico("right")}</button><div class="lb-count" id="lbCount"></div>`;
  document.body.appendChild(d);
}
function lbShow(){
  const list = GALLERY[lb.id] || []; if(!list.length) return;
  lb.i = (lb.i + list.length) % list.length; $("lbImg").src = list[lb.i];
  $("lbCount").textContent = list.length > 1 ? `${lb.i+1} / ${list.length}` : "";
  $("lbPrev").style.display = $("lbNext").style.display = list.length > 1 ? "grid" : "none";
}
function openLightbox(id, i){ ensureLightbox(); lb = { id, i }; $("lightbox").classList.add("open"); lbShow(); $("lbClose").focus(); }
function closeLightbox(){ const l = $("lightbox"); if(l){ l.classList.remove("open"); $("lbImg").src = ""; } }
const curIdx = t => Math.round(t.scrollLeft / Math.max(1, t.clientWidth));

document.addEventListener("click", e => {
  const sb = e.target.closest("[data-slide]");
  if(sb){ const sl = sb.closest(".slider"), tr = sl.querySelector(".slides"), n = sl.dataset.n|0;
    tr.scrollTo({ left: Math.min(n-1, Math.max(0, curIdx(tr) + Number(sb.dataset.slide))) * tr.clientWidth, behavior:"smooth" }); return; }
  const sv = e.target.closest("[data-save]"); if(sv){ e.preventDefault(); toggleSaved(sv.dataset.save); return; }
  const sh = e.target.closest("[data-share]"); if(sh){ e.preventDefault(); share(sh.dataset.share); return; }
  const z = e.target.closest("[data-zoom]"); if(z){ openLightbox(z.dataset.zoom, Number(z.dataset.i)||0); return; }
  if(e.target.id === "lbClose" || e.target.id === "lightbox") closeLightbox();
  if(e.target.closest("#lbPrev")){ lb.i--; lbShow(); }
  if(e.target.closest("#lbNext")){ lb.i++; lbShow(); }
});
document.addEventListener("scroll", e => {
  const t = e.target; if(!(t instanceof Element) || !t.classList.contains("slides")) return;
  const s = t.closest(".slider"), i = curIdx(t);
  s.querySelectorAll(".dot").forEach((d,k) => d.classList.toggle("on", k === i));
  const c = s.querySelector(".s-count b"); if(c) c.textContent = i + 1;
}, true);
document.addEventListener("keydown", e => {
  const l = $("lightbox");
  if(l && l.classList.contains("open")){
    if(e.key === "Escape") closeLightbox(); if(e.key === "ArrowLeft"){ lb.i--; lbShow(); } if(e.key === "ArrowRight"){ lb.i++; lbShow(); }
  } else if(e.key === "Escape"){ const s = $("shareSheet"); if(s) s.classList.remove("open"); }
});
let tx = null;
document.addEventListener("touchstart", e => { if(e.target.closest("#lightbox")) tx = e.touches[0].clientX; }, {passive:true});
document.addEventListener("touchend", e => { if(tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if(Math.abs(dx) > 50){ lb.i += dx < 0 ? 1 : -1; lbShow(); } });

/* ---------------- icons + chrome ---------------- */
const EXTRA_ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-logo" viewBox="0 0 32 32"><path d="M5 28V14.5C5 9 9.5 5 16 3c6.5 2 11 6 11 11.500V28" fill="none"/><path d="M10 28v-9a6 6 0 0 1 12 0v9" fill="none"/><path d="M3 28h26" fill="none"/></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.800-8 11-8 11z"/></symbol>
<symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.600 13.500l6.800 4M15.400 6.500l-6.800 4"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.800 5.800 6.200.9-4.500 4.400 1.100 6.200L12 17.300 6.400 20.300l1.100-6.200L3 9.700l6.200-.9z"/></symbol>
<symbol id="i-handshake" viewBox="0 0 24 24"><path d="M2 12l4-4 4 1 3-2 4 2 5-1"/><path d="M2 12l6 6a2 2 0 0 0 3 0l1-1 1 1a2 2 0 0 0 3 0l1-1 1 1a2 2 0 0 0 3 0l2-2"/></symbol>
<symbol id="i-calc" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/></symbol>
<symbol id="i-gift" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M5 12v9h14v-9M12 8c-2-4-6-3-5 0 .5 1.500 3 1 5 0zM12 8c2-4 6-3 5 0-.5 1.500-3 1-5 0z"/></symbol>
<symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18M6 12h12M10 19h4"/></symbol>
</defs></svg>`;
function chrome(){
  const root = document.querySelector("[data-chrome]"); if(!root) return;
  const page = root.dataset.chrome;
  const nav = (href, label, key) => `<a href="${href}"${page===key?' class="nav-primary" aria-current="page"':""}>${label}</a>`;
  const waHello = wa("Hello, I want property consultation in Jaipur.");
  document.body.insertAdjacentHTML("afterbegin", `<div class="topbar"><div class="container topbar-inner"><div class="topbar-left">Jaipur &amp; Jhotwara property consultation</div><div class="top-right"><a href="tel:+91${esc(SITE.phone)}">${ico("phone")}${esc(SITE.phone)}</a><a href="${waHello}" target="_blank" rel="noopener">${ico("wa")}WhatsApp</a></div></div></div>
  <header class="nav-wrap"><nav class="container nav" aria-label="Main"><a class="brand" href="index.html" aria-label="${esc(SITE.brand.name)} home"><div class="brand-mark">${ico("logo")}</div><div><div class="brand-name">${esc(SITE.brand.name)}</div><div class="brand-sub">${esc(SITE.brand.tagline)}</div></div></a>
  <div class="nav-links" id="navLinks">${nav("properties.html","Properties","properties")}${nav("partner.html","Sell &amp; earn","partner")}${nav("reviews.html","Reviews","reviews")}${nav("index.html#contact","Contact","contact")}<a href="properties.html?saved=1" class="nav-saved">${ico("heart")}Saved<span class="saved-count" style="display:none"></span></a><a class="nav-wa" target="_blank" rel="noopener" href="${waHello}">${ico("wa")}WhatsApp</a></div>
  <button class="menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">${ico("menu")}</button></nav></header>`);
  document.body.insertAdjacentHTML("beforeend", `<footer class="footer"><div class="container"><div class="footer-grid"><div><div class="brand" style="margin-bottom:12px"><div class="brand-mark">${ico("logo")}</div><div><div class="brand-name">${esc(SITE.brand.name)}</div></div></div><p>Real estate consultation for plots, land and property buying, selling and investment in Jaipur &amp; Jhotwara.</p></div><div><h4>Explore</h4><a href="properties.html">Properties</a><a href="partner.html">Sell with us</a><a href="partner.html#agents">Agent programme</a><a href="reviews.html">Reviews</a></div><div><h4>Contact</h4><a href="tel:+91${esc(SITE.phone)}">${esc(SITE.phone)}</a><span style="display:block;padding:3px 0">${esc(SITE.address)}</span>${SITE.officeHours ? `<span style="display:block;padding:3px 0">${esc(SITE.officeHours)}</span>` : ""}</div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(SITE.brand.name)}. All rights reserved.${SITE.reraNo ? " RERA " + esc(SITE.reraNo) : ""}</span><a href="admin.html" rel="nofollow">Staff login</a></div></div></footer>
  <a class="float-wa" target="_blank" rel="noopener" href="${waHello}" aria-label="Chat on WhatsApp"><svg class="icon" style="width:28px;height:28px;fill:#fff;stroke:none"><use href="#i-wa"/></svg></a>
  <div class="mobile-bar"><a class="c" href="tel:+91${esc(SITE.phone)}">${ico("phone")}Call</a><a class="w" target="_blank" rel="noopener" href="${waHello}"><svg class="icon" style="width:18px;height:18px;fill:#fff;stroke:none"><use href="#i-wa"/></svg>WhatsApp</a></div>`);
  const mb = $("menuBtn"), nl = $("navLinks");
  mb.onclick = () => { const o = nl.classList.toggle("open"); mb.setAttribute("aria-expanded", String(o)); };
  nl.addEventListener("click", e => { if(e.target.closest("a")){ nl.classList.remove("open"); mb.setAttribute("aria-expanded","false"); } });
}
function init(){
  document.body.insertAdjacentHTML("afterbegin", EXTRA_ICONS);
  if(document.querySelector("[data-chrome]") && !document.querySelector("#i-phone")) document.body.insertAdjacentHTML("afterbegin", window.JPC_SPRITE || "");
  chrome(); paintSaved();
  document.addEventListener("jpc:rendered", paintSaved);
}
if("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

window.JPC = { SITE, $, esc, ico, wa, hidden, millis, tidy, cleanArea, unitSize, inr, priceText, photosOf, availClass, perGaj, titleOf, GALLERY, META, sliderHTML, propertyCard, openLightbox, closeLightbox, savedList, isSaved, toggleSaved, paintSaved, toast, share, pageUrl };
})();
