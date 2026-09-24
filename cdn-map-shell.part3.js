  paintTideGraph(document.getElementById("tg"), min, eta, {compact:false});
  var tip=document.getElementById("tgTip"); if(tip) tip.textContent=hhmm(min)+"  ·  SPP "+hs.toFixed(2)+" m  ·  St-Malo "+hm.toFixed(2)+" m CD";
  var strip=document.getElementById("tideStrip");
  var tideCb=document.getElementById("tideOnMap");
  if(strip && tideCb && tideCb.checked){
    paintTideGraph(document.getElementById("tgMap"), min, eta, {compact:true});
    var rn=document.getElementById("tideReadNow");
    var rx=document.getElementById("tideReadNext");
    if(rn) rn.innerHTML="<b>Now</b> SPP "+hs.toFixed(1)+" m · St-Malo "+hm.toFixed(1)+" m CD";
    if(rx) rx.innerHTML="<b>Next</b> SPP "+nextExt(SPP,min)+" · Mal "+nextExt(MAL,min);
  }
  paintWindows(min,eta);
}

function tick(){
  const min=+document.getElementById("t").value, dep=+document.getElementById("dep").value;
  cam.z=+document.getElementById("z").value/10;
  const nm=nmAt(min,dep), boat=posAt(nm), g=sogAt(min,boat.cog), eta=etaMin(dep);
  document.getElementById("tlab").textContent=hhmm(min);
  document.getElementById("dlab").textContent=hhmm(dep);
  document.getElementById("zlab").textContent=cam.z.toFixed(1)+"×";
  document.getElementById("wv").textContent=g.st.tws.toFixed(1);
  document.getElementById("wg").textContent=cardDir(g.st.twd)+" G"+g.st.gust.toFixed(0);
  document.getElementById("sv").textContent=g.s.kn.toFixed(1);
  document.getElementById("sd").textContent=cardDir(g.s.dir)+" "+g.s.phase;
  document.getElementById("eta").textContent=hhmm(eta);
  document.getElementById("left").textContent=(TOTAL-nm).toFixed(1)+" nm";
  document.getElementById("who").textContent=placeAt(nm);
  if(document.getElementById("follow").checked && GPS){ cam.lon=GPS.lon; cam.lat=GPS.lat; dirty=true; }
  if(dirty){ paintBg(g.st,boat,g.s); fctx.clearRect(0,0,W,H); paintPages(min,eta); dirty=false; }
  fctx.globalCompositeOperation="destination-out"; fctx.fillStyle="rgba(0,0,0,0.14)"; fctx.fillRect(0,0,W,H);
  fctx.globalCompositeOperation="source-over"; fctx.lineCap="round";
  const to=(g.st.twd+180)*Math.PI/180, step=0.00105*(g.st.tws/12);
  fctx.lineWidth=1.1;
  for(let i=0;i<P.length;i++){const p=P[i],x0=X(p.lon),y0=Y(p.lat); p.lon+=Math.sin(to)*step; p.lat+=Math.cos(to)*step; p.age++; if(p.age>90||inLand(p.lon,p.lat)){Object.assign(p,spawn());continue;} fctx.strokeStyle="rgba(255,255,255,"+(0.14+0.45*(1-p.age/90))+")"; fctx.beginPath(); fctx.moveTo(x0,y0); fctx.lineTo(X(p.lon),Y(p.lat)); fctx.stroke();}
  const col=COLS[document.getElementById("ccol").value]||COLS.orange;
  const rgb=g.s.phase==="flood"?col.f:(g.s.phase==="ebb"?col.e:col.s);
  const cd=g.s.dir*Math.PI/180, cs=0.00042*g.s.kn;
  fctx.lineWidth=2.2;
  for(let i=0;i<C.length;i++){const p=C[i],x0=X(p.lon),y0=Y(p.lat); p.lon+=Math.sin(cd)*cs; p.lat+=Math.cos(cd)*cs; p.age++; if(p.age>110||inLand(p.lon,p.lat)||g.s.kn<0.16){Object.assign(p,spawn());continue;} fctx.strokeStyle="rgba("+rgb+","+(0.35+0.5*(1-p.age/110))+")"; fctx.beginPath(); fctx.moveTo(x0,y0); fctx.lineTo(X(p.lon),Y(p.lat)); fctx.stroke();}
  requestAnimationFrame(tick);
}
function rebuildHours(dep){const box=document.getElementById("hours"); box.innerHTML=""; [dep,dep+60,dep+180,dep+360,etaMin(dep)].forEach(function(m,i){const labs=["Dep","+1h","+3h","+6h","ETA"]; const b=document.createElement("button"); b.textContent=labs[i]+" "+hhmm(m); b.onclick=function(){dropFollow(); document.getElementById("t").value=m; dirty=true;}; box.appendChild(b);});}
function applyRoute(){
  const a=PORTS[document.getElementById("rfrom").value], b=PORTS[document.getElementById("rto").value];
  FROMN=a.n; TON=b.n;
  const pts=[a.p.slice()];
  if(document.getElementById("vRuss").checked) pts.push([-2.528,49.422]);
  if(document.getElementById("vWJer").checked){ pts.push([-2.45,49.30],[-2.40,49.18]); }
  if(document.getElementById("vEJer").checked){ pts.push([-2.05,49.29],[-2.00,49.22]); }
  if(document.getElementById("vWMin").checked){ pts.push([-2.383,48.995],[-2.267,48.85]); }
  pts.push(b.p.slice());
  WPS=pts; rebuildTrack(); TABLE=null; TABDEP=-1;
  document.getElementById("rname").value=FROMN+" to "+TON;
  document.getElementById("rsum").textContent=FROMN+" → "+TON+" · "+TOTAL.toFixed(1)+" nm · "+WPS.length+" wpts";
  rebuildHours(+document.getElementById("dep").value); dirty=true;
}
(function fillPorts(){
  const f=document.getElementById("rfrom"), t=document.getElementById("rto");
  Object.keys(PORTS).forEach(function(k){ const o=document.createElement("option"); o.value=k; o.textContent=PORTS[k].n; f.appendChild(o); t.appendChild(o.cloneNode(true)); });
  f.value="spp"; t.value="sablons";
})();
document.getElementById("rapply").onclick=applyRoute;
document.getElementById("dep").addEventListener("input",function(){dropFollow(); TABDEP=-1;TABLE=null;rebuildHours(+this.value);dirty=true;});
document.getElementById("t").addEventListener("input",function(){dropFollow(); dirty=true;});
document.getElementById("follow").addEventListener("change",function(){ if(this.checked){ if(!GPS){ document.getElementById("gpsstat").textContent="turn GPS on first"; this.checked=false; return;} snapFollow(); document.getElementById("gpsstat").textContent="following "+GPS.lat.toFixed(3)+"N"; } else document.getElementById("gpsstat").textContent=GPS?"fix parked":"GPS off — tap GPS"; });
document.getElementById("gps").onclick=function(){
  if(watch){navigator.geolocation.clearWatch(watch);watch=null;GPS=null;document.getElementById("follow").checked=false;document.getElementById("gpsstat").textContent="GPS off — tap GPS";dirty=true;return;}
  if(!navigator.geolocation){document.getElementById("gpsstat").textContent="no GPS";return;}
  document.getElementById("gpsstat").textContent="asking…";
