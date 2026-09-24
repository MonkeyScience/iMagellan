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
      assumed.push((ej && ej.checked) ? "east-about (unchanged)" : "west-about (unchanged)");
    }
  }

  var depMin = parseLeaveMin(s);
  if(depMin!=null){
    var d=document.getElementById("dep");
    if(d){
      var lo=+d.min||0, hi=+d.max||1440;
      var clamped=Math.max(lo, Math.min(hi, depMin));
      d.value=clamped;
      if(clamped!==depMin) assumed.push("depart slider clamped to "+hhmm(clamped)+" (asked "+hhmm(depMin)+")");
      else found.push("leave "+hhmm(depMin));
    }
    var tm=document.getElementById("t"); if(tm) tm.value=depMin;
    TABDEP=-1; TABLE=null;
    rebuildHours(+document.getElementById("dep").value);
  } else {
    assumed.push("leave "+hhmm(+document.getElementById("dep").value)+" (unchanged)");
  }

  var ed = parseEtaOrDur(s, depMin!=null?depMin:+document.getElementById("dep").value);
  if(ed && ed.dur!=null){ bits.push("passage ~"+Math.round(ed.dur/60*10)/10+" h \u2192 ETA "+hhmm(ed.eta)); found.push("ETA hint "+hhmm(ed.eta)); }

  if(typeof applyRoute==="function") applyRoute();
  else if(document.getElementById("rapply")) document.getElementById("rapply").click();

  var summary = (found.length?found.join(" \u00b7 "):"No new fields parsed") + (assumed.length?" \u00b7 assumed: "+assumed.join(", "):"");
  if(bits.length) summary += " \u00b7 "+bits.join(" \u00b7 ");
  var out=document.getElementById("rparseOut");
  if(out) out.textContent=summary;
  var rs=document.getElementById("rsum");
  if(rs){
    var sideTxt = (document.getElementById("vEJer")&&document.getElementById("vEJer").checked)?"east-about":"west-about";
    rs.textContent=(FROMN||"?")+" \u2192 "+(TON||"?")+" \u00b7 "+sideTxt+" \u00b7 leave "+hhmm(+document.getElementById("dep").value)+" \u00b7 "+TOTAL.toFixed(1)+" nm";
  }
  dirty=true;
}

var _rp=document.getElementById("rparse"); if(_rp) _rp.onclick=parsePrompt;
(function(){
  var q=new URLSearchParams(location.search);
  var seams=document.getElementById("seams");
  if(seams){
    if(q.get("seams")==="0") seams.checked=false;
    if(q.get("seams")==="1") seams.checked=true;
    try{ var s=localStorage.getItem("imagellan_seams"); if(s==="0") seams.checked=false; if(s==="1") seams.checked=true; }catch(e){}
    seams.addEventListener("change", function(){ try{ localStorage.setItem("imagellan_seams", seams.checked?"1":"0"); }catch(e){} dirty=true; });
  }
  function syncTideStrip(){
    var cb=document.getElementById("tideOnMap");
    var strip=document.getElementById("tideStrip");
    if(!cb||!strip) return;
    strip.classList.toggle("on", !!cb.checked);
    try{ localStorage.setItem("imagellan_tide_on_map", cb.checked?"1":"0"); }catch(e){}
    requestAnimationFrame(function(){ resize(); dirty=true; });
  }
  var tide=document.getElementById("tideOnMap");
  if(tide){
    try{ var t=localStorage.getItem("imagellan_tide_on_map"); if(t==="0") tide.checked=false; if(t==="1") tide.checked=true; }catch(e){}
    if(q.get("tide")==="0") tide.checked=false;
    if(q.get("tide")==="1") tide.checked=true;
    tide.addEventListener("change", syncTideStrip);
    syncTideStrip();
  }
})();

addEventListener("resize",resize);
if(window.visualViewport){ visualViewport.addEventListener("resize",resize); visualViewport.addEventListener("scroll",resize); }
document.getElementById("t").value=nowMin();
rebuildHours(410); resize(); loadLive(); tick();
})();
