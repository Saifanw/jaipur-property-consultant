/* JPC Analytics tracker v2
   Uses the existing Firebase project from assets/config.js.
   Collects (no IP, no name/phone, no exact GPS):
   - page views with session, source/channel/UTM, device/OS/browser, screen, language, timezone
   - approximate location (country/state/city) via a no-key IP lookup - turn off with SITE.analytics.geo=false
   - time spent (active seconds) and scroll depth per page view
   - actions: call / WhatsApp / email / map clicks, property opens, outbound links, form start / submit
   Admin's own visits (signed-in Google user) and bots are skipped. Add ?notrack=1 once on any
   page to exclude your own browser permanently. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

(() => {
  const cfg = window.SITE?.firebase;
  if (!cfg || !cfg.projectId) return;
  const OPT = window.SITE?.analytics || {};
  const ua = navigator.userAgent || "";
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };

  /* ---- skip bots and the owner's own browser ---- */
  if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|monitor|uptime/i.test(ua)) return;
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("notrack") === "1") { LS.set("jpc_no_track", "1"); return; }
    if (q.get("notrack") === "0") LS.set("jpc_no_track", "0");
  } catch (_) {}
  if (LS.get("jpc_no_track") === "1") return;

  const cut = (v, n) => String(v ?? "").slice(0, n);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "x-" + Date.now() + "-" + Math.random().toString(36).slice(2));

  /* ---- visitor (browser) id, visit counter ---- */
  let visitorId = LS.get("jpc_analytics_visitor");
  if (!visitorId) { visitorId = uuid(); LS.set("jpc_analytics_visitor", visitorId); }

  /* ---- session (30 min inactivity window) ---- */
  const now = Date.now();
  let sess = null;
  try { sess = JSON.parse(LS.get("jpc_an_sess") || "null"); } catch (_) {}
  const isNewSession = !sess || !sess.id || now - (sess.last || 0) > 30 * 60 * 1000;

  const host = location.hostname.replace(/^www\./, "");
  const params = new URLSearchParams(location.search);
  const refHost = (() => {
    try {
      if (!document.referrer) return "";
      const u = new URL(document.referrer);
      return (u.protocol === "android-app:" ? u.hostname : u.hostname).replace(/^www\./, "").slice(0, 120);
    } catch (_) { return ""; }
  })();

  function classify() {
    const utmSource = cut(params.get("utm_source"), 60), medium = cut(params.get("utm_medium"), 40).toLowerCase(), campaign = cut(params.get("utm_campaign"), 80);
    const h = refHost.toLowerCase();
    let channel = "Direct", source = "Direct";
    if (h && h !== host) { channel = "Referral"; source = h; }
    const rules = [
      [/google\.|googlequicksearchbox/, "Organic Search", "Google"], [/bing\./, "Organic Search", "Bing"], [/yahoo\./, "Organic Search", "Yahoo"],
      [/duckduckgo\./, "Organic Search", "DuckDuckGo"], [/yandex\.|baidu\.|ecosia\./, "Organic Search", h],
      [/facebook\.|(^|\.)fb\.|com\.facebook|lm\.facebook/, "Social", "Facebook"], [/instagram\./, "Social", "Instagram"],
      [/(^|\.)t\.co$|twitter\.|(^|\.)x\.com$/, "Social", "X / Twitter"], [/linkedin\.|lnkd\.in/, "Social", "LinkedIn"],
      [/youtube\.|youtu\.be/, "Social", "YouTube"], [/pinterest\./, "Social", "Pinterest"], [/reddit\./, "Social", "Reddit"],
      [/whatsapp\.|(^|\.)wa\.me$/, "Social", "WhatsApp"], [/(^|\.)t\.me$|telegram\./, "Social", "Telegram"],
      [/mail\.google|outlook\.|mail\.yahoo|webmail/, "Email", "Email"],
      [/99acres\.|magicbricks\.|housing\.com|nobroker\.|commonfloor\.|olx\./, "Referral", h]
    ];
    if (h && h !== host) for (const [re, ch, src] of rules) if (re.test(h)) { channel = ch; source = src; break; }
    if (utmSource) source = utmSource;
    if (/^(cpc|ppc|paid|paidsearch|paid_social|display|ads?)$/.test(medium)) channel = "Paid";
    else if (medium === "email") channel = "Email";
    else if (medium === "social" && channel !== "Social") channel = "Social";
    else if (utmSource && channel === "Direct") channel = "Campaign";
    return { channel, source: cut(source, 60), referrer: h === host ? "" : cut(refHost, 120), medium, campaign };
  }

  if (isNewSession) {
    const visits = (parseInt(LS.get("jpc_an_visits") || "0", 10) || 0) + 1;
    LS.set("jpc_an_visits", String(visits));
    if (!LS.get("jpc_an_first")) LS.set("jpc_an_first", String(now));
    sess = { id: uuid(), start: now, last: now, idx: 0, visits, attr: classify(), entry: location.pathname.split("/").pop() || "index.html" };
  }
  const idx = sess.idx || 0;
  sess.idx = idx + 1; sess.last = now;
  LS.set("jpc_an_sess", JSON.stringify(sess));
  const attr = sess.attr || classify();

  /* ---- environment ---- */
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "Tablet" : /mobi|iphone|ipod|android/i.test(ua) ? "Mobile" : "Desktop";
  const os = /windows nt/i.test(ua) ? "Windows" : /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iOS" : /mac os x/i.test(ua) ? "macOS" : /cros/i.test(ua) ? "ChromeOS" : /linux/i.test(ua) ? "Linux" : "Other";
  const browser = /FBAN|FBAV/.test(ua) ? "Facebook App" : /Instagram/.test(ua) ? "Instagram App" : /EdgA?\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\/|FxiOS/.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const page = cut(location.pathname.split("/").pop() || "index.html", 160);
  const propertyId = cut(params.get("id") || "", 80);
  const tz = (() => { try { return cut(Intl.DateTimeFormat().resolvedOptions().timeZone, 60); } catch (_) { return ""; } })();
  const cached = (() => { try { const c = JSON.parse(LS.get("jpc_an_geo") || "null"); return c && Date.now() - c.t < 864e5 ? c : null; } catch (_) { return null; } })();

  /* ---- Firebase ---- */
  let db, ref, uid = "", dead = false;
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  const auth = getAuth(app);
  db = getFirestore(app);
  const ready = (async () => {
    await (auth.authStateReady ? auth.authStateReady() : Promise.resolve());
    let u = auth.currentUser;
    if (u && !u.isAnonymous) return null;          // signed-in admin = internal traffic, do not track
    if (!u) u = (await signInAnonymously(auth)).user;
    return u;
  })();

  const state = { duration: 0, scroll: 0, clicks: 0 };
  let created = null, pending = {}, timer = null, sentSig = "";

  created = ready.then(async u => {
    if (!u) { dead = true; return false; }
    uid = u.uid;
    ref = doc(collection(db, "websiteAnalytics"));
    await setDoc(ref, {
      visitorId: cut(visitorId, 80), sessionId: cut(sess.id, 80), page, title: cut(document.title || page, 160), propertyId,
      referrer: attr.referrer, source: attr.source, channel: attr.channel, medium: attr.medium, campaign: attr.campaign,
      device, os, browser, userAgentFamily: browser === "Edge" || browser === "Chrome" || browser === "Firefox" || browser === "Safari" ? browser : "Other",
      screen: screen.width + "x" + screen.height, viewport: innerWidth + "x" + innerHeight,
      language: cut(navigator.language, 20), tz, net: cut(navigator.connection?.effectiveType || "", 10),
      landing: idx === 0, pageIndex: idx + 1, entry: cut(sess.entry, 160), visitCount: sess.visits || 1, isNew: (sess.visits || 1) === 1,
      country: cached?.country || "", countryCode: cached?.cc || "", region: cached?.region || "", city: cached?.city || "",
      durationSec: 0, maxScroll: 0, interactions: 0,
      createdAt: serverTimestamp(), uid
    });
    return true;
  }).catch(err => { dead = true; console.warn("Website analytics unavailable:", err?.code || err); return false; });

  function patch(obj, now_) {
    if (dead) return;
    Object.assign(pending, obj);
    clearTimeout(timer);
    timer = setTimeout(flush, now_ ? 0 : 2500);
  }
  async function flush() {
    if (dead || !Object.keys(pending).length) return;
    const body = pending; pending = {};
    const sig = JSON.stringify(body);
    if (sig === sentSig) return;
    sentSig = sig;
    if (!(await created)) return;
    try { await updateDoc(ref, { ...body, updatedAt: serverTimestamp() }); } catch (e) { console.warn("analytics update:", e?.code || e); }
  }

  /* ---- approximate location (country / state / city only) ---- */
  if (!cached && OPT.geo !== false) {
    (async () => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch("https://ipwho.is/?fields=success,country,country_code,region,city", { signal: ctl.signal, cache: "no-store" });
        clearTimeout(t);
        const j = await r.json();
        if (!j || !j.success) return;
        const g = { t: Date.now(), country: cut(j.country, 60), cc: cut(j.country_code, 4), region: cut(j.region, 60), city: cut(j.city, 60) };
        LS.set("jpc_an_geo", JSON.stringify(g));
        patch({ country: g.country, countryCode: g.cc, region: g.region, city: g.city });
      } catch (_) {}
    })();
  }

  /* ---- time on page (visible seconds) and scroll depth ---- */
  const marks = [10, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800];
  let lastSent = 0, lastScrollSent = 0;
  const scrollNow = () => {
    const d = document.documentElement, h = Math.max(d.scrollHeight, document.body?.scrollHeight || 0) - 0;
    if (!h) return 0;
    return Math.min(100, Math.round(((window.scrollY || d.scrollTop || 0) + innerHeight) / h * 100));
  };
  let st = 0;
  addEventListener("scroll", () => {
    if (st) return;
    st = setTimeout(() => {
      st = 0; const s = scrollNow();
      if (s > state.scroll) { state.scroll = s; const m = [25, 50, 75, 90, 100].find(x => state.scroll >= x && lastScrollSent < x); if (m) { lastScrollSent = m; patch({ maxScroll: state.scroll, durationSec: state.duration }); } }
    }, 250);
  }, { passive: true });
  setTimeout(() => { state.scroll = Math.max(state.scroll, scrollNow()); }, 800);

  setInterval(() => {
    if (document.visibilityState !== "visible" || state.duration >= 1800) return;
    state.duration++;
    if (marks.includes(state.duration)) { lastSent = state.duration; patch({ durationSec: state.duration, maxScroll: state.scroll, interactions: state.clicks }); }
  }, 1000);
  const leave = () => {
    state.scroll = Math.max(state.scroll, scrollNow());
    if (state.duration !== lastSent || state.scroll > lastScrollSent) { lastSent = state.duration; patch({ durationSec: state.duration, maxScroll: state.scroll, interactions: state.clicks }, true); }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") leave(); });
  addEventListener("pagehide", leave);

  /* ---- actions ---- */
  let sent = 0; const once = new Set();
  function track(type, label, target, extraPid) {
    if (dead || sent >= 40) return;
    sent++;
    created.then(ok => {
      if (!ok) return;
      addDoc(collection(db, "websiteEvents"), {
        type, label: cut(label, 80), target: cut(target, 80), page, propertyId: cut(extraPid || propertyId, 80),
        visitorId: cut(visitorId, 80), sessionId: cut(sess.id, 80), uid, createdAt: serverTimestamp()
      }).catch(() => {});
    });
  }
  window.JPCTrack = (label, target) => track("custom", label || "custom", target || "");

  document.addEventListener("click", e => {
    state.clicks++;
    const el = e.target?.closest?.("a,button,[data-track]");
    if (!el) return;
    const label = (el.getAttribute("data-track") || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
    const zone = el.closest("[id]")?.id || el.closest("header,footer,nav,section")?.tagName?.toLowerCase() || "";
    if (el.tagName !== "A") { if (el.hasAttribute("data-track")) track("custom", label, zone); return; }
    const href = el.getAttribute("href") || "";
    if (/^tel:/i.test(href)) return track("call_click", label || href.slice(4), zone);
    if (/^mailto:/i.test(href)) return track("email_click", label || "email", zone);
    if (/wa\.me|api\.whatsapp\.com|^whatsapp:/i.test(href)) return track("whatsapp_click", label || "WhatsApp", zone);
    if (/maps\.google|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(href)) return track("map_click", label || "Map", zone);
    try {
      const u = new URL(href, location.href);
      if (u.hostname === location.hostname) {
        if (/property\.html$/.test(u.pathname) && u.searchParams.get("id")) track("property_open", label, zone, u.searchParams.get("id"));
      } else if (/^https?:$/.test(u.protocol)) track("outbound_click", u.hostname.replace(/^www\./, ""), zone);
    } catch (_) {}
  }, true);

  document.addEventListener("focusin", e => {
    const f = e.target?.closest?.("form"); if (!f || !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const id = f.id || "form"; if (once.has("s" + id)) return; once.add("s" + id); track("form_start", id, "");
  }, true);
  document.addEventListener("submit", e => {
    const f = e.target; const id = (f && f.id) || "form"; track("form_submit", id, "");
  }, true);
})();
