(function(){
function hh(m){m=((+m%1440)+1440)%1440;var h=Math.floor(m/60),n=Math.floor(m%60);return (h<10?'0':'')+h+':'+(n<10?'0':'')+n;}
function dayName(off){var d=new Date(Date.now()+off*86400000);var o={};new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short'}).formatToParts(d).forEach(function(p){o[p.type]=p.value;});return (o.weekday||'')+' '+(o.day||'')+' '+(o.month||'');}
function stamp(m){var off=Math.floor(Math.max(0,+m)/1440);if(off>1)off=1;return dayName(off)+' '+hh(m);}
function setTime(m){var t=document.getElementById('t');if(!t)return;var lo=+t.min||0,hi=+t.max||2159;if(m<lo)m=lo;if(m>hi)m=hi;t.value=Math.round(m);try{t.dispatchEvent(new Event('input'));}catch(e){}}
function addTideScale(){
  var c=document.getElementById('tg');
  if(!c||c.dataset.ax)return;
  c.dataset.ax='1';
  var parent=c.parentNode;
  if(!parent)return;
  var top=document.createElement('div');
  top.style.cssText='display:flex;justify-content:space-between;font-size:10px;color:#9bb0c3;padding:2px 0';
  top.innerHTML='<span>10 m CD</span><span>teal SPP · orange St-Malo</span><span>0 m</span>';
  parent.insertBefore(top,c);
  var bar=document.createElement('div');
  bar.style.cssText='display:flex;justify-content:space-between;font-size:10px;color:#9bb0c3;padding:2px 0';
  [dayName(0)+' 00',dayName(0)+' 12',dayName(1)+' 00',dayName(1)+' 12'].forEach(function(l){var s=document.createElement('span');s.textContent=l;bar.appendChild(s);});
  if(c.nextSibling)parent.insertBefore(bar,c.nextSibling);else parent.appendChild(bar);
  var tip=document.getElementById('tgTip');
  if(!tip){tip=document.createElement('div');tip.id='tgTip';tip.style.cssText='font-size:11px;color:#e6b35a;min-height:16px';parent.insertBefore(tip,bar.nextSibling);}
}
function bindScrub(){
  var c=document.getElementById('tg');
  if(!c||c.dataset.sc)return;
  c.dataset.sc='1';
  c.style.cursor='crosshair';
  function at(ev){
    var r=c.getBoundingClientRect();
    var u=(ev.clientX-r.left)/Math.max(1,r.width);
    if(u<0)u=0;if(u>1)u=1;
    var m=u*2160;
    setTime(m);
    var tip=document.getElementById('tgTip');
    var spp=document.getElementById('sppNow'),mal=document.getElementById('malNow');
    if(tip)tip.textContent=stamp(m)+(spp?('  SPP '+(spp.textContent||'')+'  St-Malo '+((mal&&mal.textContent)||'')):'');
  }
  c.addEventListener('mousemove',at);
  c.addEventListener('click',at);
}
function boot(){addTideScale();bindScrub();}
setTimeout(boot,1600);
})();
