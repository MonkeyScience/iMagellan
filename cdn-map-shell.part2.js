  drawShafts(s);
  bctx.setLineDash([7,5]); bctx.strokeStyle="#e6b35a"; bctx.lineWidth=2.2; bctx.beginPath();
  WPS.forEach(function(p,i){i?bctx.lineTo(X(p[0]),Y(p[1])):bctx.moveTo(X(p[0]),Y(p[1]));}); bctx.stroke(); bctx.setLineDash([]);
  const bx=X(boat.lon), by=Y(boat.lat), rad=boat.cog*Math.PI/180;
  bctx.fillStyle="#fff"; bctx.strokeStyle="#111"; bctx.lineWidth=1.4;
  bctx.beginPath(); bctx.moveTo(bx+Math.sin(rad)*14, by-Math.cos(rad)*14); bctx.lineTo(bx+Math.sin(rad+2.45)*8, by-Math.cos(rad+2.45)*8); bctx.lineTo(bx+Math.sin(rad-2.45)*8, by-Math.cos(rad-2.45)*8); bctx.closePath(); bctx.fill(); bctx.stroke();
  if(GPS){const gx=X(GPS.lon), gy=Y(GPS.lat); bctx.strokeStyle="#67e8f9"; bctx.lineWidth=2; bctx.beginPath(); bctx.arc(gx,gy,10,0,6.28); bctx.stroke(); bctx.fillStyle="#67e8f9"; bctx.beginPath(); bctx.arc(gx,gy,3,0,6.28); bctx.fill();}
}
function dropFollow(){const f=document.getElementById("follow"); if(f.checked){f.checked=false; document.getElementById("gpsstat").textContent=GPS?("fix parked · "+GPS.lat.toFixed(3)+"N"):"Follow off"; }}
function snapFollow(){ if(!GPS) return; cam.lon=GPS.lon; cam.lat=GPS.lat; document.getElementById("t").value=nowMin(); dirty=true; }
function paintWindows(min,eta){
  const c=document.getElementById("win"); if(!c) return;
  const dpr=Math.min(2,devicePixelRatio||1), w=c.clientWidth||320, h=c.clientHeight||168;
  c.width=w*dpr; c.height=h*dpr; const ctx=c.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#101820"; ctx.fillRect(0,0,w,h);
  const t0=300, t1=1440, rows=[["Sablons",function(m){return tideAt(MAL,m)>=2.0;},"#34d399"],["Victoria",function(m){return Math.abs(m-nearestHW(SPP,m)[0])<=180;},"#38bdf8"],["Lock in",function(m){const d=m-nearestHW(MAL,m)[0]; return d>=-150&&d<=90;},"#c084fc"]];
  rows.forEach(function(r,i){
    const y=10+i*50; ctx.fillStyle="#9bb0c3"; ctx.font="11px sans-serif"; ctx.fillText(r[0],6,y+8);
    ctx.fillStyle="#1c2a36"; ctx.fillRect(70,y,w-80,22);
    ctx.fillStyle=r[2];
    for(let m=t0;m<t1;m+=8){ if(r[1](m)) ctx.fillRect(70+(m-t0)/(t1-t0)*(w-80), y, 3, 22); }
    const mark=function(mm,col){const x=70+(mm-t0)/(t1-t0)*(w-80); ctx.strokeStyle=col; ctx.beginPath(); ctx.moveTo(x,y-2); ctx.lineTo(x,y+24); ctx.stroke();};
    mark(min,"#e6b35a"); mark(eta,"#fff");
  });
  ctx.fillStyle="#9bb0c3"; ctx.font="10px sans-serif"; [360,720,1080,1440].forEach(function(m){ctx.fillText(hhmm(m), 62+(m-t0)/(t1-t0)*(w-80), h-4);});
}
function paintTideGraph(canvas,min,eta,opts){
  if(!canvas) return;
  opts=opts||{};
  const dpr=Math.min(2,devicePixelRatio||1), w=canvas.clientWidth||320, h=canvas.clientHeight||(opts.compact?118:200);
  if(w<40||h<40) return;
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#101820"; ctx.fillRect(0,0,w,h);
  const padL=opts.compact?22:28, padR=6, padT=opts.compact?12:14, padB=opts.compact?16:20, hi=10, span=2160;
  ctx.strokeStyle="#1e2a36"; ctx.fillStyle="#9bb0c3"; ctx.font=(opts.compact?"9":"10")+"px sans-serif"; ctx.textAlign="left";
  for(let m=0;m<=hi;m+=2){ const y=padT+(1-m/hi)*(h-padT-padB); ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke(); ctx.fillText(m+(opts.compact?"":" m"), 2, y+3); }
  const ys=padT+(1-2/hi)*(h-padT-padB); ctx.strokeStyle="rgba(237,107,69,.55)"; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(padL,ys); ctx.lineTo(w-padR,ys); ctx.stroke(); ctx.setLineDash([]);
  if(opts.compact){ ctx.fillStyle="rgba(237,107,69,.8)"; ctx.font="8px sans-serif"; ctx.fillText("sill", padL+2, ys-2); }
  function draw(series,col){ ctx.strokeStyle=col; ctx.lineWidth=opts.compact?1.8:2; ctx.beginPath(); series.forEach(function(p,i){const x=padL+p[0]/span*(w-padL-padR), y=padT+(1-p[1]/hi)*(h-padT-padB); i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.stroke(); }
  draw(SPP,"#7dd3c7"); draw(MAL,"#fb923c");
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
function paintPages(min,eta){
  const hs=tideAt(SPP,min), hm=tideAt(MAL,min), s=streamAt(min);
  document.getElementById("tideClock").textContent=hhmm(min);
  document.getElementById("portClock").textContent=hhmm(min);
  document.getElementById("sppNow").textContent=hs.toFixed(1)+" m CD";
  document.getElementById("malNow").textContent=hm.toFixed(1)+" m CD";
  document.getElementById("sppNext").textContent=nextExt(SPP,min);
  document.getElementById("malNext").textContent=nextExt(MAL,min);
  document.getElementById("sill").innerHTML=(hm>=2?"<span class='ok'>above sill</span>":"<span class='no'>at / below sill</span>")+" · "+hm.toFixed(1)+" m";
  const hw=nearestHW(SPP,min);
  document.getElementById("vic").innerHTML=(Math.abs(min-hw[0])<=180?"<span class='ok'>inside</span>":"<span class='no'>outside</span>")+" · HW "+hhmm(hw[0]);
  const mhw=nearestHW(MAL,min), md=min-mhw[0];
  document.getElementById("lock").innerHTML=((md>=-150&&md<=90)?"in":"no in")+" / "+((md>=-120&&md<=120)?"out":"no out")+" · HW "+hhmm(mhw[0]);
  document.getElementById("portStr").textContent=s.kn.toFixed(1)+" kn "+cardDir(s.dir)+" "+s.phase;
