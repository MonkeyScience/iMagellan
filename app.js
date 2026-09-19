/* Step 1 — tides scale only */
(function(){
  var s=document.createElement("script");
  s.src="/scales.js?v=step1";
  s.onerror=function(){
    var n=document.createElement("div");
    n.style.cssText="position:fixed;bottom:8px;left:8px;background:#3b1d1d;color:#fecaca;padding:8px 10px;z-index:99;font:12px system-ui";
    n.textContent="Missing /scales.js. Map baseline still runs.";
    document.body.appendChild(n);
  };
  document.body.appendChild(s);
})();
