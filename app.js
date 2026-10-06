/* iMagellan map hooks (loaded by map.html after the map shell). acc1 build.
   Streams: /api/streams (Open-Meteo SMOC 8 km). Each station keeps ONE fixed axis (principal axis of
   its own model data) so arrows never rotate; they flip only through slack. Which half of the axis is
   "flood" comes from the station's known flood set (server field st.flood, see server.py STREAM_FLOOD).
   Tides: read through the map shell's dated feed (window.__tideAt etc. -> /api/tides). */
(function(){
function hh(m){m=((+m%1440)+1440)%1440;var h=Math.floor(m/60),n=Math.floor(m%60);return (h<10?'0':'')+h+':'+(n<10?'0':'')+n;}
function tx(id){var n=document.getElementById(id);return n&&n.textContent?n.textContent.replace(/^\s+|\s+$/g,''):'';}
function parseEta(s,dep){var m=(s||'').match(/(\d{1,2}):(\d{2})/);if(!m)return dep+540;var v=(+m[1])*60+(+m[2]);if(v<dep)v+=1440;return v;}
var CUR=null;
/* Fallback only (older server without st.flood). Same values as server.py STREAM_FLOOD. */
var FLOOD={spp:33,russell:33,race:30,minqw:120,bigruss:17,alderney:34,casquets:24,carteret:332,dielette:355,wjersey:153,helier:99,ecrehous:131,minqe:75,mid:123,sablons:82,granville:60};
function loadStreams(){fetch('/api/streams',{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){if(d&&d.stations){CUR=d;window.__CUR=d;window.__dirty=true;paint();}}).catch(function(){});}
loadStreams();setInterval(loadStreams,15*60*1000);
function adiff(a,b){return Math.abs((((a-b)%360)+540)%360-180);}
function card(d){var n=['N','NE','E','SE','S','SW','W','NW'];return n[Math.round((((d%360)+360)%360)/45)%8];}
function axisOf(st){if(st._ax!=null)return st._ax;var sx=0,sy=0;(st.hours||[]).forEach(function(r){var k=+r.kn||0,d=(+r.dir||0)*Math.PI/90;sx+=k*Math.cos(d);sy+=k*Math.sin(d);});var a=((Math.atan2(sy,sx)*90/Math.PI)%180+180)%180;var fl=(st.flood!=null&&isFinite(+st.flood))?+st.flood:FLOOD[st.id];if(fl!=null){if(adiff(a,fl)>90)a+=180;st._fl=adiff(a%360,fl)<=75;}else st._fl=false;st._ax=a%360;return st._ax;}
function sgnOf(r,ax){return (+r.kn||0)*Math.cos(((+r.dir||0)-ax)*Math.PI/180);}
function rect(st,min){var rows=st&&st.hours;if(!rows||rows.length<2)return null;if(min<rows[0].min-60||min>rows[rows.length-1].min+60)return null;var ax=axisOf(st);var i=0;while(i<rows.length-2&&rows[i+1].min<min)i++;var A=rows[i],B=rows[i+1]||A,t=Math.max(0,Math.min(1,(min-A.min)/Math.max(1,(B.min-A.min)||60)));var v=sgnOf(A,ax)+(sgnOf(B,ax)-sgnOf(A,ax))*t;var kn=Math.abs(v),pos=v>=0,dir=pos?ax:(ax+180)%360;var ph=kn<0.28?'slack':(st._fl?(pos?'flood':'ebb'):(card(dir)+'-going'));return {kn:kn,dir:dir,signed:v,phase:ph};}
function stn(id){if(!CUR||!CUR.stations)return null;return CUR.stations.find(function(x){return x.id===id;})||null;}
function gate(id,label,min){var st=stn(id);if(!st)return label+' no stream data';var row=rect(st,min);if(!row)return label+' no stream data';return label+' '+row.phase+' '+row.kn.toFixed(1)+' kn '+card(row.dir);}
function slider(){var t=document.getElementById('t');return t?+t.value:0;}function mn(m){return typeof m==='number'&&isFinite(m)?m:slider();}
window.__smocAt=function(min){var st=stn('mid');return st?rect(st,min):null;};
window.__smocStn=function(lon,lat,min){if(!CUR||!CUR.stations)return null;var best=null,bd=1e9,cl=Math.cos(lat*Math.PI/180);CUR.stations.forEach(function(st){if(st.id==='spp')return;var d=(st.lon-lon)*(st.lon-lon)*cl*cl+(st.lat-lat)*(st.lat-lat);if(d<bd){bd=d;best=st;}});if(!best)return null;var row=rect(best,mn(min));if(!row)return null;row.id=best.id;return row;};
window.__smocStations=function(min){if(!CUR||!CUR.stations)return [];var m=mn(min),out=[];CUR.stations.forEach(function(st){if(st.id==='spp')return;var r=rect(st,m);if(r)out.push({id:st.id,lon:st.lon,lat:st.lat,kn:r.kn,dir:r.dir,phase:r.phase});});return out;};
window.__streamRect=rect;
function tAt(id,min){return window.__tideAt?window.__tideAt(id,min):null;}
function hAt(id,min){var v=tAt(id,min);if(v==null)return '';return v.toFixed(1)+' m CD'+(window.__tideEst&&window.__tideEst(id,min)?' (model est.)':'');}
function nxt(id,min){return window.__tideNext?window.__tideNext(id,min):'';}
function paint(){var src=document.getElementById('src');var tEl=document.getElementById('t'),depEl=document.getElementById('dep');if(src){var box=document.getElementById('mbrief');if(!box){box=document.createElement('div');box.id='mbrief';box.style.cssText='font-size:11px;color:#d5e2ec;line-height:1.4;padding:4px 0 0';src.parentNode.appendChild(box);}var now=tEl?+tEl.value:0;var a=hAt('spp',now),b=hAt('sablons',now);box.textContent=(a||b)?('Now SPP '+(a||'no data')+'  ·  St-Malo '+(b||'no data')):'Tide data unavailable for this time';}
var sum=document.getElementById('rsum');if(!sum||!sum.parentNode)return;var el=document.getElementById('rbrief');if(!el){el=document.createElement('p');el.id='rbrief';el.className='note';el.style.cssText='white-space:pre-wrap;line-height:1.45';sum.parentNode.insertBefore(el,sum.nextSibling);}
if(!depEl||!tEl){el.textContent='Open Map once so the clocks exist, then come back to Route.';return;}
var dep=+depEl.value,now=+tEl.value,eta=parseEta(tx('eta'),dep);var rf=document.getElementById('rfrom'),rt=document.getElementById('rto');var fn=rf&&rf.options[rf.selectedIndex]?rf.options[rf.selectedIndex].text:'St Peter Port';var tn=rt&&rt.options[rt.selectedIndex]?rt.options[rt.selectedIndex].text:'Les Sablons';var east=document.getElementById('vEJer')&&document.getElementById('vEJer').checked;var side=east?'east-about':'west-about';var other=east?'West-about keeps Jersey to starboard.':'East-about puts you the other side of Jersey and the Minquiers.';
var lines=[];lines.push('Leave '+hh(dep)+' '+side+' from '+fn+' to '+tn+'.');var hs=hAt('spp',dep);lines.push(hs?('Leave SPP '+hs+(nxt('spp',dep)?', next '+nxt('spp',dep):'')+'.'):'Leave SPP: tide data unavailable.');lines.push('At leave: '+gate('russell','Little Russell',dep)+'.');lines.push('+1h '+hh(dep+60)+' '+gate('russell','Russell',dep+60)+'.');lines.push('+3h '+hh(dep+180)+' '+gate('minqw','Minquiers',dep+180)+'.');lines.push('+6h '+hh(dep+360)+' '+gate('minqw','Minquiers',dep+360)+'.');lines.push('Arrive '+hh(eta)+' '+gate('sablons','Sablons',eta)+'.');
var hv=tAt('sablons',eta),ha=hAt('sablons',eta);if(hv!=null){lines.push('Arrive St-Malo '+ha+(nxt('sablons',eta)?', next '+nxt('sablons',eta):'')+'.');var ov=hv-2;lines.push(ov>=0?('Sablons sill +2.0 m CD, so about '+ov.toFixed(1)+' m over the sill.'):('Sablons sill +2.0 m CD: '+Math.abs(ov).toFixed(1)+' m BELOW the sill. Do not plan entry.'));}else{lines.push('Arrive St-Malo: tide data unavailable. Sill check not possible; do not assume the sill is clear.');}
lines.push('Slider '+hh(now)+': '+(tx('who')||'On passage')+', '+tx('left')+' left, wind '+tx('wv')+' '+tx('wg')+'.');lines.push('Why not the other way: '+other);lines.push('Planning sketch. Not a chart. Stream is the 8 km model; tide source shown on the Tides page.');el.textContent=lines.join('\n');}
setTimeout(paint,800);setInterval(paint,1000);
})();
