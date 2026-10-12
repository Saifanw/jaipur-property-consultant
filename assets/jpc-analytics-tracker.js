/* JPC privacy-conscious page analytics. Uses existing Firebase project in assets/config.js. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

(() => {
  const cfg = window.SITE?.firebase;
  if (!cfg || !cfg.projectId) return;
  let visitorId = "";
  try {
    visitorId = localStorage.getItem("jpc_analytics_visitor") || "";
    if (!visitorId) {
      visitorId = (crypto.randomUUID ? crypto.randomUUID() : "v-" + Date.now() + "-" + Math.random().toString(36).slice(2));
      localStorage.setItem("jpc_analytics_visitor", visitorId);
    }
  } catch (_) { visitorId = "session-" + Date.now() + "-" + Math.random().toString(36).slice(2); }
  const path = location.pathname.split("/").pop() || "index.html";
  const title = (document.title || path).slice(0, 160);
  const ref = (() => { try { return document.referrer ? new URL(document.referrer).hostname.slice(0,120) : ""; } catch (_) { return ""; } })();
  const ua = navigator.userAgent || "";
  const device = /tablet|ipad/i.test(ua) ? "Tablet" : /mobile|android|iphone/i.test(ua) ? "Mobile" : "Desktop";
  const source = !ref ? "Direct" : /google\./i.test(ref) ? "Google" : /facebook\.|fb\.|instagram\.|t\.co|twitter\.|linkedin\.|whatsapp\./i.test(ref) ? "Social" : "Referral";
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    const auth = getAuth(app), db = getFirestore(app);
    signInAnonymously(auth).then(async cred => {
      await addDoc(collection(db, "websiteAnalytics"), {
        visitorId: visitorId.slice(0,80), page: path.slice(0,160), title, referrer: ref,
        source, device,
        userAgentFamily: /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Other",
        createdAt: serverTimestamp(), uid: cred.user.uid
      });
    }).catch(err => console.warn("Website analytics unavailable:", err?.code || err));
  } catch (err) { console.warn("Website analytics unavailable:", err); }
})();
