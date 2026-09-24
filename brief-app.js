/* iMagellan brief — loads restored parts */
(function(){
  function load(url){
    return fetch(url,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); });
  }
  Promise.all([load('/brief-app.a.js'), load('/brief-app.b.js')]).then(function(parts){
    var a = parts[0], b = parts[1];
    /* Guard: ensure O() closes before Et() if a prior push dropped a brace */
    b = b.replace('+(P?"&east=1":"")}function Et()', '+(P?"&east=1":"")}function Et()'.replace('}function', '}}function'));
    var s = document.createElement('script');
    s.textContent = a + b;
    document.head.appendChild(s);
  }).catch(function(e){ console.error('brief load failed', e); });
})();
