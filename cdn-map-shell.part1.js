["Minquiers","7904,5274,8783,5143,9378,4623,7891,3944,6317,3846,4768,4057,4569,4939"],
["Écréhous","8835,7705,8619,7708,8156,7903,8146,7931,8623,8012,8861,7959,8897,7880"]
];
function decQ(str){const a=str.split(",").map(Number),p=[];for(let i=0;i+1<a.length;i+=2)p.push([a[i]/1e4-2.8,a[i+1]/1e4+48.5]);return p;}
function bboxOf(p){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;p.forEach(function(q){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);});return [x0,y0,x1,y1];}
const LAND=LANDQ.map(decQ), LANDBB=LAND.map(bboxOf);
const HAZA=HAZQ.map(function(h){return {n:h[0],p:decQ(h[1])};});
/* Labels: Minquiers at Maitresse Ile (OSM node 11830474383), Ecrehous at OSM rel 5004601, Little Russell at Brehon Tower (OSM way 522604715). */
const HAZ=[[-2.0619,48.9706,"Minquiers"],[-1.9411,49.2866,"Écréhous"],[-2.4881,49.4713,"Little Russell"]];
const PORTS={spp:{n:"St Peter Port",p:[-2.5233,49.4567]},sark:{n:"Sark",p:[-2.3429,49.4324]},helier:{n:"St Helier",p:[-2.12,49.18]},sablons:{n:"Les Sablons",p:[-2.0285,48.6407]},granville:{n:"Granville",p:[-1.5994,48.8330]},carteret:{n:"Carteret",p:[-1.7819,49.3778]}};
/* WP_STM: Ports of Jersey safe-water WP 6 cables SE of St Martin's Pt light (49 24.87N 2 31.04W). WP_SWM: 2 cables W of SW Minquiers buoy (48 54.34N 2 19.69W).
   SAB_APP: La Plate WP (48 40.80N 2 02.09W), then two points computed from the OSM coastline so the sketch stays in water (not a pilotage line). */
const WP_STM=[-2.5173,49.4145], WP_SWM=[-2.3282,48.9057], SAB_APP=[[-2.0348,48.68],[-2.048,48.657],[-2.029,48.639]];
let WPS=[[-2.5233,49.4567],WP_STM,[-2.45,49.30],[-2.40,49.18],[-2.383,48.995],WP_SWM,[-2.267,48.85],[-2.08,48.72]].concat(SAB_APP,[[-2.0285,48.6407]]);
let FROMN="St Peter Port", TON="Les Sablons", CUM=[0], TOTAL=0;
function nmBetween(a,b){return Math.hypot((b[1]-a[1])*60,(b[0]-a[0])*60*Math.cos((a[1]+b[1])*Math.PI/360));}
function cogBetween(a,b){return (Math.atan2(b[0]-a[0], b[1]-a[1])*180/Math.PI+360)%360;}
function rebuildTrack(){ CUM=[0]; for(let i=1;i<WPS.length;i++) CUM.push(CUM[i-1]+nmBetween(WPS[i-1],WPS[i])); TOTAL=CUM[CUM.length-1]; }
rebuildTrack();
function posAt(nm){nm=Math.max(0,Math.min(TOTAL,nm)); let i=0; while(i<CUM.length-2 && CUM[i+1]<nm) i++; const t=CUM[i+1]===CUM[i]?0:(nm-CUM[i])/(CUM[i+1]-CUM[i]); return {lon:WPS[i][0]+t*(WPS[i+1][0]-WPS[i][0]), lat:WPS[i][1]+t*(WPS[i+1][1]-WPS[i][1]), cog:cogBetween(WPS[i],WPS[i+1])};}
function placeAt(nm){ if(nm<2) return FROMN; if(nm>TOTAL-2) return TON; return "On passage"; }
const SNAP=[{min:360,tws:9.5,twd:285,gust:12,hs:1.46},{min:480,tws:10.2,twd:270,gust:13,hs:1.45},{min:610,tws:11,twd:268,gust:14,hs:1.44},{min:720,tws:12.7,twd:249,gust:15.6,hs:1.42},{min:780,tws:16.2,twd:260,gust:20,hs:1.4},{min:840,tws:16.8,twd:245,gust:20.8,hs:1.38},{min:900,tws:17.9,twd:250,gust:21.9,hs:1.36},{min:1020,tws:19.2,twd:265,gust:23.8,hs:1.32}];
const COLS={orange:{f:"251,146,60",e:"234,88,12",s:"253,186,116"},teal:{f:"45,212,191",e:"251,113,133",s:"148,163,184"},blue:{f:"56,189,248",e:"37,99,235",s:"147,197,253"}};
/* Tides: dated HW/LW events from /api/tides (gov.gg for SPP, SHOM via maree.info for St-Malo, or the labelled
   calibrated model). Minutes are Europe/London wall-clock minutes from today's local midnight. Nothing is
   clamped or extrapolated: outside the events the height is null = "tide data unavailable". */
