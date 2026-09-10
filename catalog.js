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
let items=[];let filter='all';let search='';let formTags=[];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function makeField([key,label]){
  const wrap=document.createElement('label');wrap.dataset.detailField=key;wrap.textContent=label;
  const input=document.createElement('textarea');input.rows=3;input.id=`detail-${key}`;wrap.appendChild(input);return wrap;
}
function setupForm(){
  $('#addItem').textContent=`+ ${C.add}`;
  const root=$('#detailFields');C.fields.forEach(f=>root.appendChild(makeField(f)));
  setupNav();setupTags();setupImageUpload();
}
function setupNav(){
  const nav=document.querySelector('.site-nav');
  if(!nav||nav.querySelector('a[href="devlog.html"]'))return;
  const link=document.createElement('a');link.href='devlog.html';link.textContent='Дневник';
  const development=nav.querySelector('a[href="index.html"]');
  if(development?.nextSibling)nav.insertBefore(link,development.nextSibling);else nav.appendChild(link);
}

async function load(){
  const {data,error}=await sb.from('game_content').select('*').eq('kind',KIND).order('created_at',{ascending:false});
  if(error){$('#connection').textContent='Ошибка подключения';console.error(error);return}
  items=data||[];$('#connection').textContent='Общий режим • синхронизация включена';render();
}
function splitCodex(text=''){
  const re=/\(\s*Промпт\s+для\s+Codex\s*:/i;
  const match=re.exec(text);
  if(!match)return {main:text.trim(),codex:''};
  let codex=text.slice(match.index+match[0].length).trim();
  if(codex.endsWith(')'))codex=codex.slice(0,-1).trim();
  codex=codex.replace(/^[«“"]|[»”"]$/g,'').trim();
  return {main:text.slice(0,match.index).trim(),codex};
}
function render(){
  const root=$('#catalog');root.innerHTML='';
  const q=search.toLowerCase();
  const shown=items.filter(x=>(filter==='all'||x.status===filter)&&(!q||`${x.title} ${x.description} ${x.tags} ${JSON.stringify(x.details)}`.toLowerCase().includes(q)));
  if(!shown.length){root.innerHTML='<div class="empty-state">Пока ничего нет. Добавь первую запись.</div>';return}

  shown.forEach(item=>{
    const [statusText,statusClass]=STATUS[item.status]||STATUS.idea;
    const {main:description,codex}=splitCodex(item.description||'');
    const details=C.fields.map(([key,label])=>item.details?.[key]?`<details class="detail-accordion"><summary>${esc(label)}</summary><div class="detail-content">${esc(item.details[key])}</div></details>`:'').join('');
    const tags=parseStoredTags(item.tags).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
    const longDescription=description.length>420;
    const article=document.createElement('article');article.className='catalog-card';
    article.innerHTML=`
      <div class="catalog-image">${item.image_url?`<img src="${esc(item.image_url)}" alt="${esc(item.title)}">`:'<div class="image-empty">Фото не добавлено</div>'}</div>
      <div class="catalog-body">
        <div class="top"><span class="pill ${statusClass}">${statusText}</span><button class="edit">Изменить</button></div>
        <h3>${esc(item.title)}</h3>
        ${description?`<div class="catalog-description${longDescription?' is-clamped':''}">${esc(description)}</div>${longDescription?'<button type="button" class="text-toggle">Показать описание полностью</button>':''}`:''}
        ${tags?`<div class="tag-row">${tags}</div>`:''}
        ${details?`<div class="detail-list">${details}</div>`:''}
        ${codex?`<details class="codex-details"><summary>Промпт для Codex</summary><div class="codex-content">${esc(codex)}</div></details>`:''}
      </div>`;

    const img=article.querySelector('.catalog-image img');
    if(img)img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('div'),{className:'image-empty',textContent:'Картинка не загрузилась'}));};
    const toggle=article.querySelector('.text-toggle');
    if(toggle)toggle.onclick=()=>{
      const block=article.querySelector('.catalog-description');
      const clamped=block.classList.toggle('is-clamped');
      toggle.textContent=clamped?'Показать описание полностью':'Свернуть описание';
    };
    article.querySelector('.edit').onclick=()=>edit(item);
    root.appendChild(article);
  });
}

