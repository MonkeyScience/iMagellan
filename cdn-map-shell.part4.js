};
document.getElementById("z").addEventListener("input",function(){dirty=true;});
document.getElementById("style").onchange=function(){mapStyle=this.value; dirty=true;};
document.getElementById("ccol").onchange=function(){dirty=true;};
document.getElementById("zi").onclick=function(){document.getElementById("z").value=Math.min(60,+document.getElementById("z").value+4);dirty=true;};
document.getElementById("zo").onclick=function(){document.getElementById("z").value=Math.max(10,+document.getElementById("z").value-4);dirty=true;};
document.getElementById("now").onclick=function(){document.getElementById("t").value=nowMin(); dropFollow(); dirty=true;};
let drag=null;
bg.addEventListener("pointerdown",function(ev){drag={x:ev.clientX,y:ev.clientY,lon:cam.lon,lat:cam.lat};});
bg.addEventListener("pointerup",function(){drag=null;});
bg.addEventListener("pointermove",function(ev){if(!drag)return; dropFollow(); const sL=(LON1-LON0)/cam.z,sA=(LAT1-LAT0)/cam.z; cam.lon=drag.lon-(ev.clientX-drag.x)/W*sL; cam.lat=drag.lat+(ev.clientY-drag.y)/H*sA; dirty=true;});
document.querySelectorAll("#nav button").forEach(function(b){b.onclick=function(){document.querySelectorAll("#nav button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); const p=b.dataset.p; document.getElementById("view-map").style.display=p==="map"?"flex":"none"; ["tides","ports","routes"].forEach(function(n){document.getElementById("view-"+n).classList.toggle("on",p===n);}); dirty=true; if(p==="map") resize();};});
async function loadLive(){try{const u="https://api.open-meteo.com/v1/forecast?latitude=49.30&longitude=-2.43&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=Europe/London&forecast_days=1"; const w=await (await fetch(u)).json(); const hours=(w.hourly.time||[]).map(function(s,i){const hm=s.split("T")[1].split(":"); return {min:(+hm[0])*60+(+hm[1]||0), tws:w.hourly.wind_speed_10m[i], twd:w.hourly.wind_direction_10m[i], gust:w.hourly.wind_gusts_10m[i], hs:1.4};}); if(hours.length>3){LIVE=hours;TABDEP=-1;TABLE=null;document.getElementById("src").textContent="LIVE wind · 8 km stream";rebuildHours(+document.getElementById("dep").value);dirty=true;}}catch(e){}}

function normPrompt(s){
  return (s||"").toLowerCase()
    .replace(/[\u2013\u2014]/g,"-")
    .replace(/[\u2019']/g,"'")
    .replace(/\bst[- ]?malo\b/g,"st-malo")
    .replace(/\bst[- ]?peter\b/g,"st peter")
    .replace(/\bst[- ]?helier\b/g,"st helier")
    .replace(/\bles[- ]?sablons\b/g,"les sablons")
    .replace(/\s+/g," ").trim();
}
function matchPortKey(s){
  if(/\b(les\s+)?sablons\b|\bst-malo\b|\bstmalo\b|\bsain?t\s*malo\b/.test(s)) return "sablons";
  if(/\bgranville\b|\bgranvill\b/.test(s)) return "granville";
  if(/\bcarteret\b|\bcarte?ret\b/.test(s)) return "carteret";
  if(/\bsark\b|\bsercq\b/.test(s)) return "sark";
  if(/\bst\s*helier\b|\bhelier\b|\bjers(e|ey)\s*(harbour|port)?\b/.test(s)) return "helier";
  if(/\bspp\b|\bst\s*peter\s*port\b|\bguernsey\b|\bst\s*pp\b/.test(s)) return "spp";
  return null;
}
function parseLeaveMin(s){
  var m, h, mi, ap="";
  // Compact HHMM first: leaving at 0640 / depart 650
  m = s.match(/(?:leav\w*|depart\w*|dep(?:arture)?|sail\w*)\s*(?:at\s+|around\s+|about\s+|~)?(\d{3,4})(?!\d)/);
  if(m){
    var raw=m[1];
    if(raw.length===3){ h=+raw[0]; mi=+raw.slice(1); } else { h=+raw.slice(0,2); mi=+raw.slice(2); }
    if(h<=23 && mi<=59) return h*60+mi;
  }
  m = s.match(/(?:leav\w*|depart\w*|dep(?:arture)?|sail\w*)\s*(?:at\s+|around\s+|about\s+|~)?(\d{1,2})(?:[:.](\d{2}))\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/);
  if(!m) m = s.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\b/);
  if(!m) m = s.match(/(?:leav\w*|depart\w*|dep(?:arture)?|sail\w*)\s*(?:at\s+|around\s+|about\s+|~)?(\d{1,2})(?!\d)\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/);
  if(!m) m = s.match(/\b(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b/);
  if(!m) return null;
  h=+m[1]; mi=m[2]!=null && /^\d{2}$/.test(String(m[2])) ? +m[2] : 0;
  ap=(m[3]||m[2]&&!/^\d{2}$/.test(String(m[2]))?m[2]:""||"").toString().toLowerCase().replace(/\./g,"").replace(/\s/g,"");
  if(!ap || /^\d/.test(ap)){ ap=(m[3]||"").toLowerCase().replace(/\./g,"").replace(/\s/g,""); }
  if(!ap){ var apm=s.match(/\b\d{1,2}(?:[:.]\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b/); if(apm) ap=apm[1].toLowerCase().replace(/\./g,"").replace(/\s/g,""); }
  if(ap.indexOf("pm")>=0 && h<12) h+=12;
  if(ap.indexOf("am")>=0 && h===12) h=0;
  if(!isFinite(h) || h>23 || mi>59) return null;
  return h*60+mi;
}
function parseEtaOrDur(s, dep){
  var m = s.match(/(?:arriv\w*|eta|get\s+in)\s*(?:by\s+|at\s+|around\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/);
  if(m){
    var h=+m[1], mi=m[2]!=null?+m[2]:0;
    var ap=(m[3]||"").toLowerCase().replace(/\./g,"").replace(/\s/g,"");
    if(ap.indexOf("pm")>=0 && h<12) h+=12;
    if(ap.indexOf("am")>=0 && h===12) h=0;
    var eta=h*60+mi; if(dep!=null && eta<dep) eta+=1440;
    return {eta:eta, dur: dep!=null? eta-dep : null};
  }
  m = s.match(/(?:for|about|~|roughly|passage\s+of)\s*(\d{1,2}(?:[.,]\d)?)\s*(?:h(?:ours?)?|hrs?)\b/);
  if(m && dep!=null){ var hrs=parseFloat(m[1].replace(",",".")); return {eta:dep+Math.round(hrs*60), dur:Math.round(hrs*60)}; }
  return null;
}
function parsePrompt(){
  var box=document.getElementById("rprompt"); if(!box) return;
  var s=normPrompt(box.value||"");
  var assumed=[], found=[], bits=[];

  var fromKey=null, toKey=null;
  var arrow = s.split(/\bto\b|\u2192|->/);
  if(arrow.length>=2){
    fromKey = matchPortKey(arrow[0]);
    toKey = matchPortKey(arrow.slice(1).join(" to "));
  } else {
    toKey = matchPortKey(s);
  }
  var fm = s.match(/\bfrom\s+([a-z0-9 .'-]{2,40}?)(?:\s+to\b|$)/);
  if(fm){ var fk=matchPortKey(fm[1]); if(fk) fromKey=fk; }

  var rf=document.getElementById("rfrom"), rt=document.getElementById("rto");
