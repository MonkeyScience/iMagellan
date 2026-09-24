
(function(){
const LON0=-2.78,LON1=-1.88,LAT0=48.54,LAT1=49.56;
const LAND=[
[[-2.67,49.50],[-2.52,49.51],[-2.50,49.49],[-2.525,49.42],[-2.66,49.44],[-2.70,49.47]],
[[-2.25,49.26],[-2.01,49.26],[-2.02,49.18],[-2.20,49.17],[-2.27,49.23]],
[[-2.34,49.03],[-2.00,49.02],[-1.98,48.90],[-2.28,48.90]]
];
const HAZ=[[-2.28,48.97,"Minquiers"],[-2.12,49.29,"Écréhous"],[-2.48,49.43,"Little Russell"]];
const STN=[[-2.50,49.43,1.4],[-2.52,49.34,1.1],[-2.36,49.20,1.0],[-2.28,48.97,1.6],[-2.12,48.74,1.2],[-2.04,48.66,0.8]];
const PORTS={spp:{n:"St Peter Port",p:[-2.5233,49.4567]},sark:{n:"Sark",p:[-2.35,49.43]},helier:{n:"St Helier",p:[-2.12,49.18]},sablons:{n:"Les Sablons",p:[-2.0285,48.6407]},granville:{n:"Granville",p:[-1.60,48.835]},carteret:{n:"Carteret",p:[-1.80,49.375]}};
let WPS=[[-2.5233,49.4567],[-2.528,49.422],[-2.45,49.30],[-2.40,49.18],[-2.383,48.995],[-2.267,48.85],[-2.08,48.72],[-2.032,48.68],[-2.0285,48.6407]];
let FROMN="St Peter Port", TON="Les Sablons", CUM=[0], TOTAL=0;
function nmBetween(a,b){return Math.hypot((b[1]-a[1])*60,(b[0]-a[0])*60*Math.cos((a[1]+b[1])*Math.PI/360));}
function cogBetween(a,b){return (Math.atan2(b[0]-a[0], b[1]-a[1])*180/Math.PI+360)%360;}
function rebuildTrack(){ CUM=[0]; for(let i=1;i<WPS.length;i++) CUM.push(CUM[i-1]+nmBetween(WPS[i-1],WPS[i])); TOTAL=CUM[CUM.length-1]; }
rebuildTrack();
function posAt(nm){nm=Math.max(0,Math.min(TOTAL,nm)); let i=0; while(i<CUM.length-2 && CUM[i+1]<nm) i++; const t=CUM[i+1]===CUM[i]?0:(nm-CUM[i])/(CUM[i+1]-CUM[i]); return {lon:WPS[i][0]+t*(WPS[i+1][0]-WPS[i][0]), lat:WPS[i][1]+t*(WPS[i+1][1]-WPS[i][1]), cog:cogBetween(WPS[i],WPS[i+1])};}
function placeAt(nm){ if(nm<2) return FROMN; if(nm>TOTAL-2) return TON; return "On passage"; }
const SNAP=[{min:360,tws:9.5,twd:285,gust:12,hs:1.46},{min:480,tws:10.2,twd:270,gust:13,hs:1.45},{min:610,tws:11,twd:268,gust:14,hs:1.44},{min:720,tws:12.7,twd:249,gust:15.6,hs:1.42},{min:780,tws:16.2,twd:260,gust:20,hs:1.4},{min:840,tws:16.8,twd:245,gust:20.8,hs:1.38},{min:900,tws:17.9,twd:250,gust:21.9,hs:1.36},{min:1020,tws:19.2,twd:265,gust:23.8,hs:1.32}];
const COLS={orange:{f:"251,146,60",e:"234,88,12",s:"253,186,116"},teal:{f:"45,212,191",e:"251,113,133",s:"148,163,184"},blue:{f:"56,189,248",e:"37,99,235",s:"147,197,253"}};
const SPP=[[304,3.4],[670,7.3],[1045,3.6],[1407,6.9],[1775,4.0],[2150,6.7]];
const MAL=[[366,1.14],[698,6.8],[1100,1.55],[1436,6.11],[1761,1.94],[1936,5.95]];
let LIVE=null,GPS=null,watch=null,TABLE=null,TABDEP=-1,tileCache={},mapStyle="vector";
const wrap=d=>((d%360)+360)%360;
function cardDir(d){const n=["N","NE","E","SE","S","SW","W","NW"];return n[Math.round(wrap(d)/45)%8];}
function hhmm(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(Math.round(m%60)).padStart(2,"0");}
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes();}
function inLand(lo,la){return(lo>-2.68&&lo<-2.50&&la>49.42&&la<49.51)||(lo>-2.25&&lo<-2.02&&la>49.17&&la<49.26)||(lo>-2.32&&lo<-1.98&&la>48.90&&la<49.03)||la<48.64;}
function spawn(){let lo,la,n=0;do{lo=LON0+Math.random()*(LON1-LON0);la=LAT0+Math.random()*(LAT1-LAT0);n++;}while(inLand(lo,la)&&n<40);return{lon:lo,lat:la,age:Math.random()*80};}
function stateAt(min){min=((+min%1440)+1440)%1440;const src=LIVE||SNAP; let i=0; while(i<src.length-2 && src[i+1].min<min) i++; const A=src[i],B=src[i+1]||A,t=(min-A.min)/Math.max(1,(B.min||A.min+60)-A.min); const lerp=(a,b)=>a+(b-a)*t; return {tws:lerp(A.tws,B.tws), twd:wrap(A.twd+(((B.twd-A.twd+540)%360)-180)*t), gust:lerp(A.gust||A.tws+3,B.gust||B.tws+3), hs:lerp(A.hs,B.hs)};}
function streamAt(min){if(window.__smocAt){var u=window.__smocAt(min);if(u)return u;}
  const hw=670, half=6.21*60;
  const signed=1.65*Math.sin(Math.PI*(min-hw)/half);
  const kn=Math.abs(signed);
  const flood=signed<0;
  return {kn:kn, signed:signed, dir:flood?155:335, phase:kn<0.28?"slack":(flood?"flood":"ebb")};
}
function bsp(tws){ if(tws<6)return 3.2; if(tws<10)return 4.8; if(tws<14)return 5.9; if(tws<18)return 6.5; return 6.0; }
function sogAt(min,cog){const st=stateAt(min), s=streamAt(min); return {sog:Math.max(2.3, bsp(st.tws)+s.signed*Math.cos((155-cog)*Math.PI/180)), st:st, s:s};}
function buildTable(dep){const rows=[{min:dep,nm:0}]; let nm=0; for(let m=dep;m<dep+16*60 && nm<TOTAL;m+=5){const p=posAt(nm); nm=Math.min(TOTAL, nm+sogAt(m,p.cog).sog*(5/60)); rows.push({min:m+5,nm:nm});} return rows;}
function nmAt(min,dep){if(!TABLE||TABDEP!==dep){TABLE=buildTable(dep);TABDEP=dep;} if(min<=dep)return 0; let i=0; while(i<TABLE.length-2 && TABLE[i+1].min<min) i++; const A=TABLE[i],B=TABLE[i+1]||A,t=(min-A.min)/Math.max(1,(B.min-A.min)||1); return A.nm+(B.nm-A.nm)*t;}
function etaMin(dep){if(!TABLE||TABDEP!==dep){TABLE=buildTable(dep);TABDEP=dep;} const hit=TABLE.find(function(r){return r.nm>=TOTAL-0.05;}); return hit?hit.min:dep+16*60;}
function tideAt(series,min){let i=0; while(i<series.length-2 && series[i+1][0]<min) i++; const A=series[i],B=series[i+1]||A,t=(min-A[0])/Math.max(1,B[0]-A[0]),u=0.5-0.5*Math.cos(Math.PI*Math.max(0,Math.min(1,t))); return A[1]+(B[1]-A[1])*u;}
function nextExt(series,min){for(let i=0;i<series.length;i++) if(series[i][0]>min) return ((i%2===1)?"HW ":"LW ")+hhmm(series[i][0])+" · "+series[i][1].toFixed(1)+" m"; return "—";}
function nearestHW(series,min){let best=series[1],d=1e9; series.forEach(function(p,i){if(i%2===1){const x=Math.abs(p[0]-min); if(x<d){d=x;best=p;}}}); return best;}
function wash(kn){ if(kn<10)return"rgba(125,255,122,0.12)"; if(kn<16)return"rgba(183,240,110,0.12)"; return"rgba(215,243,58,0.10)"; }
const bg=document.getElementById("bg"), fg=document.getElementById("fg"), wrapEl=document.getElementById("mapwrap");
const bctx=bg.getContext("2d"), fctx=fg.getContext("2d");
const cam={z:1.8,lon:-2.42,lat:49.22}; let W=300,H=300,dirty=true; window.__cam=cam; Object.defineProperty(window,'__dirty',{get(){return dirty;},set(v){dirty=v;}});
const P=[],C=[]; for(let i=0;i<360;i++) P.push(spawn()); for(let i=0;i<160;i++) C.push(