/* ----------------------------- tags ----------------------------- */
function parseStoredTags(value=''){
  return String(value).split(',').map(x=>x.trim()).filter(Boolean);
}
function syncTags(){
  $('#tags').value=formTags.join(', ');
  const chips=$('#tagChips');chips.innerHTML='';
  formTags.forEach((tag,index)=>{
    const chip=document.createElement('button');chip.type='button';chip.className='tag-chip';
    chip.innerHTML=`<span>${esc(tag)}</span><b aria-hidden="true">×</b>`;
    chip.title='Удалить тег';chip.onclick=()=>{formTags.splice(index,1);syncTags()};chips.appendChild(chip);
  });
}
function addTag(raw){
  const tag=String(raw||'').trim().replace(/\s+/g,' ');
  if(!tag)return;
  if(formTags.some(x=>x.toLocaleLowerCase('ru')===tag.toLocaleLowerCase('ru')))return;
  formTags.push(tag);syncTags();
}
function setupTags(){
  const stored=$('#tags');
  const label=stored.closest('label');
  if(!$('#tagInput')){
    stored.type='hidden';
    if(label){
      label.classList.add('tag-editor-label');
      for(const node of label.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent='Теги';break;}}
      const editor=document.createElement('div');editor.id='tagEditor';editor.className='tag-editor';
      const chips=document.createElement('div');chips.id='tagChips';chips.className='tag-chips';
      const input=document.createElement('input');input.id='tagInput';input.placeholder='1–2 слова → Enter';input.autocomplete='off';
      const help=document.createElement('small');help.textContent='Запятая больше не нужна. Напиши тег и нажми Enter/Tab или просто перейди к следующему полю.';
      editor.append(chips,input);label.insertBefore(editor,stored);label.appendChild(help);
    }
  }
  const input=$('#tagInput');
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key==='Tab'||e.key===','){
      if(input.value.trim()){
        e.preventDefault();addTag(input.value);input.value='';
      }
    }
    if(e.key==='Backspace'&&!input.value&&formTags.length){formTags.pop();syncTags();}
  });
  input.addEventListener('blur',()=>{if(input.value.trim()){addTag(input.value);input.value='';}});
  input.addEventListener('paste',e=>{
    const text=e.clipboardData?.getData('text')||'';
    if(!/[\n,;]/.test(text))return;
    e.preventDefault();text.split(/[\n,;]+/).forEach(addTag);input.value='';
  });
}

