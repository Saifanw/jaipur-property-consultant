/* =====================================================================
   Hindi / English toggle (shared by every public page).
   - Static text:  <span data-i18n="key">English</span>   (+ data-i18n-ph / data-i18n-aria)
   - Dynamic text: JPC_T("key", {var:"x"}, "fallback")
   - Add a new line of text: add ONE row below  key: ["English", "हिन्दी"].
   Choice is remembered in the browser. Owner-typed data (titles, details) is never changed.
   ===================================================================== */
(function(){
const S = {
  /* chrome */
  "tag":["Plots, land & property in Jaipur","जयपुर में प्लॉट, ज़मीन और प्रॉपर्टी"],
  "nav.properties":["Properties","प्रॉपर्टी"],
  "nav.sell":["Sell & earn","बेचें और कमाएं"],
  "nav.reviews":["Reviews","रिव्यू"],
  "nav.call":["Call Now","कॉल करें"],
  "nav.saved":["Saved","सेव्ड"],
  "wa":["WhatsApp","व्हाट्सऐप"],
  "call":["Call","कॉल"],
  "menu":["Open menu","मेन्यू खोलें"],
  "foot.about":["Plots, land and property in Jaipur & Jhotwara.","जयपुर और झोटवाड़ा में प्लॉट, ज़मीन और प्रॉपर्टी।"],
  "foot.rights":["© 2026 Jaipur Property Consultant","© 2026 जयपुर प्रॉपर्टी कंसल्टेंट"],
  "foot.staff":["Staff login","स्टाफ लॉगिन"],
  "foot.explore":["Explore","देखें"],
  "foot.contact":["Contact","संपर्क"],
  "foot.sell":["Sell with us","हमारे साथ बेचें"],
  "foot.agents":["Agent programme","एजेंट प्रोग्राम"],
  "home":["Home","होम"],
  /* hero + search */
  "h1":["Find the right property in Jaipur","जयपुर में सही प्रॉपर्टी खोजें"],
  "lead":["Verified plots, houses and land from a real local office.","असली लोकल ऑफिस से वेरिफाइड प्लॉट, मकान और ज़मीन।"],
  "buy":["I want to Buy","मुझे खरीदना है"],
  "sell":["I want to Sell","मुझे बेचना है"],
  "search":["Search","खोजें"],
  "search.ph":["Location, e.g. Jhotwara","इलाका, जैसे झोटवाड़ा"],
  "allTypes":["All types","सभी प्रकार"],
  "anyBudget":["Any budget","कोई भी बजट"],
  "b25":["Up to ₹25 Lakh","₹25 लाख तक"],
  "b50":["Up to ₹50 Lakh","₹50 लाख तक"],
  "b100":["Up to ₹1 Crore","₹1 करोड़ तक"],
  "b200":["Up to ₹2 Crore","₹2 करोड़ तक"],
  "t.Plot":["Plot","प्लॉट"],"t.House":["House","मकान"],"t.Flat":["Flat","फ्लैट"],"t.Villa":["Villa","विला"],
  "t.Land":["Land","ज़मीन"],"t.Shop":["Shop","दुकान"],"t.Commercial":["Commercial","कमर्शियल"],"t.Other":["Other","अन्य"],
  "t.Property":["Property","प्रॉपर्टी"],
  /* sections */
  "props.title":["Properties in Jaipur","जयपुर की प्रॉपर्टी"],
  "props.all":["View all","सभी देखें"],
  "props.empty":["New listings are being added","नई लिस्टिंग जोड़ी जा रही हैं"],
  "props.emptyText":["Tell us what you need and we’ll find options for you.","अपनी ज़रूरत बताएं, हम आपके लिए विकल्प ढूंढेंगे।"],
  "props.ask":["Ask on WhatsApp","व्हाट्सऐप पर पूछें"],
  "fail":["Listings could not be loaded","लिस्टिंग लोड नहीं हो सकीं"],
  "failText":["Check your internet or message us on WhatsApp.","इंटरनेट जांचें या हमें व्हाट्सऐप करें।"],
  "buyers.title":["Buyer requirements","खरीदार की ज़रूरतें"],
  "buyers.sub":["Have a matching property? Contact us. Buyer numbers stay private.","मैच करती प्रॉपर्टी है? हमसे संपर्क करें। खरीदार का नंबर निजी रहता है।"],
  "buyers.post":["+ Post requirement","+ ज़रूरत जोड़ें"],
  "buyers.empty":["No public requirements yet","अभी कोई सार्वजनिक ज़रूरत नहीं"],
  "buyers.emptyText":["Looking to buy? Post your requirement.","खरीदना है? अपनी ज़रूरत भेजें।"],
  "buyers.tag":["Approved requirement","अप्रूव्ड ज़रूरत"],
  "buyers.looking":["Looking for {what} in {area}","{area} में {what} चाहिए"],
  "buyers.match":["I have a matching property","मेरे पास मैच करती प्रॉपर्टी है"],
  "budgetTalk":["Budget on discussion","बजट बातचीत से तय"],
  /* enquiry */
  "enq.title":["Quick enquiry","जल्दी पूछताछ"],
  "enq.sub":["Share your need. We reply on WhatsApp.","अपनी ज़रूरत बताएं। हम व्हाट्सऐप पर जवाब देंगे।"],
  "enq.name":["Your name","आपका नाम"],
  "enq.mobile":["Mobile number (10 digits)","मोबाइल नंबर (10 अंक)"],
  "enq.want":["I want to…","मुझे चाहिए…"],
  "enq.o1":["Buy a plot","प्लॉट खरीदना"],"enq.o2":["Sell a plot","प्लॉट बेचना"],"enq.o3":["Buy property","प्रॉपर्टी खरीदना"],
  "enq.o4":["Sell property","प्रॉपर्टी बेचना"],"enq.o5":["Investment","निवेश"],"enq.o6":["Site visit","साइट विज़िट"],"enq.o7":["Agent / broker","एजेंट / ब्रोकर"],
  "enq.loc":["Preferred location (optional)","पसंदीदा इलाका (वैकल्पिक)"],
  "enq.msg":["Size, budget or details (optional)","साइज़, बजट या जानकारी (वैकल्पिक)"],
  "enq.send":["Send on WhatsApp","व्हाट्सऐप पर भेजें"],
  "enq.priv":["Your number is never shown publicly.","आपका नंबर कभी सार्वजनिक नहीं होता।"],
  "enq.e1":["Please enter your name.","कृपया अपना नाम लिखें।"],
  "enq.e2":["Please enter a valid 10-digit mobile number.","कृपया सही 10 अंक का मोबाइल नंबर लिखें।"],
  "enq.e3":["Please choose what you want to do.","कृपया चुनें कि आपको क्या करना है।"],
  "trust":["Real office in Jhotwara","झोटवाड़ा में असली ऑफिस"],
  "trust2":["Approved listings only","सिर्फ़ अप्रूव्ड लिस्टिंग"],
  "trust3":["Owner details stay private","मालिक की जानकारी निजी"],
  /* sell band */
  "sellband.t":["Want to sell? Reach genuine buyers.","बेचना है? असली खरीदारों तक पहुंचें।"],
  "sellband.p":["Your number stays private. Listing goes live after our review.","आपका नंबर निजी रहता है। लिस्टिंग हमारी जांच के बाद लाइव होती है।"],
  "sellband.b1":["List my property","मेरी प्रॉपर्टी लिस्ट करें"],
  "sellband.b2":["Agents & earn","एजेंट और कमाई"],
  /* areas / reviews / contact */
  "areas.title":["Areas we cover","हमारे इलाके"],
  "rev.title":["Customer reviews","ग्राहकों के रिव्यू"],
  "rev.all":["All reviews","सभी रिव्यू"],
  "rev.empty":["No reviews yet","अभी कोई रिव्यू नहीं"],
  "rev.emptyText":["Worked with us? Share your feedback.","हमारे साथ काम किया? अपनी राय दें।"],
  "rev.write":["Write a review","रिव्यू लिखें"],
  "rev.cust":["Customer","ग्राहक"],
  "contact.title":["Visit our office","हमारे ऑफिस आएं"],
  "contact.addr":["Address","पता"],
  "contact.addrText":["58A, Gosai Marg, Udyog Nagar, Jhotwara, Jaipur 302012","58A, गोसाई मार्ग, उद्योग नगर, झोटवाड़ा, जयपुर 302012"],
  "contact.phone":["Phone","फोन"],
  "contact.email":["Email","ईमेल"],
  "contact.hours":["Hours","समय"],
  "contact.directions":["Directions","रास्ता"],
  "contact.emailBtn":["Email us","ईमेल करें"],
  /* property cards (assets/app.js) */
  "card.enquire":["Enquire","पूछें"],
  "card.details":["View details","विवरण देखें"],
  "card.photos":["photos","फोटो"],
  "card.video":["Video","वीडियो"],
  "card.noPhoto":["Photos on request","फोटो माँगने पर"],
  "card.priceAsk":["Price on enquiry","कीमत पूछने पर"],
  "card.onwards":["onwards","से शुरू"],
  "card.save":["Save property","प्रॉपर्टी सेव करें"],
  "card.share":["Share property","प्रॉपर्टी शेयर करें"],
  "Crore":["Crore","करोड़"],"Lakh":["Lakh","लाख"],
  "v.Available":["Available","उपलब्ध"],"v.Sold":["Sold","बिक गई"],"v.Not Available":["Not available","उपलब्ध नहीं"],
  /* submit modal */
  "m.buyTitle":["I want to buy property","मुझे प्रॉपर्टी खरीदनी है"],
  "m.sellTitle":["I want to sell property","मुझे प्रॉपर्टी बेचनी है"],
  "m.buySub":["Submit your requirement. Our team reviews it before anything is published.","अपनी ज़रूरत भेजें। कुछ भी दिखने से पहले हमारी टीम जांचती है।"],
  "m.sellSub":["Submit your property and photos. It goes live only after our review.","अपनी प्रॉपर्टी और फोटो भेजें। हमारी जांच के बाद ही लाइव होगी।"],
  "m.name":["Name *","नाम *"],
  "m.mobile":["Mobile / WhatsApp *","मोबाइल / व्हाट्सऐप *"],
  "m.private":["(private)","(निजी)"],
  "m.mobilePh":["10-digit mobile number","10 अंक का मोबाइल नंबर"],
  "m.area":["Area / location *","इलाका / लोकेशन *"],
  "m.areaPh":["e.g. Jhotwara, Vaishali Nagar","जैसे झोटवाड़ा, वैशाली नगर"],
  "m.city":["City","शहर"],
  "m.type":["Property type *","प्रॉपर्टी का प्रकार *"],
  "m.selType":["Select type","प्रकार चुनें"],
  "m.size":["Size","साइज़"],
  "m.sizePh":["e.g. 50 Gaj / 1200 sqft","जैसे 50 गज / 1200 sqft"],
  "m.minB":["Minimum budget (₹)","न्यूनतम बजट (₹)"],"m.maxB":["Maximum budget (₹)","अधिकतम बजट (₹)"],
  "m.minP":["Expected price (₹)","अपेक्षित कीमत (₹)"],"m.maxP":["Maximum price (₹)","अधिकतम कीमत (₹)"],
  "m.details":["Details *","जानकारी *"],
  "m.detailsPh":["Describe your requirement or property…","अपनी ज़रूरत या प्रॉपर्टी बताएं…"],
  "m.photos":["Photos (up to 3)","फोटो (3 तक)"],
  "m.photoHelp":["Clear photos build trust. Shown only after approval.","साफ़ फोटो भरोसा बढ़ाती हैं। अप्रूवल के बाद ही दिखेंगी।"],
  "m.privacy":["Your mobile and exact address are never published. Only approved details appear on the website.","आपका मोबाइल और सही पता कभी पब्लिश नहीं होता। सिर्फ़ अप्रूव्ड जानकारी वेबसाइट पर दिखती है।"],
  "m.consent":["I agree that selected details may be shown publicly after approval.","मैं सहमत हूँ कि अप्रूवल के बाद चुनी हुई जानकारी सार्वजनिक दिख सकती है।"],
  "m.cancel":["Cancel","रद्द करें"],
  "m.submit":["Submit for approval","अप्रूवल के लिए भेजें"],
  "m.sending":["Submitting…","भेजा जा रहा है…"],
  "m.ok":["✅ Thank you! Our team will review and contact you.","✅ धन्यवाद! हमारी टीम जांच कर आपसे संपर्क करेगी।"],
  "m.err":["Could not submit. Please try again.","भेजा नहीं जा सका। कृपया फिर कोशिश करें।"],
  "m.max3":["Please select a maximum of 3 photos.","कृपया अधिकतम 3 फोटो चुनें।"],
  "m.big":["Photos are too large together. Choose smaller or fewer photos.","फोटो बहुत बड़ी हैं। छोटी या कम फोटो चुनें।"],
  "close":["Close","बंद करें"]
};
let lang = "en";
try{ lang = localStorage.getItem("jpc_lang") === "hi" ? "hi" : "en"; }catch(_){}

function t(key, vars, fb){
  const r = S[key]; let s = r ? r[lang === "hi" ? 1 : 0] : (fb != null ? fb : key);
  if(vars) s = s.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
  return s;
}
function set(el, prop, v){ if(el[prop] !== v) el[prop] = v; }
function apply(root){
  root = root || document;
  root.querySelectorAll("[data-i18n]").forEach(el => { if(S[el.dataset.i18n]) set(el, "textContent", t(el.dataset.i18n)); });
  root.querySelectorAll("[data-i18n-ph]").forEach(el => el.setAttribute("placeholder", t(el.dataset.i18nPh)));
  root.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.documentElement.lang = lang === "hi" ? "hi" : "en";
  document.querySelectorAll("[data-lang-toggle]").forEach(box => {
    if(!box.firstChild) box.innerHTML = '<button type="button" data-lang="en">EN</button><button type="button" data-lang="hi">हिं</button>';
    box.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  });
}
function setLang(l){
  lang = l === "hi" ? "hi" : "en";
  try{ localStorage.setItem("jpc_lang", lang); }catch(_){}
  apply();
  document.dispatchEvent(new CustomEvent("jpc:lang", { detail: lang }));
}
document.addEventListener("click", e => { const b = e.target.closest("[data-lang-toggle] button"); if(b) setLang(b.dataset.lang); });

let q = 0;
function boot(){
  apply();
  new MutationObserver(() => { if(q) return; q = requestAnimationFrame(() => { q = 0; apply(); }); }).observe(document.body, { childList:true, subtree:true });
}
window.JPC_T = t;
window.JPC_LANG = () => lang;
window.JPC_APPLY = apply;
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
