  if(dirty){ paintBg(g.st,boat,g.s,min); fctx.clearRect(0,0,W,H); paintPages(min,eta,g.s); dirty=false; }
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
  if(document.getElementById("vRuss").checked) pts.push(WP_STM.slice());
  if(document.getElementById("vWJer").checked){ pts.push([-2.45,49.30],[-2.40,49.18]); }
  if(document.getElementById("vEJer").checked){ pts.push([-2.05,49.29],[-2.00,49.22]); }
  if(document.getElementById("vWMin").checked){ pts.push([-2.383,48.995],WP_SWM.slice(),[-2.267,48.85]); }
  if(document.getElementById("rto").value==="sablons") SAB_APP.forEach(function(q){pts.push(q.slice());});
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
  watch=navigator.geolocation.watchPosition(function(p){ GPS={lat:p.coords.latitude,lon:p.coords.longitude}; if(document.getElementById("follow").checked) snapFollow(); else document.getElementById("gpsstat").textContent="fix "+GPS.lat.toFixed(3)+"N "+Math.abs(GPS.lon).toFixed(3)+"W"; dirty=true; }, function(){document.getElementById("gpsstat").textContent="GPS blocked";},{enableHighAccuracy:true,maximumAge:2000,timeout:12000});
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
bg.addEventListener("pointermove",function(ev){if(!drag)return; dropFollow(); const v=view(); cam.lon=drag.lon-(ev.clientX-drag.x)/W*v.sLon; cam.lat=drag.lat+(ev.clientY-drag.y)/H*v.sLat; dirty=true;});
document.querySelectorAll("#nav button").forEach(function(b){b.onclick=function(){document.querySelectorAll("#nav button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); const p=b.dataset.p; document.getElementById("view-map").style.display=p==="map"?"flex":"none"; ["tides","ports","routes"].forEach(function(n){document.getElementById("view-"+n).classList.toggle("on",p===n);}); dirty=true; if(p==="map") resize();};});
