/* PWA helper: registers the service worker and shows an "Install app" button on mobile Chrome. */
(function(){
  if("serviceWorker" in navigator && location.protocol !== "file:")
    addEventListener("load", function(){ navigator.serviceWorker.register("/sw.js", {scope:"/"}).catch(function(){}); });

  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if(standalone) return;
  try{ if(localStorage.getItem("jpc_install_hide") > Date.now()) return; }catch(e){}

  var ua = navigator.userAgent, isIOS = /iphone|ipad|ipod/i.test(ua), isMobile = /android|iphone|ipad|ipod/i.test(ua);
  var deferred = null, btn = null;

  function toast(msg){
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; t.style.opacity = 1; t.style.transform = "translate(-50%,0)";
    t.style.maxWidth = "88vw"; t.style.textAlign = "center"; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 6500);
  }
  function hide(days){ try{ localStorage.setItem("jpc_install_hide", Date.now() + days*864e5); }catch(e){} if(btn){ btn.remove(); btn = null; } }
  function show(){
    if(btn || !document.body) return;
    btn = document.createElement("div");
    btn.setAttribute("style", "position:fixed;left:12px;bottom:84px;z-index:2100;display:flex;align-items:center;gap:2px;background:#0f1b2d;color:#fff;border:1px solid #e8c45c;border-radius:999px;box-shadow:0 10px 28px rgba(15,27,45,.35);font:700 14px/1 Inter,Arial,sans-serif");
    btn.innerHTML = '<button type="button" id="jpcInstall" style="all:unset;cursor:pointer;padding:12px 8px 12px 16px">&#128242; Install App</button><button type="button" id="jpcInstallX" aria-label="Close" style="all:unset;cursor:pointer;padding:12px 14px 12px 6px;opacity:.7">&#10005;</button>';
    document.body.appendChild(btn);
    document.getElementById("jpcInstallX").onclick = function(){ hide(7); };
    document.getElementById("jpcInstall").onclick = function(){
      if(deferred){
        deferred.prompt();
        deferred.userChoice.then(function(c){ deferred = null; if(c && c.outcome === "accepted") hide(365); });
      }else if(isIOS){
        toast("Safari mein Share button dabayein, phir \"Add to Home Screen\" chuniye.");
      }else{
        toast("Chrome ke menu (⋮) mein jaakar \"Install app\" ya \"Add to Home screen\" dabayein.");
      }
    };
  }

  addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); deferred = e; show(); });
  addEventListener("appinstalled", function(){ deferred = null; hide(365); });
  // browsers that never fire the prompt event (already dismissed, iOS, in-app browsers): still show the button with instructions
  if(isMobile) addEventListener("load", function(){ setTimeout(show, 3500); });
})();
