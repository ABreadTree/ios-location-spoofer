// 与 location-picker/server.js 的 PAGE 保持一致（地图选点 UI）
export const PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>定位选点</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
  .bar{padding:8px;display:flex;gap:6px;box-sizing:border-box}
  .bar input{flex:1;padding:10px;font-size:16px;border:1px solid #ccc;border-radius:8px}
  .bar button{padding:10px 14px;font-size:16px;border:0;border-radius:8px;background:#007aff;color:#fff}
  .results{margin:0 8px;border:1px solid #e2e2e2;border-radius:8px;max-height:34vh;overflow:auto;display:none}
  .results.show{display:block}
  .rrow{padding:10px 12px;font-size:14px;border-bottom:1px solid #eee;color:#222}
  .rrow:last-child{border-bottom:0}
  .rrow:active{background:#f0f6ff}
  #map{height:52vh}
  #info{padding:8px 10px;font-size:13px;line-height:1.4}
  .opts{padding:6px 10px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
  .opts label{font-size:13px;color:#444;display:flex;flex-direction:column}
  .opts input{width:88px;padding:8px;font-size:15px;border:1px solid #ccc;border-radius:6px;margin-top:2px}
  #savebtn{padding:11px 20px;font-size:16px;border:0;border-radius:8px;background:#34c759;color:#fff;font-weight:600}
  #favbtn{padding:11px 16px;font-size:15px;border:0;border-radius:8px;background:#5856d6;color:#fff}
  .schedule{margin:0 10px 12px;border:1px solid #e2e2e2;border-radius:8px;padding:10px;font-size:13px}
  .schedtop{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .schedtop b{flex:1}
  .schedtop button,.schedrow button{border:0;border-radius:6px;padding:7px 9px;color:#fff;background:#007aff}
  .schedrow{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:8px 0;border-top:1px solid #eee}
  .schedrow select{width:130px;padding:7px;border:1px solid #ccc;border-radius:6px;background:#fff}
  .schedrow input[type="time"]{width:95px;padding:6px;border:1px solid #ccc;border-radius:6px}
  .days{display:flex;gap:5px;flex-wrap:wrap}
  .days label{display:flex;gap:2px;align-items:center;color:#444}
  .schedrow button.del{background:#ff3b30}
  .favs{margin:0 10px 12px;border:1px solid #e2e2e2;border-radius:8px;max-height:24vh;overflow:auto}
  .favrow{padding:9px 10px;border-bottom:1px solid #eee;display:flex;gap:8px;align-items:center;font-size:13px}
  .favrow:last-child{border-bottom:0}
  .favrow span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .favrow button{border:0;border-radius:6px;padding:7px 9px;color:#fff;background:#007aff}
  .favrow button.del{background:#ff3b30}
  .toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,.85);color:#fff;padding:10px 16px;border-radius:8px;
    font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:9999}
  .toast.show{opacity:1}
</style>
</head>
<body>
<div class="bar">
  <input id="q" placeholder="搜地名，回车列出候选（只预览，不改定位）">
  <button id="btn">搜</button>
</div>
<div class="results" id="results"></div>
<div id="map"></div>
<div id="info">加载中…</div>
<div class="opts">
  <label>海拔(米)<input id="alt" type="number" inputmode="numeric"></label>
  <label>水平精度<input id="hacc" type="number" inputmode="numeric"></label>
  <label>垂直精度<input id="vacc" type="number" inputmode="numeric"></label>
  <button id="savebtn">保存定位</button>
  <button id="favbtn">收藏当前位置</button>
</div>
<div class="schedule">
  <div class="schedtop"><b>定时开关</b><button id="addschedule">新增</button><button id="saveschedules">保存</button></div>
  <div id="schedules"></div>
</div>
<div class="favs" id="favs"></div>
<div class="toast" id="toast"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var token = new URLSearchParams(location.search).get("token") || "";

var GCJ = (function(){
  var PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323;
  function outOfChina(lat,lng){return (lng<72.004||lng>137.8347)||(lat<0.8293||lat>55.8271);}
  function tLat(x,y){
    var r=-100.0+2.0*x+3.0*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    r+=(20.0*Math.sin(6.0*x*PI)+20.0*Math.sin(2.0*x*PI))*2.0/3.0;
    r+=(20.0*Math.sin(y*PI)+40.0*Math.sin(y/3.0*PI))*2.0/3.0;
    r+=(160.0*Math.sin(y/12.0*PI)+320*Math.sin(y*PI/30.0))*2.0/3.0;return r;
  }
  function tLng(x,y){
    var r=300.0+x+2.0*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    r+=(20.0*Math.sin(6.0*x*PI)+20.0*Math.sin(2.0*x*PI))*2.0/3.0;
    r+=(20.0*Math.sin(x*PI)+40.0*Math.sin(x/3.0*PI))*2.0/3.0;
    r+=(150.0*Math.sin(x/12.0*PI)+300*Math.sin(x/30.0*PI))*2.0/3.0;return r;
  }
  function wgs2gcj(lat,lng){
    if(outOfChina(lat,lng))return [lat,lng];
    var dLat=tLat(lng-105.0,lat-35.0), dLng=tLng(lng-105.0,lat-35.0);
    var radLat=lat/180.0*PI, m=Math.sin(radLat); m=1-ee*m*m; var sm=Math.sqrt(m);
    dLat=(dLat*180.0)/((a*(1-ee))/(m*sm)*PI);
    dLng=(dLng*180.0)/(a/sm*Math.cos(radLat)*PI);
    return [lat+dLat,lng+dLng];
  }
  function gcj2wgs(lat,lng){
    if(outOfChina(lat,lng))return [lat,lng];
    var g=wgs2gcj(lat,lng); return [lat*2-g[0], lng*2-g[1]];
  }
  return {wgs2gcj:wgs2gcj, gcj2wgs:gcj2wgs};
})();

var map, marker;
var WGS = {lat:0, lng:0};
var datum = "gcj";
var saved = true;
var schedules = [];
var favorites = [];

function $(id){return document.getElementById(id);}
function toast(t){var e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(function(){e.classList.remove("show");},1800);}
function numOrNull(id){var v=$(id).value.trim();return v===""?null:Number(v);}

function info(){
  var tag = saved ? "已保存 ✓" : "未保存 · 点“保存定位”生效";
  $("info").innerHTML = "<b style='color:"+(saved?"#34c759":"#ff9500")+"'>"+tag+"</b>　WGS-84 "+
    WGS.lat.toFixed(5)+", "+WGS.lng.toFixed(5)+"　海拔 "+($("alt").value||"?")+"m";
}

function defaultSchedule(){
  return {id:String(Date.now()), enabled:true, start:"09:00", end:"17:00", days:[1,2,3,4,5]};
}

function locFromFav(f){
  if(!f)return null;
  var loc={latitude:Number(f.latitude), longitude:Number(f.longitude)};
  ["altitude","horizontalAccuracy","verticalAccuracy"].forEach(function(k){ if(f[k]!==undefined)loc[k]=Number(f[k]); });
  return isFinite(loc.latitude)&&isFinite(loc.longitude)?loc:null;
}

function locFromCurrent(){
  return {latitude:WGS.lat, longitude:WGS.lng, altitude:numOrNull("alt"), horizontalAccuracy:numOrNull("hacc"), verticalAccuracy:numOrNull("vacc")};
}

function syncScheduleLocation(s, favId){
  if(favId==="__current"){ s.favoriteId=""; s.favoriteName="当前定位"; s.location=locFromCurrent(); return; }
  var f=favorites.filter(function(x){return String(x.id)===String(favId);})[0];
  if(f){ s.favoriteId=String(f.id); s.favoriteName=f.name||"收藏位置"; s.location=locFromFav(f); }
}

function cleanSchedules(){
  return schedules.map(function(s, i){
    var days=Array.isArray(s.days)?s.days.map(Number).filter(function(d, idx, a){return d>=1&&d<=7&&a.indexOf(d)===idx;}):[];
    var out={id:String(s.id||Date.now()+"-"+i), enabled:s.enabled!==false, start:s.start||"09:00", end:s.end||"17:00", days:days};
    if(s.favoriteId)out.favoriteId=String(s.favoriteId);
    if(s.favoriteName)out.favoriteName=String(s.favoriteName);
    if(s.location)out.location=s.location;
    return out;
  });
}

function renderSchedules(){
  var box=$("schedules"); box.innerHTML="";
  if(!schedules.length){ var empty=document.createElement("div"); empty.className="schedrow"; empty.textContent="未设置定时，沿用启用状态"; box.appendChild(empty); return; }
  schedules.forEach(function(s, idx){
    var row=document.createElement("div"), on=document.createElement("input"), fav=document.createElement("select"), start=document.createElement("input"), end=document.createElement("input"), days=document.createElement("div"), del=document.createElement("button");
    row.className="schedrow"; on.type="checkbox"; on.checked=s.enabled!==false; on.onchange=function(){s.enabled=on.checked;};
    [{id:"__current",name:"沿用当前定位"}].concat(favorites).forEach(function(f){
      var opt=document.createElement("option"); opt.value=String(f.id); opt.textContent=f.name||"收藏位置"; fav.appendChild(opt);
    });
    if(s.favoriteId && !favorites.some(function(f){return String(f.id)===String(s.favoriteId); })){
      var old=document.createElement("option"); old.value=String(s.favoriteId); old.textContent=s.favoriteName||"已保存定位"; fav.appendChild(old);
    }
    fav.value=s.favoriteId?String(s.favoriteId):"__current";
    fav.onchange=function(){ syncScheduleLocation(s, fav.value); };
    start.type="time"; start.value=s.start||"09:00"; start.onchange=function(){s.start=start.value;};
    end.type="time"; end.value=s.end||"17:00"; end.onchange=function(){s.end=end.value;};
    days.className="days";
    ["一","二","三","四","五","六","日"].forEach(function(label, i){
      var wrap=document.createElement("label"), cb=document.createElement("input"), day=i+1;
      cb.type="checkbox"; cb.checked=Array.isArray(s.days)&&s.days.map(Number).indexOf(day)>=0;
      cb.onchange=function(){ var set=Array.isArray(s.days)?s.days.map(Number):[]; if(cb.checked&&set.indexOf(day)<0)set.push(day); if(!cb.checked)set=set.filter(function(d){return d!==day;}); s.days=set; };
      wrap.appendChild(cb); wrap.appendChild(document.createTextNode(label)); days.appendChild(wrap);
    });
    del.textContent="删除"; del.className="del"; del.onclick=function(){schedules.splice(idx,1); renderSchedules();};
    row.appendChild(on); row.appendChild(fav); row.appendChild(start); row.appendChild(end); row.appendChild(days); row.appendChild(del); box.appendChild(row);
  });
}

function saveSchedules(){
  schedules.forEach(function(s){ if(!s.location) syncScheduleLocation(s, s.favoriteId || "__current"); });
  schedules=cleanSchedules();
  fetch("/schedule?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({schedules:schedules})})
    .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(d){ schedules=Array.isArray(d.schedules)?d.schedules:[]; renderSchedules(); toast("定时已保存"); })
    .catch(function(){ toast("定时保存失败"); });
}

function favPayload(){
  return {lat:WGS.lat, lng:WGS.lng, altitude:numOrNull("alt"),
    horizontalAccuracy:numOrNull("hacc"), verticalAccuracy:numOrNull("vacc")};
}

function renderFavs(a){
  var box=$("favs"); box.innerHTML="";
  if(!a||!a.length){ box.innerHTML="<div class='favrow'><span>暂无收藏位置</span></div>"; return; }
  a.forEach(function(f){
    var row=document.createElement("div"), name=document.createElement("span"), use=document.createElement("button"), del=document.createElement("button");
    row.className="favrow";
    name.textContent=f.name+" · "+Number(f.latitude).toFixed(5)+", "+Number(f.longitude).toFixed(5);
    use.textContent="载入"; del.textContent="删除"; del.className="del";
    use.onclick=function(){
      WGS={lat:Number(f.latitude), lng:Number(f.longitude)};
      ["altitude","horizontalAccuracy","verticalAccuracy"].forEach(function(k){ var id={altitude:"alt",horizontalAccuracy:"hacc",verticalAccuracy:"vacc"}[k]; if(f[k]!==undefined)$(id).value=f[k]; });
      var p=dispPos(); marker.setLatLng(p); map.setView(p,15); saved=false; info(); toast("已载入收藏，点保存定位生效");
    };
    del.onclick=function(){ fetch("/favorites/"+encodeURIComponent(f.id)+"?token="+encodeURIComponent(token),{method:"DELETE"}).then(function(r){return r.json();}).then(function(a){favorites=Array.isArray(a)?a:[]; renderFavs(favorites); renderSchedules();}).catch(function(){toast("删除失败");}); };
    row.appendChild(name); row.appendChild(use); row.appendChild(del); box.appendChild(row);
  });
}

function loadFavs(){ fetch("/favorites?token="+encodeURIComponent(token)).then(function(r){return r.json();}).then(function(a){favorites=Array.isArray(a)?a:[]; renderFavs(favorites); renderSchedules();}).catch(function(){favorites=[]; renderFavs([]); renderSchedules();}); }

function addFav(){
  var name=prompt("收藏名称", "位置 "+new Date().toLocaleString()); if(name===null) return;
  var p=favPayload(); p.name=name;
  fetch("/favorites?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)})
    .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(a){favorites=Array.isArray(a)?a:[]; renderFavs(favorites); renderSchedules(); toast("已收藏");}).catch(function(){toast("收藏失败");});
}

function dispPos(){return datum==="gcj"?GCJ.wgs2gcj(WGS.lat,WGS.lng):[WGS.lat,WGS.lng];}
function toWgs(lat,lng){return datum==="gcj"?GCJ.gcj2wgs(lat,lng):[lat,lng];}

function fetchElevation(lat,lng){
  return fetch("https://api.open-meteo.com/v1/elevation?latitude="+lat+"&longitude="+lng)
    .then(function(r){return r.json();})
    .then(function(d){return (d&&d.elevation&&d.elevation.length)?d.elevation[0]:null;})
    .catch(function(){return null;});
}

function movePin(dispLat,dispLng){
  var w=toWgs(dispLat,dispLng);
  WGS={lat:w[0], lng:w[1]};
  saved=false;
  marker.setLatLng([dispLat,dispLng]);
  info();
  fetchElevation(WGS.lat,WGS.lng).then(function(el){ if(el!==null)$("alt").value=Math.round(el); info(); });
}

function commit(){
  var payload={lat:WGS.lat, lng:WGS.lng,
    altitude:numOrNull("alt"), horizontalAccuracy:numOrNull("hacc"), verticalAccuracy:numOrNull("vacc")};
  fetch("/set?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    .then(function(r){ if(r.ok){ saved=true; info(); toast("已保存 ✓ Loon/小火箭约60秒内生效"); } else { toast("保存失败 "+r.status); } })
    .catch(function(){ toast("网络错误"); });
}

function search(){
  var q=$("q").value.trim(); if(!q) return;
  fetch("https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=8&q="+encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(a){
      var box=$("results"); box.innerHTML="";
      if(!a||!a.length){ box.classList.remove("show"); toast("没找到"); return; }
      a.forEach(function(it){
        var row=document.createElement("div");
        row.className="rrow";
        row.textContent=it.display_name;
        row.addEventListener("click",function(){
          box.classList.remove("show"); box.innerHTML="";
          var la=+it.lat, lo=+it.lon;
          var p = datum==="gcj"?GCJ.wgs2gcj(la,lo):[la,lo];
          map.setView(p,15);
          toast("已定位视野，在地图上点一下放置图钉");
        });
        box.appendChild(row);
      });
      box.classList.add("show");
    })
    .catch(function(){toast("搜索失败");});
}

function load(){
  fetch("/loc.json?token="+encodeURIComponent(token)).then(function(r){return r.json();}).then(function(d){
    WGS={lat:d.latitude, lng:d.longitude};
    saved=true;
    schedules=Array.isArray(d.schedules)?d.schedules:[];
    $("alt").value=(d.altitude!==undefined?d.altitude:"");
    $("hacc").value=(d.horizontalAccuracy!==undefined?d.horizontalAccuracy:39);
    $("vacc").value=(d.verticalAccuracy!==undefined?d.verticalAccuracy:1000);

    var amapVec=L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7",{subdomains:"1234",maxZoom:18,attribution:"高德地图"});
    amapVec.datum="gcj";
    var amapSat=L.layerGroup([
      L.tileLayer("https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",{subdomains:"1234",maxZoom:18}),
      L.tileLayer("https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8",{subdomains:"1234",maxZoom:18})
    ]);
    amapSat.datum="gcj";
    var osm=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});
    osm.datum="wgs";

    map=L.map("map");
    amapVec.addTo(map); datum="gcj";
    map.setView(dispPos(),13);
    L.control.layers({"高德地图":amapVec,"高德卫星":amapSat,"国外 OSM":osm},null,{collapsed:false}).addTo(map);

    marker=L.marker(dispPos(),{draggable:true}).addTo(map);
    info();

    map.on("baselayerchange",function(e){datum=e.layer.datum||"wgs"; var p=dispPos(); marker.setLatLng(p); map.setView(p,map.getZoom()); info();});
    map.on("click",function(e){movePin(e.latlng.lat,e.latlng.lng);});
    marker.on("dragend",function(){var p=marker.getLatLng(); movePin(p.lat,p.lng);});
    loadFavs();
  }).catch(function(){$("info").textContent="加载失败，检查 token 是否正确";});
}

$("btn").addEventListener("click",search);
$("q").addEventListener("keydown",function(e){if(e.key==="Enter")search();});
$("savebtn").addEventListener("click",commit);
$("favbtn").addEventListener("click",addFav);
$("addschedule").addEventListener("click",function(){schedules.push(defaultSchedule()); renderSchedules();});
$("saveschedules").addEventListener("click",saveSchedules);
load();
</script>
</body>
</html>`;
