/* iMagellan brief — loads restored parts */
(function(){
  function load(url){
    return fetch(url,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); });
  }
  Promise.all([load('/brief-app.a.js'), load('/brief-app.b.js')]).then(function(parts){
    var s = document.createElement('script');
    s.textContent = parts[0] + parts[1];
    document.head.appendChild(s);
  }).catch(function(e){ console.error('brief load failed', e); });
})();
