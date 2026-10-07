const SUPABASE_URL = "https://pwtmblzenkxrilvsesak.supabase.co";
const SUPABASE_KEY = "sb_publishable_1xXRoGWj2Kz-mIlUB_AvWw_Ge8odQN_";
const FESTIVAL_NAME = "第47回 大須大道町人祭";
const $ = s => document.querySelector(s);

let performers = [];
let events = [];
let venues = [];
let links = [];
let linksByPerformer = new Map();

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
function venueName(e){ return venues.find(v=>Number(v.id)===Number(e.venue_id))?.name || "会場未定"; }

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

function showDetail(id){
  const p=performers.find(x=>Number(x.id)===Number(id));
  if(!p) return;
  const ids=new Set((linksByPerformer.get(Number(id))||[]).map(x=>Number(x.event_id)));
  const schedule=events.filter(e=>ids.has(Number(e.id)))
    .sort((a,b)=>(a.event_date+a.start_time).localeCompare(b.event_date+b.start_time));

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
  $("#performerSchedule").innerHTML=schedule.length?schedule.map(e=>
    '<a class="performer-event" href="./?event='+encodeURIComponent(e.id)+'">'+
      '<div class="performer-event-date">'+dateText(e.event_date)+'<strong>'+esc(timeText(e))+'</strong></div>'+
      '<div class="performer-event-main"><div class="event-title">'+esc(e.title||e.performer||"")+'</div><div class="meta">📍 '+esc(venueName(e))+'</div></div>'+
    '</a>'
  ).join(""):'<div class="empty">出演スケジュールが登録されていません。</div>';
  window.scrollTo({top:0,behavior:"smooth"});
}

$("#performerKeyword").oninput=renderList;
$("#performerGenre").onchange=renderList;
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