const sb=supabase.createClient(window.CURIOCREW_CONFIG.supabaseUrl,window.CURIOCREW_CONFIG.supabaseAnonKey);
const KIND=document.body.dataset.kind;
const CONFIG={
  artifact:{title:'Артефакты',add:'Добавить артефакт',fields:[['rarity','Редкость'],['island','Остров'],['effect','Что даёт / функция'],['transport','Особенности переноски'],['reward','Награда / стоимость'],['danger','Опасность']]},
  royal_artifact:{title:'Королевские артефакты',add:'Добавить королевский артефакт',fields:[['island','Связанный остров'],['legend','История / легенда'],['purpose','Зачем нужен королю'],['boss','Связанный босс'],['unlock','Что открывает'],['reward','Награда / новое звание']]},
  island:{title:'Острова',add:'Добавить остров',fields:[['theme','Тематика / биом'],['difficulty','Сложность'],['mission','Основная миссия'],['mechanic','Уникальная механика'],['royalArtifact','Королевский артефакт'],['mobs','Мобы / босс']]},
  mob:{title:'Мобы',add:'Добавить моба',fields:[['type','Тип'],['island','Остров'],['behavior','Поведение'],['attacks','Атаки / способности'],['weakness','Слабости'],['physics','Физика / комедийное поведение']]}
};
const C=CONFIG[KIND];
const STATUS={idea:['Идея','idea'],planned:['Запланировано','planned'],doing:['В разработке','doing'],done:['Готово','done']};
let items=[];let filter='all';let search='';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function makeField([key,label]){
  const wrap=document.createElement('label');wrap.dataset.detailField=key;wrap.textContent=label;
  const input=document.createElement('textarea');input.rows=2;input.id=`detail-${key}`;wrap.appendChild(input);return wrap;
}
function setupForm(){
  $('#addItem').textContent=`+ ${C.add}`;
  const root=$('#detailFields');C.fields.forEach(f=>root.appendChild(makeField(f)));
}
async function load(){
  const {data,error}=await sb.from('game_content').select('*').eq('kind',KIND).order('created_at',{ascending:false});
  if(error){$('#connection').textContent='Ошибка подключения';console.error(error);return}
  items=data||[];$('#connection').textContent='Общий режим • синхронизация включена';render();
}
function render(){
  const root=$('#catalog');root.innerHTML='';
  const q=search.toLowerCase();
  const shown=items.filter(x=>(filter==='all'||x.status===filter)&&(!q||`${x.title} ${x.description} ${x.tags} ${JSON.stringify(x.details)}`.toLowerCase().includes(q)));
  if(!shown.length){root.innerHTML='<div class="empty-state">Пока ничего нет. Добавь первую запись.</div>';return}
  shown.forEach(item=>{
    const [statusText,statusClass]=STATUS[item.status]||STATUS.idea;
    const details=C.fields.map(([key,label])=>item.details?.[key]?`<div class="detail"><b>${esc(label)}</b><span>${esc(item.details[key])}</span></div>`:'').join('');
    const tags=(item.tags||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
    const article=document.createElement('article');article.className='catalog-card';
    article.innerHTML=`<div class="catalog-image">${item.image_url?`<img src="${esc(item.image_url)}" alt="${esc(item.title)}">`:'Изображение не добавлено'}</div><div class="catalog-body"><div class="top"><span class="pill ${statusClass}">${statusText}</span><button class="edit">Изменить</button></div><h3>${esc(item.title)}</h3><p>${esc(item.description||'')}</p>${tags?`<div class="tag-row">${tags}</div>`:''}${details?`<div class="detail-list">${details}</div>`:''}</div>`;
    article.querySelector('.edit').onclick=()=>edit(item);root.appendChild(article);
  });
}
function edit(item=null){
  $('#formTitle').textContent=item?`Изменить: ${item.title}`:C.add;
  $('#id').value=item?.id||'';$('#title').value=item?.title||'';$('#description').value=item?.description||'';$('#status').value=item?.status||'idea';$('#image').value=item?.image_url||'';$('#tags').value=item?.tags||'';
  C.fields.forEach(([key])=>{ $(`#detail-${key}`).value=item?.details?.[key]||''; });
  $('#delete').classList.toggle('hidden',!item);$('#dialog').showModal();
}
$('#addItem').onclick=()=>edit();$('#cancel').onclick=()=>$('#dialog').close();
$('#form').onsubmit=async e=>{
  e.preventDefault();const id=$('#id').value;const details={};C.fields.forEach(([key])=>{details[key]=$(`#detail-${key}`).value.trim()});
  const payload={kind:KIND,title:$('#title').value.trim(),description:$('#description').value.trim(),status:$('#status').value,image_url:$('#image').value.trim(),tags:$('#tags').value.trim(),details,updated_at:new Date().toISOString()};
  const query=id?sb.from('game_content').update(payload).eq('id',id):sb.from('game_content').insert(payload);const {error}=await query;
  if(error)return alert(error.message);$('#dialog').close();await load();
};
$('#delete').onclick=async()=>{const id=$('#id').value;if(!id||!confirm('Удалить запись?'))return;const {error}=await sb.from('game_content').delete().eq('id',id);if(error)return alert(error.message);$('#dialog').close();await load()};
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
$('#search').oninput=e=>{search=e.target.value.trim();render()};
sb.channel(`cc-${KIND}`).on('postgres_changes',{event:'*',schema:'public',table:'game_content',filter:`kind=eq.${KIND}`},load).subscribe();
setupForm();load();
