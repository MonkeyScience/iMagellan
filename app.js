(function(){
const LAND=[[[-2.67,49.50],[-2.52,49.51],[-2.50,49.49],[-2.525,49.42],[-2.66,49.44],[-2.70,49.47]],[[-2.25,49.26],[-2.01,49.26],[-2.02,49.18],[-2.20,49.17],[-2.27,49.23]],[[-2.34,49.03],[-2.00,49.02],[-1.98,48.90],[-2.28,48.90]],[[-2.38,49.46],[-2.34,49.44],[-2.35,49.40],[-2.38,49.39],[-2.40,49.43]],[[-2.23,49.74],[-2.16,49.74],[-2.16,49.70],[-2.23,49.70]]];
const FR=[[-1.95,49.73],[-1.94,49.56],[-1.86,49.55],[-1.80,49.38],[-1.70,49.22],[-1.54,48.90],[-1.60,48.835],[-1.52,48.70],[-1.85,48.65],[-2.05,48.64],[-2.35,48.64],[-2.60,48.62]];
const PORTS={spp:{n:"St Peter Port",p:[-2.5233,49.4567]},sablons:{n:"Les Sablons",p:[-2.0285,48.6407]},helier:{n:"St Helier",p:[-2.12,49.18]},sark:{n:"Sark",p:[-2.35,49.43]},alderney:{n:"Alderney",p:[-2.20,49.72]},granville:{n:"Granville",p:[-1.60,48.835]},carteret:{n:"Carteret",p:[-1.80,49.375]},dielette:{n:"Dielette",p:[-1.86,49.551]},cherbourg:{n:"Cherbourg",p:[-1.62,49.65]}};
const GATES={russ:[-2.520,49.430],bigr:[-2.420,49.430],wjer:[-2.400,49.200],ejer:[-2.000,49.220],wmin:[-2.320,48.970],emin:[-1.950,48.950]};
const HOT=[{lon:-2.08,lat:49.71,m:2.8},{lon:-2.52,lat:49.43,m:2.15},{lon:-2.42,lat:49.43,m:1.7},{lon:-2.32,lat:48.97,m:1.85},{lon:-1.95,lat:48.95,m:1.55},{lon:-2.40,lat:49.20,m:1.45}];
const ALIAS={spp:["spp","st peter","peter port","guernsey","st james"],sablons:["sablons","st malo","st-malo","saint-malo","saint malo"],helier:["helier","jersey","st helier"],sark:["sark"],alderney:["alderney"],granville:["granville"],carteret:["carteret"],dielette:["dielette"],cherbourg:["cherbourg"]};
let WPS=[[-2.5233,49.4567],[-2.528,49.422],[-2.45,49.30],[-2.40,49.18],[-2.383,48.995],[-2.08,48.72],[-2.0285,48.6407]];
let CUM=[0],TOTAL=0,FROM="spp",TO="sablons",STREAMS=null,LIVE=null,GPS=null,watch=null;
let mapStyle="vector",dirty=true,pagesDirty=true,W=300,H=300;
const cam={z:1.8,lon:-2.42,lat:49.22};
function nmBetween(a,b){return Math.hypot((b[1]-a[1])*60,(b[0]-a[0])*60*Math.cos((a[1]+b[1])*Math.PI/360));}
function rebuildTrack(){CUM=[0];for(let i=1;i<WPS.length;i++)CUM.push(CUM[i-1]+nmBetween(WPS[i-1],WPS[i]));TOTAL=CUM[CUM.length-1]||1;}
rebuildTrack();
function posAt(nm){nm=Math.max(0,Math.min(TOTAL,nm));let i=0;while(i<CUM.length-2&&CUM[i+1]<nm)i++;const t=CUM[i+1]===CUM[i]?0:(nm-CUM[i])/(CUM[i+1]-CUM[i]);return{lon:WPS[i][0]+t*(WPS[i+1][0]-WPS[i][0]),lat:WPS[i][1]+t*(WPS[i+1][1]-WPS[i][1])};}
const wrap=d=>((d%360)+360)%360;
function cardDir(d){return["N","NE","E","SE","S","SW","W","NW"][Math.round(wrap(d)/45)%8];}
function hhmm(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60|0).padStart(2,"0");}
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes();}
function voyageMin(){const dep=+document.getElementById("dep").value,wall=+document.getElementById("t").value;return wall<dep?wall+1440:wall;}
function fallbackStream(min){const hw=670,s=1.65*Math.sin(Math.PI*(min-hw)/(6.21*60)),kn=Math.abs(s);const dir=s<0?25:205;return{kn:kn,dir:dir,sl:2.4*Math.cos(Math.PI*(min-hw)/(6.21*60)),phase:kn<0.22?"slack":(dir<90||dir>270?"flood":"ebb")};}
function hourAt(st,min){
  const rows=st.hours||[];
  if(!rows.length)return fallbackStream(min);
  let i=0;while(i<rows.length-2&&rows[i+1].min<min)i++;
  const A=rows[i],B=rows[i+1]||A,t=(min-A.min)/Math.max(1,(B.min||A.min+60)-A.min);
  return{kn:(+A.kn||0)+((+B.kn||0)-(+A.kn||0))*t,sl:(+A.sl||0)+((+B.sl||0)-(+A.sl||0))*t,dir:wrap((+A.dir||0)+(((((+(B.dir)||A.dir||0)-(+A.dir||0))+540)%360)-180)*t)};
}
function streamXY(lon,lat,min){
  if(!STREAMS||!STREAMS.stations||!STREAMS.stations.length)return fallbackStream(min);
  let su=0,sv=0,ssl=0,sw=0;
  STREAMS.stations.forEach(function(st){
    const h=hourAt(st,min);
    const d=Math.hypot((st.lon-lon)*Math.cos(lat*Math.PI/180),st.lat-lat)+0.018;
    const w=1/(d*d),r=h.dir*Math.PI/180;
    su+=w*h.kn*Math.sin(r);sv+=w*h.kn*Math.cos(r);ssl+=w*h.sl;sw+=w;
  });
  let kn=Math.hypot(su/sw,sv/sw),dir=wrap(Math.atan2(su/sw,sv/sw)*180/Math.PI),sl=ssl/sw;
  HOT.forEach(function(h){const d=Math.hypot((h.lon-lon)*0.72,h.lat-lat);if(d<0.20)kn*=1+(h.m-1)*Math.max(0,1-d/0.20);});
  return{kn:kn,dir:dir,sl:sl,phase:kn<0.22?"slack":((dir>330||dir<90)?"flood":"ebb")};
}
const SNAP=[{min:360,tws:9.5,twd:285,gust:12},{min:720,tws:12.7,twd:249,gust:16},{min:900,tws:17.9,twd:250,gust:22},{min:1020,tws:19,twd:265,gust:24}];
function stateAt(min){const src=LIVE||SNAP;let i=0;while(i<src.length-2&&src[i+1].min<min)i++;const A=src[i],B=src[i+1]||A,t=(min-A.min)/Math.max(1,(B.min||A.min+60)-A.min);return{tws:A.tws+(B.tws-A.tws)*t,twd:wrap(A.twd+(((B.twd-A.twd+540)%360)-180)*t),gust:A.gust+(B.gust-A.gust)*t};}
const bg=document.getElementById("bg"),fg=document.getElementById("fg"),wrapEl=document.getElementById("mapwrap");
const bctx=bg.getContext("2d"),fctx=fg.getContext("2d");
const tileCache={};
function mx(lon){return(lon+180)/360;}
function my(lat){const r=Math.max(-85,Math.min(85,lat))*Math.PI/180;return(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2;}
function worldPx(){return W*250*cam.z;}
function visLon(){return Math.max(0.35,(W/Math.max(1,worldPx()))*360)*1.15;}
const X=function(lo){return W/2+(mx(lo)-mx(cam.lon))*worldPx();};
const Y=function(la){return H/2+(my(la)-my(cam.lat))*worldPx();};
function resize(){const r=wrapEl.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1);W=Math.max(160,r.width|0);H=Math.max(180,r.height|0);[bg,fg].forEach(function(c){c.width=W*dpr;c.height=H*dpr;c.style.width=W+"px";c.style.height=H+"px";c.getContext("2d").setTransform(dpr,0,0,dpr,0,0);});dirty=true;}
function baseUrl(z,x,y){if(mapStyle==="sat")return"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"+z+"/"+y+"/"+x;if(mapStyle==="streets")return"https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/"+z+"/"+y+"/"+x;return"https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/"+z+"/"+y+"/"+x;}
function loadTile(key,url){let im=tileCache[key];if(!im){im=new Image();im.crossOrigin="anonymous";im.onload=function(){dirty=true;};im.src=url;tileCache[key]=im;}return im;}
function viewBounds(){const sl=visLon(),sa=sl*(H/Math.max(1,W))/Math.max(0.35,Math.cos(cam.lat*Math.PI/180));return{w:cam.lon-sl/2,e:cam.lon+sl/2,s:cam.lat-sa/2,n:cam.lat+sa/2};}
function curCol(){const v=(document.getElementById("ccol")||{}).value;if(v==="teal")return["#2dd4bf","#f472b6"];if(v==="blue")return["#38bdf8","#818cf8"];return["#fb923c","#fdba74"];}
function drawShafts(min){
  const col=curCol(),b=viewBounds(),step=Math.max(0.06,visLon()/7);
  fctx.clearRect(0,0,W,H);
  for(let lo=b.w;lo<=b.e;lo+=step){
    for(let la=b.s;la<=b.n;la+=step*0.75){
      const s=streamXY(lo,la,min);if(s.kn<0.12)continue;
      const x=X(lo),y=Y(la);if(x<-20||x>W+20||y<-20||y>H+20)continue;
      const rad=s.dir*Math.PI/180,len=10+s.kn*7,x2=x+Math.sin(rad)*len,y2=y-Math.cos(rad)*len;
      fctx.strokeStyle=s.kn>2?col[0]:col[1];fctx.lineWidth=Math.max(1.2,Math.min(4,s.kn*1.1));
      fctx.beginPath();fctx.moveTo(x,y);fctx.lineTo(x2,y2);fctx.stroke();
      fctx.beginPath();fctx.moveTo(x2,y2);fctx.lineTo(x2-Math.sin(rad-0.4)*5,y2+Math.cos(rad-0.4)*5);fctx.lineTo(x2-Math.sin(rad+0.4)*5,y2+Math.cos(rad+0.4)*5);fctx.closePath();fctx.fillStyle=fctx.strokeStyle;fctx.fill();
      if(s.kn>=0.8){fctx.fillStyle="#fff";fctx.font="9px sans-serif";fctx.textAlign="center";fctx.fillText(s.kn.toFixed(1),x,y+11);}
    }
  }
}
function paint(){
  bctx.fillStyle="#0a4a58";bctx.fillRect(0,0,W,H);
  const z=Math.max(5,Math.min(16,Math.round(Math.log2(Math.max(64,worldPx()/256))))),lim=Math.pow(2,z),b=viewBounds();
  const x0=mx(b.w)*lim,x1=mx(b.e)*lim,y0=my(b.n)*lim,y1=my(b.s)*lim;
  for(let x=Math.floor(x0)-1;x<=Math.floor(x1)+1;x++){
    for(let y=Math.floor(y0)-1;y<=Math.floor(y1)+1;y++){
      const xx=((x%lim)+lim)%lim,im=loadTile(mapStyle+"/"+z+"/"+xx+"/"+y,baseUrl(z,xx,y));
      if(!im.complete||!im.naturalWidth)continue;
      const west=xx/lim*360-180,east=(xx+1)/lim*360-180;
      const n=Math.PI-2*Math.PI*y/lim,s=Math.PI-2*Math.PI*(y+1)/lim;
      bctx.drawImage(im,X(west),Y(180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))),X(east)-X(west),Y(180/Math.PI*Math.atan(0.5*(Math.exp(s)-Math.exp(-s))))-Y(180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))));
    }
  }
  if(document.getElementById("seams")&&document.getElementById("seams").checked){
    const zs=Math.max(9,z),lims=Math.pow(2,zs);
    for(let x=Math.floor(mx(b.w)*lims)-1;x<=Math.floor(mx(b.e)*lims)+1;x++){
      for(let y=Math.floor(my(b.n)*lims)-1;y<=Math.floor(my(b.s)*lims)+1;y++){
        const xx=((x%lims)+lims)%lims,im=loadTile("sea/"+zs+"/"+xx+"/"+y,"https://tiles.openseamap.org/seamark/"+zs+"/"+xx+"/"+y+".png");
        if(!im.complete||!im.naturalWidth)continue;
        const west=xx/lims*360-180,east=(xx+1)/lims*360-180;
        const n=Math.PI-2*Math.PI*y/lims,s=Math.PI-2*Math.PI*(y+1)/lims;
        bctx.drawImage(im,X(west),Y(180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))),X(east)-X(west),Y(180/Math.PI*Math.atan(0.5*(Math.exp(s)-Math.exp(-s))))-Y(180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))));
      }
    }
  }
  LAND.forEach(function(p,i){bctx.beginPath();p.forEach(function(q,k){k?bctx.lineTo(X(q[0]),Y(q[1])):bctx.moveTo(X(q[0]),Y(q[1]));});bctx.closePath();bctx.strokeStyle=i===2?"#fbbf24":"#e2e8f0";bctx.lineWidth=i===2?2:1.1;bctx.stroke();});
  bctx.beginPath();FR.forEach(function(q,k){k?bctx.lineTo(X(q[0]),Y(q[1])):bctx.moveTo(X(q[0]),Y(q[1]));});bctx.strokeStyle="rgba(226,232,240,0.85)";bctx.lineWidth=1.2;bctx.stroke();
  bctx.setLineDash([7,5]);bctx.strokeStyle="#e6b35a";bctx.lineWidth=2.2;bctx.beginPath();
  WPS.forEach(function(p,i){i?bctx.lineTo(X(p[0]),Y(p[1])):bctx.moveTo(X(p[0]),Y(p[1]));});bctx.stroke();bctx.setLineDash([]);
  const min=voyageMin(),dep=+document.getElementById("dep").value;
  const frac=Math.max(0,Math.min(1,(min-dep)/Math.max(60,TOTAL/5.5*60)));
  const boat=posAt(frac*TOTAL);
  bctx.fillStyle="#fbbf24";bctx.beginPath();bctx.arc(X(boat.lon),Y(boat.lat),6,0,6.3);bctx.fill();
  bctx.fillStyle="#fff";bctx.font="bold 12px sans-serif";bctx.textAlign="center";
  [["Guernsey",-2.58,49.46],["Jersey",-2.12,49.21],["Sablons",-2.02,48.655],["France",-1.72,49.10]].forEach(function(a){bctx.fillText(a[0],X(a[1]),Y(a[2]));});
  drawShafts(min);
}
function stationById(id){return (STREAMS&&STREAMS.stations||[]).find(function(s){return s.id===id;});}
function slSeries(id){
  const st=stationById(id);
  if(st&&st.hours&&st.hours.length)return st.hours.map(function(h){return{min:h.min,sl:+h.sl||0};});
  const out=[];for(let m=0;m<=2880;m+=20)out.push({min:m,sl:fallbackStream(m).sl});return out;
}
function peaks(series){const hw=[];for(let i=2;i<series.length-2;i++){const a=series[i-1].sl,b=series[i].sl,c=series[i+1].sl;if(b>=a&&b>=c)hw.push(series[i]);}return hw;}
function nextEvent(list,min){const n=list.find(function(x){return x.min>=min;})||list[0];return n?"HW "+hhmm(n.min)+" · "+n.sl.toFixed(2)+" m":"--";}
function interpSl(ser,min){if(!ser.length)return 0;let i=0;while(i<ser.length-2&&ser[i+1].min<min)i++;const A=ser[i],B=ser[i+1]||A,t=(min-A.min)/Math.max(1,B.min-A.min);return A.sl+(B.sl-A.sl)*t;}
function drawTideGraph(){
  const c=document.getElementById("tg");if(!c)return;
  const r=c.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  c.width=Math.max(280,r.width)*dpr;c.height=168*dpr;
  const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=c.width/dpr,h=168;
  ctx.fillStyle="#101820";ctx.fillRect(0,0,w,h);
  const A=slSeries(FROM),B=slSeries(TO);
  let lo=99,hi=-99;A.concat(B).forEach(function(p){if(p.sl<lo)lo=p.sl;if(p.sl>hi)hi=p.sl;});
  if(hi-lo<1){hi+=0.5;lo-=0.5;}lo=Math.floor(lo-0.2);hi=Math.ceil(hi+0.2);
  const maxM=Math.max(A[A.length-1].min,B[B.length-1].min,1440);
  function xx(m){return 36+(m/maxM)*(w-48);}function yy(sl){return 12+(hi-sl)/(hi-lo)*(h-28);}
  ctx.strokeStyle="#243040";ctx.fillStyle="#9bb0c3";ctx.font="10px sans-serif";ctx.textAlign="right";
  for(let m=lo;m<=hi;m++){ctx.beginPath();ctx.moveTo(36,yy(m));ctx.lineTo(w-8,yy(m));ctx.stroke();ctx.fillText(m.toFixed(0)+" m",34,yy(m)+3);}
  function stroke(ser,col){ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=2;ser.forEach(function(p,i){i?ctx.lineTo(xx(p.min),yy(p.sl)):ctx.moveTo(xx(p.min),yy(p.sl));});ctx.stroke();}
  stroke(A,"#2dd4bf");stroke(B,"#fb923c");
  const min=voyageMin();
  ctx.strokeStyle="#fbbf24";ctx.beginPath();ctx.moveTo(xx(min),8);ctx.lineTo(xx(min),h-8);ctx.stroke();
  document.getElementById("tideClock").textContent=hhmm(min);
  document.getElementById("fromLab").textContent=PORTS[FROM].n;
  document.getElementById("toLab").textContent=PORTS[TO].n;
  document.getElementById("fromNow").textContent=interpSl(A,min).toFixed(2)+" m";
  document.getElementById("toNow").textContent=interpSl(B,min).toFixed(2)+" m";
  document.getElementById("fromNext").textContent=nextEvent(peaks(A),min);
  document.getElementById("toNext").textContent=nextEvent(peaks(B),min);
  c._meta={A:A,B:B,xx:xx,maxM:maxM,w:w};
}
function drawWindows(){
  const c=document.getElementById("win");if(!c)return;
  const r=c.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  c.width=Math.max(280,r.width)*dpr;c.height=168*dpr;
  const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=c.width/dpr;
  ctx.fillStyle="#101820";ctx.fillRect(0,0,w,168);
  const dest=slSeries(TO),src=slSeries(FROM),pk=peaks(dest),min=voyageMin(),dep=+document.getElementById("dep").value;
  const eta=dep+Math.round(TOTAL/5.5*60),maxM=Math.max(1440,dest[dest.length-1].min);
  function xx(m){return 10+(m/maxM)*(w-20);}
  function band(list,col){list.forEach(function(p){ctx.fillStyle=col;ctx.fillRect(xx(p.min-150),30,Math.max(2,xx(p.min+150)-xx(p.min-150)),40);});}
  band(pk,"rgba(52,211,153,0.35)");band(peaks(src),"rgba(125,211,199,0.22)");
  ctx.fillStyle="#fbbf24";ctx.fillRect(xx(min)-1,20,2,70);
  ctx.fillStyle="#fff";ctx.fillRect(xx(eta)-1,20,2,70);
  ctx.fillStyle="#9bb0c3";ctx.font="11px sans-serif";ctx.fillText("green = dest marina +/-2.5h HW",10,110);ctx.fillText("gold = time   white = ETA "+hhmm(eta),10,128);
  document.getElementById("portClock").textContent=hhmm(min);
  document.getElementById("w0t").textContent=PORTS[TO].n+" window";
  const near=pk[0]&&pk.reduce(function(a,p){return Math.abs(p.min-eta)<Math.abs(a.min-eta)?p:a;},pk[0]);
  document.getElementById("w0").textContent=near?("HW "+hhmm(near.min)+" +/-2.5h"+(Math.abs(eta-near.min)<150?" · open":"")):"--";
  document.getElementById("w1t").textContent=PORTS[FROM].n+" window";
  const nf=peaks(src).find(function(p){return p.min>=dep;})||peaks(src)[0];
  document.getElementById("w1").textContent=nf?("HW "+hhmm(nf.min)):"--";
  document.getElementById("w2t").textContent="Lock / sill";document.getElementById("w2").textContent="Marina — no lock required";
  const s=streamXY(PORTS[TO].p[0],PORTS[TO].p[1],min);
  document.getElementById("portStr").textContent=s.kn.toFixed(1)+" kn "+cardDir(s.dir)+" "+s.phase;
}
function paintPages(){drawTideGraph();drawWindows();pagesDirty=false;}
function tick(){
  cam.z=+document.getElementById("z").value/10;mapStyle=document.getElementById("style").value;
  const dep=+document.getElementById("dep").value,min=voyageMin(),st=stateAt(min);
  const frac=Math.max(0,Math.min(1,(min-dep)/Math.max(60,TOTAL/5.5*60)));
  const boat=posAt(frac*TOTAL),s=streamXY(boat.lon,boat.lat,min);
  document.getElementById("tlab").textContent=hhmm(min);
  document.getElementById("dlab").textContent=hhmm(dep);
  document.getElementById("zlab").textContent=cam.z.toFixed(1)+"x";
  document.getElementById("wv").textContent=st.tws.toFixed(1);
  document.getElementById("wg").textContent=cardDir(st.twd)+" G"+st.gust.toFixed(0);
  document.getElementById("sv").textContent=s.kn.toFixed(1);
  document.getElementById("sd").textContent=cardDir(s.dir)+" "+s.phase;
  document.getElementById("eta").textContent=hhmm(dep+Math.round(TOTAL/5.5*60));
  document.getElementById("left").textContent=((1-frac)*TOTAL).toFixed(1)+" nm";
  document.getElementById("who").textContent=frac<0.05?PORTS[FROM].n:frac>0.95?PORTS[TO].n:"On passage";
  if(document.getElementById("follow").checked&&GPS){cam.lon=GPS.lon;cam.lat=GPS.lat;dirty=true;}
  if(dirty){paint();dirty=false;}else drawShafts(min);
  if(pagesDirty)paintPages();
  requestAnimationFrame(tick);
}
function rebuildHours(dep){
  const box=document.getElementById("hours");box.innerHTML="";
  for(let h=0;h<24;h+=2){const m=h*60,b=document.createElement("button");b.textContent=hhmm(m);
    if(Math.abs(((dep%1440)-m+1440)%1440)<60)b.style.outline="1px solid #2dd4bf";
    b.onclick=function(){document.getElementById("t").value=m;dirty=true;pagesDirty=true;};box.appendChild(b);}
}
function loadList(key){try{return JSON.parse(localStorage.getItem(key)||"[]");}catch(e){return[];}}
function saveList(key,arr){localStorage.setItem(key,JSON.stringify(arr.slice(0,12)));}
function renderLists(){
  function fill(id,arr){const box=document.getElementById(id);if(!box)return;box.innerHTML="";
    arr.forEach(function(r){const d=document.createElement("div");d.className="ritem";d.innerHTML="<b></b><span></span>";d.querySelector("b").textContent=r.name;d.querySelector("span").textContent=r.nm.toFixed(1)+" nm";
      const go=document.createElement("button");go.textContent="Go";go.onclick=function(){applyRoute(r.from,r.to,r.side,r.vias,r.name,false);};d.appendChild(go);box.appendChild(d);});}
  fill("favs",loadList("imagellan-favs"));fill("hist",loadList("imagellan-hist"));
}
function gateChoice(){return{russ:!!document.getElementById("vRuss").checked,bigr:!!document.getElementById("vBigR").checked,wjer:!!document.getElementById("vWJer").checked,ejer:!!document.getElementById("vEJer").checked,wmin:!!document.getElementById("vWMin").checked,emin:!!document.getElementById("vEMin").checked};}
function buildCorridor(fk,tk,side,vias){
  const A=PORTS[fk],B=PORTS[tk];if(!A||!B)return[PORTS.spp.p.slice(),PORTS.sablons.p.slice()];
  const pts=[A.p.slice()];const going=Math.abs(B.p[1]-A.p[1])>0.05;
  let west=side==="west"||(side!=="east"&&(B.p[0]<=-2.05||fk==="spp"));
  if(going){
    if(vias.russ&&!vias.bigr)pts.push(GATES.russ);else if(vias.bigr)pts.push(GATES.bigr);else if(fk==="spp"||tk==="spp")pts.push(GATES.russ);
    if(west){if(vias.wjer)pts.push(GATES.wjer);if(vias.wmin)pts.push(GATES.wmin);}else{if(vias.ejer)pts.push(GATES.ejer);if(vias.emin)pts.push(GATES.emin);}
  }else pts.push([(A.p[0]+B.p[0])/2,(A.p[1]+B.p[1])/2]);
  pts.push(B.p.slice());const out=[pts[0]];
  for(let i=1;i<pts.length;i++){const p=pts[i],q=out[out.length-1];if(Math.hypot(p[0]-q[0],p[1]-q[1])>0.01)out.push(p);}return out;
}
function applyRoute(fk,tk,side,vias,name,record){
  if(!PORTS[fk]||!PORTS[tk]||fk===tk)return;
  FROM=fk;TO=tk;WPS=buildCorridor(fk,tk,side||"auto",vias||gateChoice());rebuildTrack();
  cam.lon=(PORTS[fk].p[0]+PORTS[tk].p[0])/2;cam.lat=(PORTS[fk].p[1]+PORTS[tk].p[1])/2;
  document.getElementById("rfrom").value=fk;document.getElementById("rto").value=tk;
  const label=name||(PORTS[fk].n+" to "+PORTS[tk].n);
  document.getElementById("rsum").textContent=label+" · "+TOTAL.toFixed(1)+" nm · "+(side||"auto");
  document.getElementById("rname").value=label;
  if(record!==false){const rec={name:label,from:fk,to:tk,side:side||"auto",vias:vias||gateChoice(),nm:TOTAL};const hist=loadList("imagellan-hist").filter(function(x){return x.name!==label;});hist.unshift(rec);saveList("imagellan-hist",hist);renderLists();}
  dirty=true;pagesDirty=true;
}
function parsePrompt(text){
  const s=(text||"").toLowerCase();
  function findPort(which){let hit=null,idx=which==="from"?999:-1;Object.keys(ALIAS).forEach(function(k){ALIAS[k].forEach(function(a){const i=s.indexOf(a);if(i<0)return;if(which==="from"&&(hit===null||i<idx)){hit=k;idx=i;}if(which==="to"&&i>idx){hit=k;idx=i;}});});return hit;}
  let fk=findPort("from")||"spp",tk=findPort("to");if(!tk||tk===fk)tk="sablons";
  let side="auto";if(/west[- ]?about|west of/.test(s))side="west";if(/east[- ]?about|east of/.test(s))side="east";
  const vias={russ:/russell/.test(s)?!/big russell/.test(s):true,bigr:/big russell/.test(s),wjer:side!=="east",ejer:side==="east",wmin:side!=="east",emin:side==="east"};
  const lm=s.match(/leav\w*\s+(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?/);
  if(lm)document.getElementById("dep").value=(+lm[1])*60+(+(lm[2]||0));
  document.getElementById("vRuss").checked=vias.russ;document.getElementById("vBigR").checked=vias.bigr;
  document.getElementById("vWJer").checked=vias.wjer;document.getElementById("vEJer").checked=vias.ejer;
  document.getElementById("vWMin").checked=vias.wmin;document.getElementById("vEMin").checked=vias.emin;
  document.getElementById("rside").value=side;
  applyRoute(fk,tk,side,vias,PORTS[fk].n+" to "+PORTS[tk].n,true);
  document.getElementById("rparseOut").textContent="Built "+PORTS[fk].n+" to "+PORTS[tk].n+" · "+side+" · "+TOTAL.toFixed(1)+" nm";
}
["t","dep","z","style","ccol","seams"].forEach(function(id){const el=document.getElementById(id);if(el)el.oninput=function(){dirty=true;pagesDirty=true;if(id==="dep")rebuildHours(+el.value);};});
document.getElementById("zi").onclick=function(){const z=document.getElementById("z");z.value=Math.min(80,+z.value+4);dirty=true;};
document.getElementById("zo").onclick=function(){const z=document.getElementById("z");z.value=Math.max(4,+z.value-4);dirty=true;};
document.getElementById("now").onclick=function(){document.getElementById("t").value=nowMin();dirty=true;pagesDirty=true;};
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
document.querySelectorAll("#nav button").forEach(function(b){b.onclick=function(){document.querySelectorAll("#nav button").forEach(function(x){x.classList.remove("on");});b.classList.add("on");const p=b.dataset.p;document.getElementById("view-map").style.display=p==="map"?"flex":"none";["tides","ports","routes"].forEach(function(n){document.getElementById("view-"+n).classList.toggle("on",p===n);});dirty=true;pagesDirty=true;if(p==="map")resize();};});
(function fillPorts(){const f=document.getElementById("rfrom"),t=document.getElementById("rto");if(!f)return;Object.keys(PORTS).forEach(function(k){const o=document.createElement("option");o.value=k;o.textContent=PORTS[k].n;f.appendChild(o);t.appendChild(o.cloneNode(true));});f.value="spp";t.value="sablons";})();
document.getElementById("rapply").onclick=function(){applyRoute(document.getElementById("rfrom").value,document.getElementById("rto").value,document.getElementById("rside").value,gateChoice(),document.getElementById("rname").value,true);};
document.getElementById("rstar").onclick=function(){const rec={name:document.getElementById("rname").value||(PORTS[FROM].n+" to "+PORTS[TO].n),from:FROM,to:TO,side:document.getElementById("rside").value,vias:gateChoice(),nm:TOTAL};const favs=loadList("imagellan-favs").filter(function(x){return x.name!==rec.name;});favs.unshift(rec);saveList("imagellan-favs",favs);renderLists();};
document.getElementById("rparse").onclick=function(){parsePrompt(document.getElementById("rprompt").value);};
const tg=document.getElementById("tg");
function readTide(ev){const meta=tg._meta;if(!meta)return;const x=ev.clientX-tg.getBoundingClientRect().left;const m=Math.max(0,Math.min(meta.maxM,(x-36)/(meta.w-48)*meta.maxM));document.getElementById("tread").textContent=hhmm(m)+"  —  "+PORTS[FROM].n+" "+interpSl(meta.A,m).toFixed(2)+" m CD   ·   "+PORTS[TO].n+" "+interpSl(meta.B,m).toFixed(2)+" m CD";}
tg.addEventListener("pointerdown",readTide);tg.addEventListener("pointermove",function(ev){if(ev.buttons)readTide(ev);});
const ptrs=new Map();let drag=null,pinch=null;
function ptrDist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
wrapEl.addEventListener("pointerdown",function(ev){wrapEl.setPointerCapture(ev.pointerId);ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});if(ptrs.size===2){const pts=[...ptrs.values()];pinch={d0:Math.max(24,ptrDist(pts[0],pts[1])),z0:cam.z};drag=null;}else drag={x:ev.clientX,y:ev.clientY,lon:cam.lon,lat:cam.lat};});
function endPtr(ev){ptrs.delete(ev.pointerId);if(ptrs.size<2)pinch=null;if(ptrs.size===0)drag=null;}
wrapEl.addEventListener("pointerup",endPtr);wrapEl.addEventListener("pointercancel",endPtr);
wrapEl.addEventListener("pointermove",function(ev){
  if(!ptrs.has(ev.pointerId))return;ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(pinch&&ptrs.size>=2){const pts=[...ptrs.values()];cam.z=Math.max(0.4,Math.min(8,pinch.z0*(Math.max(24,ptrDist(pts[0],pts[1]))/pinch.d0)));document.getElementById("z").value=Math.round(cam.z*10);dirty=true;return;}
  if(!drag)return;const sl=visLon(),sa=sl*(H/Math.max(1,W))/Math.max(0.35,Math.cos(cam.lat*Math.PI/180));
  cam.lon=drag.lon-(ev.clientX-drag.x)/W*sl;cam.lat=Math.max(-80,Math.min(80,drag.lat+(ev.clientY-drag.y)/H*sa));dirty=true;
});
wrapEl.addEventListener("wheel",function(ev){ev.preventDefault();const z=document.getElementById("z");z.value=Math.max(4,Math.min(80,+z.value+(ev.deltaY<0?3:-3)));dirty=true;},{passive:false});
addEventListener("resize",resize);
document.getElementById("t").value=nowMin();rebuildHours(410);renderLists();resize();tick();
document.getElementById("src").textContent="Streams + tides loading";
fetch("/api/streams").then(function(r){return r.json();}).then(function(d){if(d&&d.ok){STREAMS=d;document.getElementById("src").textContent=d.src||"LIVE streams";dirty=true;pagesDirty=true;}}).catch(function(){document.getElementById("src").textContent="Atlas streams (offline)";});
fetch("https://api.open-meteo.com/v1/forecast?latitude=49.30&longitude=-2.43&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=Europe%2FLondon&forecast_days=1").then(function(r){return r.json();}).then(function(w){LIVE=(w.hourly.time||[]).map(function(s,i){const hm=s.split("T")[1].split(":");return{min:(+hm[0])*60+(+hm[1]||0),tws:w.hourly.wind_speed_10m[i],twd:w.hourly.wind_direction_10m[i],gust:w.hourly.wind_gusts_10m[i]};});dirty=true;}).catch(function(){});
})();
