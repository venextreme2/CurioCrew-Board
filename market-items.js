const marketSb=supabase.createClient(window.CURIOCREW_CONFIG.supabaseUrl,window.CURIOCREW_CONFIG.supabaseAnonKey);
const rankNames={1:'Прибрежный',2:'Экспедиционный',3:'Штурманский',4:'Капитанский',5:'Королевский',6:'Легендарный'};
const tierRoman={1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI'};
const tierColors={1:'#bdb6a6',2:'#63bd7b',3:'#6496ea',4:'#ae69df',5:'#e39551',6:'#efd166'};
const scopeNames={alpha:'Alpha',late_alpha:'Поздняя Alpha',future:'Будущее'};
let marketItems=[];
let editing=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function shortVendor(value=''){
  if(value.startsWith('Грегор'))return 'Грегор';
  if(value.startsWith('Марта'))return 'Марта';
  if(value.startsWith('Бруно'))return 'Бруно';
  return value;
}
function vendorClass(value=''){const v=shortVendor(value).toLowerCase();return 'vendor-'+(v==='грегор'?'gregor':v==='марта'?'marta':v==='бруно'?'bruno':'');}
function updateSummary(){
  $('#countAll').textContent=marketItems.length;
  $('#countGregor').textContent=marketItems.filter(x=>shortVendor(x.vendor)==='Грегор').length;
  $('#countMarta').textContent=marketItems.filter(x=>shortVendor(x.vendor)==='Марта').length;
  $('#countBruno').textContent=marketItems.filter(x=>shortVendor(x.vendor)==='Бруно').length;
  $('#countHeld').textContent=marketItems.filter(x=>x.held).length;
}
function filteredItems(){
  const q=$('#marketSearch').value.trim().toLowerCase();
  const tier=$('#tierFilter').value,vendor=$('#vendorFilter').value,scope=$('#scopeFilter').value;
  return marketItems.filter(x=>{
    if(tier!=='all'&&String(x.tier)!==tier)return false;
    if(vendor!=='all'&&shortVendor(x.vendor)!==vendor)return false;
    if(scope!=='all'&&x.release_scope!==scope)return false;
    if(q&&!([x.name,x.effect,x.drawback,x.inventory,x.item_type,x.notes,x.vendor].join(' ').toLowerCase().includes(q)))return false;
    return true;
  }).sort((a,b)=>a.item_no-b.item_no);
}
function render(){
  const rows=$('#marketRows');rows.innerHTML='';
  const shown=filteredItems();
  if(!shown.length){rows.innerHTML='<tr><td colspan="11" style="text-align:center;padding:36px;color:#707b8b">Ничего не найдено</td></tr>';return;}
  shown.forEach(item=>{
    const tr=document.createElement('tr');
    tr.style.setProperty('--tier-color',tierColors[item.tier]||'#687384');
    const vendor=shortVendor(item.vendor);
    tr.innerHTML=`
      <td class="market-no">${item.item_no}</td>
      <td><span class="tier-badge" style="color:${tierColors[item.tier]}">TIER ${tierRoman[item.tier]}</span><div class="item-note">${esc(item.rank_name||rankNames[item.tier])}</div></td>
      <td><span class="vendor-badge ${vendorClass(item.vendor)}">${esc(vendor)}</span></td>
      <td><div class="item-name">${esc(item.name)}</div><span class="type-badge">${esc(item.item_type||'ПРЕДМЕТ')}</span>${item.held?'<span class="held-badge">✋ В РУКАХ</span>':''}<div class="item-note">${esc(item.notes||'')}</div></td>
      <td class="weight-cell">${Number(item.weight_kg).toLocaleString('ru-RU')} кг</td>
      <td class="inventory-cell">${esc(item.inventory)}</td>
      <td class="effect-cell">${esc(item.effect)}</td>
      <td class="drawback-cell">${esc(item.drawback||'—')}</td>
      <td class="price-cell">${Number(item.price).toLocaleString('ru-RU')} мон.</td>
      <td><span class="scope-badge scope-${item.release_scope}">${esc(scopeNames[item.release_scope]||item.release_scope)}</span><div class="item-note">${item.implementation==='paused'?'Пауза':item.implementation==='planned'?'Запланировано':item.implementation==='doing'?'В разработке':item.implementation==='done'?'Готово':esc(item.implementation)}</div></td>
      <td><button class="edit-market" type="button">Изменить</button></td>`;
    tr.querySelector('.edit-market').onclick=()=>openEditor(item);
    rows.appendChild(tr);
  });
}
async function loadMarket(){
  $('#marketState').textContent='Синхронизация...';
  const {data,error}=await marketSb.from('market_items').select('*').order('item_no',{ascending:true});
  if(error){console.error(error);$('#marketState').textContent='Ошибка: '+error.message;return;}
  marketItems=data||[];
  updateSummary();render();
  $('#marketState').textContent=`Онлайн • ${marketItems.length} записей`;
}
function openEditor(item=null){
  editing=item;
  $('#marketFormTitle').textContent=item?'Изменить предмет':'Новый предмет';
  $('#itemId').value=item?.id||'';
  $('#itemNo').value=item?.item_no||((marketItems.at(-1)?.item_no||0)+1);
  $('#itemTier').value=item?.tier||1;
  $('#itemVendor').value=item?.vendor||'Грегор «Два Ценника»';
  $('#itemType').value=item?.item_type||'';
  $('#itemName').value=item?.name||'';
  $('#itemWeight').value=item?.weight_kg??0;
  $('#itemPrice').value=item?.price??0;
  $('#itemInventory').value=item?.inventory||'';
  $('#itemHeld').checked=Boolean(item?.held);
  $('#itemEffect').value=item?.effect||'';
  $('#itemDrawback').value=item?.drawback||'';
  $('#itemScope').value=item?.release_scope||'alpha';
  $('#itemImplementation').value=item?.implementation||'paused';
  $('#itemNotes').value=item?.notes||'';
  $('#deleteMarketItem').classList.toggle('hidden',!item);
  $('#marketDialog').showModal();
}
function closeEditor(){if($('#marketDialog').open)$('#marketDialog').close();}
$('#marketForm').onsubmit=async e=>{
  e.preventDefault();
  const tier=Number($('#itemTier').value);
  const payload={
    item_no:Number($('#itemNo').value),
    tier,
    rank_name:rankNames[tier],
    vendor:$('#itemVendor').value,
    item_type:$('#itemType').value.trim(),
    name:$('#itemName').value.trim(),
    weight_kg:Number($('#itemWeight').value),
    inventory:$('#itemInventory').value.trim(),
    effect:$('#itemEffect').value.trim(),
    drawback:$('#itemDrawback').value.trim(),
    price:Number($('#itemPrice').value),
    held:$('#itemHeld').checked,
    release_scope:$('#itemScope').value,
    implementation:$('#itemImplementation').value,
    notes:$('#itemNotes').value.trim(),
    updated_at:new Date().toISOString()
  };
  const id=$('#itemId').value;
  const {error}=id
    ?await marketSb.from('market_items').update(payload).eq('id',id)
    :await marketSb.from('market_items').insert(payload);
  if(error){alert(error.message);return;}
  closeEditor();await loadMarket();
};
$('#deleteMarketItem').onclick=async()=>{
  const id=$('#itemId').value;if(!id||!confirm('Удалить этот предмет из таблицы рынка?'))return;
  const {error}=await marketSb.from('market_items').delete().eq('id',id);
  if(error){alert(error.message);return;}
  closeEditor();await loadMarket();
};
$('#addMarketItem').onclick=()=>openEditor();
$('#closeMarketDialog').onclick=closeEditor;
$('#cancelMarketItem').onclick=closeEditor;
['marketSearch','tierFilter','vendorFilter','scopeFilter'].forEach(id=>$('#'+id).addEventListener(id==='marketSearch'?'input':'change',render));
$('#resetFilters').onclick=()=>{$('#marketSearch').value='';$('#tierFilter').value='all';$('#vendorFilter').value='all';$('#scopeFilter').value='all';render();};

marketSb.channel('market-items-live')
  .on('postgres_changes',{event:'*',schema:'public',table:'market_items'},()=>loadMarket())
  .subscribe();

loadMarket();
