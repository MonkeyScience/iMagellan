const P=[],C=[]; for(let i=0;i<360;i++) P.push(spawn()); for(let i=0;i<160;i++) C.push(spawn());
function resize(){const r=wrapEl.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1); W=Math.max(120,Math.round(r.width)); H=Math.max(120,Math.round(r.height)); [bg,fg].forEach(function(c){c.width=Math.max(1,Math.round(W*dpr));c.height=Math.max(1,Math.round(H*dpr));c.style.width=W+"px";c.style.height=H+"px";var cx=c.getContext("2d"); cx.setTransform(dpr,0,0,dpr,0,0);}); dirty=true;}
const X=function(lo){const s=(LON1-LON0)/cam.z; return (lo-(cam.lon-s/2))/s*W;};
const Y=function(la){const s=(LAT1-LAT0)/cam.z; return (cam.lat+s/2-la)/s*H;};
function lon2x(lon,z){return (lon+180)/360*Math.pow(2,z);}
function lat2y(lat,z){const r=lat*Math.PI/180; return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z);}
function tileUrl(z,x,y){
  if(mapStyle==="sat") return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"+z+"/"+y+"/"+x;
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/"+z+"/"+y+"/"+x;
}
function drawTiles(){
  const z=Math.max(8, Math.min(13, Math.round(8+cam.z*1.6)));
  const x0=lon2x(cam.lon-(LON1-LON0)/(2*cam.z), z), x1=lon2x(cam.lon+(LON1-LON0)/(2*cam.z), z);
  const y0=lat2y(cam.lat+(LAT1-LAT0)/(2*cam.z), z), y1=lat2y(cam.lat-(LAT1-LAT0)/(2*cam.z), z);
  for(let x=Math.floor(x0)-1; x<=Math.floor(x1)+1; x++){
    for(let y=Math.floor(y0)-1; y<=Math.floor(y1)+1; y++){
      const key=mapStyle+"/"+z+"/"+x+"/"+y; let im=tileCache[key];
      if(!im){ im=new Image(); im.crossOrigin="anonymous"; im.onload=function(){dirty=true;}; im.src=tileUrl(z,x,y); tileCache[key]=im; }
      if(!im.complete||!im.naturalWidth) continue;
      const west=x/Math.pow(2,z)*360-180, east=(x+1)/Math.pow(2,z)*360-180;
      const n=Math.PI-2*Math.PI*y/Math.pow(2,z), s=Math.PI-2*Math.PI*(y+1)/Math.pow(2,z);
      const north=180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
      const south=180/Math.PI*Math.atan(0.5*(Math.exp(s)-Math.exp(-s)));
      bctx.drawImage(im, X(west), Y(north), X(east)-X(west), Y(south)-Y(north));
    }
  }
}
function halo(txt,x,y){ bctx.strokeStyle="rgba(0,0,0,0.7)"; bctx.lineWidth=3; bctx.strokeText(txt,x,y); bctx.fillStyle="#fff"; bctx.fillText(txt,x,y); }
function drawLand(){
  LAND.forEach(function(p,i){
    bctx.beginPath(); p.forEach(function(q,k){k?bctx.lineTo(X(q[0]),Y(q[1])):bctx.moveTo(X(q[0]),Y(q[1]));}); bctx.closePath();
    if(mapStyle==="vector"){ bctx.fillStyle=i===2?"#3a3324":"#1c2e24"; bctx.fill(); bctx.strokeStyle=i===2?"#fbbf24":"#e2e8f0"; bctx.lineWidth=i===2?2:1.2; bctx.stroke(); }
    else if(i===2){ bctx.fillStyle="rgba(255,180,60,0.18)"; bctx.fill(); bctx.strokeStyle="#fbbf24"; bctx.lineWidth=2; bctx.stroke(); }
  });
}
function drawShafts(s){
  if(s.kn<0.16) return;
  const col=COLS[document.getElementById("ccol").value]||COLS.orange;
  const use=s.phase==="flood"?col.f:(s.phase==="ebb"?col.e:col.s);
  STN.forEach(function(st){
    var loc=window.__smocStn?window.__smocStn(st[0],st[1],s):null;const kn=(loc?loc.kn:s.kn*st[2]), rad=(loc?loc.dir:s.dir)*Math.PI/180, len=6+kn*20;
    const x=X(st[0]), y=Y(st[1]);
    const x2=x+Math.sin(rad)*len, y2=y-Math.cos(rad)*len;
    bctx.strokeStyle="rgba(0,0,0,0.55)"; bctx.lineWidth=6; bctx.lineCap="round";
    bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x2,y2); bctx.stroke();
    bctx.strokeStyle="rgb("+use+")"; bctx.lineWidth=3.4;
    bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x2,y2); bctx.stroke();
    const hx=x2+Math.sin(rad+2.6)*7, hy=y2-Math.cos(rad+2.6)*7, hx2=x2+Math.sin(rad-2.6)*7, hy2=y2-Math.cos(rad-2.6)*7;
    bctx.beginPath(); bctx.moveTo(hx,hy); bctx.lineTo(x2,y2); bctx.lineTo(hx2,hy2); bctx.stroke();
    bctx.font="bold 11px sans-serif"; bctx.textAlign="left"; halo(kn.toFixed(1), x2+6, y2-4);
  });
}

function drawSeamarks(){
  const z=Math.max(9, Math.min(13, Math.round(8+cam.z*1.6)));
  const x0=lon2x(cam.lon-(LON1-LON0)/(2*cam.z), z), x1=lon2x(cam.lon+(LON1-LON0)/(2*cam.z), z);
  const y0=lat2y(cam.lat+(LAT1-LAT0)/(2*cam.z), z), y1=lat2y(cam.lat-(LAT1-LAT0)/(2*cam.z), z);
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
function paintBg(st,boat,s){
  bctx.fillStyle="#0a4a58"; bctx.fillRect(0,0,W,H);
  if(mapStyle!=="vector") drawTiles(); else { bctx.fillStyle=wash(st.tws); bctx.fillRect(0,0,W,H); }
  if(document.getElementById("seams") && document.getElementById("seams").checked) drawSeamarks();
  drawLand();
  bctx.font="bold 12px sans-serif"; bctx.textAlign="center";
  [["Guernsey",-2.58,49.468],["Jersey",-2.12,49.215],["Sablons",-2.02,48.655]].forEach(function(a){halo(a[0],X(a[1]),Y(a[2]));});
  HAZ.forEach(function(h){ bctx.font="bold 10px sans-serif"; halo(h[2], X(h[0]), Y(h[1])); });
  drawShafts(s);
  bctx.setLineDash([7,5]); bctx.strokeStyle="#e6b35a"; bctx.lineWidth=2.2; bctx.beginPath();
  WPS.forEach(function(p,i){i?bctx.lineTo(X(p[0]),Y(p[1])):bctx.moveTo(X(p[0]),Y(p[1]));}); bctx.stroke(); bctx.setLineDash([]);
  const bx=X(boat.lon), by=Y(boat.lat), rad=boat.cog*Math.PI/180;
