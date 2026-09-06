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

/* -------------------- image upload / drag & drop -------------------- */

const imageDrop=$("#imageDrop");
const imageFile=$("#imageFile");
const imageInput=$("#image");
const imagePreview=$("#imagePreview");
const imageDropText=$("#imageDropText");
const clearImage=$("#clearImage");

function refreshImagePreview(){
  const value=imageInput.value.trim();

  if(!value){
    imagePreview.classList.add("hidden");
    imagePreview.removeAttribute("src");
    imageDropText.classList.remove("hidden");
    clearImage.classList.add("hidden");
    return;
  }

  imagePreview.src=value;
  imagePreview.classList.remove("hidden");
  imageDropText.classList.add("hidden");
  clearImage.classList.remove("hidden");
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Не удалось открыть изображение"));
    img.src=src;
  });
}

async function prepareImage(file){
  if(!file||!file.type.startsWith("image/")){
    alert("Выбери изображение");
    return;
  }

  /* Не даём случайно засунуть в строку Supabase гигантский исходник. */
  if(file.size>15*1024*1024){
    alert("Картинка слишком большая. Максимум 15 МБ.");
    return;
  }

  try{
    const source=await fileToDataUrl(file);
    const img=await loadImage(source);

    const maxSide=1400;
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
    const width=Math.max(1,Math.round(img.naturalWidth*scale));
    const height=Math.max(1,Math.round(img.naturalHeight*scale));

    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;

    const ctx=canvas.getContext("2d");
    ctx.drawImage(img,0,0,width,height);

    /* WebP заметно уменьшает размер скринов, которые хранятся в image_url. */
    imageInput.value=canvas.toDataURL("image/webp",0.82);
    refreshImagePreview();
  }catch(error){
    console.error(error);
    alert("Не удалось обработать картинку");
  }
}

imageDrop.onclick=()=>imageFile.click();
imageDrop.onkeydown=e=>{
  if(e.key==="Enter"||e.key===" "){
    e.preventDefault();
    imageFile.click();
  }
};

imageFile.onchange=()=>{
  prepareImage(imageFile.files?.[0]);
  imageFile.value="";
};

imageDrop.ondragover=e=>{
  e.preventDefault();
  imageDrop.classList.add("dragging");
};

imageDrop.ondragleave=()=>imageDrop.classList.remove("dragging");

imageDrop.ondrop=e=>{
  e.preventDefault();
  imageDrop.classList.remove("dragging");
  prepareImage(e.dataTransfer.files?.[0]);
};

imageInput.oninput=refreshImagePreview;

clearImage.onclick=()=>{
  imageInput.value="";
  refreshImagePreview();
};

/* ------------------------------------------------------------------- */

function edit(t=null){
  $("#formTitle").textContent=t?"Изменить задачу":"Новая задача";
  $("#id").value=t?.id||"";$("#title").value=t?.title||"";$("#description").value=t?.description||"";
  $("#status").value=t?.status||"planned";$("#image").value=t?.image_url||"";
  refreshImagePreview();
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
