(function(){
const LAND=[[[-2.67,49.50],[-2.52,49.51],[-2.50,49.49],[-2.525,49.42],[-2.66,49.44],[-2.70,49.47]],[[-2.25,49.26],[-2.01,49.26],[-2.02,49.18],[-2.20,49.17],[-2.27,49.23]],[[-2.34,49.03],[-2.00,49.02],[-1.98,48.90],[-2.28,48.90]],[[-2.38,49.46],[-2.34,49.44],[-2.35,49.40],[-2.38,49.39],[-2.40,49.43]],[[-2.23,49.74],[-2.16,49.74],[-2.16,49.70],[-2.23,49.70]]];
const FR=[[-1.95,49.73],[-1.94,49.56],[-1.86,49.55],[-1.80,49.38],[-1.70,49.22],[-1.54,48.90],[-1.60,48.835],[-1.52,48.70],[-1.85,48.65],[-2.05,48.64],[-2.35,48.64],[-2.60,48.62]];
const PORTS={spp:{n:"St Peter Port",p:[-2.5233,49.4567]},sablons:{n:"Les Sablons",p:[-2.0285,48.6407]},helier:{n:"St Helier",p:[-2.12,49.18]},sark:{n:"Sark",p:[-2.35,49.43]},alderney:{n:"Alderney",p:[-2.20,49.72]},granville:{n:"Granville",p:[-1.60,48.835]},carteret:{n:"Carteret",p:[-1.80,49.375]},dielette:{n:"Dielette",p:[-1.86,49.551]},cherbourg:{n:"Cherbourg",p:[-1.62,49.65]}};
let WPS=[[-2.5233,49.4567],[-2.528,49.422],[-2.45,49.30],[-2.40,49.18],[-2.383,48.995],[-2.08,48.72],[-2.0285,48.6407]];
let CUM=[0],TOTAL=0;
function nmBetween(a,b){return Math.hypot((b[1]-a[1])*60,(b[0]-a[0])*60*Math.cos((a[1]+b[1])*Math.PI/360));}
function rebuildTrack(){CUM=[0];for(let i=1;i<WPS.length;i++)CUM.push(CUM[i-1]+nmBetween(WPS[i-1],WPS[i]));TOTAL=CUM[CUM.length-1];}
rebuildTrack();
function posAt(nm){nm=Math.max(0,Math.min(TOTAL,nm));let i=0;while(i<CUM.length-2&&CUM[i+1]<nm)i++;const t=CUM[i+1]===CUM[i]?0:(nm-CUM[i])/(CUM[i+1]-CUM[i]);return{lon:WPS[i][0]+t*(WPS[i+1][0]-WPS[i][0]),lat:WPS[i][1]+t*(WPS[i+1][1]-WPS[i][1])};}
const wrap=d=>((d%360)+360)%360;
function cardDir(d){return["N","NE","E","SE","S","SW","W","NW"][Math.round(wrap(d)/45)%8];}
function hhmm(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(Math.round(m%60)).padStart(2,"0");}
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes();}
function streamAt(min){const hw=670,s=1.65*Math.sin(Math.PI*(min-hw)/(6.21*60)),kn=Math.abs(s);const dir=s<0?25:205;return{kn:kn,dir:dir,phase:kn<0.25?"slack":(dir<90||dir>270?"flood":"ebb")};}
const SNAP=[{min:360,tws:9.5,twd:285,gust:12},{min:720,tws:12.7,twd:249,gust:16},{min:900,tws:17.9,twd:250,gust:22},{min:1020,tws:19,twd:265,gust:24}];
function stateAt(min){const src=LIVE||SNAP;let i=0;while(i<src.length-2&&src[i+1].min<min)i++;const A=src[i],B=src[i+1]||A,t=(min-A.min)/Math.max(1,(B.min||A.min+60)-A.min);return{tws:A.tws+(B.tws-A.tws)*t,twd:wrap(A.twd+(((B.twd-A.twd+540)%360)-180)*t),gust:A.gust+(B.gust-A.gust)*t};}
let LIVE=null,GPS=null,watch=null,mapStyle="vector",dirty=true,W=300,H=300;
const cam={z:1.8,lon:-2.42,lat:49.22};
const bg=document.getElementById("bg"),fg=document.getElementById("fg"),wrapEl=document.getElementById("mapwrap");
const bctx=bg.getContext("2d"),fctx=fg.getContext("2d");
const tileCache={};
function mx(lon){return(lon+180)/360;}
function my(lat){const r=Math.max(-85,Math.min(85,lat))*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2;}
function worldPx(){return W*250*cam.z;}
function visLon(){return 1.44/Math.max(0.25,cam.z);}
const X=function(lo){return W/2+(mx(lo)-mx(cam.lon))*worldPx();};
const Y=function(la){return H/2+(my(la)-my(cam.lat))*worldPx();};
function resize(){const r=wrapEl.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1);W=Math.max(160,r.width|0);H=Math.max(180,r.height|0);[bg,fg].forEach(function(c){c.width=W*dpr;c.height=H*dpr;c.style.width=W+"px";c.style.height=H+"px";c.getContext("2d").setTransform(dpr,0,0,dpr,0,0);});dirty=true;}
function baseUrl(z,x,y){if(mapStyle==="sat")return"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"+z+"/"+y+"/"+x;if(mapStyle==="streets")return"https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/"+z+"/"+y+"/"+x;return"https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/"+z+"/"+y+"/"+x;}
function loadTile(key,url){let im=tileCache[key];if(!im){im=new Image();im.crossOrigin="anonymous";im.onload=function(){dirty=true;};im.src=url;tileCache[key]=im;}return im;}
function viewBounds(){const sl=visLon(),sa=sl*(H/Math.max(1,W))/Math.max(0.35,Math.cos(cam.lat*Math.PI/180));return{w:cam.lon-sl/2,e:cam.lon+sl/2,s:cam.lat-sa/2,n:cam.lat+sa/2};}
function paint(){
  bctx.fillStyle="#0a4a58";bctx.fillRect(0,0,W,H);
  const z=Math.max(5,Math.min(16,Math.round(Math.log2(Math.max(64,worldPx()/256)))));
  const lim=Math.pow(2,z);
  const b=viewBounds();
  const x0=mx(b.w)*lim,x1=mx(b.e)*lim,y0=my(b.n)*lim,y1=my(b.s)*lim;
  for(let x=Math.floor(x0)-1;x<=Math.floor(x1)+1;x++){
    for(let y=Math.floor(y0)-1;y<=Math.floor(y1)+1;y++){
      const xx=((x%lim)+lim)%lim;
      const im=loadTile(mapStyle+"/"+z+"/"+xx+"/"+y,baseUrl(z,xx,y));
      if(!im.complete||!im.naturalWidth)continue;
      const west=xx/lim*360-180,east=(xx+1)/lim*360-180;
      const n=Math.PI-2*Math.PI*y/lim,s=Math.PI-2*Math.PI*(y+1)/lim;
      const north=180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
      const south=180/Math.PI*Math.atan(0.5*(Math.exp(s)-Math.exp(-s)));
      bctx.drawImage(im,X(west),Y(north),X(east)-X(west),Y(south)-Y(north));
    }
  }
  if(document.getElementById("seams")&&document.getElementById("seams").checked){
    const zs=Math.max(9,z);
    const lims=Math.pow(2,zs);
    const xs0=mx(b.w)*lims,xs1=mx(b.e)*lims,ys0=my(b.n)*lims,ys1=my(b.s)*lims;
    for(let x=Math.floor(xs0)-1;x<=Math.floor(xs1)+1;x++){
      for(let y=Math.floor(ys0)-1;y<=Math.floor(ys1)+1;y++){
        const xx=((x%lims)+lims)%lims;
        const im=loadTile("sea/"+zs+"/"+xx+"/"+y,"https://tiles.openseamap.org/seamark/"+zs+"/"+xx+"/"+y+".png");
        if(!im.complete||!im.naturalWidth)continue;
        const west=xx/lims*360-180,east=(xx+1)/lims*360-180;
        const n=Math.PI-2*Math.PI*y/lims,s=Math.PI-2*Math.PI*(y+1)/lims;
        const north=180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
        const south=180/Math.PI*Math.atan(0.5*(Math.exp(s)-Math.exp(-s)));
        bctx.drawImage(im,X(west),Y(north),X(east)-X(west),Y(south)-Y(north));
      }
    }
  }
  LAND.forEach(function(p,i){bctx.beginPath();p.forEach(function(q,k){k?bctx.lineTo(X(q[0]),Y(q[1])):bctx.moveTo(X(q[0]),Y(q[1]));});bctx.closePath();bctx.strokeStyle=i===2?"#fbbf24":"#e2e8f0";bctx.lineWidth=i===2?2:1.1;bctx.stroke();});
  bctx.beginPath();FR.forEach(function(q,k){k?bctx.lineTo(X(q[0]),Y(q[1])):bctx.moveTo(X(q[0]),Y(q[1]));});bctx.strokeStyle="rgba(226,232,240,0.85)";bctx.lineWidth=1.2;bctx.stroke();
  bctx.setLineDash([7,5]);bctx.strokeStyle="#e6b35a";bctx.lineWidth=2.2;bctx.beginPath();
  WPS.forEach(function(p,i){i?bctx.lineTo(X(p[0]),Y(p[1])):bctx.moveTo(X(p[0]),Y(p[1]));});bctx.stroke();bctx.setLineDash([]);
  const dep=+document.getElementById("dep").value,wall=+document.getElementById("t").value;
  const min=wall<dep?wall+1440:wall;
  const frac=Math.max(0,Math.min(1,(min-dep)/720));
  const boat=posAt(frac*TOTAL);
  bctx.fillStyle="#fbbf24";bctx.beginPath();bctx.arc(X(boat.lon),Y(boat.lat),6,0,6.3);bctx.fill();
  bctx.fillStyle="#fff";bctx.font="bold 12px sans-serif";bctx.textAlign="center";
  [["Guernsey",-2.58,49.46],["Jersey",-2.12,49.21],["Sablons",-2.02,48.655],["France",-1.72,49.10]].forEach(function(a){bctx.fillText(a[0],X(a[1]),Y(a[2]));});
}
function tick(){
  cam.z=+document.getElementById("z").value/10;
  mapStyle=document.getElementById("style").value;
  const dep=+document.getElementById("dep").value,wall=+document.getElementById("t").value;
  const min=wall<dep?wall+1440:wall;
  const st=stateAt(min),s=streamAt(min);
  const frac=Math.max(0,Math.min(1,(min-dep)/720));
  document.getElementById("tlab").textContent=hhmm(min);
  document.getElementById("dlab").textContent=hhmm(dep);
  document.getElementById("zlab").textContent=cam.z.toFixed(1)+"x";
  document.getElementById("wv").textContent=st.tws.toFixed(1);
  document.getElementById("wg").textContent=cardDir(st.twd)+" G"+st.gust.toFixed(0);
  document.getElementById("sv").textContent=s.kn.toFixed(1);
  document.getElementById("sd").textContent=cardDir(s.dir)+" "+s.phase;
  document.getElementById("eta").textContent=hhmm(dep+Math.round(TOTAL/5.5*60));
  document.getElementById("left").textContent=((1-frac)*TOTAL).toFixed(1)+" nm";
  document.getElementById("who").textContent=frac<0.05?"St Peter Port":frac>0.95?"Les Sablons":"On passage";
  if(document.getElementById("follow").checked&&GPS){cam.lon=GPS.lon;cam.lat=GPS.lat;dirty=true;}
  if(dirty){paint();fctx.clearRect(0,0,W,H);dirty=false;}
  requestAnimationFrame(tick);
}
function rebuildHours(dep){const box=document.getElementById("hours");box.innerHTML="";[dep,dep+60,dep+180,dep+360,dep+600].forEach(function(m,i){const labs=["Dep","+1h","+3h","+6h","ETA"];const b=document.createElement("button");b.textContent=labs[i]+" "+hhmm(m);b.onclick=function(){document.getElementById("t").value=((m%1440)+1440)%1440;dirty=true;};box.appendChild(b);});}
["t","dep","z","style","ccol","seams"].forEach(function(id){const el=document.getElementById(id);if(el)el.oninput=function(){dirty=true;};});
document.getElementById("zi").onclick=function(){const z=document.getElementById("z");z.value=Math.min(80,+z.value+4);dirty=true;};
document.getElementById("zo").onclick=function(){const z=document.getElementById("z");z.value=Math.max(4,+z.value-4);dirty=true;};
document.getElementById("now").onclick=function(){document.getElementById("t").value=nowMin();dirty=true;};
document.getElementById("gps").onclick=function(){
  if(watch){navigator.geolocation.clearWatch(watch);watch=null;GPS=null;document.getElementById("follow").checked=false;document.getElementById("gpsstat").textContent="GPS off - tap GPS";document.getElementById("gsd").textContent="off";return;}
  if(!navigator.geolocation){document.getElementById("gpsstat").textContent="no GPS";return;}
  watch=navigator.geolocation.watchPosition(function(p){
    GPS={lon:p.coords.longitude,lat:p.coords.latitude,sog:p.coords.speed==null?null:p.coords.speed*1.94384,cog:p.coords.heading};
    document.getElementById("gsv").textContent=GPS.sog==null?"fix":GPS.sog.toFixed(1);
    document.getElementById("gsd").textContent=GPS.cog==null?"kn":Math.round(GPS.cog)+" deg";
    document.getElementById("gpsstat").textContent="GPS live";dirty=true;
  },function(){document.getElementById("gpsstat").textContent="GPS denied";},{enableHighAccuracy:true,maximumAge:3000});
};
document.querySelectorAll("#nav button").forEach(function(b){b.onclick=function(){document.querySelectorAll("#nav button").forEach(function(x){x.classList.remove("on");});b.classList.add("on");const p=b.dataset.p;document.getElementById("view-map").style.display=p==="map"?"flex":"none";["tides","ports","routes"].forEach(function(n){document.getElementById("view-"+n).classList.toggle("on",p===n);});dirty=true;if(p==="map")resize();};});
(function fillPorts(){const f=document.getElementById("rfrom"),t=document.getElementById("rto");if(!f)return;Object.keys(PORTS).forEach(function(k){const o=document.createElement("option");o.value=k;o.textContent=PORTS[k].n;f.appendChild(o);t.appendChild(o.cloneNode(true));});f.value="spp";t.value="sablons";})();
if(document.getElementById("rapply"))document.getElementById("rapply").onclick=function(){
  const A=PORTS[document.getElementById("rfrom").value],B=PORTS[document.getElementById("rto").value];
  if(!A||!B||A===B)return;
  WPS=[A.p.slice(),[(A.p[0]+B.p[0])/2,(A.p[1]+B.p[1])/2],B.p.slice()];rebuildTrack();
  document.getElementById("rsum").textContent=A.n+" to "+B.n+" · "+TOTAL.toFixed(1)+" nm";
  cam.lon=(A.p[0]+B.p[0])/2;cam.lat=(A.p[1]+B.p[1])/2;dirty=true;
};
const ptrs=new Map();
let drag=null,pinch=null;
function ptrDist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
wrapEl.addEventListener("pointerdown",function(ev){
  wrapEl.setPointerCapture(ev.pointerId);
  ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(ptrs.size===2){const pts=[...ptrs.values()];pinch={d0:Math.max(24,ptrDist(pts[0],pts[1])),z0:cam.z};drag=null;}
  else drag={x:ev.clientX,y:ev.clientY,lon:cam.lon,lat:cam.lat};
});
function endPtr(ev){ptrs.delete(ev.pointerId);if(ptrs.size<2)pinch=null;if(ptrs.size===0)drag=null;}
wrapEl.addEventListener("pointerup",endPtr);
wrapEl.addEventListener("pointercancel",endPtr);
wrapEl.addEventListener("pointermove",function(ev){
  if(!ptrs.has(ev.pointerId))return;
  ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(pinch&&ptrs.size>=2){
    const pts=[...ptrs.values()];
    const d=Math.max(24,ptrDist(pts[0],pts[1]));
    cam.z=Math.max(0.4,Math.min(8,pinch.z0*(d/pinch.d0)));
    document.getElementById("z").value=Math.round(cam.z*10);
    dirty=true;return;
  }
  if(!drag)return;
  const sl=visLon(),sa=sl*(H/Math.max(1,W))/Math.max(0.35,Math.cos(cam.lat*Math.PI/180));
  cam.lon=drag.lon-(ev.clientX-drag.x)/W*sl;
  cam.lat=Math.max(-80,Math.min(80,drag.lat+(ev.clientY-drag.y)/H*sa));
  dirty=true;
});
wrapEl.addEventListener("wheel",function(ev){ev.preventDefault();const z=document.getElementById("z");z.value=Math.max(4,Math.min(80,+z.value+(ev.deltaY<0?3:-3)));dirty=true;},{passive:false});
addEventListener("resize",resize);
document.getElementById("t").value=nowMin();
rebuildHours(410);resize();tick();
document.getElementById("src").textContent="Map tiles · pinch on";
fetch("https://api.open-meteo.com/v1/forecast?latitude=49.30&longitude=-2.43&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=Europe%2FLondon&forecast_days=1")
  .then(function(r){return r.json();}).then(function(w){
    LIVE=(w.hourly.time||[]).map(function(s,i){const hm=s.split("T")[1].split(":");return{min:(+hm[0])*60+(+hm[1]||0),tws:w.hourly.wind_speed_10m[i],twd:w.hourly.wind_direction_10m[i],gust:w.hourly.wind_gusts_10m[i]};});
    document.getElementById("src").textContent="LIVE wind · full tiles";dirty=true;
  }).catch(function(){});
})();
