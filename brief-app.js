/*! iMagellan brief loader — fetches chunk parts then evals */
(function () {
  var n = 3, parts = [], left = n;
  function go() {
    if (left) return;
    var code = parts.join("");
    try { (0, eval)(code); } catch (e) { console.error("brief load", e); }
  }
  for (var i = 0; i < n; i++) {
    (function (i) {
      fetch("/brief-chunk-" + i + ".txt", { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) { parts[i] = t; left--; go(); })
        .catch(function (e) { console.error(e); });
    })(i);
  }
})();
