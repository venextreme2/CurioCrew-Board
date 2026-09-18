(()=>{
  const homeSb=supabase.createClient(window.CURIOCREW_CONFIG.supabaseUrl,window.CURIOCREW_CONFIG.supabaseAnonKey);
  const alphaOut=document.querySelector('#alphaDate');
  const betaOut=document.querySelector('#betaDate');
  const releaseOut=document.querySelector('#releaseDate');
  const editButton=document.querySelector('#editReleaseDates');
  const editor=document.querySelector('#releaseEditor');
  const alphaInput=document.querySelector('#alphaDateInput');
  const betaInput=document.querySelector('#betaDateInput');
  const releaseInput=document.querySelector('#releaseDateInput');
  const saveButton=document.querySelector('#saveReleaseDates');
  const cancelButton=document.querySelector('#cancelReleaseDates');
  const state=document.querySelector('#releaseSyncState');
  const taskTotal=document.querySelector('#taskTotal');
  const taskDone=document.querySelector('#taskDone');
  const taskDoing=document.querySelector('#taskDoing');
  const artifactCount=document.querySelector('#artifactCount');
  if(!alphaOut||!betaOut||!releaseOut||!editor)return;

  let values={alpha:'?',beta:'?',release:'?'};
  const clean=v=>String(v||'').trim()||'?';

  function draw(){
    alphaOut.textContent=clean(values.alpha);
    betaOut.textContent=clean(values.beta);
    releaseOut.textContent=clean(values.release);
  }
  function setState(text,kind=''){
    state.textContent=text;
    state.classList.remove('saved','error');
    if(kind)state.classList.add(kind);
  }
  function fillEditor(){
    alphaInput.value=values.alpha==='?'?'':values.alpha;
    betaInput.value=values.beta==='?'?'':values.beta;
    releaseInput.value=values.release==='?'?'':values.release;
  }
  function closeEditor(){editor.classList.add('hidden');editButton.classList.remove('hidden');}


  async function loadProjectStats(){
    if(!taskTotal&&!taskDone&&!taskDoing&&!artifactCount)return;
    const [{data:taskRows,error:taskError},{count:artifacts,error:artifactError}]=await Promise.all([
      homeSb.from('tasks').select('status'),
      homeSb.from('game_content').select('id',{count:'exact',head:true}).eq('kind','artifact')
    ]);
    if(!taskError&&Array.isArray(taskRows)){
      const done=taskRows.filter(row=>row.status==='done').length;
      const doing=taskRows.filter(row=>row.status==='doing').length;
      if(taskTotal)taskTotal.textContent=String(taskRows.length);
      if(taskDone)taskDone.textContent=String(done);
      if(taskDoing)taskDoing.textContent=String(doing);
    }else if(taskError)console.error(taskError);
    if(!artifactError&&artifactCount&&Number.isFinite(artifacts))artifactCount.textContent=String(artifacts);
    else if(artifactError)console.error(artifactError);
  }

  async function loadDates(){
    setState('Загрузка дат…');
    const {data,error}=await homeSb.from('site_release_settings').select('alpha,beta,release').eq('id','main').single();
    if(error){console.error(error);setState('Не удалось загрузить даты','error');return;}
    values={alpha:clean(data?.alpha),beta:clean(data?.beta),release:clean(data?.release)};
    draw();fillEditor();setState('Даты синхронизируются для всей команды','saved');
  }

  editButton.onclick=()=>{
    fillEditor();
    editor.classList.remove('hidden');
    editButton.classList.add('hidden');
    alphaInput.focus();
  };
  cancelButton.onclick=()=>{fillEditor();closeEditor();};
  saveButton.onclick=async()=>{
    const next={alpha:clean(alphaInput.value),beta:clean(betaInput.value),release:clean(releaseInput.value)};
    saveButton.disabled=true;setState('Сохраняю…');
    const {error}=await homeSb.from('site_release_settings').update({...next,updated_at:new Date().toISOString()}).eq('id','main');
    saveButton.disabled=false;
    if(error){console.error(error);setState('Ошибка сохранения','error');alert(error.message);return;}
    values=next;draw();closeEditor();setState('Сохранено • видно всей команде','saved');
  };

  [alphaInput,betaInput,releaseInput].forEach(input=>input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();fillEditor();closeEditor();}
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveButton.click();}
  }));

  homeSb.channel('cc-release-settings')
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'site_release_settings',filter:'id=eq.main'},payload=>{
      const row=payload.new||{};values={alpha:clean(row.alpha),beta:clean(row.beta),release:clean(row.release)};draw();
      if(editor.classList.contains('hidden'))fillEditor();
      setState('Обновлено • видно всей команде','saved');
    })
    .subscribe();

  homeSb.channel('cc-home-stats')
    .on('postgres_changes',{event:'*',schema:'public',table:'tasks'},()=>loadProjectStats())
    .on('postgres_changes',{event:'*',schema:'public',table:'game_content'},()=>loadProjectStats())
    .subscribe();

  loadProjectStats();
  loadDates();
})();