/* ---------------------- image upload / drag-drop ---------------------- */
function refreshImagePreview(){
  const input=$('#image'),preview=$('#imagePreview'),text=$('#imageDropText'),clear=$('#clearImage');
  const value=input.value.trim();
  if(!value){preview.classList.add('hidden');preview.removeAttribute('src');text.classList.remove('hidden');clear.classList.add('hidden');return;}
  preview.src=value;preview.classList.remove('hidden');text.classList.add('hidden');clear.classList.remove('hidden');
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('read error'));r.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('image error'));img.src=src;});}
async function prepareImage(file){
  if(!file||!file.type.startsWith('image/'))return alert('Перетащи файл изображения.');
  if(file.size>15*1024*1024)return alert('Картинка слишком большая. Максимум 15 МБ.');
  try{
    const src=await fileToDataUrl(file),img=await loadImage(src);const maxSide=1600;
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    $('#image').value=canvas.toDataURL('image/webp',0.84);refreshImagePreview();
  }catch(err){console.error(err);alert('Не удалось обработать картинку.');}
}
function setupImageUpload(){
  const input=$('#image');
  if(!$('#imageDrop')){
    const urlLabel=input.closest('label');
    const parent=urlLabel.parentNode;
    const field=document.createElement('div');field.className='image-field wide';
    const title=document.createElement('label');title.textContent='Картинка';
    const drop=document.createElement('div');drop.id='imageDrop';drop.className='image-drop';drop.tabIndex=0;drop.setAttribute('role','button');drop.setAttribute('aria-label','Загрузить картинку');
    const file=document.createElement('input');file.id='imageFile';file.type='file';file.accept='image/*';file.hidden=true;
    const text=document.createElement('div');text.id='imageDropText';text.className='image-drop-text';text.innerHTML='<strong>Перетащи фотографию сюда</strong><small>Зона подсветится, когда файл можно отпускать</small><small>или нажми, чтобы выбрать файл</small>';
    const preview=document.createElement('img');preview.id='imagePreview';preview.className='hidden';preview.alt='Предпросмотр картинки';
    const clear=document.createElement('button');clear.type='button';clear.id='clearImage';clear.className='image-clear hidden';clear.textContent='Убрать картинку';
    drop.append(file,text,preview);field.append(title,drop);
    if(urlLabel){urlLabel.classList.remove('wide');urlLabel.classList.add('image-url-line');for(const node of urlLabel.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){node.textContent='Или ссылка на картинку';break;}}field.appendChild(urlLabel);}
    field.appendChild(clear);parent.insertBefore(field,$('#detailFields'));
  }
  const drop=$('#imageDrop'),file=$('#imageFile');
  drop.onclick=()=>file.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}};
  file.onchange=()=>{prepareImage(file.files?.[0]);file.value='';};
  drop.ondragenter=drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging');};
  drop.ondragleave=e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('dragging');};
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');prepareImage(e.dataTransfer.files?.[0]);};
  input.oninput=refreshImagePreview;
  $('#clearImage').onclick=()=>{input.value='';refreshImagePreview();};
}

function edit(item=null){
  $('#formTitle').textContent=item?`Изменить: ${item.title}`:C.add;
  $('#id').value=item?.id||'';$('#title').value=item?.title||'';$('#description').value=item?.description||'';$('#status').value=item?.status||'idea';$('#image').value=item?.image_url||'';
  formTags=parseStoredTags(item?.tags||'');$('#tagInput').value='';syncTags();refreshImagePreview();
  C.fields.forEach(([key])=>{$(`#detail-${key}`).value=item?.details?.[key]||'';});
  $('#delete').classList.toggle('hidden',!item);$('#dialog').showModal();
}
$('#addItem').onclick=()=>edit();$('#cancel').onclick=()=>$('#dialog').close();
$('#form').onsubmit=async e=>{
  e.preventDefault();
  if($('#tagInput').value.trim()){addTag($('#tagInput').value);$('#tagInput').value='';}
  const id=$('#id').value,details={};C.fields.forEach(([key])=>{details[key]=$(`#detail-${key}`).value.trim()});
  const payload={kind:KIND,title:$('#title').value.trim(),description:$('#description').value.trim(),status:$('#status').value,image_url:$('#image').value.trim(),tags:$('#tags').value.trim(),details,updated_at:new Date().toISOString()};
  const query=id?sb.from('game_content').update(payload).eq('id',id):sb.from('game_content').insert(payload);const {error}=await query;
  if(error)return alert(error.message);$('#dialog').close();await load();
};
$('#delete').onclick=async()=>{const id=$('#id').value;if(!id||!confirm('Удалить запись?'))return;const {error}=await sb.from('game_content').delete().eq('id',id);if(error)return alert(error.message);$('#dialog').close();await load()};
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
$('#search').oninput=e=>{search=e.target.value.trim();render()};
sb.channel(`cc-${KIND}`).on('postgres_changes',{event:'*',schema:'public',table:'game_content',filter:`kind=eq.${KIND}`},load).subscribe();
setupForm();load();
