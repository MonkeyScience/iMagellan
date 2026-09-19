/* Step 1 loader — scales only */
(function(){
  var s=document.createElement("script");
  s.src="/scales.js?v=s1";
  s.onerror=function(){
    var n=document.createElement("div");
    n.style.cssText="position:fixed;bottom:8px;left:8px;right:8px;background:#3b1d1d;color:#fecaca;padding:8px 10px;border-radius:8px;z-index:99;font:12px system-ui";
    n.textContent="scales.js missing — Tides graph is the baseline only.";
    document.body.appendChild(n);
  };
  document.body.appendChild(s);
})();
