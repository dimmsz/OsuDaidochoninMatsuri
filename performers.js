const SUPABASE_URL = "https://pwtmblzenkxrilvsesak.supabase.co";
const SUPABASE_KEY = "sb_publishable_1xXRoGWj2Kz-mIlUB_AvWw_Ge8odQN_";
const FESTIVAL_NAME = "第47回 大須大道町人祭";
const $ = s => document.querySelector(s);

let performers = [];
let events = [];
let venues = [];
let links = [];
let linksByPerformer = new Map();
const favs = new Set(JSON.parse(localStorage.getItem("osu-favorites") || "[]"));

async function api(table, params="") {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + params, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
  });
  if (!r.ok) throw Error(table + ": " + r.status);
  return r.json();
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function dateText(s){
  if(!s) return "";
  const [y,m,d]=s.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("ja-JP",{month:"numeric",day:"numeric",weekday:"short"});
}
function timeText(e){
  const st=e.start_time?.slice(0,5)||"";
  const en=e.end_time?.slice(0,5);
  return en ? st+"–"+en : st;
}
function venueName(e){
  const type=e.location_type||"fixed";
  if(type==="roaming") return "🌀 "+(e.location_label||"ロービング");
  if(type==="route") return "↔ "+(e.location_label||"移動演目");
  const v=venues.find(v=>Number(v.id)===Number(e.venue_id));
  return "📍 "+(v?.name||"会場未定")+(e.venue_section?"・"+e.venue_section:"");
}

function genreOptions(){
  const genres=[...new Set(performers.map(p=>p.genre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));
  const s=$("#performerGenre");
  s.innerHTML='<option value="">すべて</option>'+genres.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join("");
}

function performerCard(p){
  const n=linksByPerformer.get(Number(p.id))?.length||0;
  return '<button class="performer-card" type="button" data-performer-id="'+p.id+'">'+
    '<div class="performer-card-main">'+
      '<div class="performer-name">'+esc(p.name)+'</div>'+
      (p.genre?'<div class="performer-genre">'+esc(p.genre)+'</div>':"")+
    '</div>'+
    '<div class="performer-count">'+n+'件<span>›</span></div>'+
  '</button>';
}

function renderList(){
  const q=$("#performerKeyword").value.trim().toLocaleLowerCase("ja-JP");
  const g=$("#performerGenre").value;
  const list=performers.filter(p=>{
    if(g && p.genre!==g) return false;
    if(q && ![p.name,p.genre,p.description].filter(Boolean).join(" ").toLocaleLowerCase("ja-JP").includes(q)) return false;
    return true;
  }).sort((a,b)=>a.name.localeCompare(b.name,"ja"));
  $("#performerCount").textContent=list.length+"組";
  $("#performerList").innerHTML=list.length?list.map(performerCard).join(""):'<div class="empty">条件に一致する出演者はいません。</div>';
  document.querySelectorAll("[data-performer-id]").forEach(b=>b.onclick=()=>showDetail(Number(b.dataset.performerId)));
}

function socialLinks(p){
  const out=[];
  if(p.official_url) out.push('<a class="performer-link official" href="'+esc(p.official_url)+'" target="_blank" rel="noopener noreferrer">公式サイト</a>');
  if(p.x_url) out.push('<a class="performer-link x" href="'+esc(p.x_url)+'" target="_blank" rel="noopener noreferrer">X</a>');
  if(p.instagram_url) out.push('<a class="performer-link instagram" href="'+esc(p.instagram_url)+'" target="_blank" rel="noopener noreferrer">Instagram</a>');
  if(p.profile_url) out.push('<a class="performer-link" href="'+esc(p.profile_url)+'" target="_blank" rel="noopener noreferrer">プロフィール</a>');
  return out.length?'<div class="performer-links">'+out.join("")+'</div>':"";
}

function performerSchedule(id){
  const ids=new Set((linksByPerformer.get(Number(id))||[]).map(x=>Number(x.event_id)));
  return events.filter(e=>ids.has(Number(e.id)))
    .sort((a,b)=>(a.event_date+a.start_time).localeCompare(b.event_date+b.start_time));
}

function updateBulkFavoriteButton(schedule){
  const button=$("#performerBulkFavorite");
  if(!button) return;
  if(!schedule.length){
    button.disabled=true;
    button.textContent="☆ 一括お気に入り登録";
    return;
  }
  button.disabled=false;
  const allFav=schedule.every(e=>favs.has(Number(e.id)));
  button.textContent=allFav?"★ 一括お気に入り解除":"☆ 一括お気に入り登録";
}

function showDetail(id){
  const p=performers.find(x=>Number(x.id)===Number(id));
  if(!p) return;
  const schedule=performerSchedule(Number(id));
  updateBulkFavoriteButton(schedule);

  $("#performerIndex").hidden=true;
  $("#performerDetail").hidden=false;
  $("#performerProfile").innerHTML=
    '<div class="performer-profile-card">'+
      '<div class="eyebrow dark">出演者</div>'+
      '<h2>'+esc(p.name)+'</h2>'+
      (p.genre?'<div class="performer-profile-genre">'+esc(p.genre)+'</div>':"")+
      (p.description?'<p class="performer-description">'+esc(p.description)+'</p>':"")+
      socialLinks(p)+
    '</div>';
  $("#performerSchedule").innerHTML=schedule.length?schedule.map(e=>{
    const isFav=favs.has(Number(e.id));
    const title=e.title||e.performer||"";
    const performer=e.performer && e.title!==e.performer ? e.performer : "";
    return '<article class="event performer-schedule-card">'+
      '<div class="event-time"><div class="event-date-label">'+esc(dateText(e.event_date))+'</div>'+esc(timeText(e))+'</div>'+
      '<div>'+
        '<div class="event-title">'+esc(title)+'</div>'+
        (performer?'<div class="event-subtitle">'+esc(performer)+'</div>':"")+
        '<div class="meta">'+esc(venueName(e))+'</div>'+
      '</div>'+
      '<button type="button" class="fav '+(isFav?"on":"")+'" data-fav="'+e.id+'" aria-label="お気に入り">'+(isFav?"★":"☆")+'</button>'+
    '</article>';
  }).join(""):'<div class="empty">出演スケジュールが登録されていません。</div>';
  document.querySelectorAll("#performerSchedule [data-fav]").forEach(b=>b.onclick=ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    const id=Number(b.dataset.fav);
    favs.has(id)?favs.delete(id):favs.add(id);
    localStorage.setItem("osu-favorites",JSON.stringify([...favs]));
    showDetail(Number(p.id));
  });
  const allIds=(linksByPerformer.get(Number(p.id))||[]).map(x=>Number(x.event_id));
  const allFav=allIds.length>0 && allIds.every(eventId=>favs.has(eventId));
  $("#favoriteAllBtn").textContent=allFav ? "★ すべてお気に入り解除" : "☆ すべてお気に入り";
  window.scrollTo({top:0,behavior:"smooth"});
}

