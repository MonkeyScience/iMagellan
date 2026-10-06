function inLand(lo,la){for(let i=0;i<LAND.length;i++){const b=LANDBB[i];if(lo<b[0]||lo>b[2]||la<b[1]||la>b[3])continue;if(pip(LAND[i],lo,la))return true;}return false;}
function spawn(){let lo,la,n=0;do{lo=LON0+Math.random()*(LON1-LON0);la=LAT0+Math.random()*(LAT1-LAT0);n++;}while(inLand(lo,la)&&n<40);return{lon:lo,lat:la,age:Math.random()*80};}
function stateAt(min){min=((+min%1440)+1440)%1440;const src=LIVE||SNAP; let i=0; while(i<src.length-2 && src[i+1].min<min) i++; const A=src[i],B=src[i+1]||A,t=(min-A.min)/Math.max(1,(B.min||A.min+60)-A.min); const lerp=(a,b)=>a+(b-a)*t; return {tws:lerp(A.tws,B.tws), twd:wrap(A.twd+(((B.twd-A.twd+540)%360)-180)*t), gust:lerp(A.gust||A.tws+3,B.gust||B.tws+3), hs:lerp(A.hs,B.hs)};}
/* Stream at a position/time comes only from the live model hook in app.js (fixed per-station axis,
   flood/ebb from per-station flood sets). No synthetic fallback: without data we say so. */
function streamAt(min,lon,lat){if(window.__smocStn){var u=window.__smocStn(lon==null?-2.22:lon,lat==null?49.08:lat,min);if(u)return u;} return {kn:0,dir:0,signed:0,phase:"no data",none:true};}
function bsp(tws){ if(tws<6)return 3.2; if(tws<10)return 4.8; if(tws<14)return 5.9; if(tws<18)return 6.5; return 6.0; }
/* SOG along the track: stream component along COG adds (fair) or subtracts (foul); the cross-track part is
   crabbed out of the boat speed. dir = direction the stream sets TOWARD at the boat's position and time. */
function sogFrom(b,s,cog){if(!s||s.none||!(s.kn>0))return b;const th=(s.dir-cog)*Math.PI/180,al=s.kn*Math.cos(th),cr=s.kn*Math.sin(th),w=b*b-cr*cr;return w>0?Math.sqrt(w)+al:al;}
function sogAt(min,cog,lon,lat){const st=stateAt(min), s=streamAt(min,lon,lat); return {sog:Math.max(0.5, sogFrom(bsp(st.tws),s,cog)), st:st, s:s};}
window.__sogFrom=sogFrom;
function buildTable(dep){const rows=[{min:dep,nm:0}]; let nm=0; for(let m=dep;m<dep+16*60 && nm<TOTAL;m+=5){const p=posAt(nm); nm=Math.min(TOTAL, nm+sogAt(m,p.cog,p.lon,p.lat).sog*(5/60)); rows.push({min:m+5,nm:nm});} return rows;}
function nmAt(min,dep){if(!TABLE||TABDEP!==dep){TABLE=buildTable(dep);TABDEP=dep;} if(min<=dep)return 0; let i=0; while(i<TABLE.length-2 && TABLE[i+1].min<min) i++; const A=TABLE[i],B=TABLE[i+1]||A,t=(min-A.min)/Math.max(1,(B.min-A.min)||1); return A.nm+(B.nm-A.nm)*t;}
function etaMin(dep){if(!TABLE||TABDEP!==dep){TABLE=buildTable(dep);TABDEP=dep;} const hit=TABLE.find(function(r){return r.nm>=TOTAL-0.05;}); return hit?hit.min:dep+16*60;}
function wash(kn){ if(kn<10)return"rgba(125,255,122,0.12)"; if(kn<16)return"rgba(183,240,110,0.12)"; return"rgba(215,243,58,0.10)"; }
const bg=document.getElementById("bg"), fg=document.getElementById("fg"), wrapEl=document.getElementById("mapwrap");
const bctx=bg.getContext("2d"), fctx=fg.getContext("2d");
const cam={z:1.8,lon:-2.42,lat:49.22}; let W=300,H=300,dirty=true; window.__cam=cam; Object.defineProperty(window,'__dirty',{get(){return dirty;},set(v){dirty=v;}});
const P=[],C=[]; for(let i=0;i<360;i++) P.push(spawn()); for(let i=0;i<160;i++) C.push(spawn());
function resize(){const r=wrapEl.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1); W=Math.max(120,Math.round(r.width)); H=Math.max(120,Math.round(r.height)); [bg,fg].forEach(function(c){c.width=Math.max(1,Math.round(W*dpr));c.height=Math.max(1,Math.round(H*dpr));c.style.width=W+"px";c.style.height=H+"px";var cx=c.getContext("2d"); cx.setTransform(dpr,0,0,dpr,0,0);}); dirty=true;}
function mercY(lat){const r=Math.min(85.05,Math.max(-85.05,lat))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+r/2));}
function view(){const sLat=(LAT1-LAT0)/cam.z;const m0=mercY(cam.lat-sLat/2),m1=mercY(cam.lat+sLat/2);const pxPerMerc=H/Math.max(1e-9,m1-m0);const pxPerDegLon=pxPerMerc*Math.PI/180;return{sLat:sLat,sLon:W/pxPerDegLon,pxPerMerc:pxPerMerc,pxPerDegLon:pxPerDegLon};}
const X=function(lo){const v=view();return W/2+(lo-cam.lon)*v.pxPerDegLon;};
const Y=function(la){const v=view();return H/2-(mercY(la)-mercY(cam.lat))*v.pxPerMerc;};
function lon2x(lon,z){return (lon+180)/360*Math.pow(2,z);}
function lat2y(lat,z){const r=lat*Math.PI/180; return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z);}
function tileUrl(z,x,y){
  if(mapStyle==="sat") return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"+z+"/"+y+"/"+x;
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/"+z+"/"+y+"/"+x;
}
function drawTiles(){
  const z=Math.max(8, Math.min(13, Math.round(8+cam.z*1.6)));
  const v=view();
  const x0=lon2x(cam.lon-v.sLon/2, z), x1=lon2x(cam.lon+v.sLon/2, z);
  const y0=lat2y(cam.lat+v.sLat/2, z), y1=lat2y(cam.lat-v.sLat/2, z);
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
  const path=function(p){bctx.beginPath(); p.forEach(function(q,k){k?bctx.lineTo(X(q[0]),Y(q[1])):bctx.moveTo(X(q[0]),Y(q[1]));}); bctx.closePath();};
  LAND.forEach(function(p){
    path(p);
    if(mapStyle==="vector"){ bctx.fillStyle="#1c2e24"; bctx.fill(); bctx.strokeStyle="#e2e8f0"; bctx.lineWidth=1.1; bctx.stroke(); }
    else { bctx.strokeStyle="rgba(255,255,255,0.75)"; bctx.lineWidth=1; bctx.stroke(); }
  });
  HAZA.forEach(function(h){
    path(h.p); bctx.fillStyle=mapStyle==="vector"?"rgba(251,191,36,0.16)":"rgba(255,180,60,0.18)"; bctx.fill();
    bctx.setLineDash([5,4]); bctx.strokeStyle="#fbbf24"; bctx.lineWidth=1.8; bctx.stroke(); bctx.setLineDash([]);
  });
}
function drawShafts(min){
