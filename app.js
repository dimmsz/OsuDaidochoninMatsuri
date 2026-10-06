const SUPABASE_URL = "https://pwtmblzenkxrilvsesak.supabase.co";
const SUPABASE_KEY = "sb_publishable_1xXRoGWj2Kz-mIlUB_AvWw_Ge8odQN_";
const $ = (s) => document.querySelector(s);
let events = [], venues = [], venueMap = null, venueMarkers = [], venueMarkerById = new Map();
const favs = new Set(JSON.parse(localStorage.getItem("osu-favorites") || "[]"));

async function api(table, params="") {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + params, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
  });
  if (!r.ok) throw Error(table + ": " + r.status);
  return r.json();
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function dateKey(d=new Date()) {
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function mins(t) { if(!t) return null; const a=t.slice(0,5).split(":").map(Number); return a[0]*60+a[1]; }
function start(e) { return mins(e.start_time); }
function end(e) { return e.end_time ? mins(e.end_time) : start(e)+(Number(e.duration_minutes)||30); }
function status(e,d=new Date()) {
  if(e.event_date!==dateKey(d)) return "other";
  const n=d.getHours()*60+d.getMinutes()+d.getSeconds()/60, s=start(e);
  return n>=s && n<end(e) ? "live" : n<s ? "next" : "done";
}
function unique(a) {
  const m=new Map();
  for(const e of a) {
    const k=[e.event_date,e.start_time,e.performer||e.title].join("|");
    if(!m.has(k) || (e.notes && !m.get(k).notes)) m.set(k,e);
  }
  return [...m.values()];
}
function card(e,now=false) {
  const v=venues.find(x=>x.id===e.venue_id);
  const t=e.start_time?.slice(0,5)||"";
  const en=e.end_time ? "–"+e.end_time.slice(0,5) : (e.duration_minutes||30)+"分";
  const fav=favs.has(e.id);
  return '<article class="event '+(now?"event-now":"")+'"><div class="event-time">'+t+'<small>'+en+'</small></div><div><div class="event-title">'+esc(e.title)+'</div>'+
    (now?'<span class="live-pill">● 開催中</span>':status(e)==="next"?'<span class="next-pill">このあと</span>':"")+
    '<div class="meta">📍 '+esc(v?.name||"会場未定")+'</div>'+
    (e.performer&&e.title!==e.performer?'<div class="performer">'+esc(e.performer)+'</div>':"")+
    '</div><button class="fav '+(fav?"on":"")+'" data-fav="'+e.id+'">'+(fav?"★":"☆")+'</button></article>';
}
function renderNow() {
  const d=new Date();
  $("#nowClock").textContent=d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
  $("#nowDate").textContent=d.toLocaleDateString("ja-JP",{month:"numeric",day:"numeric",weekday:"short"});
  const today=unique(events.filter(e=>e.event_date===dateKey(d)));
  const live=today.filter(e=>status(e,d)==="live");
  const next=today.filter(e=>status(e,d)==="next").sort((a,b)=>start(a)-start(b)).slice(0,6);
  $("#nowSection").innerHTML=live.length?'<div class="now-label">🟢 いま開催中</div>'+live.map(e=>card(e,true)).join(""):'<div class="empty"><strong>いま開催中の登録イベントはありません</strong><br><small>次のイベントを確認しよう。</small></div>';
  $("#nextList").innerHTML=next.length?next.map(e=>card(e)).join(""):'<div class="empty">このあとの登録イベントはありません。</div>';
  $("#todayList").innerHTML=today.length?today.sort((a,b)=>start(a)-start(b)).map(e=>card(e)).join(""):'<div class="empty">今日は祭りの登録イベント日ではありません。</div>';
  bindFavs();
}
function renderVenueFilter() {
  const select=$("#venueFilter");
  if(!select) return;
  const current=select.value;
  const names=[...venues].sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
  select.innerHTML='<option value="">すべての会場</option>'+names.map(v=>'<option value="'+v.id+'">'+esc(v.name)+'</option>').join("");
  if(names.some(v=>String(v.id)===current)) select.value=current;
}
function renderSchedule() {
  const d=$("#dateFilter").value;
  const venueId=$("#venueFilter").value;
  const a=unique(events.filter(e=>(!d||e.event_date===d)&&(!venueId||String(e.venue_id)===venueId)))
    .sort((x,y)=>(x.event_date+x.start_time).localeCompare(y.event_date+y.start_time));
  $("#scheduleList").innerHTML=a.length?a.map(card).join(""):'<div class="empty">この条件のイベントはありません。</div>';
  bindFavs();
}
function renderVenues() {
  const ordered=[...venues].sort((a,b)=>(a.sort_order??999)-(b.sort_order??999));
  const venueNumbers=new Map(ordered.map((v,i)=>[v.id,i+1]));
  const mapped=ordered.filter(v=>v.latitude!=null&&v.longitude!=null);
  if(window.L && mapped.length){
    if(!venueMap){
      venueMap=L.map("venueMap",{scrollWheelZoom:false}).setView([35.1597,136.9020],16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(venueMap);
    }
    venueMarkers.forEach(m=>m.remove());
    venueMarkers=[];
    venueMarkerById=new Map();
    const bounds=[];
    mapped.forEach(v=>{
      const n=venueNumbers.get(v.id);
      const icon=L.divIcon({className:"venue-number-icon",html:"<span>"+n+"</span>",iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-17]});
      const m=L.marker([Number(v.latitude),Number(v.longitude)],{icon,title:v.name}).addTo(venueMap).bindPopup("<strong>"+n+". "+esc(v.name)+"</strong>");
      m.on("click",()=>highlightVenue(v.id));
      venueMarkers.push(m); venueMarkerById.set(v.id,m); bounds.push([Number(v.latitude),Number(v.longitude)]);
    });
    if(bounds.length) venueMap.fitBounds(bounds,{padding:[24,24]});
    setTimeout(()=>venueMap.invalidateSize(),50);
  }
  $("#venueList").innerHTML=ordered.map((v,i)=>'<article class="venue" id="venue-'+v.id+'" data-venue-id="'+v.id+'"><div class="pin">'+(i+1)+'</div><div><h3>'+esc(v.name)+'</h3><p>'+esc(v.description||"")+'</p></div></article>').join("");
  document.querySelectorAll("[data-venue-id]").forEach(el=>el.onclick=()=>{
    const id=Number(el.dataset.venueId), marker=venueMarkerById.get(id);
    if(marker && venueMap){ venueMap.setView(marker.getLatLng(),Math.max(venueMap.getZoom(),17),{animate:true}); marker.openPopup(); }
    highlightVenue(id);
  });
}
function highlightVenue(id){
  document.querySelectorAll(".venue").forEach(el=>el.classList.toggle("selected",Number(el.dataset.venueId)===Number(id)));
  const el=$("#venue-"+id); if(el) el.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function renderFavorites() {
  const a=unique(events.filter(e=>favs.has(e.id)));
  $("#favoriteList").innerHTML=a.length?a.map(card).join(""):'<div class="empty">お気に入りはまだありません。</div>';
  bindFavs();
}
function bindFavs() {
  document.querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>{
    const id=Number(b.dataset.fav);
    favs.has(id)?favs.delete(id):favs.add(id);
    localStorage.setItem("osu-favorites",JSON.stringify([...favs]));
    renderNow(); renderSchedule(); renderFavorites();
  });
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===b.dataset.page));
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n===b));
  if(b.dataset.page==="schedule")renderSchedule();
  if(b.dataset.page==="venues")renderVenues();
  if(b.dataset.page==="favorites")renderFavorites();
});
$("#dateFilter").onchange=renderSchedule;
$("#venueFilter").onchange=renderSchedule;
$("#refreshBtn").onclick=load;
async function load() {
  try {
    const f=await api("festivals","select=id&name=eq.%E7%AC%AC47%E5%9B%9E%20%E5%A4%A7%E9%A0%88%E5%A4%A7%E9%81%93%E7%94%BA%E4%BA%BA%E7%A5%AD&limit=1");
    const id=f[0]?.id;
    if(!id) throw Error("festival not found");
    [venues,events]=await Promise.all([
      api("venues","select=*&festival_id=eq."+id+"&order=sort_order"),
      api("events","select=*&festival_id=eq."+id+"&order=event_date,start_time,sort_order")
    ]);
    events=unique(events);
    renderVenueFilter();
    renderNow(); renderSchedule(); renderVenues();
  } catch(e) {
    console.error(e);
    $("#nowSection").innerHTML='<div class="empty">データを読み込めませんでした。<br><small>'+esc(e.message)+'</small></div>';
  }
}
load();
setInterval(renderNow,30000);