let TIDE=null;
const SPP="spp", MAL="sablons";
const LDN=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
function ldn(d){const o={};LDN.formatToParts(d).forEach(function(p){o[p.type]=p.value;});return o;}
function dayKey(o){return Date.UTC(+o.year,+o.month-1,+o.day)/864e5;}
function minOf(iso){const d=new Date(iso);if(isNaN(d))return NaN;const o=ldn(d),t=ldn(new Date());return (dayKey(o)-dayKey(t))*1440+(+o.hour)*60+(+o.minute);}
function tport(id){return TIDE&&TIDE.ports?TIDE.ports.find(function(x){return x.id===id;}):null;}
function series(id){const p=tport(id);if(!p||!p.events)return [];const k=dayKey(ldn(new Date()));if(p._s&&p._k===k)return p._s;p._s=p.events.map(function(e){return [minOf(e.utc||e.t),+e.h,e.type,e.src==="model"];}).filter(function(a){return isFinite(a[0])&&isFinite(a[1]);}).sort(function(a,b){return a[0]-b[0];});p._k=k;return p._s;}
function bracket(id,min){const s=series(id);for(let i=0;i<s.length-1;i++){if(s[i][0]<=min&&min<=s[i+1][0])return [s[i],s[i+1]];}return null;}
function tideAt(id,min){const b=bracket(id,min);if(!b)return null;const A=b[0],B=b[1],u=0.5-0.5*Math.cos(Math.PI*(min-A[0])/Math.max(1,B[0]-A[0]));return A[1]+(B[1]-A[1])*u;}
function tideEst(id,min){const b=bracket(id,min);return !!(b&&(b[0][3]||b[1][3]));}
function tideKind(id){const p=tport(id);return p?p.kind:(TIDE?"unavailable":"loading");}
function dayTag(m){return m>=1440?" +1d":(m<0?" -1d":"");}
function nextExt(id,min){const s=series(id);for(let i=0;i<s.length;i++) if(s[i][0]>min) return s[i][2]+" "+hhmm(s[i][0])+dayTag(s[i][0])+" · "+s[i][1].toFixed(1)+" m"+(s[i][3]?" (model est.)":""); return "no data";}
function nearestHW(id,min){let best=null,d=420;series(id).forEach(function(p){if(p[2]==="HW"){const x=Math.abs(p[0]-min);if(x<=d){d=x;best=p;}}});return best;}
function fmtH(v,dp){return v==null?"—":v.toFixed(dp||1)+" m";}
function loadTides(){fetch("/api/tides",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){TIDE=d;dirty=true;}).catch(function(){TIDE=TIDE||{ports:[]};dirty=true;});}
window.__tideAt=tideAt; window.__tideEst=tideEst; window.__tideNext=nextExt; window.__tideKind=tideKind;
let LIVE=null,GPS=null,watch=null,TABLE=null,TABDEP=-1,tileCache={},mapStyle="vector";
const wrap=d=>((d%360)+360)%360;
function cardDir(d){const n=["N","NE","E","SE","S","SW","W","NW"];return n[Math.round(wrap(d)/45)%8];}
function hhmm(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(Math.round(m%60)).padStart(2,"0");}
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes();}
function pip(p,x,y){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