$("#performerBulkFavorite").onclick=()=>{
  const params=new URLSearchParams(location.search);
  const id=Number(params.get("id"));
  if(!id) return;
  const schedule=performerSchedule(id);
  if(!schedule.length) return;
  const allFav=schedule.every(e=>favs.has(Number(e.id)));
  for(const e of schedule){
    const eventId=Number(e.id);
    allFav?favs.delete(eventId):favs.add(eventId);
  }
  localStorage.setItem("osu-favorites",JSON.stringify([...favs]));
  showDetail(id);
};

$("#performerKeyword").oninput=renderList;
$("#performerGenre").onchange=renderList;
$("#favoriteAllBtn").onclick=()=>{
  const p=performers.find(x=>Number(x.id)===Number(new URLSearchParams(location.search).get("id")));
  if(!p) return;
  const eventIds=(linksByPerformer.get(Number(p.id))||[]).map(x=>Number(x.event_id));
  const allFav=eventIds.length>0 && eventIds.every(id=>favs.has(id));
  eventIds.forEach(id=>allFav?favs.delete(id):favs.add(id));
  localStorage.setItem("osu-favorites",JSON.stringify([...favs]));
  showDetail(Number(p.id));
};

$("#performerBack").onclick=()=>{
  $("#performerDetail").hidden=true;
  $("#performerIndex").hidden=false;
  window.scrollTo({top:0,behavior:"smooth"});
};

async function load(){
  try{
    const f=await api("festivals","select=id&name=eq."+encodeURIComponent(FESTIVAL_NAME)+"&limit=1");
    const id=f[0]?.id;
    if(!id) throw Error("festival not found");
    [performers,events,venues,links]=await Promise.all([
      api("performers","select=*&order=name"),
      api("events","select=*&festival_id=eq."+id+"&order=event_date,start_time,sort_order"),
      api("venues","select=id,name&festival_id=eq."+id+"&order=sort_order"),
      api("event_performers","select=event_id,performer_id,sort_order&order=performer_id,sort_order")
    ]);
    linksByPerformer=new Map();
    for(const row of links){
      const k=Number(row.performer_id);
      if(!linksByPerformer.has(k)) linksByPerformer.set(k,[]);
      linksByPerformer.get(k).push(row);
    }
    genreOptions();
    renderList();
    const params=new URLSearchParams(location.search);
    const selected=Number(params.get("id"));
    if(selected) showDetail(selected);
  }catch(e){
    console.error(e);
    $("#performerList").innerHTML='<div class="empty">出演者データを読み込めませんでした。<br><small>'+esc(e.message)+'</small></div>';
  }
}
load();