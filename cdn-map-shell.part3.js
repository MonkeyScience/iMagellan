  const L=window.__smocStations?window.__smocStations(min):[];
  const col=COLS[document.getElementById("ccol").value]||COLS.orange;
  L.forEach(function(st){
    if(!(st.kn>=0.16)) return;
    const use=st.phase==="flood"?col.f:(st.phase==="ebb"?col.e:col.s);
    const kn=st.kn, rad=st.dir*Math.PI/180, len=6+kn*20;
    const x=X(st.lon), y=Y(st.lat);
    const x2=x+Math.sin(rad)*len, y2=y-Math.cos(rad)*len;
    bctx.strokeStyle="rgba(0,0,0,0.55)"; bctx.lineWidth=6; bctx.lineCap="round";
    bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x2,y2); bctx.stroke();
    bctx.strokeStyle="rgb("+use+")"; bctx.lineWidth=3.4;
    bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x2,y2); bctx.stroke();
    const hx=x2+Math.sin(rad+2.6)*7, hy=y2-Math.cos(rad+2.6)*7, hx2=x2+Math.sin(rad-2.6)*7, hy2=y2-Math.cos(rad-2.6)*7;
    bctx.beginPath(); bctx.moveTo(hx,hy); bctx.lineTo(x2,y2); bctx.lineTo(hx2,hy2); bctx.stroke();
    const tag=st.phase==="flood"?" F":(st.phase==="ebb"?" E":(st.phase==="slack"?" S":""));
    bctx.font="bold 11px sans-serif"; bctx.textAlign="left"; halo(kn.toFixed(1)+tag, x2+6, y2-4);
  });
}

function drawSeamarks(){
  const z=Math.max(9, Math.min(13, Math.round(8+cam.z*1.6)));
  const v=view();
  const x0=lon2x(cam.lon-v.sLon/2, z), x1=lon2x(cam.lon+v.sLon/2, z);
  const y0=lat2y(cam.lat+v.sLat/2, z), y1=lat2y(cam.lat-v.sLat/2, z);
  for(let x=Math.floor(x0)-1; x<=Math.floor(x1)+1; x++){
    for(let y=Math.floor(y0)-1; y<=Math.floor(y1)+1; y++){
      const key="sea/"+z+"/"+x+"/"+y; let im=tileCache[key];
      if(!im){ im=new Image(); im.crossOrigin="anonymous"; im.onload=function(){dirty=true;}; im.src="https://tiles.openseamap.org/seamark/"+z+"/"+x+"/"+y+".png"; tileCache[key]=im; }
      if(!im.complete||!im.naturalWidth) continue;
      const west=x/Math.pow(2,z)*360-180, east=(x+1)/Math.pow(2,z)*360-180;
      const n=Math.PI-2*Math.PI*y/Math.pow(2,z), s=Math.PI-2*Math.PI*(y+1)/Math.pow(2,z);
      const north=180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
      const south=180/Math.PI*Math.atan(0.5*(Math.exp(s)-Math.exp(-s)));
      bctx.drawImage(im, X(west), Y(north), X(east)-X(west), Y(south)-Y(north));
    }
  }
}
function paintBg(st,boat,s,min){
  bctx.fillStyle="#0a4a58"; bctx.fillRect(0,0,W,H);
  if(mapStyle!=="vector") drawTiles(); else { bctx.fillStyle=wash(st.tws); bctx.fillRect(0,0,W,H); }
  if(document.getElementById("seams") && document.getElementById("seams").checked) drawSeamarks();
  drawLand();
  bctx.font="bold 12px sans-serif"; bctx.textAlign="center";
  [["Guernsey",-2.58,49.468],["Jersey",-2.12,49.215],["Sark",-2.363,49.429],["Herm",-2.449,49.479],["Alderney",-2.199,49.715],["Chausey",-1.83,48.873],["Sablons",-2.02,48.655]].forEach(function(a){halo(a[0],X(a[1]),Y(a[2]));});
  HAZ.forEach(function(h){ bctx.font="bold 10px sans-serif"; halo(h[2], X(h[0]), Y(h[1])); });
  drawShafts(min);
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
  const t0=300, t1=1440, rows=[["Sablons",function(m){const h=tideAt(MAL,m);return h==null?null:h>=2.0;},"#34d399"],["Victoria",function(m){const hw=nearestHW(SPP,m);return hw?Math.abs(m-hw[0])<=180:null;},"#38bdf8"],["Lock in",function(m){const hw=nearestHW(MAL,m);if(!hw)return null;const d=m-hw[0]; return d>=-150&&d<=90;},"#c084fc"]];
  rows.forEach(function(r,i){
    const y=10+i*50; ctx.fillStyle="#9bb0c3"; ctx.font="11px sans-serif"; ctx.fillText(r[0],6,y+8);
    ctx.fillStyle="#1c2a36"; ctx.fillRect(70,y,w-80,22);
    ctx.fillStyle=r[2];
    for(let m=t0;m<t1;m+=8){ const v=r[1](m); if(v===null){ctx.fillStyle="#4b5563"; ctx.fillRect(70+(m-t0)/(t1-t0)*(w-80), y+9, 3, 4); ctx.fillStyle=r[2];} else if(v) ctx.fillRect(70+(m-t0)/(t1-t0)*(w-80), y, 3, 22); }
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
  const span=2160; let hi=10; for(let m=0;m<=span;m+=30){const a=tideAt(SPP,m),b=tideAt(MAL,m); if((a!=null&&a>9.8)||(b!=null&&b>9.8)){hi=14;break;}}
  const padL=opts.compact?22:28, padR=6, padT=opts.compact?12:14, padB=opts.compact?16:20;
  ctx.strokeStyle="#1e2a36"; ctx.fillStyle="#9bb0c3"; ctx.font=(opts.compact?"9":"10")+"px sans-serif"; ctx.textAlign="left";
