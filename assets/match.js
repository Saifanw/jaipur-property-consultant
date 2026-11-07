/* =====================================================================
   JPC smart search + matching  (used by properties.html and admin.html)
   - parseQuery("50 gaj plot jhotwara under 40 lakh")  -> structured filters
   - search(list, query)    -> properties ranked by relevance
   - score(customer, prop)  -> {score 0-100, why[]} for the CRM matching
   Edit NEARBY below if your area map changes.
   ===================================================================== */
(function (root) {
  "use strict";

  /* ---- areas: spelling variants -> one canonical name ---- */
  const ALIASES = {
    "jhotwara": ["jhotwara industrial area", "jhotwara industrial", "jhotwara", "jhotwada", "jhotvara", "jhotwra"],
    "vaishali nagar": ["vaishali nagar", "vaishalinagar", "vaishali"],
    "mansarovar": ["mansarovar", "mansarover", "manasarovar", "mansarowar", "mansarvar"],
    "jagatpura": ["jagatpura", "jagatpur", "jagatpuraa"],
    "sanganer": ["sanganer", "sanganeer"],
    "ajmer road": ["ajmer road", "ajmer rd", "ajmer"],
    "tonk road": ["tonk road", "tonk rd", "tonk"],
    "kalwar road": ["kalwar road", "kalwar rd", "kalwar"],
    "mahapura": ["mahapura", "mahapur"],
    "bhankrota": ["bhankrota", "bhakrota", "bhankrotha"],
    "khatipura": ["khatipura", "khatipur"],
    "bindayaka": ["bindayaka", "bindayka", "bindaika"],
    "vatika": ["vatika"],
    "chaksu": ["chaksu", "chaksoo"]
  };
  /* areas that are close to each other (used for "paas ka area" partial matches) */
  const NEARBY = {
    "jhotwara": ["khatipura", "kalwar road", "bindayaka", "ajmer road"],
    "khatipura": ["jhotwara", "kalwar road"],
    "kalwar road": ["jhotwara", "khatipura", "bindayaka"],
    "bindayaka": ["kalwar road", "jhotwara", "ajmer road"],
    "ajmer road": ["vaishali nagar", "bhankrota", "mahapura", "jhotwara", "bindayaka"],
    "vaishali nagar": ["mansarovar", "ajmer road"],
    "mansarovar": ["vaishali nagar", "sanganer"],
    "sanganer": ["jagatpura", "mansarovar", "tonk road"],
    "jagatpura": ["mahapura", "sanganer", "tonk road"],
    "mahapura": ["jagatpura", "ajmer road", "bhankrota"],
    "bhankrota": ["ajmer road", "mahapura"],
    "tonk road": ["sanganer", "jagatpura", "vatika", "chaksu"],
    "vatika": ["tonk road", "chaksu"],
    "chaksu": ["vatika", "tonk road"]
  };
  const ALIAS_LIST = [];
  Object.keys(ALIASES).forEach(k => ALIASES[k].forEach(a => ALIAS_LIST.push([a, k])));
  ALIAS_LIST.sort((a, b) => b[0].length - a[0].length);   // longest first

  const norm = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f.\s]/g, " ").replace(/\s+/g, " ").trim();
  const hasWord = (txt, w) => new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9])").test(txt);

  /* one canonical area name from free text, or "" */
  function canonArea(txt) {
    const t = norm(txt);
    if (!t) return "";
    for (const [a, k] of ALIAS_LIST) if (hasWord(t, a)) return k;
    return "";
  }
  /* list of area keys in a field like "Jhotwara, Kalwar Road" */
  function areaKeys(field) {
    const out = [];
    String(field || "").split(/[,\/|&\n]|\bya\b|\bor\b/i).forEach(seg => {
      const s = norm(seg); if (!s) return;
      const c = canonArea(s); const k = c || s;
      if (k && !out.includes(k)) out.push(k);
    });
    return out;
  }
  const areaSame = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
  const isNear = (a, b) => (NEARBY[a] || []).includes(b) || (NEARBY[b] || []).includes(a);

  /* ---- property type families ---- */
  const FAMS = [
    ["plot", /\b(plots?|zameen|jameen|bhukhand|residential plot)\b/],
    ["land", /\b(land|agricultural|agriculture|kheti|farm|farmland|farmhouse land)\b/],
    ["house", /\b(house|villa|villas|kothi|makaan|makan|ghar|bungalow|independent|duplex)\b/],
    ["flat", /\b(flats?|apartments?|\d\s?bhk)\b/],
    ["shop", /\b(shops?|dukan|showroom)\b/],
    ["commercial", /\b(commercial|office|warehouse|godown|factory|industrial)\b/]
  ];
  const COUSIN = { "plot|land": .6, "shop|commercial": .8, "house|flat": .35 };
  const cousin = (a, b) => COUSIN[a + "|" + b] || COUSIN[b + "|" + a] || 0;
  function typeFam(txt) {
    const t = norm(txt);
    if (!t) return "";
    for (const [f, re] of FAMS) if (re.test(t)) return f;
    return "";
  }

  /* ---- numbers: size and budget ---- */
  function parseSize(txt) {
    const t = norm(txt), out = { gaj: 0, bhk: 0 };
    let m = t.match(/(\d+(?:\.\d+)?)\s*(gaj|sq\.? ?yards?|sq\.? ?yd|sqyd|yards?)\b/);
    if (m) out.gaj = parseFloat(m[1]);
    else if ((m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(sq\.? ?ft|sqft|square feet|sft|feet)\b/))) out.gaj = parseFloat(m[1].replace(/,/g, "")) / 9;
    const b = t.match(/\b(\d)\s*bhk\b/); if (b) out.bhk = parseInt(b[1], 10);
    return out;
  }
  const UNIT = u => /^(cr|crore|crores|karod)/.test(u) ? CRORE() : /^(k|hazar|thousand)/.test(u) ? 1e3 : LAKH();
  function CRORE() { return 1e7; } function LAKH() { return 1e5; }
  const NUM = "(\\d+(?:\\.\\d+)?)", UN = "(cr|crores?|karod|l|lacs?|lakhs?|lakh|k|hazar)";
  const MAXW = /\b(under|below|upto|up to|within|max|maximum|tak|se kam|andar|less than)\b/;
  const MINW = /\b(above|over|min|minimum|se zyada|se jyada|more than|from|atleast|at least)\b/;
  function parseBudget(txt) {
    const t = norm(txt).replace(/₹|rs\.?|inr/g, " ");
    let m = t.match(new RegExp(NUM + "\\s*(?:-|to|se)\\s*" + NUM + "\\s*" + UN + "\\b"));
    if (m) { const u = UNIT(m[3]); return { min: Math.round(parseFloat(m[1]) * u), max: Math.round(parseFloat(m[2]) * u), frag: m[0] }; }
    m = t.match(new RegExp(NUM + "\\s*" + UN + "\\b"));
    if (m) {
      const v = Math.round(parseFloat(m[1]) * UNIT(m[2])), pre = t.slice(Math.max(0, m.index - 14), m.index + m[0].length + 10);
      if (MINW.test(pre) && !MAXW.test(pre)) return { min: v, max: 0, frag: m[0] };
      if (MAXW.test(pre)) return { min: 0, max: v, frag: m[0] };
      return { min: 0, max: Math.round(v * 1.1), bare: v, frag: m[0] };
    }
    m = t.match(/\b(\d{6,9})\b/);
    if (m) { const v = parseInt(m[1], 10); return { min: 0, max: Math.round(v * 1.1), bare: v, frag: m[0] }; }
    return { min: 0, max: 0, frag: "" };
  }
  const codeNum = c => { const m = String(c || "").match(/(\d{1,6})\s*$/); return m ? parseInt(m[1], 10) : 0; };

  const STOP = new Set(("for in at on of the a an and or to me mein main ka ki ke ko hai hain chahiye chahie sale buy rent property properties " +
    "wala wali near under below above upto up tak se kam zyada jyada budget size need want looking dikhao batao available mere meri mujhe " +
    "sq ft sqft gaj yard bhk rs inr lakh lac lakhs crore cr").split(" "));

  /* free text -> structured query */
  function parseQuery(raw) {
    const t = norm(raw), q = { raw: String(raw || ""), area: "", type: "", fam: "", min: 0, max: 0, bare: 0, gaj: 0, bhk: 0, code: 0, rest: [] };
    if (!t) return q;
    let rest = " " + t + " ";
    const cm = t.match(/\bjpc\s*-?\s*0*(\d{1,5})\b/);
    if (cm) { q.code = parseInt(cm[1], 10); rest = rest.replace(cm[0], " "); }
    const b = parseBudget(t);
    if (b.frag) { q.min = b.min; q.max = b.max; q.bare = b.bare || 0; rest = rest.replace(b.frag, " "); }
    const sz = parseSize(t);
    q.gaj = sz.gaj; q.bhk = sz.bhk;
    rest = rest.replace(/(\d+(?:\.\d+)?)\s*(gaj|sq\.? ?yards?|sq\.? ?yd|sqyd|sq\.? ?ft|sqft|sft)\b/g, " ").replace(/\b\d\s*bhk\b/g, " ");
    const area = canonArea(t);
    if (area) { q.area = area; ALIASES[area].forEach(a => { rest = rest.replace(new RegExp("(^|\\s)" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|$)", "g"), " "); }); }
    q.fam = typeFam(t);
    if (q.fam) { const f = FAMS.find(x => x[0] === q.fam); q.type = q.fam; rest = rest.replace(new RegExp(f[1].source, "g"), " "); }
    q.rest = rest.split(" ").filter(w => w && w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
    return q;
  }

  /* ---- facts about a property ---- */
  const priceRange = p => {
    const a = Number(p.budgetMin) || 0, b = Number(p.budgetMax) || 0;
    return a || b ? [a || b, b || a] : [0, 0];
  };
  const gajOf = p => Number(p.areaGaj) > 0 ? Number(p.areaGaj) : (parseSize(p.size).gaj || parseSize(p.details).gaj || 0);
  const bhkOf = p => parseSize(p.size).bhk || (parseInt(p.bedrooms, 10) || 0) || parseSize(p.details).bhk;
  const blob = p => norm([p.area, p.city, p.propertyType, p.size, p.code, p.details, p.roadFacing, p.facing, p.society, p.highlights, p.nearby, p.pattaType, p.registry, p.propertyLocation].join(" "));
  function lev1(a, b) {                       // true when edit distance <= 1
    if (a === b) return true; const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, d = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return d + (la - i) + (lb - j) <= 1;
  }
  function tokenIn(tok, text, words) {
    if (text.includes(tok)) return true;
    if (tok.length < 5) return false;
    return words.some(w => w[0] === tok[0] && lev1(tok, w));
  }

  /* ---- website search ---- */
  function strictMatch(p, q) {
    if (q.code && codeNum(p.code) !== q.code) return -1;
    let s = 50;
    if (q.area) {
      const pk = areaKeys(p.area);
      if (pk.some(k => areaSame(k, q.area))) s += 25; else return -1;
    }
    if (q.fam) { if (typeFam(p.propertyType) === q.fam) s += 15; else return -1; }
    if (q.max || q.min) {
      const [lo, hi] = priceRange(p);
      if (!lo) return -1;
      if (q.max && lo > q.max) return -1;
      if (q.min && hi < q.min) return -1;
      s += 10;
      if (q.bare) s -= Math.min(10, Math.abs(hi - q.bare) / q.bare * 10);   // closer to the amount ranks higher
    }
    if (q.gaj) { const g = gajOf(p); if (!g) return -1; const r = Math.abs(g - q.gaj) / q.gaj; if (r > .25) return -1; s += 10 - r * 20; }
    if (q.bhk) { const b = bhkOf(p); if (b && b !== q.bhk) return -1; if (b) s += 8; }
    if (q.rest.length) {
      const text = blob(p), words = [...new Set(text.split(" "))];
      for (const tok of q.rest) { if (!tokenIn(tok, text, words)) return -1; s += 4; }
    }
    return s;
  }
  function search(list, query) {
    const q = typeof query === "string" ? parseQuery(query) : query;
    const out = [];
    list.forEach(p => { const s = strictMatch(p, q); if (s >= 0) out.push({ p, score: Math.round(s) }); });
    return out.sort((a, b) => b.score - a.score);
  }
  /* what the visitor probably wants, as a pseudo-customer, so score() can find "closest matches" */
  function queryAsBuyer(q) {
    return { area: q.area, propertyType: q.type, budgetMin: q.min || 0, budgetMax: q.max || 0, size: q.gaj ? q.gaj + " gaj" : (q.bhk ? q.bhk + " bhk" : "") };
  }

  /* ---- CRM matching: customer requirement <-> property ---- */
  const W = { area: 35, type: 25, budget: 25, size: 15 };
  function score(c, p) {
    const why = []; let pts = 0, known = 0, capType = false, capBudget = false;

    const ca = areaKeys(c.area), pa = areaKeys(p.area);
    if (ca.length && pa.length) {
      known += W.area;
      if (ca.some(a => pa.some(b => areaSame(a, b)))) { pts += W.area; why.push("Same area"); }
      else if (ca.some(a => pa.some(b => isNear(a, b)))) { pts += 20; why.push("Paas ka area"); }
    }

    const cf = typeFam(c.propertyType) || typeFam(c.details), pf = typeFam(p.propertyType);
    if (cf && pf) {
      known += W.type;
      if (cf === pf) { pts += W.type; why.push("Same type"); }
      else if (cousin(cf, pf)) { pts += Math.round(W.type * cousin(cf, pf)); why.push("Milta-julta type"); }
      else { capType = true; why.push("Type alag"); }
    }

    let bMin = Number(c.budgetMin) || 0, bMax = Number(c.budgetMax) || 0; const [lo, hi] = priceRange(p);
    if (bMin && !bMax) { bMax = bMin; bMin = 0; }   /* ek hi budget likha ho to wo 'kitna tak' hai, 'kam se kam' nahi */
    if ((bMin || bMax) && lo) {
      known += W.budget;
      const top = bMax || Infinity;
      if (lo <= top && hi >= bMin) { pts += W.budget; why.push("Budget fits"); }
      else {
        const gap = lo > top ? lo - top : bMin - hi, ref = lo > top ? top : bMin, r = ref ? gap / ref : 1;
        if (r <= .10) { pts += 20; why.push("Budget thoda door"); }
        else if (r <= .20) { pts += 12; why.push("Budget 20% tak door"); }
        else if (r <= .35) { pts += 5; why.push("Budget door"); }
        else if (r > .5) { capBudget = true; why.push("Budget bahut alag"); }
      }
    }

    const cs = parseSize([c.size, c.details].join(" ")), cg = cs.gaj, pg = gajOf(p);
    const cb = cs.bhk, pb = bhkOf(p);
    if (cb && pb) {
      known += W.size;
      if (cb === pb) { pts += W.size; why.push("Same BHK"); } else if (Math.abs(cb - pb) === 1) { pts += 6; why.push("BHK 1 alag"); }
    } else if (cg && pg) {
      known += W.size;
      const r = Math.abs(cg - pg) / cg;
      if (r <= .10) { pts += W.size; why.push("Size fits"); }
      else if (r <= .20) { pts += 11; why.push("Size milta-julta"); }
      else if (r <= .35) { pts += 5; why.push("Size thodi alag"); }
    }

    if (!known) return { score: 0, why: [] };
    let s = Math.round((pts / known) * 100 * (0.4 + 0.6 * known / 100));
    if (capType) s = Math.min(s, 40);
    if (capBudget) s = Math.min(s, 45);
    return { score: Math.max(0, Math.min(100, s)), why };
  }

  root.JPCMatch = { parseQuery, parseSize, parseBudget, search, score, queryAsBuyer, areaKeys, canonArea, typeFam, codeNum, norm, ALIASES, NEARBY };
})(typeof window !== "undefined" ? window : globalThis);
