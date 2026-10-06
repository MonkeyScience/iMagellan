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
  if(fromKey && rf){ rf.value=fromKey; found.push("from "+PORTS[fromKey].n); }
  else if(rf && rf.value){ assumed.push("from "+(PORTS[rf.value]?PORTS[rf.value].n:rf.value)); }
  if(toKey && rt){ rt.value=toKey; found.push("to "+PORTS[toKey].n); }
  else if(rt && rt.value){ assumed.push("to "+(PORTS[rt.value]?PORTS[rt.value].n:rt.value)+" (unchanged)"); }

  var east = /east[- ]?about|east\s+of\s+(?:the\s+)?(?:jersey|minquiers|minqs)|via\s+east|e\.?\s*about/.test(s);
  var west = /west[- ]?about|west\s+of\s+(?:the\s+)?(?:jersey|minquiers|minqs)|via\s+west|w\.?\s*about/.test(s);
  var viaRuss = /(?:via|through|little)\s+russell|\brussell\b/.test(s) && !/avoid\s+russell|skip\s+russell|no\s+russell/.test(s);
  var skipRuss = /avoid\s+russell|skip\s+russell|no\s+russell|outside\s+russell/.test(s);
  var westMin = /west\s+of\s+(?:the\s+)?minquiers|west[- ]?minq/.test(s);
  var eastMin = /east\s+of\s+(?:the\s+)?minquiers|east[- ]?minq/.test(s);
  var westJer = /west\s+of\s+jersey/.test(s);
  var eastJer = /east\s+of\s+jersey/.test(s);

  var r=document.getElementById("vRuss");
  var wj=document.getElementById("vWJer");
  var wm=document.getElementById("vWMin");
  var ej=document.getElementById("vEJer");

  if(skipRuss && r){ r.checked=false; found.push("skip Russell"); }
  else if(viaRuss && r){ r.checked=true; found.push("via Little Russell"); }

  if(east && !west){
    if(wj) wj.checked=false;
    if(wm) wm.checked=false;
    if(ej) ej.checked=true;
    found.push("east-about");
  } else if(west && !east){
    if(wj) wj.checked=true;
    if(wm) wm.checked= !eastMin;
    if(ej) ej.checked=false;
    found.push("west-about");
  } else {
    if(westJer && wj){ wj.checked=true; if(ej) ej.checked=false; found.push("west of Jersey"); }
    if(eastJer && ej){ ej.checked=true; if(wj) wj.checked=false; found.push("east of Jersey"); }
    if(westMin && wm){ wm.checked=true; found.push("west of Minquiers"); }
    if(eastMin && wm){ wm.checked=false; found.push("east of Minquiers"); }
    if(!westJer && !eastJer && !westMin && !eastMin && !east && !west){
