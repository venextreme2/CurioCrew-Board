const C={planned:["Запланировано","planned"],doing:["В разработке","doing"],done:["СДЕЛАНО","done"],cancelled:["Не делаем","cancelled"]};
const STATUS_ORDER={doing:0,planned:1,done:2,cancelled:3};
const sb=supabase.createClient(window.CURIOCREW_CONFIG.supabaseUrl,window.CURIOCREW_CONFIG.supabaseAnonKey);
let tasks=[],filter="all",sort="newest",page=1,pageSize=10;
const $=s=>document.querySelector(s);

async function load(){
  const {data,error}=await sb.from("tasks").select("*");
  if(error){$("#connection").textContent="Ошибка подключения";console.error(error);return}
  tasks=data||[];
  $("#connection").textContent="Общий режим • синхронизация включена";
  render();
}

function sortedTasks(){
  const list=tasks.filter(t=>filter==="all"||t.status===filter).slice();
  const byTitle=(a,b)=>(a.title||"").localeCompare(b.title||"","ru",{sensitivity:"base"});
  list.sort((a,b)=>{
    if(sort==="oldest")return new Date(a.created_at)-new Date(b.created_at);
    if(sort==="title-asc")return byTitle(a,b);
    if(sort==="title-desc")return byTitle(b,a);
    if(sort==="status"){
      const statusDiff=(STATUS_ORDER[a.status]??99)-(STATUS_ORDER[b.status]??99);
      return statusDiff||new Date(b.created_at)-new Date(a.created_at);
    }
    return new Date(b.created_at)-new Date(a.created_at);
  });
  return list;
}

function render(){
  const root=$("#tasks");root.innerHTML="";
  const list=sortedTasks();
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  page=Math.min(Math.max(page,1),totalPages);
  const start=(page-1)*pageSize;
  const shown=list.slice(start,start+pageSize);

  shown.forEach(t=>{
    const a=document.createElement("article");a.className="card";
    const [txt,cls]=C[t.status]||C.planned;
    a.innerHTML=`<div class="top"><span class="pill ${cls}">${txt}</span><button class="edit">Изменить</button></div><h3></h3><p></p>${t.image_url?'<img alt="">':''}<div class="quick"><button data-s="doing">В разработке</button><button data-s="done">✓ Сделано</button><button data-s="cancelled">Не делаем</button></div>`;
    a.querySelector("h3").textContent=t.title;
    a.querySelector("p").textContent=t.description||"";
    if(t.image_url)a.querySelector("img").src=t.image_url;
    a.querySelector(".edit").onclick=()=>edit(t);
    a.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>setStatus(t.id,b.dataset.s));
    root.appendChild(a);
  });

  if(!shown.length)root.innerHTML='<div class="empty-state">Задач с такими параметрами пока нет.</div>';
  renderPagination(list.length,totalPages,start,shown.length);
}

function renderPagination(total,totalPages,start,shownCount){
  const meta=$("#taskMeta");
  meta.textContent=total?`Показано ${start+1}–${start+shownCount} из ${total}`:"0 задач";
  const root=$("#pagination");root.innerHTML="";
  if(totalPages<=1)return;

  const addButton=(label,target,disabled=false,active=false)=>{
    const button=document.createElement("button");
    button.type="button";button.textContent=label;
    if(active)button.classList.add("active");
    button.disabled=disabled;
    button.onclick=()=>{page=target;render();document.querySelector(".task-board")?.scrollIntoView({behavior:"smooth",block:"start"})};
    root.appendChild(button);
  };

  addButton("←",page-1,page===1);
  const pages=[];
  if(totalPages<=7){for(let i=1;i<=totalPages;i++)pages.push(i)}
  else{
    pages.push(1);
    if(page>3)pages.push("…");
    for(let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++)pages.push(i);
    if(page<totalPages-2)pages.push("…");
    pages.push(totalPages);
  }

  pages.forEach(p=>{
    if(p==="…"){
      const span=document.createElement("span");
      span.className="pagination-ellipsis";span.textContent=p;root.appendChild(span);
    }else addButton(String(p),p,false,p===page);
  });
  addButton("→",page+1,page===totalPages);
}

async function setStatus(id,status){
  const {error}=await sb.from("tasks").update({status}).eq("id",id);
  if(error)return alert(error.message);
  await load();
}

function edit(t=null){
  $("#formTitle").textContent=t?"Изменить задачу":"Новая задача";
  $("#id").value=t?.id||"";$("#title").value=t?.title||"";$("#description").value=t?.description||"";
  $("#status").value=t?.status||"planned";$("#image").value=t?.image_url||"";
  $("#delete").classList.toggle("hidden",!t);$("#dialog").showModal();
}

$("#addTask").onclick=()=>edit();
$("#cancel").onclick=()=>$("#dialog").close();

$("#form").onsubmit=async e=>{
  e.preventDefault();const id=$("#id").value;
  const p={title:$("#title").value.trim(),description:$("#description").value.trim(),status:$("#status").value,image_url:$("#image").value.trim()};
  const q=id?sb.from("tasks").update(p).eq("id",id):sb.from("tasks").insert(p);
  const {error}=await q;
  if(error)return alert(error.message);
  $("#dialog").close();page=1;await load();
};

$("#delete").onclick=async()=>{
  const id=$("#id").value;
  if(!id||!confirm("Удалить задачу?"))return;
  const {error}=await sb.from("tasks").delete().eq("id",id);
  if(error)return alert(error.message);
  $("#dialog").close();await load();
};

document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");filter=b.dataset.filter;page=1;render();
});

$("#taskSort").onchange=e=>{sort=e.target.value;page=1;render()};
$("#pageSize").onchange=e=>{pageSize=Number(e.target.value)||10;page=1;render()};

sb.channel("cc-live").on("postgres_changes",{event:"*",schema:"public",table:"tasks"},load).subscribe();
load();
