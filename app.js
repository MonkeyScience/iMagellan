/* iMagellan loader — pulls briefing and tide scales as separate files */
(function(){
  function load(src){
    var s=document.createElement("script");
    s.src=src;
    s.onerror=function(){
      var n=document.createElement("div");
      n.style.cssText="position:fixed;bottom:8px;left:8px;right:8px;background:#3b1d1d;color:#fecaca;padding:8px 10px;border-radius:8px;z-index:99;font:12px system-ui";
      n.textContent="Missing "+src+" — briefing/tides extra UI not loaded. Map baseline still runs.";
      document.body.appendChild(n);
    };
    document.body.appendChild(s);
  }
  load("/brief.js?v=1");
  load("/scales.js?v=1");
})();
