  for(let m=0;m<=hi;m+=2){ const y=padT+(1-m/hi)*(h-padT-padB); ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke(); ctx.fillText(m+(opts.compact?"":" m"), 2, y+3); }
  const ys=padT+(1-2/hi)*(h-padT-padB); ctx.strokeStyle="rgba(237,107,69,.55)"; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(padL,ys); ctx.lineTo(w-padR,ys); ctx.stroke(); ctx.setLineDash([]);
  if(opts.compact){ ctx.fillStyle="rgba(237,107,69,.8)"; ctx.font="8px sans-serif"; ctx.fillText("sill", padL+2, ys-2); }
  let any=false;
  function draw(id,col){ ctx.strokeStyle=col; ctx.lineWidth=opts.compact?1.8:2; let pen=false, est=null;
    for(let m=0;m<=span;m+=10){ const v=tideAt(id,m); if(v==null){ if(pen){ctx.stroke(); pen=false;} continue; } any=true;
      const e=tideEst(id,m), x=padL+m/span*(w-padL-padR), y=padT+(1-Math.min(hi,v)/hi)*(h-padT-padB);
      if(!pen||e!==est){ if(pen){ctx.lineTo(x,y); ctx.stroke();} ctx.setLineDash(e?[3,3]:[]); ctx.beginPath(); ctx.moveTo(x,y); pen=true; est=e; } else ctx.lineTo(x,y); }
    if(pen) ctx.stroke(); ctx.setLineDash([]); }
  draw(SPP,"#7dd3c7"); draw(MAL,"#fb923c");
  if(!any){ ctx.fillStyle="#fb7185"; ctx.font="bold "+(opts.compact?"10":"12")+"px sans-serif"; ctx.textAlign="center"; ctx.fillText(TIDE?"TIDE DATA UNAVAILABLE":"loading tides…", (padL+w-padR)/2, h/2); ctx.textAlign="left"; }
  const dep=+document.getElementById("dep").value;
  [["Leave · Russell",dep,"#c4ec56"],["Minquiers",dep+180,"#e6b35a"],["Arrive · Sablons",eta,"#fb923c"]].forEach(function(mk){
    const x=padL+Math.max(0,Math.min(span,mk[1]))/span*(w-padL-padR);
    ctx.strokeStyle=mk[2]; ctx.globalAlpha=.85; ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,h-padB); ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle=mk[2]; ctx.font="8px sans-serif"; ctx.textAlign="center"; ctx.fillText(mk[0], x, padT+8);
  });
  const x=padL+(((min%1440)+1440)%1440)/span*(w-padL-padR); ctx.strokeStyle="#e6b35a"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,h-padB); ctx.stroke();
  ctx.fillStyle="#9bb0c3"; ctx.textAlign="center"; ctx.font="9px sans-serif";
  [0,720,1440,2160].forEach(function(m){ ctx.fillText(hhmm(m%1440), padL+m/span*(w-padL-padR), h-3); });
}
function tsrc(id,min){const k=tideKind(id); if(k!=="loading"&&tideAt(id,min)==null) return "no data at this time";return k==="official"?"official":(k==="model"?"MODEL ESTIMATE":(k==="mixed"?"official + model est.":(k==="loading"?"loading":"no data")));}
function paintPages(min,eta,s){
  const hs=tideAt(SPP,min), hm=tideAt(MAL,min); s=s||streamAt(min);
  const es=tideEst(SPP,min), em=tideEst(MAL,min);
  document.getElementById("tideClock").textContent=hhmm(min);
  document.getElementById("portClock").textContent=hhmm(min);
  document.getElementById("sppNow").textContent=hs==null?"tide data unavailable":hs.toFixed(1)+" m CD"+(es?" (model est.)":"");
  document.getElementById("malNow").textContent=hm==null?"tide data unavailable":hm.toFixed(1)+" m CD"+(em?" (model est.)":"");
  document.getElementById("sppNext").textContent=nextExt(SPP,min);
  document.getElementById("malNext").textContent=nextExt(MAL,min);
  var hint=document.getElementById("tideHint"); if(hint) hint.textContent="Teal = SPP ("+tsrc(SPP,min)+"). Orange = St-Malo ("+tsrc(MAL,min)+"). Metres CD, UK time. Dashed = model estimate. Gold = time. Markers = journey.";
  document.getElementById("sill").innerHTML=hm==null?"<span class='no'>tide data unavailable · sill check not possible — do not assume clear</span>":((hm>=2?"<span class='ok'>above sill</span>":"<span class='no'>at / below sill</span>")+" · "+hm.toFixed(1)+" m"+(em?" (model est.)":""));
  const hw=nearestHW(SPP,min);
  document.getElementById("vic").innerHTML=hw?((Math.abs(min-hw[0])<=180?"<span class='ok'>inside</span>":"<span class='no'>outside</span>")+" · HW "+hhmm(hw[0])):"<span class='no'>no tide data</span>";
  const mhw=nearestHW(MAL,min);
  if(mhw){const md=min-mhw[0]; document.getElementById("lock").innerHTML=((md>=-150&&md<=90)?"in":"no in")+" / "+((md>=-120&&md<=120)?"out":"no out")+" · HW "+hhmm(mhw[0]);} else document.getElementById("lock").innerHTML="<span class='no'>no tide data</span>";
  document.getElementById("portStr").textContent=s.none?"no stream data":(s.kn.toFixed(1)+" kn "+cardDir(s.dir)+" "+s.phase);
  paintTideGraph(document.getElementById("tg"), min, eta, {compact:false});
  var tip=document.getElementById("tgTip"); if(tip) tip.textContent=hhmm(min)+"  ·  SPP "+fmtH(hs,2)+(es?" est":"")+"  ·  St-Malo "+fmtH(hm,2)+(em?" est":"")+" CD";
  var strip=document.getElementById("tideStrip");
  var tideCb=document.getElementById("tideOnMap");
  if(strip && tideCb && tideCb.checked){
    paintTideGraph(document.getElementById("tgMap"), min, eta, {compact:true});
    var rn=document.getElementById("tideReadNow");
    var rx=document.getElementById("tideReadNext");
    if(rn) rn.innerHTML=(hs==null&&hm==null)?"<b style='color:#fb7185'>Tide data unavailable</b>":"<b>Now</b> SPP "+fmtH(hs)+(es?" est":"")+" · St-Malo "+fmtH(hm)+(em?" est":"")+" CD"+((es||em||tideKind(SPP)==="model"||tideKind(MAL)==="model")?" · <b style='color:#fbbf24'>MODEL ESTIMATE</b>":" · official");
    if(rx) rx.innerHTML="<b>Next</b> SPP "+nextExt(SPP,min)+" · Mal "+nextExt(MAL,min);
  }
  paintWindows(min,eta);
}

function tick(){
  const min=+document.getElementById("t").value, dep=+document.getElementById("dep").value;
  cam.z=+document.getElementById("z").value/10;
  const nm=nmAt(min,dep), boat=posAt(nm), g=sogAt(min,boat.cog,boat.lon,boat.lat), eta=etaMin(dep);
  document.getElementById("tlab").textContent=hhmm(min);
  document.getElementById("dlab").textContent=hhmm(dep);
  document.getElementById("zlab").textContent=cam.z.toFixed(1)+"×";
  document.getElementById("wv").textContent=g.st.tws.toFixed(1);
  document.getElementById("wg").textContent=cardDir(g.st.twd)+" G"+g.st.gust.toFixed(0);
  document.getElementById("sv").textContent=g.s.kn.toFixed(1);
  document.getElementById("sd").textContent=g.s.none?"no data":(cardDir(g.s.dir)+" "+g.s.phase);
  document.getElementById("eta").textContent=hhmm(eta);
  document.getElementById("left").textContent=(TOTAL-nm).toFixed(1)+" nm";
  document.getElementById("who").textContent=placeAt(nm);
  if(document.getElementById("follow").checked && GPS){ cam.lon=GPS.lon; cam.lat=GPS.lat; dirty=true; }
