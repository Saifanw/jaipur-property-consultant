/* =====================================================================
   SITE SETTINGS  —  one place to edit. Empty items are simply hidden.
   When you build the "Apna Ghar" app, reuse this same file (brand, phone,
   areas, commission rules) and the same Firestore collections.
   ===================================================================== */
window.SITE = {
  brand: {
    name: "Jaipur Property Consultant",
    short: "JPC",
    tagline: "Plots, land & property in Jaipur",
    appName: "Apna Ghar"          // future app name (shown nowhere until you launch)
  },
  phone: "6350566010",
  whatsapp: "916350566010",
  address: "58A, Gosai Marg, Udyog Nagar, Jhotwara, Jaipur 302012",
  mapUrl: "",                      // optional Google Maps link
  reraNo: "",                      // e.g. "RAJ/A/2021/1234"  <- add your real RERA number
  yearsExperience: "",             // e.g. "8+ years"
  propertiesHelped: "",            // e.g. "150+ properties"
  officeHours: "",                 // e.g. "Mon–Sat, 10 AM – 7 PM"
  areas: ["Jhotwara","Jagatpura","Sanganer","Mansarovar","Vaishali Nagar","Ajmer Road","Tonk Road","Kalwar Road","Mahapura","Bhankrota","Khatipura","Bindayaka","Vatika","Chaksu"],

  /* ---- commission / partner programme (shown on partner.html) ----
     IMPORTANT: these are PLACEHOLDER rates. Change them to what you really
     offer. Final terms should always be agreed in writing before a deal.   */
  commission: {
    sellerPct: 1,        // % of sale price we charge the property owner
    buyerPct: 1,         // % of sale price we charge the buyer
    referralSharePct: 20,// % of OUR brokerage paid to a person who refers a seller/buyer (non-agent)
    freeListing: true,   // true = "no upfront listing fee" is shown. Set false if you charge one.
    agentSplitPct: 50,   // % of brokerage an agent keeps on a joint deal
    payoutNote: "Payment is made after the registry is done and our brokerage is received.",
    disclaimer: "Rates shown are indicative. Exact terms are agreed in writing before any deal."
  }
};
