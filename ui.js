'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS={
 tree:'<path d="M7 3v18M7 11h6a5 5 0 0 0 5-5V3M7 11h6a5 5 0 0 1 5 5v5"/><circle cx="7" cy="3" r="1.4"/><circle cx="18" cy="3" r="1.4"/><circle cx="18" cy="21" r="1.4"/>',
 dialogue:'<path d="M4 4h16v12H9l-5 4V4zM8 8h8M8 12h5"/>',monologue:'<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',condition:'<path d="m12 2 10 10-10 10L2 12zM12 8v5M12 16v.1"/>',jump:'<path d="M3 7h11v11M14 7l-9 9M18 3h3v18h-3"/>',event:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',label:'<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',characters:'<circle cx="10" cy="7" r="4"/><path d="M3 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8M20 15a5 5 0 0 1 2 4v2"/>',items:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M8 5l9 5"/>',scenes:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 2v6M16 2v6"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',save:'<path d="M4 3h13l4 4v14H3V3zM7 3v7h10V3M7 21v-7h10v7"/>',play:'<path d="m7 3 14 9-14 9z"/>',undo:'<path d="M8 5 3 10l5 5M3 10h12a6 6 0 0 1 0 12"/>',redo:'<path d="m16 5 5 5-5 5M21 10H9a6 6 0 0 0 0 12"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',settings:'<path d="M4 7h16M4 17h16M9 3v8M16 13v8"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v.2"/>',mcp:'<path d="m8 3-5 5 5 5M16 11l5 5-5 5M16 3 8 21"/>',fit:'<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',folder:'<path d="M3 5h7l2 3h9v12H3z"/>',chevron:'<path d="m9 5 7 7-7 7"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',arrow:'<path d="M3 12h18m-6-6 6 6-6 6"/>'};
const icon=(k,size=17)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||ICONS.label}</svg>`;
ICONS.art='<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-4 3 2 4-5 4 5"/>';
ICONS.map='<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>';
const button=(action,label,cls='',title='')=>`<button data-action="${action}" class="${cls}" ${title?`title="${esc(title)}"`:''}>${label}</button>`;
const state={
  ...ST.displaySettings(),
  p:null, connection:null, tab:'characters', search:'', locationLibraryScope:'',
  projectQuery:'', searchOpen:false, searchCursor:0, focusedEntity:null,
  selected:new Set(), inspectorTab:'node', view:{x:60,y:90,zoom:.85},
  treeExpanded:false, treeScope:{}, treeFiltersOpen:false, treeRouteStart:'', treeRouteChoices:{}, treeQuery:'',
  link:null, modal:null, rolePicker:null, saves:0, mapOpen:false,
  queue:Promise.resolve(), lastDirectory:'', traceChoices:{}, traceInputs:{}
};
let composingInput = null;
let renderAfterComposition = false;
let lastSceneClick = null;
let draggingCard='';
const displayKey = 'storytree-display-settings';
const dismissedTips = new Set();
const dialogueBusy = new Set();
let datePicker = null;
const fontFamilies = {
  default: 'StoryUI, "Segoe UI", "Microsoft YaHei", sans-serif',
  sans: '"Microsoft YaHei UI", "Segoe UI", sans-serif',
  serif: 'SimSun, Georgia, serif',
  kai: 'KaiTi, "Microsoft YaHei", Georgia, serif',
  mono: 'Consolas, "Microsoft YaHei", monospace'
};

function optionalTip(key, content, style = '') {
  if (dismissedTips.has(key)) return '';
  return html`<button type="button" class="optional-tip ${style}" data-dismiss-tip="${key}" title="单击隐藏此提示">${content}</button>`;
}

const nodeType = type => t(ST.TYPES[type]);
const eventTypeLabel = type => ['战斗','交易','自定义'].includes(type) ? t(type) : type;
const dateLabel = date => date || t('未定日期');
const dialogueModeLabels = {manual:'手动',round:'轮谈',same:'对谈'};
const editorNodeId = el => el.closest('[data-dialogue-node]')?.dataset.dialogueNode || el.closest('[data-editor-node]')?.dataset.editorNode;
const artLabels = {map:'地图',character:'角色设定',location:'场景设定图',other:'其他'};

function t(text) {
  if (state.language !== 'en' || typeof text !== 'string') return text;
  const key = text.trim();
  return Object.hasOwn(english, key) ? text.replace(key, () => english[key]) : text;
}

function translateStaticText(source, escapeMarkup) {
  if (state.language !== 'en') return source;
  return source.replace(/[^<>"'\r\n]+/gu, part => {
    const key = part.trim();
    if (!Object.hasOwn(english,key)) return part;
    return part.replace(key, () => escapeMarkup ? esc(english[key]) : english[key]);
  });
}

// Interpolated values include story content. Only the static template strings are translated.
function html(strings, ...values) {
  return strings.reduce((output,part,index) =>
    output+translateStaticText(part,true)+(index<values.length?String(values[index]):''),'');
}

function message(strings, ...values) {
  return strings.reduce((output,part,index) =>
    output+translateStaticText(part,false)+(index<values.length?String(values[index]):''),'');
}

const staticHtml = source => translateStaticText(source,true);

async function loadDisplaySettings() {
  try {
    const settings = window.desktop?.getDisplaySettings
      ? await desktop.getDisplaySettings()
      : JSON.parse(localStorage.getItem(displayKey) || '{}');
    Object.assign(state, ST.displaySettings(settings));
  } catch {
    Object.assign(state, ST.displaySettings());
  }
  applyDisplayStyles();
}

async function saveDisplaySettings() {
  const settings = ST.displaySettings(state);
  try {
    if (window.desktop?.saveDisplaySettings) await desktop.saveDisplaySettings(settings);
    else localStorage.setItem(displayKey, JSON.stringify(settings));
  } catch {
    toast(t('显示设置未能保存'));
  }
}

function applyDisplayStyles() {
  const root = document.documentElement;
  root.lang = state.language;
  document.title = state.language === 'en' ? 'StoryTree' : 'StoryTree · 故事树';
  root.style.setProperty('--story-font', fontFamilies[state.fontFamily]);
  root.style.setProperty('--text-scale', state.uiFont / 100);
  root.style.setProperty('--node-text-scale', state.nodeFont / 100);
}

function panelRail(action, label, iconName, side) {
  return html`<button type="button" class="panel-rail ${side}" data-action="${action}" aria-expanded="false" title="展开${label}">
    ${icon(iconName,17)}<span class="vertical-label">${label}</span>
  </button>`;
}
let toastTimer;
function toast(text){const notice=$('#toast');notice.textContent=localizeError(text);notice.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.classList.remove('show'),4000);}
function localizeError(text) {
  if (state.language!=='en' || typeof text!=='string') return text;
  const range = text.match(/^数值必须在 (.+)–(.+) 之间$/u);
  if (range) return `Enter a value between ${range[1]} and ${range[2]}.`;
  const inventory = text.match(/^(.+) 的物品数量不足$/u);
  if (inventory) return `${inventory[1]} does not have enough of the item.`;
  return t(text);
}
const charName=id=>state.p.characters.find(c=>c.id===id)?.name||t('旁白');
const itemName=id=>state.p.items.find(i=>i.id===id)?.name||id;
const nodeById=id=>state.p.nodes.find(n=>n.id===id);
const DEFAULT_LOCATION_COLOR='#79aace';
let locationProject,locationIndex;
function locationsInOrder(){
 if(locationProject===state.p)return locationIndex;
 const children=new Map(),ordered=new Map();
 for(const location of state.p.locations||[]){
   const key=location.parentId||'';
   if(!children.has(key))children.set(key,[]);
   children.get(key).push(location);
 }
 const stack=(children.get('')||[]).slice().reverse().map(location=>({location,parents:[]}));
 while(stack.length){
   const {location,parents}=stack.pop();
   const path=[...parents,location];
   ordered.set(location.id,{location,path,depth:parents.length,name:path.map(entry=>entry.name).join(' / ')});
   for(const child of (children.get(location.id)||[]).slice().reverse())stack.push({location:child,parents:path});
 }
 locationProject=state.p;
 return locationIndex=ordered;
}
const locationById=id=>locationsInOrder().get(id)?.location;
const locationName=id=>locationsInOrder().get(id)?.name;
const currentScene=()=>ST.sceneOf(state.p,state.p.currentSceneId);
const selectedNode=()=>state.selected.size===1?nodeById([...state.selected][0]):null;
let namedProject,namedScenes,namedStates;
function speakerName(id,node){
 if(!id)return t('旁白');
 if(namedProject!==state.p){
   namedProject=state.p;
   namedScenes=new Set(state.p.nodes.filter(n=>n.operations.some(op=>op.kind==='characterField'&&op.key==='displayName')).map(n=>n.sceneId));
   namedStates=new Map();
 }
 let characters=namedStates.get(node.id);
 if(!characters){
   characters=namedScenes.has(node.sceneId)
     ?getTimelineEntries().find(entry=>entry.id===node.id)?.result?.after||nodeRoute(node).h?.after
     :null;
   characters ||= ST.sceneOf(state.p,node.sceneId).characters;
   namedStates.set(node.id,characters);
 }
 return ST.characterDisplayName(characters[id]||state.p.characters.find(c=>c.id===id))||charName(id);
}
function speakerOption(id,node){
 const name=speakerName(id,node),roleId=charName(id);
 return name===roleId?name:name+' · '+roleId;
}
const characterOptions=(selected='',blank=true,node)=>`${blank?html`<option value="" ${!selected?'selected':''}>旁白 / 未指定</option>`:''}${state.p.characters.map(c=>`<option value="${esc(c.id)}" ${selected===c.id?'selected':''}>${esc(node?speakerOption(c.id,node):c.name)}</option>`).join('')}`;
const options=(values,value,label=t)=>values.map(v=>`<option ${v===value?'selected':''} value="${esc(v)}">${esc(v?label(v):t('不设置'))}</option>`).join('');
function avatar(c,i=0,large=false){return `<span class="avatar ${i%2?'alt':''}" ${large?'style="width:70px;height:82px"':''}>${c.image?`<img alt="${esc(c.name)}" src="${esc(c.image)}">`:esc(c.name.slice(0,1))}</span>`;}
function entityChip(ref,extra='') {const obj=ref.kind==='character'?state.p.characters.find(c=>c.id===ref.id):state.p.items.find(i=>i.id===ref.id);if(!obj)return '';return `<span class="entity-chip ${ref.kind==='item'?'item':''}" draggable="true" data-drag-kind="${ref.kind}" data-drag-id="${esc(ref.id)}" data-entity-kind="${ref.kind}" data-entity-id="${esc(ref.id)}" data-summary="${esc(obj.summary)}" title="${esc(obj.summary||obj.name)}" ${extra}>${icon(ref.kind==='character'?'characters':'items',11)}${esc(obj.name)}</span>`;}
function renderTextMentions(text,node){
  const mentions=new Map();
  for(const ref of node.refs){
    const entry=(ref.kind==='character'?state.p.characters:state.p.items).find(entry=>entry.id===ref.id);
    const name=entry&&'@'+entry.name;
    if(name&&!mentions.has(name))mentions.set(name,ref);
  }
  if(!mentions.size)return esc(text);
  const names=[...mentions.keys()].sort((a,b)=>b.length-a.length);
  const pattern=new RegExp(names.map(name=>name.replace(/[.*+?^$\{\}()|[\]\\]/gu,'\\$&')).join('|'),'gu');
  let output='',start=0;
  for(const match of text.matchAll(pattern)){
    output+=esc(text.slice(start,match.index))+entityChip(mentions.get(match[0]),`data-in-node="${esc(node.id)}"`);
    start=match.index+match[0].length;
  }
  return output+esc(text.slice(start));
}
async function api(route,body){
 const binary=body instanceof Blob;
 let status,value;
 if(window.desktop?.projectRequest){
   ({status,value}=await desktop.projectRequest(route,binary?new Uint8Array(await body.arrayBuffer()):body));
 }else{
   const sample=route==='script-example.txt';
   const r=await fetch(sample?'/'+route:'/api/'+route,{
     method:body===undefined?'GET':'POST',
     headers:{'Content-Type':binary?'application/octet-stream':'application/json','X-StoryTree-Token':state.connection.token},
     body:binary?body:JSON.stringify(body),signal:AbortSignal.timeout(12000)
   });
   status=r.status;
   value=status===204?null:sample?await r.text():await r.json();
 }
 if(status>=400){const error=Error(value?.error||t('保存失败'));error.status=status;throw error;}
 return value;
}
function run(commands,message='',redraw=render,retryDraft=false) {
 const modal=state.modal;
 state.saves++;
 updateSave();
 const operation=state.queue.then(async()=>{
   let batch,revision,projectId;
   try{
     for(let attempt=0;;attempt++){
       batch=typeof commands==='function'?commands():commands;
       if(!batch.length)return;
       revision=state.p.revision;
       projectId=state.p.id;
       try{
         const result=await api('commands',{commands:batch,revision});
         state.p=result.project;
         if(modal && !retryDraft)delete modal.failedSave;
         state.selected=new Set([...state.selected].filter(id=>nodeById(id)));
         redraw();
         if(message)toast(message);
         return result;
       }catch(error){
         if(error.status!==409)throw error;
         await refresh(true);
         if(!retryDraft || attempt)throw error;
       }
     }
   }catch(error){
     if(modal && !retryDraft && batch?.length)modal.failedSave={batch,revision,projectId};
     toast(error.message);
     throw error;
   }finally{
     state.saves--;
     updateSave();
   }
 });
 state.queue=operation.catch(()=>{});
 return operation;
}
const cmd=(type,args,message)=>run([{type,args}],message);
async function refresh(force=false){
 try{
   if(!force&&(state.modal||draggingCard||sceneMapView.dragging()))return;
   const result=await api(force||!state.p?'project':'project?revision='+state.p.revision);
   if(!result||!force&&(draggingCard||sceneMapView.dragging()))return;
   state.lastDirectory=result.directory;
   if(!state.p||result.project.revision>state.p.revision||force){
     const previous=state.p?.currentSceneId;
     state.p=result.project;
     resetSceneView(previous);
     render();
   }
 }catch(error){toast(t('本地服务连接失败：')+error.message);}
}
function updateSave(){
 const el=$('#save-label');
 if(!el)return;
 const failed=[...editTimers.values()].find(task=>task.error);
 if(state.saves)el.textContent=t('正在保存…');
 else if(failed || state.modal?.failedSave){
   el.innerHTML=failed
     ?button('retry-save',t('保存未完成 · 重试'),'small danger ghost',failed.error)
     :esc(t('保存未完成，请在对话框中重试'));
 }else if(editTimers.size)el.textContent=t('有待保存的编辑');
 else el.innerHTML=staticHtml('<span class="status-dot"></span>已保存到本机');
}
function focusCapture(){
 const el=document.activeElement;
 if(!el?.dataset.focus)return null;
 const editor=editorNodeId(el);
 const edit=editor && editTimers.get(draftKey(editor,el.dataset.storyDate?'date':el.dataset.nodePath));
 return {key:el.dataset.focus,editor,start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection,scroll:el.scrollTop,draft:edit?.value};
}
function focusRestore(f){
 if(!f)return;
 const el=$$('[data-focus]').find(x=>x.dataset.focus===f.key && editorNodeId(x)===f.editor);
 if(!el||el===document.activeElement)return;
 if(f.draft!==undefined)el.value=f.draft;
 focusNodeEditor(el,{preventScroll:true});
 if(typeof f.start==='number' && el.setSelectionRange)el.setSelectionRange(f.start,f.end,f.direction);
 el.scrollTop=f.scroll;
}
const selectionCaption=()=>state.selected.size?t('已选择 ')+state.selected.size+t(' 个节点 · '):'';
function selectionToolbar(){return state.selected.size>1?html`<div class="selection-toolbar">已选 ${state.selected.size} 个节点 ${button('transfer',icon('scenes',12)+t(' 移入场景'),'small')}${button('copy-transfer',icon('copy',12)+t(' 复制到场景'),'small')}${button('location-assign',t('指定地点'),'small')}${button('delete-selected',icon('trash',12),'icon small danger',t('删除选中'))}</div>`:'';}
function render(){
 if(!state.p)return;
 if(composingInput?.isConnected){renderAfterComposition=true;return;}
 if(state.rolePicker && selectedNode()?.id!==state.rolePicker.nodeId)state.rolePicker=null;
 hideOverviewTip();
 const focus=focusCapture(),scroll=$('.inspector-content')?.scrollTop||0,libScroll=$('.library-list')?.scrollTop||0;
 const treeScroll=$('.tree-content')?.scrollTop||0,treeLeft=$('.tree-content')?.scrollLeft||0;
 const p=state.p,s=currentScene();
 syncTreeProject();
 sceneMapView.session();
 if(state.locationLibraryScope&&!locationById(state.locationLibraryScope))state.locationLibraryScope='';
 $('#app').innerHTML=html`<header class="topbar"><div class="brand"><img src="logo.svg" alt=""><div>StoryTree</div></div><div class="top-separator"></div>${button('rename-project',`<span class="project-name">${esc(p.title)}</span><span class="muted tiny"> ▾</span>`,'ghost')}<span class="save-state" id="save-label"></span><div class="top-actions">${button('undo',icon('undo',15),'icon ghost',t('撤销 Ctrl+Z'))}${button('redo',icon('redo',15),'icon ghost',t('重做 Ctrl+Shift+Z'))}<div class="top-separator"></div>${button('manual-save',icon('save',14)+t(' 保存'),'ghost',t('保存 Ctrl+S'))}${button('import', t('打开'),'ghost')}${button('script-import',t('导入剧本'),'ghost')}${button('export',icon('save',14)+t(' 导出'),'ghost')}${window.desktop?.listPlugins?button('plugins',t('插件'),'ghost'):''}${button('mcp',icon('mcp',14)+' AI / MCP','ghost')}${button('simulate',icon('play',14)+t(' 推演剧情'),'primary')}</div></header>
 <div class="body"><nav class="rail">${button('rail-canvas',icon('tree',22),'active',t('剧情画布'))}${button('rail-characters',icon('characters',21),state.tab==='characters'?'active':'',t('角色库'))}${button('rail-items',icon('items',21),state.tab==='items'?'active':'',t('物品库'))}${button('rail-scenes',icon('scenes',21),state.tab==='scenes'?'active':'',t('场景'))}${button('rail-art',icon('art',21),state.tab==='art'?'active':'',t('概念图'))}${button('definitions',icon('label',20),'',t('技能与属性设定'))}<div class="bottom">${button('settings',icon('settings',21),'',t('设置'))}</div></nav>
 ${state.libraryCollapsed?panelRail('toggle-library',t('素材库'),'folder','left-rail'):renderLibrary()}<main class="workspace"><div class="scene-tabs">${p.scenes.map(x=>`<button class="scene-tab ${x.id===s.id?'active':''}" data-scene="${esc(x.id)}" data-rename-scene="${esc(x.id)}" title="${esc(t('双击修改场景名称'))}" data-drop-scene="${esc(x.id)}"><span class="tab-dot"></span>${esc(x.name)}<span class="muted tiny">${p.nodes.filter(n=>n.sceneId===x.id).length}</span></button>`).join('')}${button('new-scene',icon('plus',14),'ghost',t('新建场景'))}</div>
 <div class="canvas-toolbar">
   ${button('toggle-library',icon('folder',14),'icon ghost',t('显示或收起素材库'))}
   <div class="crumb">故事 / <strong data-rename-scene="${esc(s.id)}" title="${esc(t('双击修改场景名称'))}">${esc(s.name)}</strong></div>
   ${button('scene-map',icon('map',14)+`<span class="tool-caption">${t(state.mapOpen?'返回剧情画布':'场景地图')}</span>`,state.mapOpen?'active':'ghost',t(state.mapOpen?'返回剧情画布':'场景地图'))}
   ${state.mapOpen?'':[
     button('palette',icon('plus',13)+staticHtml('<span class="tool-caption">添加节点</span>'),'primary',t('添加节点')),
     button('fit',icon('fit',13)+staticHtml('<span class="tool-caption">适应画布</span>'),'ghost',t('适应画布')),
     sceneMapView.guideAvailable()?button('map-guide',icon('map',13)+staticHtml('<span class="tool-caption">地图指引</span>'),sceneMapView.guideActive()?'active':'ghost',t('显示或隐藏地图指引')):''
   ].join('')}
   ${button('tree',icon('tree',13)+staticHtml('<span class="tool-caption">故事树</span>'),state.tree?'active':'ghost',t('显示或收起故事树'))}
 </div>
 ${state.mapOpen?sceneMapView.renderMap():''}
 ${renderProjectSearch()}
 <div class="canvas" id="canvas" tabindex="0" aria-label="剧情节点画布"><div class="stage" id="stage"><div id="location-regions"></div><svg class="edges" id="edges"></svg><div id="nodes"></div></div>${!sceneMapView.guideActive()&&!p.nodes.some(n=>n.sceneId===s.id)?html`<div class="canvas-empty"><div class="empty-icon">${icon('tree',53)}</div><h2>每个故事，都始于一个节点</h2><p>双击画布开始创作<br>将角色和物品拖进节点，让他们参与故事</p></div>`:''}<div class="canvas-overlay"><div class="zoom-controls">${button('zoom-out','−','ghost')}<span id="zoom-text">${Math.round(state.view.zoom*100)}%</span>${button('zoom-in','+','ghost')}${button('fit',icon('fit',13),'ghost',t('适应全部节点'))}</div></div><div id="minimap" class="minimap"></div><div class="canvas-help">拖动节点 · 空格拖动画布 · 滚轮缩放 · Shift 框选</div><div id="selection-tools">${selectionToolbar()}</div>${state.link?staticHtml('<div class="canvas-banner">点击目标节点左侧的输入点 · Esc 取消</div>'):''}</div></main>
 ${state.mapOpen?'':state.inspectorCollapsed?panelRail('toggle-inspector',t('检查器'),'settings','right-rail'):renderInspectorPanel()}
 ${state.tree?renderTree():panelRail('tree',t('故事树'),'tree','right-rail')}</div>
 <footer class="statusbar"><span><span class="status-dot"></span>本地项目</span><span>${p.scenes.length} 场景</span><span>${p.characters.length} 角色</span><span>${p.nodes.length} 节点 · ${p.edges.length} 连线</span><span class="right"><span id="selection-caption">${selectionCaption()}</span>StoryTree ${esc(state.connection?.version||'')} · 所有更改自动保存</span></footer>`;
 $('#canvas').hidden=state.mapOpen;
 $('.project-search').hidden=state.mapOpen;
 if(!state.mapOpen)renderGraph();
 updateSave();
 if($('.inspector-content'))$('.inspector-content').scrollTop=scroll;
 if($('.library-list'))$('.library-list').scrollTop=libScroll;
 const treeContent = $('.tree-content');
 if(treeContent){
   treeContent.scrollTop=treeScroll;
   treeContent.scrollLeft=treeLeft;
 }
 focusRestore(focus);
 if(!state.mapOpen)bindCanvas();
 renderSearchResults();
 textFind.sync();
}
function renderInspectorPanel() {
  const tabs = [['project',t('项目')],['node',t('节点')],['scene',t('场景')],['characters',t('角色')],['items',t('物品')]];
  return html`<aside class="inspector">
    <div class="panel-heading">
      <h3>检查器</h3>
      <div class="panel-controls">
        ${button('scene-info',icon('more',17),'icon ghost',t('场景设定'))}
        ${button('toggle-inspector',icon('chevron',14),'icon ghost',t('收起检查器'))}
      </div>
    </div>
    <div class="inspector-tabs">${tabs.map(([tab,name])=>`<button data-inspector-tab="${tab}" class="${state.inspectorTab===tab?'active':''}">${name}</button>`).join('')}</div>
    <div class="inspector-content" data-editor-node="${esc(selectedNode()?.id||'')}">${renderInspector()}</div>
  </aside>`;
}
function renderLibraryCard(c,i,kind,inLibrary=true){return `<div class="library-card ${state.focusedEntity===c.id?'search-located':''}" draggable="true" data-drag-kind="${kind}" data-drag-id="${esc(c.id)}" data-entity-kind="${kind}" data-entity-id="${esc(c.id)}" data-summary="${esc(c.summary)}" title="${esc(c.summary||t('双击编辑'))}" ${inLibrary?'data-library="true"':''}>${kind==='character'?avatar(c,i):`<span class="avatar item">${icon('items',19)}</span>`}<div class="flex"><div class="name">${esc(c.name)}</div><div class="desc">${esc(kind==='item'?t(c.category)+' · '+(t(c.type)||t('未分类')):(c.tags.slice(0,2).join(' · ')||c.summary||t('拖入节点开始使用')))}</div></div><button type="button" class="small ghost library-card-edit" data-edit-asset title="${esc(t('编辑'))}">${t('编辑')}</button></div>`;}
function renderGroupedCards(kind,q='',inLibrary=true){
   const p=state.p,cards=p[kind==='item'?'items':'characters'];
   let content='';
   for(const group of [...ST.groupsOf(p,kind),{id:'',name:t('未分组')}]){
     const members=cards.filter(c=>(c.groupId||'')===group.id);
     const shown=members.filter(c=>!q || [
       group.name,c.name,c.summary,c.details,...c.tags,c.category,t(c.category),c.type,t(c.type),c.grade,t(c.grade),
       ...Object.keys(c.skills||{}),...Object.keys(c.attributes)
     ].join(' ').toLowerCase().includes(q));
     if(q && !shown.length)continue;
     if(!group.id && !members.length && !cards.length)continue;
     const groupButton=group.id?`<button class="small ghost" data-group="${esc(group.id)}" title="${esc(t('编辑分组'))}" aria-label="${esc(t('编辑分组'))}">${icon('more',12)}</button>`:'';
     const drag=group.id?`draggable="true" data-drag-kind="${kind==='item'?'item-group':'group'}" data-drag-id="${esc(group.id)}"`:'';
     const drop=kind==='item'?`data-item-group-drop="${esc(group.id)}"`:'';
     content+=`<div class="group-head" ${drag} ${drop}><span>${esc(group.name)} <span class="muted tiny">${shown.length}</span></span>${groupButton}</div>${shown.map((c,i)=>renderLibraryCard(c,i,kind,inLibrary)).join('')}`;
   }
   if(!content && q)content=`<div class="hint">${t('没有匹配的素材。')}</div>`;
   const label=t(kind==='item'?'＋ 新建物品分组':'＋ 新建角色分组');
   return content+`<button data-action="new-group" data-group-kind="${kind}" class="ghost small full">${label}</button>`;
}
function renderLibraryList(){
 const p=state.p,q=state.search.trim().toLowerCase();
 if(state.tab==='art')return renderArtLibrary(q);
 if(state.tab==='locations')return renderLocationLibrary(q);
 if(state.tab==='items')return renderItemSetLibrary(q)+renderGroupedCards('item',q);
 if(state.tab==='characters')return renderGroupedCards('character',q);
 let content='';
 if(state.tab==='scenes')content=p.scenes.filter(s=>!q||s.name.toLowerCase().includes(q)).map(s=>html`
   <div class="library-card scene-library-card" draggable="true" data-drag-kind="scene" data-drag-id="${esc(s.id)}" data-edit-scene="${esc(s.id)}" data-drop-scene="${esc(s.id)}">
     <span class="avatar alt">${icon('scenes',18)}</span>
     <div class="flex"><button type="button" class="scene-card-name" data-edit-scene="${esc(s.id)}" title="编辑场景">${esc(s.name)}</button>
     <div class="desc">${p.nodes.filter(n=>n.sceneId===s.id).length} ${t('节点')} · ${Object.keys(s.characters).length} ${t('场景角色')}</div></div>
     <button type="button" class="icon small ghost" data-scene="${esc(s.id)}" title="打开场景" aria-label="打开场景">${icon('tree',14)}</button>
     <button type="button" class="icon small ghost" data-open-scene-map="${esc(s.id)}" title="场景地图" aria-label="场景地图">${icon('map',14)}</button>
   </div>`).join('');
 return content||`<div class="hint">${q?t('没有匹配的素材。'):t('这里还没有素材，点击右上角 ＋ 创建。')}</div>`;
}
function renderLibrary() {
  return html`<aside class="library">
    <div class="panel-heading">
      <h3>${t(state.tab==='art'?'概念图':'素材库')}</h3>
      <div class="panel-controls">
        ${button('new-entity',icon('plus',16),'icon ghost',t('新建素材'))}
        ${button('toggle-library',icon('chevron',14),'icon ghost fold-left',t('收起素材库'))}
      </div>
    </div>
    <div class="library-search"><input id="library-search" data-focus="library-search" autocomplete="off" placeholder="搜索名称、标签或描述…" value="${esc(state.search)}" aria-label="搜索素材"></div>
    ${state.tab==='art'?'':`<div class="library-tabs">${[['characters','角色'],['items','物品'],['locations','地点'],['scenes','场景']].map(([tab,label])=>`<button data-tab="${tab}" class="${state.tab===tab?'active':''}">${t(label)}</button>`).join('')}</div>`}
    ${['characters','items'].includes(state.tab)?`<div class="library-tools">${button('excel-import',t('导入 Excel'),'small ghost')}</div>`:''}
    <div class="library-list">${renderLibraryList()}</div>
    ${state.tab==='locations'?optionalTip('location-library',html`双击地点查看子地点 · 拖动卡片可布置地点`,'library-hint'):
      state.tab!=='art'?optionalTip('library', html`${icon('characters',11)} 双击卡片编辑 · 悬停查看简介<br>拖入节点 / 场景以建立独立快照<br>分组也可以整组拖入`, 'library-hint'):''}
  </aside>`;
}
const itemSetName=id=>(state.p.itemSets||[]).find(set=>set.id===id)?.name||'';
const itemSetEntryName=entry=>entry.kind==='set'?itemSetName(entry.id):itemName(entry.id);
function renderItemSetLibrary(query){
  const sets=(state.p.itemSets||[]).filter(set=>[set.name,...set.entries.map(itemSetEntryName)].join(' ').toLowerCase().includes(query));
  if(query&&!sets.length)return '';
  return html`<section class="item-set-library">
    <div class="group-head"><strong>物品组合</strong>${button('item-set-new','＋','small ghost',t('新建物品组合'))}</div>
    ${sets.map(set=>html`<button type="button" class="item-set-card" draggable="true" data-drag-kind="itemset"
      data-drag-id="${esc(set.id)}" data-item-set-open="${esc(set.id)}" data-item-set-drop="${esc(set.id)}"
      title="点击编辑，或拖入物品及其他组合">
      ${icon('items',15)} <span class="item-set-card-text"><strong>${esc(set.name)}</strong>
      <small>${esc(set.entries.map(entry=>itemSetEntryName(entry)+' × '+entry.quantity).join(' · ')||t('空组合'))}</small></span>
    </button>`).join('')||html`<p class="hint">保存可重复添加到角色的定量物品组合。</p>`}
  </section>`;
}
function locationCardActions(id){
 const key=esc(id),edit=esc(t('编辑地点')),remove=esc(t('删除地点'));
 return `<button type="button" class="small ghost" data-edit-location="${key}" title="${edit}" aria-label="${edit}">${icon('settings',13)}</button>
   <button type="button" class="small ghost danger" data-delete-location="${key}" title="${remove}" aria-label="${remove}">${icon('trash',13)}</button>`;
}
function renderLocationCard({location,name},attributes,detail,controls){
 const title=[name,t('双击查看子地点'),location.notes].filter(Boolean).join('\n');
 return `<div class="library-card location-card ${state.focusedEntity===location.id?'search-located':''}"
   draggable="true" data-drag-kind="location" data-drag-id="${esc(location.id)}" ${attributes}
   style="--location-color:${location.color||DEFAULT_LOCATION_COLOR}" title="${esc(title)}">
   <span class="avatar alt">${icon('map',16)}</span><div class="flex">
     <div class="name">${esc(location.name)}</div>
     <div class="desc">${esc(detail)}</div>
   </div><div class="location-card-controls">${controls}${locationCardActions(location.id)}</div>
 </div>`;
}
function renderLocationLibrary(query){
 const index=locationsInOrder(),scope=state.locationLibraryScope;
 const matches=[...index.values()].filter(({location,name})=>query?
   [name,location.notes].join(' ').toLowerCase().includes(query):(location.parentId||'')===scope);
 const counts=new Map();
 for(const node of state.p.nodes)for(const location of index.get(node.locationId)?.path||[])
   counts.set(location.id,(counts.get(location.id)||0)+1);
 const cards=matches.map(entry=>{
   const id=esc(entry.location.id);
   const controls=`<button type="button" class="small ghost" data-location-library-scope="${id}"
       title="${esc(t('查看子地点'))}" aria-label="${esc(t('查看子地点'))}">${icon('chevron',13)}</button>`;
   return renderLocationCard(entry,`data-library-location="${id}"`,
     query?entry.name:message`${counts.get(entry.location.id)||0} 个节点`,controls);
 }).join('');
 const parent=locationById(scope)?.parentId||'';
 return html`<div class="location-library-path">
   ${scope?`<button type="button" class="small ghost" data-location-library-scope="${esc(parent)}">${t('↑ 上一级')}</button>`:''}
   <span title="${esc(locationName(scope)||t('所有地点'))}">${esc(query?t('搜索全部地点'):locationName(scope)||t('所有地点'))}</span>
   ${scope&&!query?`<div class="location-card-controls">${locationCardActions(scope)}</div>`:''}
 </div>${cards||`<p class="hint">${t(query?'没有匹配的素材。':scope?'这里还没有子地点。':'点击右上角 ＋ 创建地点。')}</p>`}`;
}
function openLocationLibraryScope(id){
 if(id&&!locationById(id))return;
 state.locationLibraryScope=id;
 state.search='';
 state.focusedEntity=null;
 $('#library-search').value='';
 const list=$('.library-list');
 list.innerHTML=renderLocationLibrary('');
 list.scrollTop=0;
}
function openLocation(id,parentId=''){
 const location=locationById(id);
 state.modal={kind:'location',id:location?.id};
 showModal(t(location?'编辑地点':'新建地点'),html`
   <label for="location-name">地点名称</label>
   <input id="location-name" value="${esc(location?.name||'')}">
   <div class="form-row">
     <div><label for="location-parent">上级地点</label><select id="location-parent">
       ${locationOptions(location?.parentId??parentId,t('无上级地点'),id)}
     </select></div>
     <div><label for="location-color">范围颜色</label>
       <input id="location-color" type="color" value="${location?.color||locationById(parentId)?.color||DEFAULT_LOCATION_COLOR}">
     </div>
   </div>
   <label for="location-notes">备注</label>
   <textarea id="location-notes" rows="4">
${esc(location?.notes||'')}</textarea>
   <p class="hint">可把地点卡拖到画布节点上；框选多个节点后，也可以一次指定地点。</p>`,
   (location?deleteEntryButton('location')+button('location-new-child',t('新建子地点'),'ghost')+button('location-map',t('查看地点地图'),'ghost'):'')+
   button('modal-close',t('取消'))+button('location-save',t('保存'),'primary'),'narrow location-editor');
}
document.addEventListener('dblclick',event=>{
 const card=event.target.closest('[data-library-location]');
 if(card&&!event.target.closest('button'))openLocationLibraryScope(card.dataset.libraryLocation);
});
function locationOptions(selected,empty=t('未指定地点'),exclude){
 return `<option value="">${esc(empty)}</option>`+[...locationsInOrder().values()]
   .filter(({path})=>!exclude||!path.some(location=>location.id===exclude))
   .map(({location,name})=>
     `<option value="${esc(location.id)}" ${selected===location.id?'selected':''}>${esc(name)}</option>`).join('');
}
function openLocationAssignment(){
 const ids=[...state.selected];
 if(!ids.length)return;
 const current=new Set(ids.map(id=>nodeById(id)?.locationId||''));
 state.modal={kind:'location-assignment',ids};
 showModal(t('指定地点'),html`
   <p class="hint">此设置会应用到 ${ids.length} 个节点。</p>
   <label for="location-assignment">地点</label>
   <select id="location-assignment">${locationOptions(current.size===1?[...current][0]:'')}</select>`,
   button('modal-close',t('取消'))+button('location-assign-save',t('应用'),'primary'),'narrow');
}
function renderArtLibrary(query){
 const assets=(state.p.conceptArt||[]).filter(art=>[art.name,t(artLabels[art.category]),art.notes].join(' ').toLowerCase().includes(query));
 return html`<div class="art-library">
   ${button('art-add',icon('plus',14)+t(' 添加图片'),'small full')}
   ${assets.length?`<div class="art-grid">${assets.map(art=>`<button class="art-tile" draggable="true" data-drag-kind="art" data-drag-id="${esc(art.id)}" data-art-id="${esc(art.id)}" title="${esc(art.notes||art.name)}"><img src="${esc(art.image)}" alt="" loading="lazy"><strong>${esc(art.name)}</strong><span>${esc(t(artLabels[art.category]))}</span></button>`).join('')}</div>`
   :`<div class="hint">${t(query?'没有匹配的素材。':'在这里保存地图、角色设定和场景参考图。')}</div>`}
 </div>`;
}
function openArtAdd(){
 state.modal={kind:'art-add'};
 showModal(t('添加概念图'),html`
   <label for="art-files">选择图片</label>
   <input id="art-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
   <label for="art-category">分类</label>
   <select id="art-category">${ST.ART_CATEGORIES.map(key=>`<option value="${key}" ${key==='other'?'selected':''}>${t(artLabels[key])}</option>`).join('')}</select>
   <p class="hint">支持 PNG、JPEG、WebP 和 GIF。单张最多 4 MB，每个项目合计最多 12 MB。图片随项目一起保存和导出。</p>`,
   button('modal-close',t('取消'))+button('art-add-save',t('添加图片'),'primary'),'narrow');
}
function openArt(id){
 const art=(state.p.conceptArt||[]).find(asset=>asset.id===id);
 if(!art)return;
 state.modal={kind:'art',id};
 showModal(t('概念图'),html`
   <div class="art-preview"><img src="${esc(art.image)}" alt="${esc(art.name)}"></div>
   <div class="row art-view-tools">${button('art-zoom',t('原始大小'),'small ghost')}</div>
   <div class="form-row"><div><label for="art-name">名称</label><input id="art-name" value="${esc(art.name)}"></div>
   <div><label for="art-category">分类</label><select id="art-category">${ST.ART_CATEGORIES.map(key=>`<option value="${key}" ${key===art.category?'selected':''}>${t(artLabels[key])}</option>`).join('')}</select></div></div>
   <label for="art-notes">备注</label><textarea id="art-notes" rows="3">
${esc(art.notes)}</textarea>`,
   deleteEntryButton('art')+button('modal-close',t('关闭'))+button('art-save',t('保存'),'primary'),'wide');
}
function readArtImage(file){
 return new Promise((resolve,reject)=>{
   if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){reject(Error(t('仅支持 PNG、JPEG、WebP 或 GIF 图片')));return;}
   const reader=new FileReader();
   reader.onerror=()=>reject(Error(t('无法读取图片')));
   reader.onload=()=>{
     const image=new Image();
     image.onerror=()=>reject(Error(t('无法读取图片')));
     image.onload=()=>resolve(reader.result);
     image.src=reader.result;
   };
   reader.readAsDataURL(file);
 });
}
function openMapObject(destination,point){
 const arts=state.p.conceptArt||[];
 state.modal={kind:'map-object',destination,point};
 showModal(t('自定义物体'),html`
   <label for="map-object-name">物体名称</label>
   <input id="map-object-name" maxlength="80">
   <label for="map-object-art">图库图片</label>
   <select id="map-object-art"><option value="">选择已有图片</option>${arts.map(art=>`<option value="${esc(art.id)}">${esc(art.name)}</option>`).join('')}</select>
   <label for="map-object-file">或上传本地图片</label>
   <input id="map-object-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">`,
   button('modal-close',t('取消'))+button('map-object-save',t('放入地图'),'primary'),'narrow');
}
function openExcelImport(){
 const kind=state.tab==='items'?'item':'character';
 state.modal={kind:'excel-import',cardKind:kind,preview:null,fileName:''};
 showModal(t('从 Excel 批量导入'),html`
   <p class="inline-note">首行填写列名，名称必填。工作表命名为「角色」或「物品」，也可使用 Characters 或 Items。一份工作簿可同时导入两类卡片。</p>
   <p class="smalltext">${window.desktop?button('excel-template',t('下载 Excel 模板'),'small'):`<a href="/excel-import-template.xlsx" download>${t('下载 Excel 模板')}</a>`}</p>
   <p class="hint">${kind==='item'?t('工作表未使用上述名称时，第一张表按物品导入。'):t('工作表未使用上述名称时，第一张表按角色导入。')} ${t('导入会新增卡片，并按分组名称归类。')}</p>
   <label for="excel-file">选择 .xlsx 文件</label><input id="excel-file" type="file" accept=".xlsx">
   <div id="excel-preview" aria-live="polite"></div>`,
   button('modal-close',t('取消'))+`<button class="primary" data-action="excel-save" disabled>${t('确认导入')}</button>`,'');
}
function openScriptImport(){
 state.modal={kind:'script-import',preview:null};
 showModal(t('从 TXT 导入剧本'),html`
   <p class="inline-note">根据场景标题、对白标记和段落拆分节点。先看预览，确认后会把新场景追加到当前项目。</p>
   <label for="script-file">选择 .txt 文件</label>
   <div class="row script-file-row"><input id="script-file" type="file" accept=".txt,text/plain">${button('script-example',t('试用示例'),'small')}</div>
   <p class="hint">支持「场景：码头」、INT./EXT.、Markdown 标题和「角色：对白」。无法识别的段落保留为独白。</p>
   <p class="hint">用「日期：1024.04.16」标注当前场景内的日期。缺少明确年月日的段落会保留为未定日期。</p>
   <div class="script-import-options">
     <label class="check-row"><input id="script-create-characters" type="checkbox" checked>为新说话者创建角色卡</label>
     <label class="check-row"><input id="script-connect-scenes" type="checkbox" checked>用跳转节点连接新场景</label>
   </div>
   <div id="script-preview-status" class="script-preview-status" aria-live="polite"></div>
   <div id="script-preview"></div>`,
   button('modal-close',t('取消'))+`<button class="primary" data-action="script-save" disabled>${t('确认导入剧本')}</button>`,'wide');
}
function scriptLineLabel(first,last=first){
 const span=first===last?String(first):first+'–'+last;
 return state.language==='en'?'Line '+span:'第 '+span+' 行';
}
function renderScriptSummary(){
 const preview=state.modal?.preview;
 if(!preview)return;
 const nonempty=preview.scenes.filter(scene=>scene.nodes.length).length;
 const jumps=$('#script-connect-scenes').checked?Math.max(0,nonempty-1):0;
 const speakers=StoryScript.resolveSpeakers(state.p,preview);
 const matched=speakers.filter(speaker=>speaker.id).length;
 const fresh=$('#script-create-characters').checked?speakers.filter(speaker=>!speaker.id && !speaker.ambiguous).length:0;
 const ambiguous=speakers.filter(speaker=>speaker.ambiguous);
 const undated=preview.scenes.reduce((count,scene)=>count+scene.nodes.filter(node=>!node.date).length,0);
 const counts=state.language==='en'
   ?[`${preview.scenes.length} scenes`,`${preview.nodeCount} content nodes`,`${jumps} jumps`,`${undated} undated`]
   :[`${preview.scenes.length} 个场景`,`${preview.nodeCount} 个正文节点`,`${jumps} 个跳转`,`${undated} 个未定日期`];
 const byline=state.language==='en'?`Reuse ${matched} character cards · Create ${fresh}`:`复用 ${matched} 张角色卡 · 新建 ${fresh} 张`;
 const oversized=preview.nodeCount+jumps>StoryScript.MAX_NODES;
 $('#script-preview-status').innerHTML=`
   <div class="script-source-name">${esc(preview.file)} <span class="muted">· ${esc(preview.encoding.toUpperCase())}</span></div>
   <div class="script-summary-chips">${counts.map(count=>`<span class="pill">${esc(count)}</span>`).join('')}</div>
   <p class="smalltext">${esc(byline)}</p>
   ${ambiguous.length?`<p class="hint">${esc(t('以下名字对应多张角色卡，导入时会保留原说话者名字。'))} ${esc(ambiguous.map(speaker=>speaker.name).join(', '))}</p>`:''}
   ${oversized?`<p class="error">${t('每次最多导入 500 个节点（含跳转）')}</p>`:''}`;
 $('[data-action="script-save"]').disabled=oversized;
}
function renderScriptNodes(index){
 const scene=state.modal.preview.scenes[index];
 $('#script-node-list').innerHTML=scene.nodes.map(node=>{
   const body=node.type==='dialogue'?node.lines.map(line=>line.name+'：'+line.text).join('\n'):node.text;
   return `<details class="script-preview-node">
     <summary><span class="script-node-type">${esc(nodeType(node.type))}</span><strong>${esc(node.title)}</strong>
       <span class="script-node-meta">${esc(dateLabel(node.date))} · ${esc(scriptLineLabel(node.firstLine,node.lastLine))}</span></summary>
     <div class="script-node-text">${esc(body)}</div>
   </details>`;
 }).join('')||`<p class="hint">${t('这个场景只有标题。')}</p>`;
}
async function previewScript(file){
 const modal=state.modal;
 const request=Symbol();
 modal.request=request;
 modal.preview=null;
 const status=$('#script-preview-status');
 status.textContent='';
 $('#script-preview').innerHTML='';
 $('[data-action="script-save"]').disabled=true;
 if(!file)return;
 status.textContent=t('正在拆分剧本…');
 try{
   if(!/\.txt$/iu.test(file.name))throw Error('请选择 .txt 剧本文件');
   if(file.size>StoryScript.FILE_LIMIT)throw Error('TXT 文件最大为 1 MB');
   const {text,encoding}=StoryScript.decode(await file.arrayBuffer());
   if(state.modal!==modal || modal.request!==request)return;
   const preview=StoryScript.parse(text,file.name,state.p.characters);
   if(!preview.nodeCount)throw Error('没有找到可以导入的剧本正文');
   modal.preview={...preview,encoding};
   const warning=preview.warnings.length?`<p class="error">${esc(t('以下行的日期无效，原文已保留。'))} ${esc(preview.warnings.slice(0,12).map(warning=>warning.line).join(', '))}${preview.warnings.length>12?'…':''}</p>`:'';
   $('#script-preview').innerHTML=`
     ${warning}
     <label for="script-preview-scene">${t('场景预览')}</label>
     <select id="script-preview-scene">${preview.scenes.map((scene,index)=>`<option value="${index}">${index+1}. ${esc(scene.name)} (${scene.nodes.length})</option>`).join('')}</select>
     <div id="script-node-list"></div>`;
   renderScriptSummary();
   renderScriptNodes(0);
 }catch(error){
   if(state.modal===modal && modal.request===request)status.textContent=localizeError(error.message);
 }
}
async function previewExcel(file){
 const modal=state.modal;
 const panel=$('#excel-preview'),save=$('[data-action="excel-save"]');
 modal.preview=null;
 const request=Symbol();
 modal.request=request;
 save.disabled=true;
 if(!file){panel.innerHTML='';return;}
 panel.textContent=t('正在读取工作簿…');
 try{
   const result=await api('excel?kind='+modal.cardKind,file);
   if(state.modal!==modal || modal.request!==request)return;
   if(result.errorCount){
     const heading=state.language==='en'?`Errors found (${result.errorCount}). Update the workbook and choose it again.`:`发现 ${result.errorCount} 处错误。请修改工作簿后重新选择。`;
     panel.innerHTML=`<p class="error">${esc(heading)}</p><ul class="import-errors">${result.errors.map(error=>{
       const row=state.language==='en'?`Row ${error.row}`:`第 ${error.row} 行`;
       return `<li>${esc([error.sheet,row,t(error.message),error.detail].filter(Boolean).join(' · '))}</li>`;
     }).join('')}</ul>`;
     return;
   }
   const {characters,items}=result;
   if(!characters.length && !items.length){panel.textContent=t('工作簿里没有可导入的卡片。');return;}
   const list=(cards,label)=>!cards.length?'':`<section><strong>${label} · ${cards.length}</strong><ul>${cards.slice(0,8).map(card=>`<li>${esc(card.name)} ${card.group?`<span class="muted">· ${esc(card.group)}</span>`:''}</li>`).join('')}</ul>${cards.length>8?`<span class="muted">${state.language==='en'?`+${cards.length-8} more`:`另有 ${cards.length-8} 张卡片`}</span>`:''}</section>`;
   panel.innerHTML=`<div class="excel-summary">${list(characters,t('角色'))}${list(items,t('物品'))}</div>`;
   modal.preview={characters,items};
   save.disabled=false;
 }catch(error){
   if(state.modal===modal && modal.request===request)panel.textContent=localizeError(error.message);
 }
}
function dialogueLog(n){
 return `<div class="node-dialogue-log" aria-label="${esc(t('对白日志'))}">${n.lines.map(line=>{
   const name=speakerName(line.characterId,n);
   const text=(line.text||'').replace(/[\r\n]+/gu,' ');
   return `<div class="node-log-line" title="${esc(name+'：'+previewCharacterText(line.text||'',n))}"><span class="node-log-speaker">${esc(name)}：</span>${richText(text,n)}</div>`;
 }).join('')}</div>`;
}
function nodeBody(n){let h=`<div class="node-date">${icon('clock',10)} ${esc(dateLabel(n.date))}</div>`;if(n.summary)h+=`<div class="node-summary">${richText(n.summary,n)}</div>`;
 if(n.type==='dialogue')h+=dialogueLog(n);
 if(n.type==='monologue')h+=`<div class="node-text">${n.speakerId?'<span class="node-speaker">'+esc(speakerName(n.speakerId,n))+' · </span>':''}${richText(n.text||t('双击节点，写下这一刻…'),n)}</div>`;
 if(n.type==='event'||n.type==='label'){h+=n.type==='event'?`<span class="event-kind">${esc(eventTypeLabel(n.eventType))}</span>`:html`<div class="condition-line">标签匹配：${esc(n.labelQuery.tags.join(' + ')||t('尚未指定'))}</div>`;if(n.text)h+=`<div class="node-text" style="margin-top:8px">${richText(n.text,n)}</div>`;h+=n.operations.slice(0,3).map(o=>`<div class="pending-line">${esc(operationText(o))}</div>`).join('');if(!n.operations.length)h+=staticHtml('<div class="hint">将角色拖入，设计待发生的变化</div>');if(n.operations.length>3)h+=html`<div class="tiny muted">另有 ${n.operations.length-3} 项待变化</div>`;}
 if(n.type==='event'&&n.lines.some(line=>line.text?.trim()))h+=dialogueLog(n);
 if(n.type==='condition')h+=`<div class="condition-line">${richText(n.condition.description||t('设置一个判断条件'),n)}</div><span class="tiny muted">${n.condition.mode==='manual'?t('手动判定 · ')+(n.condition.value?t('真'):t('假')):t('结构化规则 · ')+n.condition.rules.length+t(' 条')} · ${n.condition.rollback==='all'?(n.condition.rollbackWhen==='true'?t('真分支'):t('假分支'))+t('回溯事件'):n.condition.rollback==='selected'?t('按条件豁免角色'):t('保留事件')}</span>`;
 if(n.type==='jump'){const target=nodeById(n.targetNodeId);h+=`<div class="row" style="color:#ce9cbb">${icon('jump',15)}<span>${esc(target?ST.sceneOf(state.p,target.sceneId).name+' / '+target.title:t('选择跨场景跳转目标'))}</span></div>`;}
 return h;
}
function operationText(o){const name=o.targetTag?t('标签「')+o.targetTag+'」':charName(o.characterId),value=o.value;
 if(o.kind==='characterField'){
   const field=t(characterFieldLabels[o.key]);
   if(o.input)return [
     `${name} · ${field} ← ${t('由玩家输入')}`,
     `${t('输入提示')}「${o.input.prompt}」`,
     `${t('默认名称')}「${value||name}」`,
     `${t('输入 ID')} ${o.input.id}`
   ].join(' · ');
   return `${name} · ${field} ${o.key==='displayName'?'→ '+(value||charName(o.characterId)):t('更新')}`;
 }
 if(o.kind==='itemAttribute')return message`${name} · ${itemName(o.itemId)}的${o.key} ${o.mode==='add'?(Number(value)>=0?'+':''):'→'}${value}`;
 if(o.kind==='transfer')return `${name} → ${charName(o.toCharacterId)} · ${itemName(o.itemId)} ×${value}`;
 if(o.kind==='item')return `${name} · ${itemName(o.itemId)} ${o.mode==='set'?'→':Number(value)>=0?'+':''}${value}`;
 if(o.kind==='tag')return message`${name} ${o.mode==='remove'?t('移除'):t('添加')}标签「${o.key}」`;
 return `${name} · ${o.key} ${o.mode==='add'?(Number(value)>=0?'+':''):'→'}${value}${o.kind==='skill'?' / 10':''}`;
}
const characterFieldLabels={displayName:'角色名称',summary:'简介',details:'详情',image:'形象图片',groupId:'角色分组'};
function nodeLogText(node){
 const sections=[node.title, [nodeType(node.type),ST.sceneOf(state.p,node.sceneId).name,dateLabel(node.date)].join(' · ')];
 const add=(label,lines)=>{
   const content=[lines].flat().filter(value=>value!==undefined&&value!==null&&value!=='').join('\n');
   if(content)sections.push(t(label)+'\n'+content);
 };
 add('简介 / 创作笔记',node.summary);
 add('地点',locationName(node.locationId));
 switch(node.type){
   case 'dialogue':
     add('对白日志',node.lines.map(line=>speakerName(line.characterId,node)+'：'+(line.text||'')));
     break;
   case 'monologue':
     add('正文',speakerName(node.speakerId,node)+'：'+(node.text||''));
     break;
   case 'event':
     add('事件类型',eventTypeLabel(node.eventType));
     add('正文',node.text);
     add('阵营 A',node.factions.A.map(charName).join('、'));
     add('阵营 B',node.factions.B.map(charName).join('、'));
     add('对白日志',node.lines.filter(line=>line.text?.trim()).map(line=>speakerName(line.characterId,node)+'：'+line.text));
     break;
   case 'condition':{
     const condition=node.condition;
     add('条件描述',condition.description);
     add('判定方式',condition.mode==='manual'
       ?t('手动判定')+' · '+t(condition.value?'真':'假'):t('结构化规则'));
     add('结构化规则',condition.rules.map(rule=>{
       const key=rule.kind==='item'?itemName(rule.key):rule.key;
       const operator={eq:'=',ne:'≠',gt:'>',gte:'≥',lt:'<',lte:'≤'}[rule.op]||rule.op;
       return [rule.characterId?charName(rule.characterId):'',key,operator,rule.value].filter(value=>value!=='').join(' ');
     }));
     const source=nodeById(condition.sourceEventId);
     if(source)add('回溯的事件',source.title);
     break;
   }
   case 'jump':{
     const target=nodeById(node.targetNodeId);
     add('跳转目标',target?[ST.sceneOf(state.p,target.sceneId).name,target.title,dateLabel(target.date)].join(' · '):t('尚未指定'));
     break;
   }
   case 'label':
     add('匹配对象',t(node.labelQuery.entity==='item'?'角色携带的物品标签':'角色标签'));
     add('标签',node.labelQuery.tags.join('、'));
     add('正文',node.text);
     break;
 }
 add('待变化',node.operations.map(operationText));
 const references=ST.nodeCharacterReferences(node);
 if(references.length){
   const characters=referenceCharacters(node);
   add('角色变量',references.map(ref=>{
     const value=ST.characterReferenceValue(ref,characters,state.p);
     const label=charName(ref.characterId)+' / '+referenceLabel(ref);
     return `${ref.token} · ${label} · ${t('预览值')} ${formatReferenceValue(value,ref)}`;
   }));
 }
 add('参与素材',node.refs.map(ref=>ref.kind==='character'?charName(ref.id):itemName(ref.id)).join('、'));
 add('输出点',node.outputs.map((label,index)=>{
   const targets=state.p.edges.filter(edge=>edge.from===node.id&&edge.output===index).map(edge=>nodeById(edge.to)?.title).filter(Boolean);
   return targets.length?label+' → '+targets.join('、'):label;
 }));
 return sections.join('\n\n')+'\n';
}
async function openNodeLog(id){
 if(!id||!await flushDrafts(id))return;
 const node=nodeById(id);
 if(!node)return;
 const text=nodeLogText(node);
 state.modal={kind:'node-log',id,title:node.title,text};
 showModal(t('节点日志')+' · '+node.title,`<pre class="node-log-preview" tabindex="0">${renderReferenceText(text,node,undefined,esc)}</pre>`,
   button('modal-close',t('关闭'))+(ST.hasDialogue(node)?button('dialogue-log-edit',t('编辑对白日志')):'')+
   button('node-log-export',t('导出节点日志'),'primary'),'wide');
}
async function openDialogueEditor(id,index){
 if(!id||!await flushDrafts(id))return;
 const node=nodeById(id);
 if(!ST.hasDialogue(node)||(index!==undefined&&!node.lines[index]))return;
 const bulk=index===undefined;
 const value=bulk?ST.dialogueLogText(node,state.p.characters):node.lines[index].text;
 const hasBody=bulk&&node.type==='event';
 state.modal={kind:'dialogue-edit',id,index,projectId:state.p.id,lines:ST.clone(node.lines),body:node.text};
 showModal(t(bulk?'编辑对白日志':'放大编辑对白')+' · '+node.title,html`
   ${bulk?html`<p class="hint">每句以角色 ID 和冒号开头。冒号前留空表示旁白，Shift+Enter 在同一句内换行。</p>`:
     `<p class="dialogue-edit-speaker">${esc(speakerOption(node.lines[index].characterId,node))}</p>`}
   <textarea id="dialogue-edit-text" class="dialogue-edit-text" aria-label="${esc(t(bulk?'对白日志':'对白'))}" spellcheck="false">${'\n'+esc(value)}</textarea>
   ${hasBody?html`<label for="dialogue-edit-body">事件正文</label><textarea id="dialogue-edit-body" rows="4">${'\n'+esc(node.text)}</textarea>`:''}
   <p id="dialogue-edit-error" class="error" role="alert" hidden></p>`,
   button('text-find',t('查找'),'ghost left')+button('text-replace',t('替换'),'ghost',t('查找替换 · Ctrl+H'))+
   button('modal-close',t('取消'))+button('dialogue-edit-save',t('应用修改'),'primary'),'wide');
 const text=$('#dialogue-edit-text');
 state.modal.initial=text.value;
 state.modal.initialBody=$('#dialogue-edit-body')?.value;
 text.focus();
}
function dialogueEditPatch(modal){
 const node=nodeById(modal.id);
 const text=$('#dialogue-edit-text').value,body=$('#dialogue-edit-body')?.value;
 const changedText=text!==modal.initial,changedBody=body!==modal.initialBody;
 if(!changedText&&!changedBody)return null;
 if(state.p.id!==modal.projectId||!ST.hasDialogue(node)||
   (changedText&&!sameValue(node.lines,modal.lines))||(changedBody&&node.text!==modal.body)){
   throw Error(t('节点内容已在别处修改，请保留草稿后重新打开。'));
 }
 const patch={};
 if(changedBody)patch.text=body;
 if(changedText&&modal.index!==undefined)patch.lines=node.lines.map((line,i)=>i===modal.index?{...line,text}:line);
 if(changedText&&modal.index===undefined){
   try{patch.lines=ST.parseDialogueLog(text,node,state.p.characters);}
   catch(error){
     if(error.line)throw Error(t('日志第 {line} 行').replace('{line}',error.line)+' · '+t(error.message));
     throw error;
   }
   // Freeze the previous default before a newly referenced speaker expands the node's roster.
   if(!node.dialogueRule)patch.dialogueRule=ST.clone(ST.defaultDialogueRule(node));
 }
 return patch;
}
function saveDialogueEditor(modal){
 if(modal.saving)return modal.saving;
 const save=$('.modal-footer [data-action="dialogue-edit-save"]'),error=$('#dialogue-edit-error');
 const textarea=$('#dialogue-edit-text'),body=$('#dialogue-edit-body');
 save.disabled=true;
 textarea.readOnly=true;
 if(body)body.readOnly=true;
 error.hidden=true;
 modal.saving=(async()=>{
   try{
     if(!dialogueEditPatch(modal)){closeModal();return true;}
     await run(()=>{
       const patch=dialogueEditPatch(modal);
       return patch?[{type:'node.update',args:{id:modal.id,patch}}]:[];
     },t('节点内容已更新'));
     if(state.rolePicker?.nodeId===modal.id)state.rolePicker=null;
     if(state.modal===modal)closeModal();
     render();
     if(modal.index!==undefined)focusDialogueLine(modal.id,modal.index);
     return true;
   }catch(err){
     error.textContent=localizeError(err.message);
     error.hidden=false;
     return false;
   }finally{
     save.disabled=false;
     textarea.readOnly=false;
     if(body)body.readOnly=false;
   }
 })();
 return modal.saving.finally(()=>{delete modal.saving;});
}
function renderGraph() {
  if(state.mapOpen)return;
  const nodes = state.p.nodes.filter(n => n.sceneId === state.p.currentSceneId);
  $('#nodes').innerHTML = nodes.map(n => html`<article class="node ${n.type} ${state.selected.has(n.id)?'selected':''}" data-node="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;min-height:${112+n.outputs.length*27}px">
    <div class="node-head" data-node-drag="${esc(n.id)}"><span class="type-icon">${icon(n.type,16)}</span><strong>${esc(n.title)}</strong><span class="type-name">${nodeType(n.type)}</span><button type="button" class="node-outline-grip" draggable="true" data-drag-kind="node" data-drag-id="${esc(n.id)}" title="拖入大纲" aria-label="拖入大纲">⠿</button></div>
    <div class="node-body">${n.locationId?`<div class="node-location" title="${esc(locationById(n.locationId)?.notes||'')}">${icon('scenes',11)} ${esc(locationById(n.locationId)?.name||'')}</div>`:''}${nodeBody(n)}</div>
    <div class="node-footer">${n.refs.map(r=>entityChip(r,`data-in-node="${esc(n.id)}"`)).join('')||staticHtml('<span class="muted tiny">将素材拖到这里</span>')}</div>
    <button class="port input" data-port-in="${esc(n.id)}" title="输入点（可接受任意数量连线）" aria-label="${esc(n.title)} 输入"></button>
    ${n.outputs.map((output,i)=>html`<span class="port-label" style="top:${68+i*27}px">${n.outputs.length>1?esc(n.type==='condition'?t(output):output):''}</span><button class="port output" style="top:${68+i*27}px" data-port-out="${esc(n.id)}" data-output="${i}" title="输出：${esc(output)}" aria-label="${esc(n.title)} 输出 ${i}"></button>`).join('')}
    ${['dialogue','monologue','event'].includes(n.type)?html`<button class="add-port" data-add-port="${esc(n.id)}" title="增加输出点">+</button>`:''}
    <button type="button" class="overview-node" data-overview-node="${esc(n.id)}" data-node-drag="${esc(n.id)}" aria-label="${esc(n.title)} · ${nodeType(n.type)}"></button>
  </article>`).join('');
  applyView();
  renderEdges();
  renderMinimap();
}
function pathFor(a,b){const delta=Math.max(85,Math.abs(b.x-a.x)*.5);return `M${a.x},${a.y} C${a.x+delta},${a.y} ${b.x-delta},${b.y} ${b.x},${b.y}`;}
function inOverview() {
  return !state.link && state.view.zoom * 100 < state.overviewAt;
}
function overviewSize() {
  return 18 / state.view.zoom;
}
const LOCATION_LEVEL_GAP=44;
let locationRegionScene,locationRegionBounds=new Map();
function renderLocationRegions(nodes,compact,radius){
 const layer=$('#location-regions');
 if(!layer)return;
 const locations=locationsInOrder(),bounds=new Map();
 const elements=new Map([...$$('[data-node]')].map(el=>[el.dataset.node,el]));
 for(const node of nodes.values()){
   const entry=locations.get(node.locationId);
   if(!entry)continue;
   const left=compact?node.x+150-radius:node.x,top=compact?node.y+68-radius:node.y;
   const element=elements.get(node.id);
   const right=left+(compact?radius*2:(element?.offsetWidth||300));
   const bottom=top+(compact?radius*2:(element?.offsetHeight||240));
   for(const [depth,location] of entry.path.entries()){
     const extra=(entry.depth-depth)*LOCATION_LEVEL_GAP;
     const box=bounds.get(location.id)||{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity,depth};
     box.left=Math.min(box.left,left-24-extra);
     box.top=Math.min(box.top,top-34-extra);
     box.right=Math.max(box.right,right+24+extra);
     box.bottom=Math.max(box.bottom,bottom+22+extra);
     bounds.set(location.id,box);
   }
 }
 locationRegionScene=state.p.currentSceneId;
 const guide=sceneMapView.guideMarkup();
 const guided=guide&&!state.mapLayers.locations.hidden?new Set(ST.sceneMap(currentScene(),sceneMapView.session().scope).areas.map(area=>area.locationId)):new Set();
 for(const id of guided)bounds.delete(id);
 locationRegionBounds=bounds;
 layer.innerHTML=guide+[...locations.values()].filter(({location})=>bounds.has(location.id)).map(({location,name})=>{
   const {left,top,right,bottom}=bounds.get(location.id);
   return `<div class="location-region" data-location-region="${esc(location.id)}" aria-label="${esc(name)}"
     style="left:${left}px;top:${top}px;width:${right-left}px;height:${bottom-top}px;--location-color:${location.color||DEFAULT_LOCATION_COLOR}">
     <span>${esc(location.name)}</span></div>`;
 }).join('');
}
function locationAtPoint(x,y){
 const mapped=sceneMapView.guideLocationAt(x,y);
 if(mapped)return mapped;
 if(locationRegionScene!==state.p.currentSceneId)return '';
 let bestId='',bestDepth=-1,bestArea=Infinity;
 for(const [id,{left,top,right,bottom,depth}] of locationRegionBounds){
   if(x<left||x>right||y<top||y>bottom)continue;
   const area=(right-left)*(bottom-top);
   if(depth<bestDepth||depth===bestDepth&&area>=bestArea)continue;
   bestId=id;
   bestDepth=depth;
   bestArea=area;
 }
 return bestId;
}
function renderEdges() {
  const compact = inOverview();
  const radius = overviewSize() / 2;
  const nodes = new Map(state.p.nodes.filter(n => n.sceneId === state.p.currentSceneId).map(n => [n.id,n]));
  renderLocationRegions(nodes,compact,radius);
  const paths = state.p.edges.map(edge => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (!a || !b) return '';
    const from = compact ? {x:a.x+150+radius,y:a.y+68} : {x:a.x+300,y:a.y+68+edge.output*27};
    const to = compact ? {x:b.x+150-radius,y:b.y+68} : {x:b.x,y:b.y+68};
    const branchClass = a.type==='condition' ? (edge.output===0?'true':'false') : '';
    const label = !compact && a.outputs.length>1
      ? `<text class="edge-label" x="${(from.x+to.x)/2}" y="${(from.y+to.y)/2-9}">${esc(a.type==='condition'?t(a.outputs[edge.output]):a.outputs[edge.output])}</text>`
      : '';
    return html`<path class="edge-line ${branchClass}" d="${pathFor(from,to)}" marker-end="url(#arrow)" data-edge="${esc(edge.id)}"><title>双击移除连线</title></path>${label}`;
  });
  $('#edges').innerHTML = '<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#8e81ab" stroke-width="1"/></marker></defs>' + paths.join('');
}
function renderMinimap(){const ns=state.p.nodes.filter(n=>n.sceneId===state.p.currentSceneId);if(!ns.length){$('#minimap').innerHTML='';return;}const minX=Math.min(...ns.map(n=>n.x))-40,minY=Math.min(...ns.map(n=>n.y))-40,w=Math.max(...ns.map(n=>n.x+300))-minX+40,h=Math.max(...ns.map(n=>n.y+220))-minY+40;
 const v=state.view,c=$('#canvas');$('#minimap').innerHTML=`<svg width="100%" height="100%" viewBox="${minX} ${minY} ${w} ${h}">${state.p.edges.filter(e=>nodeById(e.from)?.sceneId===state.p.currentSceneId).map(e=>{const a=nodeById(e.from),b=nodeById(e.to);return `<path d="${pathFor({x:a.x+300,y:a.y+68},{x:b.x,y:b.y+68})}" fill="none" stroke="#686077" stroke-width="8"/>`;}).join('')}${ns.map(n=>`<rect x="${n.x}" y="${n.y}" width="300" height="180" rx="13" fill="${state.selected.has(n.id)?'#b19adf':'#635877'}"/>`).join('')}<rect x="${-v.x/v.zoom}" y="${-v.y/v.zoom}" width="${c.clientWidth/v.zoom}" height="${c.clientHeight/v.zoom}" fill="#a58dd311" stroke="#a58dd3" stroke-width="8"/></svg>`;}
function applyView() {
  const v = state.view, canvas = $('#canvas');
  if (!canvas) return;
  const compact = inOverview();
  const oldCompact = canvas.classList.contains('overview');
  const size = overviewSize() + 'px';
  const resized = canvas.style.getPropertyValue('--overview-size') !== size;
  hideOverviewTip();
  canvas.classList.toggle('overview', compact);
  canvas.style.setProperty('--overview-size', size);
  $('#stage').style.transform = `translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
  canvas.style.backgroundSize = `${24*v.zoom}px ${24*v.zoom}px`;
  canvas.style.backgroundPosition = `${v.x}px ${v.y}px`;
  $('#zoom-text').textContent = Math.round(v.zoom*100) + '%' + (compact?t(' · 概览'):'');
  if (oldCompact !== compact || (compact && resized)) renderEdges();
}
const hasReference=text=>typeof text==='string'&&(text.includes('{{attr:')||text.includes('{{char:'));
let referenceProject;
const referenceSnapshots=new Map();
function referenceCharacters(node){
 if(referenceProject!==state.p){referenceProject=state.p;referenceSnapshots.clear();}
 if(!referenceSnapshots.has(node.id)){
   referenceSnapshots.set(node.id,getTimelineEntries().find(entry=>entry.id===node.id)?.result?.after||nodeCharacters(node.id));
 }
 return referenceSnapshots.get(node.id);
}
function formatReferenceValue(value,ref){
 if(ref.field==='image'&&value)return '['+t('形象图片')+']';
 if(Array.isArray(value))return value.join(state.language==='en'?', ':'、');
 return String(value??ref.token);
}
function referenceLabel(ref){
 const keys=['item','inventory','itemAttributes'].includes(ref.field)?[itemName(ref.keys[0]),...ref.keys.slice(1)]:ref.keys;
 return [t(characterReferenceLabels[ref.field]),...keys].join(' / ');
}
function renderReferenceText(text,node,characters,renderText){
 if(!hasReference(text))return renderText(text);
 characters||=referenceCharacters(node);
 return ST.characterTextParts(text).map(part=>{
   if(typeof part==='string')return renderText(part);
   const value=ST.characterReferenceValue(part,characters,state.p);
   const label=referenceLabel(part),preview=formatReferenceValue(value,part).trim();
   const short=part.field!=='image'&&value!==undefined&&preview.length<=30&&!/[\r\n]/u.test(preview)?preview:'';
   return `<a class="node-variable-link" href="#character-variable" aria-haspopup="dialog" draggable="false"
     data-variable-link="${esc(part.token)}" data-variable-node="${esc(node.id)}"
     title="${esc(charName(part.characterId)+' · '+label)}">${esc(short||label)}</a>`;
 }).join('');
}
function richText(text,node,characters){
 return renderReferenceText(text,node,characters,part=>renderTextMentions(part,node));
}
function openVariableLink(link){
 const node=nodeById(link.dataset.variableNode),[ref]=ST.characterTextParts(link.dataset.variableLink);
 if(!node||!ref?.characterId)return;
 const trace=state.modal?.kind==='simulation'?state.modal.result.history.find(step=>step.nodeId===node.id):null;
 const characters=trace?.after||referenceCharacters(node);
 const value=ST.characterReferenceValue(ref,characters,state.p);
 const character=characters[ref.characterId];
 const name=ST.characterDisplayName(character)||charName(ref.characterId);
 const dialog=document.createElement('dialog');
 dialog.className='variable-details';
 dialog.setAttribute('aria-labelledby','variable-details-title');
 const contents=ref.field==='image'&&value
   ?`<img class="variable-detail-image" src="${esc(value)}" alt="${esc(name)}">`
   :`<div class="variable-detail-value">${esc(value===undefined||value===''||Array.isArray(value)&&!value.length?t('暂无可用值'):formatReferenceValue(value,ref))}</div>`;
 dialog.innerHTML=html`<h2 id="variable-details-title">${esc(referenceLabel(ref))}</h2>
   <div class="muted smalltext">${esc(name+' · '+node.title)}</div>
   ${contents}
   <form method="dialog"><button class="primary" autofocus>关闭</button></form>`;
 document.body.append(dialog);
 dialog.addEventListener('close',()=>{
   dialog.remove();
   if(link.isConnected)link.focus({preventScroll:true});
 },{once:true});
 dialog.showModal();
}
function previewCharacterText(text,node){
 if(!hasReference(text))return text;
 return ST.resolveCharacterText(text,referenceCharacters(node),state.p,formatReferenceValue);
}
function nodePreview(n) {
  const text = n.summary || n.text || n.condition?.description || n.lines?.find(line => line.text)?.text || '';
  const oneLine = previewCharacterText(text,n).replace(/\s+/g,' ').trim();
  return oneLine.length > 120 ? oneLine.slice(0,117) + '…' : oneLine;
}
function hideOverviewTip() {
  $('#overview-tip')?.remove();
}
function showOverviewTip(target) {
  const node = nodeById(target.dataset.overviewNode);
  if (!node || !inOverview()) return;
  hideOverviewTip();
  const tip = document.createElement('div');
  tip.id = 'overview-tip';
  tip.className = 'tooltip overview-tip';
  tip.setAttribute('role','tooltip');
  const summary = nodePreview(node);
  tip.innerHTML = `<strong>${esc(node.title)}</strong><div class="overview-meta">${esc(nodeType(node.type))} · ${esc(dateLabel(node.date))}</div>${summary?`<div>${esc(summary)}</div>`:''}`;
  document.body.append(tip);
  const rect = target.getBoundingClientRect();
  tip.style.left = Math.max(8,Math.min(rect.left,innerWidth-tip.offsetWidth-12))+'px';
  tip.style.top = (rect.bottom+tip.offsetHeight+14 < innerHeight ? rect.bottom+8 : rect.top-tip.offsetHeight-8)+'px';
}
function worldPoint(e){const r=$('#canvas').getBoundingClientRect();return {x:(e.clientX-r.left-state.view.x)/state.view.zoom,y:(e.clientY-r.top-state.view.y)/state.view.zoom};}
function zoomAt(factor,clientX,clientY){const c=$('#canvas'),r=c.getBoundingClientRect(),cx=(clientX??r.left+r.width/2)-r.left,cy=(clientY??r.top+r.height/2)-r.top,v=state.view,z=Math.min(1.8,Math.max(.2,v.zoom*factor));v.x=cx-(cx-v.x)*z/v.zoom;v.y=cy-(cy-v.y)*z/v.zoom;v.zoom=z;applyView();renderMinimap();}
function fitGraph(){
 if(state.mapOpen)return;
 const nodes=state.p.nodes.filter(node=>node.sceneId===state.p.currentSceneId);
 if(!nodes.length){state.view={x:70,y:80,zoom:1};applyView();return;}
 const canvas=$('#canvas');
 const minX=Math.min(...nodes.map(node=>node.x))-60,minY=Math.min(...nodes.map(node=>node.y))-60;
 const maxX=Math.max(...nodes.map(node=>node.x+300))+60,maxY=Math.max(...nodes.map(node=>node.y+nodeHeight(node.id)))+60;
 const zoom=Math.max(.2,Math.min(1.05,canvas.clientWidth/(maxX-minX),canvas.clientHeight/(maxY-minY)));
 state.view={x:(canvas.clientWidth-(maxX-minX)*zoom)/2-minX*zoom,y:(canvas.clientHeight-(maxY-minY)*zoom)/2-minY*zoom,zoom};
 applyView();
 renderMinimap();
}
function nodeHeight(id){return [...$$('.node')].find(el=>el.dataset.node===id)?.offsetHeight||240;}
const dateFields = [
  {key:'year', label:t('年'), width:4},
  {key:'month', label:t('月'), width:2},
  {key:'day', label:t('日'), width:2}
];

function normalizeStoryDate(text) {
  if(!text.trim())return '';
  const match = text.trim().match(/^(\d{1,4})([./-])(\d{1,2})\2(\d{1,2})$/);
  if (!match) return null;
  try {
    return ST.dateText([match[1],match[3],match[4]].join('.'));
  } catch {
    return null;
  }
}

function daysInMonth(year, month) {
  const end = new Date(0);
  end.setUTCFullYear(year, month, 0);
  return end.getUTCDate();
}

function stepStoryDate(value, field, direction) {
  const [year,month,day] = value.split('.').map(Number);
  const date = new Date(0);
  if (field === 'day') date.setUTCFullYear(year,month-1,day+direction);
  else date.setUTCFullYear(year+(field==='year'?direction:0),month-1+(field==='month'?direction:0),1);
  const nextYear = date.getUTCFullYear(), nextMonth = date.getUTCMonth()+1;
  if (nextYear<1 || nextYear>9999) return value;
  const nextDay = field==='day' ? date.getUTCDate() : Math.min(day,daysInMonth(nextYear,nextMonth));
  return ST.dateText([nextYear,nextMonth,nextDay].join('.'));
}

function renderDateWheels(value) {
  const parts = value.split('.');
  return dateFields.map(({key,label,width}, index) => {
    const earlier = stepStoryDate(value,key,-1), later = stepStoryDate(value,key,1);
    const max = key==='year' ? 9999 : key==='month' ? 12 : daysInMonth(Number(parts[0]),Number(parts[1]));
    const neighbor = (date,direction) => {
      const number = date===value ? '—' : date.split('.')[index].padStart(width,'0');
      return `<button type="button" class="date-wheel-neighbor" data-date-step="${key}" data-direction="${direction}"
        ${date===value?'disabled':''} aria-label="${esc(t(label))} ${direction>0?'+':'−'}">${number}</button>`;
    };
    return `<div class="date-wheel" data-date-wheel="${key}">
      <span class="date-wheel-label">${t(label)}</span>
      ${neighbor(earlier,-1)}
      <div class="date-wheel-value" role="spinbutton" tabindex="0" data-date-part="${key}" data-focus="date-wheel-${key}"
        aria-label="${esc(t(label))}" aria-valuemin="1" aria-valuemax="${max}" aria-valuenow="${Number(parts[index])}">${parts[index]}</div>
      ${neighbor(later,1)}
    </div>`;
  }).join('');
}

function renderStoryDate(node) {
  const open = datePicker?.nodeId===node.id;
  const date = draftValue(node.id,'date',node.date);
  return `<label for="story-date-input">${t('故事时间')}</label>
    <div class="date-field">
      <input id="story-date-input" data-story-date="${esc(node.id)}" data-focus="story-date-${esc(node.id)}"
        value="${esc(date)}" placeholder="${esc(date?'YYYY.MM.DD':t('未定日期'))}" autocomplete="off" spellcheck="false"
        aria-label="${esc(t('节点故事日期'))}" aria-describedby="story-date-error">
      <button type="button" class="icon ${open?'active':'ghost'}" data-action="toggle-date-wheels"
        aria-expanded="${open}" title="${esc(t('选择故事日期'))}">${icon('scenes',16)}</button>
    </div>
    <p id="story-date-error" class="error date-error" hidden>${t('请输入有效日期，例如 1024.04.16。')}</p>
    ${open?`<div class="date-picker">
      <div id="date-wheels" class="date-wheels">${renderDateWheels(datePicker.draft)}</div>
      <div class="date-picker-actions">${button('cancel-date-wheels',t('取消'),'small ghost')}${button('apply-date-wheels',t('应用日期'),'small primary')}</div>
    </div>`:''}
    ${optionalTip('date',t('可输入日期，也可用日历按钮滚动选择。新节点默认继承上一节点日期。'),'hint date-hint')}`;
}

function changeDateWheel(field, direction) {
  if (!datePicker) return;
  const grid = $('#date-wheels');
  if (!grid) return;
  datePicker.draft = stepStoryDate(datePicker.draft,field,direction);
  const focus = focusCapture();
  grid.innerHTML = renderDateWheels(datePicker.draft);
  focusRestore(focus);
}

async function commitDateText(input) {
  const node = nodeById(input.dataset.storyDate);
  if (!node) return;
  const value = normalizeStoryDate(input.value);
  $('#story-date-error').hidden = value!==null;
  if (value===null) {
    input.setAttribute('aria-invalid','true');
    return;
  }
  input.removeAttribute('aria-invalid');
  input.value = value;
  if (value===node.date && !editTimers.has(draftKey(node.id,'date'))) return;
  datePicker = null;
  await updateNodeFor(node.id,'date',value);
}

function inspectorRefs(n){return n.refs.map(r=>entityChip(r,`data-in-node="${esc(n.id)}"`)+html`<button class="ghost small" data-remove-ref="${esc(r.kind+':'+r.id)}" title="移除引用">×</button>`).join('')||staticHtml('<div class="empty-drop full">将角色 / 物品拖进节点</div>');}
function recoveryMarkup(project){
 const edits=Array.isArray(project.recoveryEdits)?project.recoveryEdits:[];
 if(!edits.length)return '';
 return `<div class="section-title">${t('恢复草稿')} <span class="pill">${edits.length}</span></div>
   <p class="hint">${t('展开草稿后，可以复制文字到正确的位置。')}</p>
   ${edits.map(edit=>{
     const title=[edit.title,edit.field].filter(Boolean).join(' · ')||t('待保存内容');
     const content=edit.value??edit.commands??'';
     return `<details class="recovery-draft"><summary>${esc(title)}</summary><pre>${esc(typeof content==='string'?content:JSON.stringify(content,null,2))}</pre></details>`;
   }).join('')}`;
}
const characterReferenceLabels={
 id:'角色ID',name:'角色名称',summary:'简介',details:'详情',image:'形象图片',group:'角色分组',
 tags:'标签',attributes:'属性栏',skills:'技能栏',item:'携带物品名称',inventory:'携带数量',itemAttributes:'携带物品属性'
};
function characterReferenceGroups(c){
 const entries=Object.keys(c.inventory).filter(id=>c.inventory[id]>0);
 const choice=(label,...keys)=>({label,keys});
 const fromKeys=values=>Object.keys(values).map(key=>choice(key,key));
 const children={
   tags:[choice(t('全部标签')),...c.tags.map(tag=>choice(tag,tag))],
   attributes:fromKeys(c.attributes),skills:fromKeys(c.skills),
   item:entries.map(id=>choice(itemName(id),id)),inventory:entries.map(id=>choice(itemName(id),id)),
   itemAttributes:entries.flatMap(id=>{
     const defaults=state.p.items.find(item=>item.id===id)?.attributes;
     return Object.keys({...defaults,...c.itemAttributes?.[id]}).map(key=>choice(itemName(id)+' · '+key,id,key));
   })
 };
 return Object.entries(characterReferenceLabels).map(([field,label])=>({field,label:t(label),choices:children[field]}));
}
function renderCharacterReferenceTray(c){
 const groups=characterReferenceGroups(c);
 const chip=(label,field,keys=[])=>`<span class="entity-chip reference-chip" draggable="true"
   data-drag-kind="character-reference" data-reference-token="${esc(ST.characterToken(c.id,field,...keys))}">${esc(label)}</span>`;
 return html`<details class="character-reference-tray">
   <summary>可拖入节点的角色变量</summary>
   <p class="hint">把任意变量拖到正文光标处，或拖到画布上的节点。</p>
   <div class="reference-chips">${groups.filter(group=>!group.choices).map(group=>chip(group.label,group.field)).join('')}</div>
   ${groups.filter(group=>group.choices?.length).map(({field,label,choices})=>
     `<details><summary class="reference-section-label">${esc(label)}</summary><div class="reference-chips">${choices.map(({label,keys})=>chip(label,field,keys)).join('')}</div></details>`).join('')}
 </details>`;
}
function attributeButton(path,disabled=''){
 return html`<button type="button" class="small ghost" data-insert-attribute="${esc(path)}" ${disabled}>插入角色变量</button>`;
}
function hasVariableLinks(text){
 return hasReference(text)&&ST.characterTextParts(text).some(part=>typeof part!=='string');
}
function renderNodeVariableField(node,path,value,attributes){
 const text=draftValue(node.id,path,value),linked=hasVariableLinks(text);
 return html`<div class="node-variable-field ${linked?'has-variables':''}">
   <textarea data-node-path="${esc(path)}" ${attributes}>
${esc(text)}</textarea>
   <div class="node-variable-preview">
     <div class="node-variable-text">${linked?renderReferenceText(text,node,undefined,esc):''}</div>
     <button type="button" class="small ghost" data-edit-variable-text>编辑文本</button>
   </div>
 </div>`;
}
function refreshVariableField(editor){
 const field=editor.closest('.node-variable-field');
 const node=field&&nodeById(editorNodeId(editor));
 if(!node)return;
 const linked=hasVariableLinks(editor.value);
 field.classList.toggle('has-variables',linked);
 const preview=field.querySelector('.node-variable-text');
 const markup=linked?renderReferenceText(editor.value,node,undefined,esc):'';
 if(preview.innerHTML!==markup)preview.innerHTML=markup;
}
function focusNodeEditor(editor,options){
 if(!editor)return;
 if(editor.matches('textarea[data-node-path]'))editor.closest('.node-variable-field')?.classList.add('editing');
 editor.focus(options);
}
document.addEventListener('focusin',event=>{
 if(event.target.matches('textarea[data-node-path]'))event.target.closest('.node-variable-field')?.classList.add('editing');
});
document.addEventListener('focusout',event=>{
 const editor=event.target;
 if(!editor.matches('textarea[data-node-path]'))return;
 refreshVariableField(editor);
 editor.closest('.node-variable-field')?.classList.remove('editing');
});
function openAttributePicker(control){
 const id=editorNodeId(control),path=control.dataset.insertAttribute,node=nodeById(id);
 const editor=$$('textarea[data-node-path]').find(el=>editorNodeId(el)===id&&el.dataset.nodePath===path);
 if(!node||!editor||editor.readOnly)return;
 const characterId=node.refs.find(ref=>ref.kind==='character')?.id||state.p.characters[0]?.id;
 if(!characterId){toast(t('请先创建一张角色卡。'));return;}
 state.modal={kind:'attribute-picker',id,path,characterId,field:'name',characters:nodeCharacters(id),
   start:editor.selectionStart,end:editor.selectionEnd};
 renderAttributePicker();
}
function renderAttributePicker(){
 const m=state.modal,c=m.characters[m.characterId]||ST.find(state.p,'characters',m.characterId);
 const groups=characterReferenceGroups(c),group=groups.find(group=>group.field===m.field);
 showModal(t('插入角色变量'),html`
 <label for="attribute-character">角色ID</label>
 <select id="attribute-character" data-focus="attribute-character">${characterOptions(m.characterId,false)}</select>
 <div class="character-variable-picker ${group.choices?'with-subitem':''}">
   <div><label for="character-variable-field">角色卡栏目</label>
   <select id="character-variable-field" data-focus="character-variable-field">
     ${groups.map(({field,label})=>`<option value="${field}" ${field===m.field?'selected':''}>${esc(label)}</option>`).join('')}
   </select></div>
   ${group.choices?html`<div><label for="attribute-key">子项</label>
   <select id="attribute-key" ${group.choices.length?'':'disabled'}>${group.choices.map(({label,keys})=>
     `<option value="${esc(JSON.stringify(keys))}">${esc(label)}</option>`).join('')||html`<option value="">没有可选子项</option>`}</select></div>`:''}
 </div>
 <p class="hint">引用读取节点当时的角色状态。项目和节点日志保留原始变量。</p>`,
 button('modal-close',t('取消'))+`<button class="primary" data-action="attribute-insert" ${group.choices?.length===0?'disabled':''}>${t('插入')}</button>`,'narrow');
}
function renderDialogue(n){
 const {mode,participants:cast}=ST.defaultDialogueRule(n);
 const candidates=state.p.characters.filter(character=>!cast.includes(character.id));
 const busy=dialogueBusy.has(n.id);
 const disabled=busy?'disabled':'';
 const description={
   manual:'回车另起一句并弹出角色框；Tab 切换角色，Enter 确定；Shift+Enter 换行。',
   round:'轮谈按规则顺序切换说话人。点「完成并续写」或按 Enter 才会生成下一句。',
   same:'对谈续写时沿用当前说话人。点「完成并续写」或按 Enter 才会生成下一句。'
 };
 return html`<section class="dialogue-editor" data-dialogue-node="${esc(n.id)}">
   <div class="section-title">逐句对白 ${button('dialogue-log-edit',t('编辑对白日志'),'small ghost')} ${button('dialogue-default-rule',t('编辑默认规则'),'small ghost')}</div>
   <div class="dialogue-controls">
     <label for="dialogue-mode">节点默认规则</label>
     <select id="dialogue-mode" data-dialogue-mode data-focus="dialogue-mode" ${disabled}>
       ${options(ST.DIALOGUE_MODES,mode,value=>t(dialogueModeLabels[value]))}
     </select>
     <label for="dialogue-cast">参与角色</label>
     <div class="dialogue-cast">${cast.length?cast.map(id=>esc(charName(id))).join(' → '):esc(t('可在下方添加角色，或把角色卡拖进节点。'))}</div>
     ${candidates.length?html`<select id="dialogue-cast" data-dialogue-add ${disabled} aria-label="添加参与角色"><option value="">添加参与角色…</option>${candidates.map(character=>`<option value="${esc(character.id)}">${esc(character.name)}</option>`).join('')}</select>`:''}
   </div>
   <p class="hint">${esc(t(description[mode]))}</p>
   ${n.lines.map((line,index)=>{
     const rule=ST.dialogueRuleAt(n,index);
     const current=draftValue(n.id,`lines.${index}.characterId`,line.characterId);
     const speakers=rule.mode==='manual'||!rule.participants.length?characterOptions(current,true,n):
       [...new Set([...rule.participants,current])].map(id=>`<option value="${esc(id)}" ${id===current?'selected':''}>${esc(speakerOption(id,n))}</option>`).join('');
     return html`
     ${rule.mode==='manual' && state.rolePicker?.nodeId===n.id && state.rolePicker.index===index?renderRolePicker():''}
     <div class="dialogue-row">
       <div class="row"><span class="line-number">${String(index+1).padStart(2,'0')}</span>
         <select data-node-path="lines.${index}.characterId" data-focus="line-role-${index}" aria-label="第${index+1}句角色" ${disabled}>
           ${speakers}
         </select>
         <span class="flex"></span><button type="button" class="small ghost" data-expand-line="${index}" ${disabled}>放大</button>
         <button class="small ghost" data-remove-line="${index}" title="移除这句" ${disabled}>×</button>
       </div>
       ${renderNodeVariableField(n,`lines.${index}.text`,line.text,html`data-line-index="${index}" data-focus="line-text-${index}" rows="2" placeholder="写下一句对白…" ${busy?'readonly':''}`)}
       <div class="dialogue-line-actions">
         <button type="button" class="small ghost" data-line-rule="${index}" ${disabled} title="${esc(rule.participants.map(charName).join(' → '))}">${t('规则')} · ${t(dialogueModeLabels[rule.mode])}</button>
         ${attributeButton('lines.'+index+'.text',disabled)}
         <button type="button" class="small ghost" data-finish-line="${index}" ${disabled}>完成并续写</button>
       </div>
     </div>`;}).join('')}
 </section>`;
}
async function openDialogueRule(id,index){
 if(!await flushDrafts(id))return;
 const node=nodeById(id);
 if(!ST.hasDialogue(node)||(index!==undefined&&!node.lines[index]))return;
 const rule=index===undefined?ST.defaultDialogueRule(node):ST.dialogueRuleAt(node,index);
 state.modal={kind:'dialogue-rule',id,index,original:index===undefined?null:ST.clone(node.lines[index]),draft:ST.clone(rule)};
 renderDialogueRule();
}
function renderDialogueRule(){
 const modal=state.modal,rule=modal.draft;
 const choices=[{id:'',name:t('旁白')},...state.p.characters].filter(character=>!rule.participants.includes(character.id));
 const title=modal.index===undefined?t('节点默认规则'):state.language==='en'
   ?`Dialogue rule · line ${modal.index+1}`:`第 ${modal.index+1} 句的对话规则`;
 showModal(title,html`
   <label for="dialogue-rule-mode">对话模式</label>
   <select id="dialogue-rule-mode" data-focus="dialogue-rule-mode">${options(ST.DIALOGUE_MODES,rule.mode,value=>t(dialogueModeLabels[value]))}</select>
   <label>参与角色与发言顺序</label>
   <ol class="dialogue-rule-roster">${rule.participants.map((id,index)=>html`
     <li><span class="flex">${esc(charName(id))}</span>
     <button type="button" class="small ghost" data-roster-step="-1" data-roster-index="${index}" title="上移" ${index===0?'disabled':''}>↑</button>
     <button type="button" class="small ghost" data-roster-step="1" data-roster-index="${index}" title="下移" ${index===rule.participants.length-1?'disabled':''}>↓</button>
     <button type="button" class="small ghost" data-roster-remove="${index}" title="移除角色">×</button></li>`).join('')}</ol>
   ${choices.length?html`<div class="row"><select id="dialogue-rule-add" aria-label="添加参与角色">
     ${choices.map(character=>`<option value="${esc(character.id)}">${esc(character.name)}</option>`).join('')}
   </select>${button('dialogue-rule-add',t('添加'),'small')}</div>`:''}
   <p class="hint">${esc(t(modal.index===undefined?'默认规则用于开始对话。已有对白的规则会保留。':'这条规则用于本句和从本句新续写的对白，已有其他对白的规则会保留。'))}</p>`,
   button('modal-close',t('取消'))+button('dialogue-rule-save',t('保存规则'),'primary'),'narrow');
}
function renderInspector(){const n=selectedNode(),p=state.p;
 if(datePicker?.nodeId!==n?.id)datePicker=null;
 if(state.inspectorTab==='project')return html`<h2>${esc(p.title)}</h2><div class="hint">${p.scenes.length} 场景 · ${p.nodes.length} 节点 · ${p.characters.length} 角色</div><div class="modal-actions">${button('rename-project',t('项目设置'),'small')}${button('export',t('导出项目'),'small')}</div>${recoveryMarkup(p)}<div class="section-title">最近编辑记录</div>${(p.audit||[]).slice(-15).reverse().map(a=>`<div class="tool-card"><h3>${esc(a.source)} · r${a.revision}</h3><p>${esc(new Date(a.at).toLocaleString(state.language))}<br>${esc(a.description)}</p></div>`).join('')||staticHtml('<div class="hint">开始编辑后，会自动记录操作。</div>')}`;
 if(['characters','items'].includes(state.inspectorTab)){
   const kind=state.inspectorTab==='items'?'item':'character';
   return html`<div class="row between">${button(kind==='item'?'new-item-direct':'new-character-direct',t('＋ 创建'),'small')}</div><div class="hint">双击卡片编辑；可从这里拖入画布节点或正文。</div>${renderGroupedCards(kind,'',false)}`;
 }
 if(state.inspectorTab==='scene')return `<div class="stack">${p.scenes.map(s=>html`
   <div class="tool-card" data-drop-scene="${esc(s.id)}">
     <h3><button type="button" class="scene-card-name" data-edit-scene="${esc(s.id)}" title="编辑场景">${esc(s.name)}</button></h3>
     <p>${esc(s.summary)}<br>${p.nodes.filter(n=>n.sceneId===s.id).length} ${t('节点')} · ${Object.keys(s.characters).length} ${t('场景角色')}</p>
     <button type="button" class="small ghost" data-scene="${esc(s.id)}">打开场景</button>
     <button type="button" class="small ghost" data-open-scene-map="${esc(s.id)}">场景地图</button>
   </div>`).join('')}</div>${button('new-scene',t('＋ 新建场景'),'small full')}${button('scene-info',t('编辑当前场景'),'small ghost full')}`;
 if(!n){const s=currentScene();return html`<div class="scene-intro"><h2>${esc(s.name)}</h2><p>${esc(s.summary||t('为这个场景写一段简介，让每个节点有迹可循。'))}</p></div><div class="stat-grid"><div class="stat"><strong>${p.nodes.filter(n=>n.sceneId===s.id).length.toString().padStart(2,'0')}</strong><span>剧情节点</span></div><div class="stat"><strong>${Object.keys(s.characters).length.toString().padStart(2,'0')}</strong><span>场景角色</span></div></div><div class="section-title">六种节点，一条故事脉络</div><div class="node-palette">${Object.entries(ST.TYPES).map(([type,name])=>`<button class="palette-item" data-create-type="${type}">${icon(type,15)}${t(name)}</button>`).join('')}</div><div class="section-title">当前场景角色 ${button('scene-characters',t('查看状态'),'small ghost')}</div><div class="peek-chars">${Object.keys(s.characters).map(id=>entityChip({kind:'character',id},'data-current="true"')).join('')||staticHtml('<span class="hint">拖入角色，建立此场景的独立角色快照</span>')}</div><div class="tool-card" style="margin-top:23px"><h3>${icon('event',12)} 让变化沿剧情发生</h3><p>事件记录待变化，条件决定是否发生。打开故事树，查看每一刻的角色状态。</p></div><div class="tool-card"><h3>${icon('mcp',12)} 和 AI 一起梳理故事</h3><p>本地 MCP 可读取、建立和修改剧情，编辑会同步显示在画布中。</p>${button('mcp',t('查看连接方式 →'),'ghost small')}</div>`;}
 const bind=(path,value,type='input',extra='')=>{
   const key=esc(`node-${n.id}-${path}`);
   return type==='textarea'?renderNodeVariableField(n,path,value,`data-focus="${key}" ${extra}`)+attributeButton(path):
     `<input data-node-path="${path}" data-focus="${key}" value="${esc(draftValue(n.id,path,value))}" ${extra}>`;
 };
 let h=html`<div class="row node-inspector-tools">${optionalTip('node-type',nodeType(n.type),'inspector-type')}<span class="flex"></span>${button('text-find',t('查找'),'small ghost')}${button('text-replace',t('替换'),'small ghost',t('查找替换 · Ctrl+H'))}${button('node-log',t('节点日志'),'small')}</div><label>节点名称</label>${bind('title',n.title)}<label>简介 / 创作笔记</label>${bind('summary',n.summary,'textarea',staticHtml('rows="2" placeholder="记录这个节点的目的…"'))}${renderStoryDate(n)}${n.scriptSource?`<div class="script-node-source">${esc(t('剧本来源'))} · ${esc(n.scriptSource.file)} · ${esc(scriptLineLabel(n.scriptSource.firstLine,n.scriptSource.lastLine))}</div>`:''}`;
 h+=html`<div class="section-title">待变化 <span class="pill">${n.operations.length} 项</span> ${button('add-operation',t('＋ 添加变化'),'small')}</div>${n.operations.map((o,i)=>html`<div class="op-card"><div class="row"><span class="flex">${esc(operationText(o))}</span><button data-remove-operation="${i}" title="移除此变化">×</button></div></div>`).join('')}${n.type==='event'?button('event-board',t('打开事件角色面板 · 拖动物品'),'ghost small full'):''}`;
 h+=html`<label for="node-location">地点</label><select id="node-location" data-node-path="locationId" data-focus="node-location">${locationOptions(n.locationId)}</select>`;
 if(n.type==='dialogue')h+=renderDialogue(n);
 if(n.type==='monologue')h+=html`<div class="section-title">独白与长描述</div><label>唯一说话角色</label><select data-node-path="speakerId" data-focus="speakerId">${characterOptions(n.speakerId,true,n)}</select><label>正文</label>${bind('text',n.text,'textarea',staticHtml('rows="9" placeholder="写下角色的一段话，或描述眼前的事物…"'))}`;
 if(n.type==='event'){h+=html`<div class="section-title">事件设置</div><select data-node-path="eventType" data-focus="eventType">${options([...new Set(['战斗','交易','自定义',n.eventType])],n.eventType,eventTypeLabel)}</select>${n.eventType==='自定义'?button('custom-event-name',t('命名自定义事件…'),'small ghost'):''}<label>事件描述</label>${bind('text',n.text,'textarea',staticHtml('rows="3" placeholder="描述角色、物品和属性之间发生的事件…"'))}<div class="form-row" style="margin-top:12px">${['A','B'].map(f=>html`<div class="faction ${f==='B'?'b':''}" data-faction="${f}" data-faction-node="${esc(n.id)}"><h3>${f==='A'?t('阵营 A'):t('阵营 B')} · 拖入角色</h3>${n.factions[f].map(id=>entityChip({kind:'character',id},`data-in-node="${esc(n.id)}"`)).join('')||staticHtml('<span class="tiny muted">尚无成员</span>')}</div>`).join('')}</div>`;}
 if(n.type==='event')h+=renderDialogue(n);
 if(n.type==='label')h+=html`<div class="section-title">标签批量操作</div><label>匹配对象</label><select data-node-path="labelQuery.entity" data-focus="label-entity"><option value="character" ${n.labelQuery.entity==='character'?'selected':''}>角色标签</option><option value="item" ${n.labelQuery.entity==='item'?'selected':''}>角色携带的物品标签</option></select><label>目标匹配标签（逗号分隔，必须全部匹配）</label><input data-label-tags value="${esc(n.labelQuery.tags.join(', '))}" data-focus="label-tags" placeholder="例如：旅人 或 类型:装备"><div class="hint">角色按自定义标签匹配；物品可按 A 组名称、类型:装备、品级:传说等及自定义标签匹配，批量修改携带物品。</div><label>正文</label>${bind('text',n.text,'textarea','rows="3"')}`;
 if(n.type==='condition'){const c=n.condition;h+=html`<div class="section-title">条件判断</div><label>条件描述</label>${bind('condition.description',c.description,'textarea',staticHtml('rows="3" placeholder="例如：米拉卡在战斗前是否睡过了头？"'))}<label>判定方式</label><select data-node-path="condition.mode" data-focus="condition-mode">${options(['manual','rules'],c.mode).replace('>manual<',staticHtml('>手动判定<')).replace('>rules<',staticHtml('>结构化规则<'))}</select>${c.mode==='manual'?html`<label>当前剧情结果</label><select data-condition-value data-focus="condition-value"><option value="true" ${c.value?'selected':''}>真 · 走绿色分支</option><option value="false" ${!c.value?'selected':''}>假 · 走红色分支</option></select>`:button('edit-rules',message`编辑结构化规则 · ${c.rules.length} 条`,'full small')}
 <label>回溯的事件</label><select data-node-path="condition.sourceEventId" data-focus="source-event"><option value="">路径中最近的事件</option>${p.nodes.filter(x=>x.sceneId===n.sceneId&&['event','label'].includes(x.type)).map(x=>`<option value="${esc(x.id)}" ${x.id===c.sourceEventId?'selected':''}>${esc(x.title)}</option>`).join('')}</select><label>规则读取哪个时间点</label><select data-node-path="condition.evaluateAt" data-focus="condition-at"><option value="current" ${c.evaluateAt!=='beforeEvent'?'selected':''}>前序节点执行后</option><option value="beforeEvent" ${c.evaluateAt==='beforeEvent'?'selected':''}>回溯事件发生前</option></select><label>何时回溯</label><select data-node-path="condition.rollbackWhen" data-focus="rollback-when"><option value="false" ${c.rollbackWhen!=='true'?'selected':''}>条件为假（默认）</option><option value="true" ${c.rollbackWhen==='true'?'selected':''}>条件为真</option></select><label>回溯范围</label><select data-node-path="condition.rollback" data-focus="condition-rollback"><option value="all" ${c.rollback==='all'?'selected':''}>回溯该事件全部变化</option><option value="selected" ${c.rollback==='selected'?'selected':''}>豁免指定角色（只回溯其相关变化）</option><option value="none" ${c.rollback==='none'?'selected':''}>保留事件全部变化</option></select>${c.rollback==='selected'?html`<label>不发生变化的角色</label>${Object.keys(currentScene().characters).map(id=>`<label class="check-row"><input type="checkbox" data-exclude-character="${esc(id)}" ${c.excludedCharacters.includes(id)?'checked':''}>${esc(charName(id))}</label>`).join('')}`:''}<div class="hint">自然语言保留你的设想。请用手动结果或结构化规则确定真假；规则读取前序节点后的角色状态。</div>`;}
 if(n.type==='jump')h+=html`<div class="section-title">跨场景 / 跨时间跳转</div><select data-node-path="targetNodeId" data-focus="jump-target"><option value="">选择目标节点…</option>${p.scenes.map(s=>`<optgroup label="${esc(s.name)}">${p.nodes.filter(x=>x.sceneId===s.id&&x.id!==n.id).map(x=>`<option value="${esc(x.id)}" ${x.id===n.targetNodeId?'selected':''}>${esc(dateLabel(x.date)+' · '+x.title)}</option>`).join('')}</optgroup>`).join('')}</select>${n.targetNodeId?button('go-jump',t('前往目标节点 →'),'small ghost full'):''}`;
 h+=html`<div class="section-title">参与素材 <span class="pill">${n.refs.length}</span></div><div class="peek-chars" data-inspector-drop="${esc(n.id)}">${inspectorRefs(n)}</div><div class="section-title">输出点 ${['dialogue','monologue','event'].includes(n.type)?button('add-output','＋','small ghost'):''}</div>${n.outputs.map((o,i)=>html`<div class="output-row"><span class="dot" style="background:${n.type==='condition'?(i===0?'#7ec5b2':'#c08492'):'#a28cc7'}"></span><input data-node-path="outputs.${i}" data-focus="output-${i}" value="${esc(n.type==='condition'?t(o):o)}" ${n.type==='condition'?'readonly':''}><span class="muted">${p.edges.filter(e=>e.from===n.id&&e.output===i).length} 线</span>${n.outputs.length>1&&['dialogue','monologue','event'].includes(n.type)?`<button class="small ghost" data-remove-output="${i}">×</button>`:''}</div>`).join('')}
 <div class="divider"></div><div class="row">${button('transfer',t('移到场景…'),'small ghost')}${button('copy-transfer',t('复制到场景…'),'small ghost')}${button('delete-selected',icon('trash',13),'icon danger ghost',t('删除此节点'))}</div><div class="hint" style="margin-top:15px;font-family:Consolas;font-size:9px">ID: ${esc(n.id)}</div>`;
 return `<div data-editor-node="${esc(n.id)}">${h}</div>`;
}
function renderRolePicker(){const ids=['',...state.p.characters.map(c=>c.id)],r=state.rolePicker,n=nodeById(r.nodeId);return html`<div class="role-picker"><div class="hint">Tab 切换角色 · Enter 确定</div>${ids.map((id,i)=>`<div class="role-option ${r.cursor===i?'active':''}" data-pick-role="${esc(id)}">${esc(speakerOption(id,n))} ${r.cursor===i?' ↵':''}</div>`).join('')}</div>`;}
function changeText(d){
 if(d.kind==='characterField'){
   const value=d.key==='displayName'?`${d.before} → ${d.after}`:t('已变更');
   return `${charName(d.characterId)} · ${t(characterFieldLabels[d.key])} ${value}`;
 }
 return `${charName(d.characterId)} · ${d.kind==='item'?itemName(d.key):d.kind==='itemAttribute'?itemName(d.itemId)+t('的')+d.key:d.key} ${d.before} → ${d.after}`;
}
let timelineProject, timelineEntries;
function getTimelineEntries() {
  if (timelineProject !== state.p) {
    timelineEntries = ST.timeline(state.p);
    timelineProject = state.p;
  }
  return timelineEntries;
}

function focusOutline(id){
  const entry=ST.find(state.p,'outline',id);
  if(!ST.storyScope(state.p,state.treeScope).outline(entry))state.treeScope={};
  state.treeMode='outline';
  state.treeQuery='';
  redrawStoryTree();
  const card=$$('[data-outline-card]').find(el=>el.dataset.outlineCard===id);
  card?.scrollIntoView({block:'center'});
  card?.querySelector('[data-outline-edit]').focus({preventScroll:true});
}

function redrawStoryTree(resetScroll=false){
  const panel=$('.tree'),content=panel?.querySelector('.tree-content');
  if(!content)return;
  const focus=panel.contains(document.activeElement)?focusCapture():null;
  const {scrollTop,scrollLeft}=content;
  panel.outerHTML=renderTree();
  if(!resetScroll)Object.assign($('.tree-content'),{scrollTop,scrollLeft});
  focusRestore(focus);
  if(state.projectQuery)renderSearchResults();
}

const outlineAssetLabels={node:'节点',scene:'场景',character:'角色',item:'物品',itemset:'物品组合',location:'地点',art:'概念图',group:'分组',outline:'大纲',variable:'角色变量'};
let outlineAssetProject,outlineAssetCache=new Map();
function outlineAssetIndex(kind){
  if(outlineAssetProject!==state.p){outlineAssetProject=state.p;outlineAssetCache=new Map();}
  if(outlineAssetCache.has(kind))return outlineAssetCache.get(kind);
  const p=state.p;
  const rows=kind==='node'?p.nodes.map(node=>({
    id:node.id,label:node.title,detail:[ST.sceneOf(p,node.sceneId).name,dateLabel(node.date),locationName(node.locationId)].filter(Boolean).join(' · ')
  })):kind==='location'?[...locationsInOrder().values()].map(({location,name})=>({id:location.id,label:name,detail:location.notes})):
    kind==='variable'?p.characters.flatMap(character=>characterReferenceGroups(character).flatMap(({field,label,choices})=>
      (choices||[{label:'',keys:[]}]).map(choice=>({
        id:ST.characterToken(character.id,field,...choice.keys),label:[character.name,label,choice.label].filter(Boolean).join(' · ')
      }))
    )):
    (p[{scene:'scenes',character:'characters',item:'items',itemset:'itemSets',art:'conceptArt',group:'groups',outline:'outline'}[kind]]||[]).map(entry=>({
      id:entry.id,label:entry.title||entry.name,detail:entry.summary||entry.notes||''
    }));
  const index=new Map(rows.map(row=>[row.id,row]));
  outlineAssetCache.set(kind,index);
  return index;
}
function outlineLinkLabel({kind,id}){
  if(kind!=='variable')return outlineAssetIndex(kind).get(id)?.label;
  const [ref]=ST.characterTextParts(id);
  const character=ref?.characterId&&state.p.characters.find(entry=>entry.id===ref.characterId);
  return character?character.name+' · '+referenceLabel(ref):undefined;
}
function renderOutlineText(text,editing=false){
  return ST.outlineTextParts(text).map(part=>{
    if(typeof part==='string')return esc(part);
    const label=outlineLinkLabel(part);
    const title=t(outlineAssetLabels[part.kind])+': '+(label||t('链接目标已移除'));
    const attrs=editing?'contenteditable="false" tabindex="-1"':'';
    if(!label&&!editing)return `<span class="outline-link missing" title="${esc(title)}">${esc(t('链接目标已移除'))}</span>`;
    return `<a class="outline-link ${label?'':'missing'}" href="#outline-target" draggable="false"
      data-outline-link-token="${esc(part.token)}" title="${esc(title)}" ${attrs}>${esc(label||t('链接目标已移除'))}</a>`;
  }).join('');
}
function renderOutlineAssetList(){
  const host=$('#outline-assets'),kind=$('#outline-assets-kind').value;
  const query=$('#outline-assets-search').value.trim().toLowerCase();
  const matches=[...outlineAssetIndex(kind).values()].filter(asset=>
    (kind!=='outline'||asset.id!==state.modal.id)&&[asset.label,asset.detail].join(' ').toLowerCase().includes(query));
  const limit=120;
  host.innerHTML=matches.slice(0,limit).map(({id,label,detail})=>{
    const token=ST.outlineLinkToken(kind,id);
    const drag=kind==='variable'?`data-drag-kind="character-reference" data-reference-token="${esc(id)}"`:
      `data-drag-kind="${kind}" data-drag-id="${esc(id)}"`;
    return `<button type="button" class="outline-source" draggable="true" ${drag} data-outline-source="${esc(token)}">
      <strong>${esc(label)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</button>`;
  }).join('')||`<p class="hint">${t('没有匹配的素材。')}</p>`;
  if(matches.length>limit)host.insertAdjacentHTML('beforeend',html`<p class="hint">请搜索以缩小素材范围。</p>`);
}
function outlineSectionEditor(section){
  return html`<section class="outline-section-editor">
    <div class="row">
      <input class="flex" data-outline-section-title aria-label="段落标题" placeholder="段落标题（可选）" value="${esc(section.title)}">
      ${button('outline-section-up','↑','small ghost',t('上移段落'))}
      ${button('outline-section-down','↓','small ghost',t('下移段落'))}
      ${button('outline-section-remove','×','small ghost',t('移除段落'))}
    </div>
    <div data-outline-editor contenteditable="true" role="textbox" aria-multiline="true" aria-label="段落正文"
      data-placeholder="${esc(t('写下大纲，或拖入链接…'))}">${renderOutlineText(section.text,true)}</div>
  </section>`;
}
function syncOutlineSectionControls(){
  const sections=$$('.outline-section-editor');
  sections.forEach((section,index)=>{
    section.querySelector('[data-outline-editor]').id=index===0?'outline-text':`outline-text-${index+1}`;
    section.querySelector('[data-action="outline-section-up"]').disabled=index===0;
    section.querySelector('[data-action="outline-section-down"]').disabled=index===sections.length-1;
    section.querySelector('[data-action="outline-section-remove"]').disabled=sections.length===1;
  });
}
function openOutlineEditor(id){
  const entry=id?ST.find({...state.p,outline:state.p.outline||[]},'outline',id):null;
  state.modal={kind:'outline-editor',id};
  showModal(t(entry?'编辑故事大纲':'新建故事大纲'),html`
    <label for="outline-title">大纲标题</label>
    <input id="outline-title" data-focus="outline-title" value="${esc(entry?.title||'')}">
    ${scopeFields('outline-scope',entry||state.treeScope,t('不限地点'))}
    <p class="hint">选定地点后会纳入它的所有子地点。只填一端日期时，范围会向另一端开放。</p>
    <div class="outline-editor-grid">
      <div>
        <label>大纲正文</label>
        <div id="outline-sections">${ST.outlineSections(entry).map(outlineSectionEditor).join('')||outlineSectionEditor({title:'',text:''})}</div>
        ${button('outline-section-add',t('＋ 添加段落'),'small')}
        <p class="hint">拖入或点击右侧素材可在段落内插入链接，保存后点击链接跳转。</p>
      </div>
      <div class="outline-asset-panel">
        <label for="outline-assets-kind">可插入的链接</label>
        <select id="outline-assets-kind">${Object.entries(outlineAssetLabels).map(([kind,label])=>
          `<option value="${kind}">${esc(t(label))}</option>`).join('')}</select>
        <input id="outline-assets-search" placeholder="搜索素材…" aria-label="搜索素材" autocomplete="off">
        <div id="outline-assets" class="outline-asset-list"></div>
      </div>
    </div>`,
    (entry?deleteEntryButton('outline'):'')+
    button('text-find',t('查找'),'ghost')+button('text-replace',t('替换'),'ghost',t('查找替换 · Ctrl+H'))+
    button('modal-close',t('取消'))+button('outline-save',t('保存大纲'),'primary'),'wide');
  syncOutlineSectionControls();
  $('#outline-title').focus();
  renderOutlineAssetList();
}
function outlinePart(token){
  const parts=ST.outlineTextParts(token||'');
  return parts.length===1&&typeof parts[0]!=='string'?parts[0]:null;
}
function rememberOutlineCaret(){
  const modal=state.modal,selection=getSelection();
  if(modal?.kind!=='outline-editor'||!selection.rangeCount)return;
  const range=selection.getRangeAt(0);
  const container=range.commonAncestorContainer;
  const editor=(container.nodeType===Node.ELEMENT_NODE?container:container.parentElement)?.closest('[data-outline-editor]');
  if(editor){modal.outlineEditor=editor;modal.outlineCaret=range.cloneRange();}
}
document.addEventListener('selectionchange',rememberOutlineCaret);
function focusOutlineCaret(event){
  const m=state.modal;
  if(m?.kind!=='outline-editor')return;
  const editor=event?.target.closest('[data-outline-editor]')||(m.outlineEditor?.isConnected?m.outlineEditor:$('#outline-text'));
  if(!editor)return;
  const drop=event&&document.caretRangeFromPoint(event.clientX,event.clientY);
  let range=drop&&editor.contains(drop.commonAncestorContainer)?drop:m.outlineCaret;
  if(!range||!editor.contains(range.commonAncestorContainer)){
    range=document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  const container=range.startContainer;
  const atomic=(container.nodeType===Node.ELEMENT_NODE?container:container.parentElement)?.closest('[data-outline-link-token]');
  if(atomic){
    range.setStartAfter(atomic);
    range.collapse(true);
  }
  editor.focus();
  const selection=getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return {range,selection};
}
function insertOutlineLink(token,event){
  const part=outlinePart(token);
  if(!part||!outlineLinkLabel(part))return;
  const caret=focusOutlineCaret(event);
  if(!caret)return;
  const {range,selection}=caret;
  const markup=renderOutlineText(token,true)+'<span data-outline-caret-slot>&#8203;</span>';
  const fragment=range.createContextualFragment(markup);
  const slot=fragment.lastChild;
  range.deleteContents();
  range.insertNode(fragment);
  // Chromium may leave its caret inside a non-editable link at the end of a line.
  const after=document.createRange();
  after.setStart(slot.firstChild,1);
  after.collapse(true);
  selection.removeAllRanges();
  selection.addRange(after);
  rememberOutlineCaret();
}
document.addEventListener('paste',event=>{
  if(!event.target.closest('[data-outline-editor]'))return;
  event.preventDefault();
  document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));
});
function outlineEditorText(editor){
  const snapshot=editor.cloneNode(true);
  snapshot.removeAttribute('id');
  snapshot.removeAttribute('contenteditable');
  snapshot.setAttribute('aria-hidden','true');
  snapshot.className='outline-text-snapshot';
  for(const slot of snapshot.querySelectorAll('[data-outline-caret-slot]')){
    const marker=[...slot.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.data.includes('\u200b'));
    if(marker)marker.data=marker.data.replace('\u200b','');
    slot.replaceWith(...slot.childNodes);
  }
  for(const link of snapshot.querySelectorAll('[data-outline-link-token]')){
    link.replaceWith(document.createTextNode(link.dataset.outlineLinkToken));
  }
  document.body.append(snapshot);
  try{return snapshot.innerText;}
  finally{snapshot.remove();}
}
async function openOutlineLink(token){
  const part=outlinePart(token);
  if(!part||!outlineLinkLabel(part))return;
  const {id,kind}=part;
  switch(kind){
    case 'node':await focusNode(id);break;
    case 'scene':
      state.treeExpanded=false;
      await switchScene(id);
      render();
      break;
    case 'character':openCharacter(id);break;
    case 'item':openItem(id);break;
    case 'itemset':openItemSet(id);break;
    case 'location':openLocation(id);break;
    case 'art':openArt(id);break;
    case 'group':openGroup(id);break;
    case 'variable':openCharacter(ST.characterTextParts(id)[0].characterId);break;
    case 'outline':{
      focusOutline(id);
      break;
    }
  }
}

const searchLabels = {project:'项目',scene:'场景',node:'节点',character:'角色',item:'物品',location:'地点'};
const searchLimit = 60;
let indexedProject, indexedLanguage, searchEntries, searchMatches = [];

function getSearchEntries() {
  if (indexedProject===state.p && indexedLanguage===state.language) return searchEntries;
  const p = state.p;
  const scenes = new Map(p.scenes.map(scene => [scene.id,scene.name]));
  const records = [];
  const add = (kind,id,title,meta,values) => {
    const fields = [title,meta,searchLabels[kind],t(searchLabels[kind]),...values].flat(Infinity)
      .filter(value => typeof value==='string' && value.trim());
    records.push({kind,id,title,meta,fields,haystack:fields.join('\n').toLowerCase()});
  };
  add('project',p.id,p.title,t('项目总览'),[...(p.audit || []).map(entry=>entry.description)]);
  for (const scene of p.scenes) {
    add('scene',scene.id,scene.name,t('场景'),[scene.summary]);
  }
  for (const character of p.characters) {
    const group = p.groups.find(g => g.id===character.groupId)?.name;
    const inventory = Object.keys(character.inventory).map(itemName);
    add('character',character.id,character.name,group || t('角色卡'),[
      character.displayName,character.summary,character.details,character.tags,inventory,
      Object.keys(character.attributes),Object.keys(character.skills)
    ]);
  }
  for (const item of p.items) {
    const group = p.groups.find(g=>g.id===item.groupId)?.name;
    add('item',item.id,item.name,group||t(item.category),[item.summary,item.details,t(item.category),t(item.type),t(item.grade),item.tags,Object.keys(item.attributes)]);
  }
  for(const {location,name} of locationsInOrder().values())add('location',location.id,location.name,t('地点'),[name,location.notes]);
  for (const node of getTimelineEntries()) {
    const meta = [node.sceneName || scenes.get(node.sceneId), nodeType(node.type), dateLabel(node.date)].join(' · ');
    const refs = node.refs.map(ref => ref.kind==='character' ? charName(ref.id) : itemName(ref.id));
    add('node',node.id,node.title,meta,[
      node.summary,node.text,node.eventType,node.condition.description,locationName(node.locationId),
      node.lines.map(line => [speakerName(line.characterId,node),line.text]),refs,
      node.labelQuery.tags,node.operations.map(operationText),node.outputs,
      node.result?.changes.map(changeText),node.result?.error
    ]);
  }
  indexedProject = p;
  indexedLanguage = state.language;
  searchEntries = records;
  return records;
}

function renderProjectSearch() {
  return html`<div class="project-search">
    <div class="project-search-field">
      ${icon('search',15)}
      <input id="project-search" data-focus="project-search" role="combobox" autocomplete="off" spellcheck="false"
        aria-label="搜索检查器和故事树" aria-controls="project-search-results" aria-expanded="false"
        placeholder="搜索节点、角色、物品、场景…" value="${esc(state.projectQuery)}">
      <kbd>Ctrl+F</kbd>
      <button type="button" class="icon ghost" data-action="clear-project-search" title="清空搜索" hidden>${icon('close',13)}</button>
      ${button('project-replace',t('替换'),'small ghost',t('跨节点替换'))}
    </div>
    <div id="project-search-results" class="project-search-results" role="listbox" aria-label="项目搜索结果" hidden></div>
  </div>`;
}

async function openProjectReplacement(){
  if(!await flushDrafts())return;
  state.modal={kind:'project-replacement',projectId:state.p.id,preview:null};
  showModal(t('跨节点替换'),html`
    <div class="project-replace-form">
      <div><label for="project-replace-query">查找文字</label><input id="project-replace-query" autocomplete="off"></div>
      <div><label for="project-replace-value">替换为</label><input id="project-replace-value" autocomplete="off"></div>
      <div><label for="project-replace-scope">范围</label><select id="project-replace-scope">
        <option value="">全部场景</option><option value="${esc(currentScene().id)}" selected>当前场景</option>
      </select></div>
    </div>
    <div class="row project-replace-controls">
      <label><input id="project-replace-case" type="checkbox"> 区分大小写</label>
      ${button('project-replace-preview',t('预览替换'),'small')}
    </div>
    <div id="project-replace-results" aria-live="polite"></div>`,
    button('modal-close',t('取消'))+`<button data-action="project-replace-apply" class="primary" disabled>${t('替换选中项')}</button>`,'wide');
  $('#project-replace-query').focus();
}
const replacementInputs='#project-replace-query,#project-replace-value,#project-replace-scope,#project-replace-case';
function updateReplacementSelection(){
  const apply=$('[data-action="project-replace-apply"]');
  if(apply)apply.disabled=!$('#project-replace-results [data-replace-row]:checked');
}
function resetReplacementPreview(){
  if(state.modal?.kind!=='project-replacement'||!state.modal.preview)return;
  state.modal.preview=null;
  $('#project-replace-results').textContent=t('输入已修改，请重新预览。');
  updateReplacementSelection();
}
function showReplacementPreview(){
  const modal=state.modal;
  if(modal?.kind!=='project-replacement')return;
  const query=$('#project-replace-query').value,replacement=$('#project-replace-value').value;
  if(!query)throw Error(t('请输入查找文字'));
  const rows=ST.previewNodeTextReplacements(state.p,{query,replacement,sceneId:$('#project-replace-scope').value,
    matchCase:$('#project-replace-case').checked});
  modal.preview={revision:state.p.revision,rows};
  const label=row=>row.path.startsWith('lines.')?
    t('第 {index} 句对白').replace('{index}',Number(row.path.split('.')[1])+1):
    t({title:'节点名称',summary:'简介 / 创作笔记',text:'正文','condition.description':'条件描述'}[row.path]);
  const excerpt=(value,start,end)=>{
    const left=Math.max(0,start-44),right=Math.min(value.length,Math.max(end,start+1)+44);
    return (left?'…':'')+value.slice(left,right)+(right<value.length?'…':'');
  };
  const nodes=new Map(state.p.nodes.map(node=>[node.id,node]));
  $('#project-replace-results').innerHTML=rows.length?html`
    <div class="row between project-replace-controls">
      <strong>${esc(t('找到 {count} 个可替换字段').replace('{count}',rows.length))}</strong>
      <label><input type="checkbox" id="project-replace-all"> 全选</label>
    </div>
    <div class="project-replace-list">${rows.map((row,index)=>{
      const node=nodes.get(row.nodeId),scene=ST.sceneOf(state.p,node.sceneId);
      return html`<label class="project-replace-result">
        <input type="checkbox" data-replace-row="${index}">
        <span class="flex"><strong>${esc(scene.name)} · ${esc(node.title)}</strong>
          <span class="muted">${esc(label(row))} · ${esc(t('找到 {count} 处').replace('{count}',row.count))}</span>
          <del>${esc(excerpt(row.before,row.first.start,row.first.end))}</del>
          <ins>${esc(excerpt(row.after,row.first.start,row.first.start+replacement.length))}</ins>
        </span>
      </label>`;
    }).join('')}</div>`:esc(t('没有需要替换的内容。'));
  updateReplacementSelection();
}
async function applyProjectReplacement(){
  const modal=state.modal,preview=modal?.preview;
  if(modal?.kind!=='project-replacement'||!preview)return;
  const rows=$$('#project-replace-results [data-replace-row]:checked').map(el=>preview.rows[Number(el.dataset.replaceRow)]);
  if(!rows.length)return;
  const save=$('[data-action="project-replace-apply"]');
  save.disabled=true;
  try{
    await run(()=>{
      if(state.p.id!==modal.projectId||state.p.revision!==preview.revision){
        throw Error(t('项目在预览后已修改，请重新预览。'));
      }
      const edits=new Map();
      for(const row of rows){
        if(!edits.has(row.nodeId))edits.set(row.nodeId,{node:ST.clone(nodeById(row.nodeId)),patch:{}});
        const {node,patch}=edits.get(row.nodeId),parts=row.path.split('.');
        nodeField(node,parts)[parts.at(-1)]=row.after;
        patch[parts[0]]=node[parts[0]];
      }
      return [...edits].map(([id,{patch}])=>({type:'node.update',args:{id,patch}}));
    },t('已替换 {count} 处').replace('{count}',rows.reduce((sum,row)=>sum+row.count,0)));
    if(state.modal===modal)closeModal();
  }finally{if(state.modal===modal)updateReplacementSelection();}
}

function searchSnippet(entry, terms) {
  const field = entry.fields.slice(3).find(value => terms.some(term => value.toLowerCase().includes(term)));
  if (!field) return '';
  const lower = field.toLowerCase();
  const term = terms.find(value => lower.includes(value));
  const index = lower.indexOf(term);
  const start = Math.max(0,index-22), end = Math.min(field.length,index+term.length+38);
  return (start?'…':'')+esc(field.slice(start,index))+'<mark>'+esc(field.slice(index,index+term.length))+'</mark>'+esc(field.slice(index+term.length,end))+(end<field.length?'…':'');
}

function renderSearchResults() {
  const input = $('#project-search'), results = $('#project-search-results');
  if (!input || !results) return;
  const terms = state.projectQuery.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  searchMatches = terms.length ? getSearchEntries().filter(entry => terms.every(term => entry.haystack.includes(term))) : [];
  if (terms.length) {
    const query = terms.join(' ');
    const rank = entry => {
      const title = entry.title.toLowerCase();
      if (title===query) return 0;
      if (title.includes(query)) return 1;
      return 2;
    };
    searchMatches.sort((a,b) => rank(a)-rank(b));
  }
  const matchedNodes = new Set(searchMatches.filter(entry=>entry.kind==='node').map(entry=>entry.id));
  $$('[data-tree-node]').forEach(card=>card.classList.toggle('search-match',matchedNodes.has(card.dataset.treeNode)));
  $('[data-action="clear-project-search"]').hidden = !state.projectQuery;
  const visible = state.searchOpen && terms.length>0;
  results.hidden = !visible;
  input.setAttribute('aria-expanded',String(visible));
  input.removeAttribute('aria-activedescendant');
  if (!visible) return;
  const count = searchMatches.length;
  const caption = count>searchLimit ? message`共 ${count} 条 · 显示前 ${searchLimit} 条` : message`${count} 条匹配`;
  results.innerHTML = `<div class="search-result-count">${caption}</div>`+(count
    ? searchMatches.slice(0,searchLimit).map((entry,i)=>{
      const snippet = searchSnippet(entry,terms);
      return `<button type="button" class="search-result" id="project-result-${i}" data-search-result="${i}" role="option" tabindex="-1">
        <span class="search-kind">${t(searchLabels[entry.kind])}</span>
        <span class="search-result-body"><strong>${esc(entry.title)}</strong><span class="search-result-meta">${esc(entry.meta)}</span>${snippet?`<span class="search-snippet">${snippet}</span>`:''}</span>
      </button>`;
    }).join('')
    : staticHtml('<div class="search-no-results">没有匹配的内容。</div>'));
  updateSearchCursor();
}

function updateSearchCursor(scroll = false) {
  const results = $$('.search-result');
  state.searchCursor = Math.min(state.searchCursor,Math.max(0,results.length-1));
  for (const [index,result] of results.entries()) {
    result.setAttribute('aria-selected',String(index===state.searchCursor));
  }
  const current = results[state.searchCursor];
  if (!current) return;
  $('#project-search').setAttribute('aria-activedescendant',current.id);
  if (scroll) current.scrollIntoView({block:'nearest'});
}

function closeProjectSearch() {
  if (!state.searchOpen) return;
  state.searchOpen = false;
  $('#project-search-results').hidden = true;
  $('#project-search').setAttribute('aria-expanded','false');
  $('#project-search').removeAttribute('aria-activedescendant');
}

async function openSearchResult(entry) {
  if (!entry) return;
  $('#project-search').blur();
  closeProjectSearch();
  state.inspectorCollapsed = false;
  state.focusedEntity = null;
  if (entry.kind==='node') {
    await focusNode(entry.id);
    const card = $$('[data-tree-node]').find(el=>el.dataset.treeNode===entry.id&&!el.hasAttribute('data-tree-reference'));
    card?.scrollIntoView({block:'nearest',inline:'nearest'});
  } else if (entry.kind==='scene') {
    await switchScene(entry.id);
    state.inspectorTab = 'scene';
    render();
  } else if(entry.kind==='location'){
    state.tab='locations';
    state.libraryCollapsed=false;
    state.locationLibraryScope=locationById(entry.id)?.parentId||'';
    state.search='';
    state.focusedEntity=entry.id;
    render();
    $('.library-list .search-located')?.scrollIntoView({block:'nearest'});
  } else {
    state.inspectorTab = {project:'project',character:'characters',item:'items'}[entry.kind];
    if (entry.kind!=='project') state.focusedEntity = entry.id;
    render();
    $('.inspector-content .search-located')?.scrollIntoView({block:'nearest'});
  }
  await saveDisplaySettings();
}
function redrawTextEdit(){
 updateSave();
 renderGraph();
 $$('.node-variable-field textarea').forEach(refreshVariableField);
 const tree=$('.tree-content');
 if(tree)tree.innerHTML=state.treeQuery.trim()?renderTreeSearchResults():renderTreeContents(getTimelineEntries());
 renderSearchResults();
}
const editTimers=new Map();
const draftKey=(id,path)=>id+':'+path;
const draftValue=(id,path,value)=>editTimers.get(draftKey(id,path))?.value??value;
const sameValue=(left,right)=>left===right || JSON.stringify(left)===JSON.stringify(right);
const nodeField=(node,parts)=>parts.slice(0,-1).reduce((value,part)=>value?.[part],node);
function stageDraft(id,path,value,liveText,refs=[]){
 const key=draftKey(id,path),parts=path.split('.');
 let task=editTimers.get(key);
 if(!task){
   const node=nodeById(id);
   task={key,id,path,parts,projectId:state.p.id,recoveryId:ST.uid('draft'),title:node?.title||'',base:nodeField(node,parts)?.[parts.at(-1)],version:0,refs:[]};
   editTimers.set(key,task);
 }
 if(!sameValue(task.value,value)||refs.length)task.version++;
 task.value=value;
 task.liveText=liveText;
 for(const ref of refs)if(!task.refs.some(current=>current.kind===ref.kind && current.id===ref.id))task.refs.push(ref);
 clearTimeout(task.timer);
 updateSave();
 return task;
}
function draftCommands(project,task,value,refs,checkConflict){
 if(project.id!==task.projectId)throw Error('原节点或编辑位置已变动，草稿已保留。');
 const node=project.nodes.find(node=>node.id===task.id);
 const copy=node&&ST.clone(node),field=nodeField(copy,task.parts),key=task.parts.at(-1);
 if(!field || (task.parts[0]==='lines' && !ST.hasDialogue(node))){
   return [{type:'project.keepRecoveryEdit',args:{id:task.recoveryId,nodeId:task.id,title:task.title,field:task.path,value,refs}}];
 }
 const unchanged=sameValue(field[key],value);
 if(checkConflict && !unchanged && !sameValue(field[key],task.base))throw Error('该字段已在别处修改，草稿已保留。');
 const additions=refs.filter(ref=>!copy.refs.some(current=>current.kind===ref.kind && current.id===ref.id));
 if(unchanged&&!additions.length)return [];
 field[key]=value;
 const patch={[task.parts[0]]:copy[task.parts[0]]};
 if(additions.length)patch.refs=[...copy.refs,...additions];
 return [{type:'node.update',args:{id:task.id,patch}}];
}
function saveDraft(task){
 if(task.inFlight)return task.inFlight;
 clearTimeout(task.timer);
 const {version,value}=task,refs=[...task.refs];
 task.error=null;
 const operation=run(()=>draftCommands(state.p,task,value,refs,true),'',task.liveText?redrawTextEdit:render,true);
 task.inFlight=operation.then(result=>{
   if(result?.results.some(entry=>entry.recoveredDraftId))toast(t('草稿原位置已变动，可在项目检查器查看恢复草稿。'));
   task.base=value;
   if(task.version===version)editTimers.delete(task.key);
   else task.timer=setTimeout(()=>saveDraft(task).catch(()=>{}),0);
 },error=>{
   task.error=localizeError(error.message);
   throw error;
 }).finally(()=>{
   task.inFlight=null;
   updateSave();
 });
 return task.inFlight;
}
function updateNodeFor(id,path,value,liveText=false){
 return saveDraft(stageDraft(id,path,value,liveText));
}
function scheduleEdit(el){
 const id=editorNodeId(el);
 if(!id || el.tagName==='SELECT')return;
 const task=stageDraft(id,el.dataset.nodePath,el.value,true);
 task.timer=setTimeout(()=>saveDraft(task).catch(()=>{}),750);
}
async function flushDrafts(nodeId){
 const pending=()=>[...editTimers.values()].filter(task=>!nodeId||task.id===nodeId);
 for(let attempt=0;attempt<3;attempt++){
   const tasks=pending();
   if(!tasks.length)break;
   const results=await Promise.allSettled(tasks.map(saveDraft));
   if(results.some(result=>result.status==='rejected'))return false;
 }
 await state.queue;
 return pending().length===0;
}
window.flushEdits=async()=>{
 document.activeElement?.blur();
 await new Promise(resolve=>setTimeout(resolve,0));
 if(!await flushDrafts())return false;
 const modal=state.modal,failure=modal?.failedSave;
 if(modal?.kind==='dialogue-edit')return saveDialogueEditor(modal);
 if(!failure)return true;
 if(state.p.revision!==failure.revision || state.p.id!==failure.projectId)return false;
 try{
   await run(failure.batch);
   if(state.modal===modal)closeModal();
   return true;
 }catch{return false;}
};
async function saveProject(){
 if(await window.flushEdits())toast(t('项目已保存到本机'));
 else toast(t('仍有待保存的编辑，请重试'));
}
window.recoveryProject=()=>{
 if(!state.p)return null;
 let project=ST.clone(state.p);
 const edits=[];
 const modal=state.modal;
 if(modal?.kind==='dialogue-edit'){
   try{
     const patch=dialogueEditPatch(modal);
     if(patch)project=ST.execute(project,[{type:'node.update',args:{id:modal.id,patch}}]).project;
   }catch{
     const text=$('#dialogue-edit-text')?.value,body=$('#dialogue-edit-body')?.value;
     const title=nodeById(modal.id)?.title||'';
     if(text!==modal.initial)edits.push({nodeId:modal.id,title,field:modal.index===undefined?'dialogueLog':`lines.${modal.index}.text`,value:text});
     if(body!==modal.initialBody)edits.push({nodeId:modal.id,title,field:'text',value:body});
   }
 }
 const failure=modal?.kind!=='dialogue-edit'&&modal?.failedSave;
 if(failure){
   let applied=false;
   if(project.revision===failure.revision && project.id===failure.projectId){
     try{project=ST.execute(project,failure.batch).project;applied=true;}catch{}
   }
   if(!applied)edits.push({commands:failure.batch});
 }
 for(const task of editTimers.values()){
   try{project=ST.execute(project,draftCommands(project,task,task.value,task.refs,false)).project;}
   catch{edits.push({nodeId:task.id,title:task.title,field:task.path,value:task.value,refs:task.refs});}
 }
 if(edits.length)project.recoveryEdits=[...(project.recoveryEdits||[]),...edits];
 return JSON.stringify(project,null,2);
};
let pointer=null,spaceDown=false;
function bindCanvas(){const canvas=$('#canvas');canvas.addEventListener('wheel',e=>{const log=e.target.closest('.node-dialogue-log');if(e.target.closest('.entity-chip') || (log && log.scrollHeight>log.clientHeight && !e.ctrlKey))return;e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0012),e.clientX,e.clientY);},{passive:false});canvas.addEventListener('pointerdown',e=>{
 if(e.button===2)return;if(e.target.closest('button:not(.overview-node),[data-variable-link],.entity-chip,.canvas-overlay,.selection-toolbar,.minimap'))return;
 const start=worldPoint(e),nEl=e.target.closest('.node'),drag=e.target.closest('[data-node-drag]');
 if(spaceDown||e.button===1){e.preventDefault();pointer={mode:'pan',x:e.clientX,y:e.clientY,view:{...state.view}};canvas.setPointerCapture(e.pointerId);return;}
 if(nEl){state.inspectorTab='node';const id=nEl.dataset.node;if(e.shiftKey){if(state.selected.has(id))state.selected.delete(id);else state.selected.add(id);}else if(!state.selected.has(id))state.selected=new Set([id]);
 if(drag){pointer={mode:'nodes',x:e.clientX,y:e.clientY,initial:[...state.selected].map(id=>{const n=nodeById(id);return {id,x:n.x,y:n.y};}),moved:false};canvas.setPointerCapture(e.pointerId);}renderSelectionOnly();return;}
 if(!e.target.closest('.node')){if(!e.shiftKey)state.selected.clear();pointer={mode:'box',start,px:e.clientX,py:e.clientY,add:e.shiftKey,old:new Set(state.selected),moved:false};canvas.setPointerCapture(e.pointerId);renderSelectionOnly();}
 });canvas.addEventListener('pointermove',e=>{
 if(!pointer)return;
 if(pointer.mode==='pan'){state.view.x=pointer.view.x+e.clientX-pointer.x;state.view.y=pointer.view.y+e.clientY-pointer.y;applyView();renderMinimap();}
 if(pointer.mode==='nodes'){const dx=(e.clientX-pointer.x)/state.view.zoom,dy=(e.clientY-pointer.y)/state.view.zoom;if(Math.abs(dx)+Math.abs(dy)>2)pointer.moved=true;for(const v of pointer.initial){const n=nodeById(v.id);n.x=Math.round(v.x+dx);n.y=Math.round(v.y+dy);const el=$$('[data-node]').find(el=>el.dataset.node===n.id);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';}}renderEdges();}
 if(pointer.mode==='box'){const w=worldPoint(e);pointer.moved=Math.abs(e.clientX-pointer.px)+Math.abs(e.clientY-pointer.py)>5;const x=Math.min(w.x,pointer.start.x),y=Math.min(w.y,pointer.start.y),width=Math.abs(w.x-pointer.start.x),height=Math.abs(w.y-pointer.start.y);let box=$('.selection-box');if(!box){box=document.createElement('div');box.className='selection-box';$('#stage').append(box);}Object.assign(box.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});state.selected=new Set(pointer.old);
   const compact = inOverview(), radius = overviewSize()/2;
   for(const n of state.p.nodes.filter(n=>n.sceneId===state.p.currentSceneId)){
     const left = compact ? n.x+150-radius : n.x;
     const top = compact ? n.y+68-radius : n.y;
     const right = compact ? left+radius*2 : n.x+300;
     const bottom = compact ? top+radius*2 : n.y+nodeHeight(n.id);
     if(right>=x&&left<=x+width&&bottom>=y&&top<=y+height)state.selected.add(n.id);
   }
   $$('.node').forEach(el=>el.classList.toggle('selected',state.selected.has(el.dataset.node)));
 }
 });canvas.addEventListener('pointerup',e=>{
 if(!pointer)return;
 const pt=pointer;pointer=null;
 try{canvas.releasePointerCapture(e.pointerId);}catch{}
 $('.selection-box')?.remove();
 if(pt.mode==='nodes'&&pt.moved){
   const commands=pt.initial.map(({id})=>{
     const {x,y}=nodeById(id);
     return {type:'node.update',args:{id,patch:{x,y}}};
   });
   run(commands).catch(()=>{});
 }else if(pt.mode==='box'&&!pt.moved){
   // Keep the canvas element stable between clicks so the browser can deliver dblclick.
   renderSelectionOnly();
   $('#selection-tools').innerHTML=selectionToolbar();
   $('#selection-caption').textContent=selectionCaption();
   renderMinimap();
 }else render();
 });
 canvas.addEventListener('dblclick',e=>{if(e.target.closest('.entity-chip,[data-variable-link]'))return;const edge=e.target.closest('[data-edge]');if(edge){cmd('edge.delete',{id:edge.dataset.edge},t('连线已移除，可用 Ctrl+Z 恢复')).catch(()=>{});return;}const n=e.target.closest('.node');if(n){state.selected=new Set([n.dataset.node]);render();setTimeout(()=>focusNodeEditor($('.inspector-content textarea')),0);return;}if(e.target.closest('button,.minimap'))return;showPalette(e.clientX,e.clientY,worldPoint(e));});
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();showPalette(e.clientX,e.clientY,worldPoint(e));});
 canvas.addEventListener('pointerover',event=>{
   const square = event.target.closest('.overview-node');
   if (square && !pointer) showOverviewTip(square);
 });
 canvas.addEventListener('pointerout',event=>{
   if (event.target.closest('.overview-node')) hideOverviewTip();
 });
 canvas.addEventListener('focusin',event=>{
   if (event.target.matches('.overview-node')) showOverviewTip(event.target);
 });
 canvas.addEventListener('focusout',hideOverviewTip);
}
function renderSelectionOnly(){
 $$('.node').forEach(el=>el.classList.toggle('selected',state.selected.has(el.dataset.node)));
 $$('[data-tree-node]').forEach(el=>el.classList.toggle('selected',state.selected.has(el.dataset.treeNode)));
 const el=$('.inspector-content');
 if(el){
   const id=selectedNode()?.id;
   if(state.rolePicker && state.rolePicker.nodeId!==id)state.rolePicker=null;
   el.innerHTML=renderInspector();
   el.dataset.editorNode=id||'';
 }
 $$('[data-inspector-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.inspectorTab===state.inspectorTab));
 textFind.sync();
}
function showPalette(x,y,point){$('.dropdown')?.remove();const el=document.createElement('div');el.className='dropdown';el.style.left=Math.min(x,innerWidth-200)+'px';el.style.top=Math.min(y,innerHeight-310)+'px';el.innerHTML=Object.entries(ST.TYPES).map(([type,name])=>`<button data-create-type="${type}">${icon(type,15)}${t(name)}</button>`).join('');el.dataset.worldX=point?.x??150;el.dataset.worldY=point?.y??150;if(point?.locationId)el.dataset.locationId=point.locationId;document.body.append(el);}
async function createNode(type,x,y,place) {
  const canvas = $('#canvas'), bounds = canvas.getBoundingClientRect();
  const point = worldPoint({clientX:bounds.left+canvas.clientWidth*.3,clientY:bounds.top+canvas.clientHeight*.3});
  const data = {title:nodeType(type),x:Math.round(x??point.x),y:Math.round(y??point.y)};
  const locationId=place||locationAtPoint(x??point.x,y??point.y);
  if(locationId)data.locationId=locationId;
  if (type!=='condition') data.outputs = [t('继续')];
  const result = await cmd('node.create',{type,sceneId:state.p.currentSceneId,data});
  state.selected = new Set([result.results[0].id]);
  render();
}
function addNodeOutput(id) {
  const node = nodeById(id);
  return cmd('node.addOutput',{id,label:t('分支')+' '+(node.outputs.length+1)});
}
document.addEventListener('dragstart',function beginCardDrag(e){
 const el=e.target.closest('[data-drag-kind]');
 if(!el)return;
 const data={kind:el.dataset.dragKind,id:el.dataset.dragId,fromCharacterId:el.dataset.fromCharacter||'',nodeId:el.dataset.dragNode||'',qty:Number(el.dataset.qty)||1};
 draggingCard=data.kind;
 if(data.kind==='character-reference'){
   data.token=el.dataset.referenceToken;
   if(state.modal?.kind==='character')document.body.classList.add('character-reference-drag');
 }
 e.dataTransfer.setData('application/x-storytree',JSON.stringify(data));
 e.dataTransfer.setData('text/plain',data.token||data.kind+':'+data.id);
 e.dataTransfer.effectAllowed=data.token?'copy':'copyMove';
});
document.addEventListener('dragend',()=>{
 draggingCard='';
 document.body.classList.remove('character-reference-drag');
});
document.addEventListener('dragover',e=>{
 if(!e.dataTransfer.types.includes('application/x-storytree'))return;
 if(e.target.closest('[data-map-board]')){
   if(!sceneMapView.canDrop(e,draggingCard))return;
 }else if(!e.target.closest('.node,[data-node-path],.node-variable-field,[data-outline-editor],[data-outline-card],[data-faction],[data-inventory-drop],[data-inspector-drop],[data-drop-scene],[data-item-group-drop],[data-item-set-drop],.canvas'))return;
 e.preventDefault();
 e.dataTransfer.dropEffect='copy';
});
document.addEventListener('drop',async e=>{
 draggingCard='';
 const raw=e.dataTransfer.getData('application/x-storytree');
 if(!raw){
   if(e.target.closest('[data-outline-editor]')){
     e.preventDefault();
     if(focusOutlineCaret(e))document.execCommand('insertText',false,e.dataTransfer.getData('text/plain'));
   }
   return;
 }
 e.preventDefault();
 try{await handleDrop(e,JSON.parse(raw));}catch(err){toast(err.message);}
});
function draggedRefs(d){
 const kind=d.kind==='group'?'character':d.kind==='item-group'?'item':d.kind;
 const cards=state.p[kind==='character'?'characters':'items'];
 return cards.filter(c=>d.kind===kind?c.id===d.id:c.groupId===d.id).map(c=>({kind,id:c.id}));
}
async function insertCharacterReference(id,path,token,characterId,editor,start,end){
 if(dialogueBusy.has(id)||editor?.readOnly)return;
 const node=nodeById(id);
 if(!node)return;
 let value;
 if(editor){
   editor.setRangeText(token,start,end,'end');
   refreshVariableField(editor);
   value=editor.value;
 }else{
   const parts=path.split('.');
   const current=draftValue(id,path,nodeField(node,parts)?.[parts.at(-1)])||'';
   value=current+(current&&!/\s$/u.test(current)?' ':'')+token;
 }
 await saveDraft(stageDraft(id,path,value,!!editor||state.modal?.kind==='character',[{kind:'character',id:characterId}]));
 const refs=$('.inspector-content [data-inspector-drop]');
 if(refs?.dataset.inspectorDrop===id)refs.innerHTML=inspectorRefs(nodeById(id));
}
async function dropCharacterReference(target,token){
 const parts=ST.characterTextParts(token),ref=parts.length===1&&parts[0];
 if(!ref?.characterId||!state.p.characters.some(c=>c.id===ref.characterId))return;
 const editor=target.closest('textarea[data-node-path]')||target.closest('.node-variable-field')?.querySelector('textarea');
 if(editor){
   await insertCharacterReference(editorNodeId(editor),editor.dataset.nodePath,token,ref.characterId,editor,editor.selectionStart,editor.selectionEnd);
   return;
 }
 const id=target.closest('[data-node]')?.dataset.node||editorNodeId(target),node=nodeById(id);
 if(!node)return;
 const path=node.type==='dialogue'?(node.lines.length?`lines.${node.lines.length-1}.text`:'summary')
   :node.type==='condition'?'condition.description':node.type==='jump'?'summary':'text';
 const visible=$$('textarea[data-node-path]').find(el=>editorNodeId(el)===id&&el.dataset.nodePath===path);
 const prefix=visible?.value&&!/\s$/u.test(visible.value)?' ':'';
 await insertCharacterReference(id,path,prefix+token,ref.characterId,visible,visible?.value.length,visible?.value.length);
}
async function handleDrop(e,d){
 if(e.target.closest('[data-map-board]')){await sceneMapView.drop(e,d);return;}
 const outlineTarget=e.target.closest('[data-outline-editor],[data-outline-card]');
 if(outlineTarget){
   const kind=d.kind==='item-group'?'group':d.kind==='character-reference'?'variable':d.kind;
   const id=kind==='variable'?d.token:d.id;
   if(!id||!Object.hasOwn(outlineAssetLabels,kind)||!outlineLinkLabel({kind,id}))return;
   const token=ST.outlineLinkToken(kind,id);
   if(outlineTarget.hasAttribute('data-outline-editor'))insertOutlineLink(token,e);
   else if(kind!=='outline'||id!==outlineTarget.dataset.outlineCard){
     await run(()=>{
       const entry=ST.find(state.p,'outline',outlineTarget.dataset.outlineCard);
       const sections=ST.outlineSections(entry).map(section=>({...section}));
       if(!sections.length)sections.push({title:'',text:''});
       const index=Number(e.target.closest('[data-outline-section]')?.dataset.outlineSection);
       const section=sections[index]||sections.at(-1);
       section.text+=(section.text?'\n':'')+token;
       return [{type:'outline.update',args:{id:entry.id,patch:{sections}}}];
     },t('已插入大纲链接'));
   }
   return;
 }
 if(['node','scene','art','outline'].includes(d.kind))return;
 if(d.kind==='character-reference'){
   await dropCharacterReference(e.target,d.token);
   return;
 }
 if(d.kind==='location'){
   const target=e.target.closest('[data-node],[data-editor-node]');
   const id=target?.dataset.node||target?.dataset.editorNode;
   if(id){
     const nodeIds=state.selected.has(id)?[...state.selected]:[id];
     await cmd('location.assign',{locationId:d.id,nodeIds},t('地点已指定'));
   }
   return;
 }
 const group=e.target.closest('[data-item-group-drop]');
 if(group && d.kind==='item'){
   await cmd('item.update',{id:d.id,patch:{groupId:group.dataset.itemGroupDrop}});
   return;
 }
 const setTarget=e.target.closest('[data-item-set-drop]');
 if(setTarget&&['item','itemset'].includes(d.kind)){
   const entry={kind:d.kind==='itemset'?'set':'item',id:d.id,quantity:1};
   const id=setTarget.dataset.itemSetDrop;
   if(!id&&state.modal?.kind==='item-set')addItemSetDraftEntry(entry);
   else if(id)await cmd('itemSet.addEntry',{id,entry},t('已加入物品组合'));
   return;
 }
 const inv=e.target.closest('[data-inventory-drop]');if(inv){await inventoryDrop(inv.dataset.inventoryDrop,d);return;}
 if(d.kind==='itemset')return;
 const editor=e.target.closest('textarea[data-node-path]')||e.target.closest('.node-variable-field')?.querySelector('textarea');
 if(editor){
   const added=draggedRefs(d);
   if(!added.length)return;
   const id=editorNodeId(editor),path=editor.dataset.nodePath;
   if(dialogueBusy.has(id))return;
   const names=added.map(r=>'@'+(r.kind==='item'?itemName(r.id):charName(r.id)));
   const pos=editor.selectionStart;
   editor.setRangeText(names.join(' '),pos,pos,'end');
   focusNodeEditor(editor);
   await saveDraft(stageDraft(id,path,editor.value,true,added));
   toast(t('已将素材插入正文'));
   const refs=$('.inspector-content [data-inspector-drop]');
   if(refs?.dataset.inspectorDrop===id)refs.innerHTML=inspectorRefs(nodeById(id));
   return;
 }
 const faction=e.target.closest('[data-faction]');if(faction&&d.kind==='character'){const n=nodeById(faction.dataset.factionNode),fs=ST.clone(n.factions),other=faction.dataset.faction==='A'?'B':'A';fs[other]=fs[other].filter(id=>id!==d.id);fs[faction.dataset.faction]=[...new Set([...fs[faction.dataset.faction],d.id])];const refs=[...n.refs];if(!refs.some(r=>r.kind==='character'&&r.id===d.id))refs.push({kind:'character',id:d.id});await cmd('node.update',{id:n.id,patch:{factions:fs,refs}});return;}
 const s=e.target.closest('[data-drop-scene]');if(s && ['character','group'].includes(d.kind)){const ids=d.kind==='group'?state.p.characters.filter(c=>c.groupId===d.id).map(c=>c.id):[d.id];await cmd('scene.addCharacters',{sceneId:s.dataset.dropScene,characterIds:ids,sourceSceneId:state.p.currentSceneId},t('已复制到场景，各场景的角色状态相互独立'));return;}
 const node=e.target.closest('[data-node]'),insp=e.target.closest('[data-inspector-drop]');if(node||insp){
   const id=node?.dataset.node||insp.dataset.inspectorDrop, additions=draggedRefs(d);
   await run(()=>{
     const n=nodeById(id);
     if(!n)return [];
     const refs=[...n.refs];
     for(const ref of additions)if(!refs.some(item=>item.kind===ref.kind&&item.id===ref.id))refs.push(ref);
     const commands=refs.length!==n.refs.length?[{type:'node.update',args:{id,patch:{refs}}}]:[];
     if(ST.hasDialogue(n)){
       const rule=ST.defaultDialogueRule(n);
       const participants=[...new Set([...rule.participants,...additions.filter(ref=>ref.kind==='character').map(ref=>ref.id)])];
       if(participants.length!==rule.participants.length){
         commands.unshift({type:'node.dialogueRule',args:{id,rule:{...rule,participants}}});
       }
     }
     return commands;
   },t('素材已加入节点'));
   return;
 }
 if(e.target.closest('.canvas')&&['character','group'].includes(d.kind)){const ids=d.kind==='group'?state.p.characters.filter(c=>c.groupId===d.id).map(c=>c.id):[d.id];await cmd('scene.addCharacters',{sceneId:state.p.currentSceneId,characterIds:ids},t('已加入当前场景'));}
}
document.addEventListener('pointerdown',e=>{
 const control=e.target.closest('[data-finish-line],[data-remove-line],[data-line-rule],[data-expand-line],[data-action="dialogue-default-rule"],[data-action="dialogue-log-edit"]');
 const editor=document.activeElement;
 if(e.button===0&&control&&editor?.matches('textarea[data-line-index]')&&editorNodeId(control)===editorNodeId(editor)){
   e.preventDefault();
 }
});
document.addEventListener('click',async e=>{try{
 if(e.target.closest('#entity-deletion'))return;
 const deleteLocation=e.target.closest('[data-delete-location]');
 if(deleteLocation){await confirmEntryDeletion('location',deleteLocation.dataset.deleteLocation);return;}
 const editLocation=e.target.closest('[data-edit-location]');
 if(editLocation){openLocation(editLocation.dataset.editLocation);return;}
 if(e.target.closest('[data-map-add-place],[data-map-open-place],[data-map-place],[data-map-area],[data-map-element],[data-map-remove-route]')){
   await sceneMapView.handleClick(e);return;
 }
 const libraryScope=e.target.closest('[data-location-library-scope]');
 if(libraryScope){openLocationLibraryScope(libraryScope.dataset.locationLibraryScope);return;}
 const mapEntry=e.target.closest('[data-open-scene-map]');
 if(mapEntry){await openSceneMap(mapEntry.dataset.openSceneMap);return;}
 const editScene=e.target.closest('[data-edit-scene]');
 if(editScene&&!e.target.closest('[data-scene]')){openSceneInfo(editScene.dataset.editScene);return;}
 const editAsset=e.target.closest('[data-edit-asset]')?.closest('[data-entity-id]');
 if(editAsset){
   if(editAsset.dataset.entityKind==='character')openCharacter(editAsset.dataset.entityId);
   else openItem(editAsset.dataset.entityId);
   return;
 }
 const outlineSource=e.target.closest('[data-outline-source]');
 if(outlineSource){insertOutlineLink(outlineSource.dataset.outlineSource);return;}
 const outlineLink=e.target.closest('[data-outline-link-token]');
 if(outlineLink){
   e.preventDefault();
   if(!outlineLink.closest('[data-outline-editor]'))await openOutlineLink(outlineLink.dataset.outlineLinkToken);
   return;
 }
 const filter=e.target.closest('[data-tree-filter-toggle]');
 if(filter){state.treeFiltersOpen=!filter.parentElement.open;return;}
 const branch=e.target.closest('[data-story-route-choice]');
 if(branch){
   state.treeRouteStart=$('#story-route-start').value;
   state.treeRouteChoices[branch.dataset.storyRouteSource]=branch.dataset.storyRouteChoice;
   const source=branch.dataset.storyRouteSource,choice=branch.dataset.storyRouteChoice;
   redrawStoryTree();
   $$('[data-story-route-choice]').find(el=>el.dataset.storyRouteSource===source&&el.dataset.storyRouteChoice===choice)?.focus({preventScroll:true});
   return;
 }
 const outline=e.target.closest('[data-outline-edit]');
 if(outline){openOutlineEditor(outline.dataset.outlineEdit);return;}
 const treeOutline=e.target.closest('[data-tree-search-outline]');
 if(treeOutline){focusOutline(treeOutline.dataset.treeSearchOutline);return;}
 const itemSet=e.target.closest('[data-item-set-open]');
 if(itemSet){openItemSet(itemSet.dataset.itemSetOpen);return;}
 const variable=e.target.closest('[data-variable-link]');
 if(variable){e.preventDefault();openVariableLink(variable);return;}
 const editText=e.target.closest('[data-edit-variable-text]');
 if(editText){focusNodeEditor(editText.closest('.node-variable-field')?.querySelector('textarea'));return;}
 const attribute=e.target.closest('[data-insert-attribute]');
 if(attribute){openAttributePicker(attribute);return;}
 const ruleButton=e.target.closest('[data-line-rule]');
 if(ruleButton){await openDialogueRule(editorNodeId(ruleButton),Number(ruleButton.dataset.lineRule));return;}
 const roster=e.target.closest('[data-roster-step],[data-roster-remove]');
 if(roster && state.modal?.kind==='dialogue-rule'){
   const cast=state.modal.draft.participants;
   if(roster.hasAttribute('data-roster-remove'))cast.splice(Number(roster.dataset.rosterRemove),1);
   else{
     const from=Number(roster.dataset.rosterIndex),to=from+Number(roster.dataset.rosterStep);
     if(to>=0&&to<cast.length)[cast[from],cast[to]]=[cast[to],cast[from]];
   }
   renderDialogueRule();
   return;
 }
 const art=e.target.closest('[data-art-id]');
 if(art){openArt(art.dataset.artId);return;}
 const tip = e.target.closest('[data-dismiss-tip]');
 if(tip){dismissedTips.add(tip.dataset.dismissTip);tip.remove();return;}
 const dateStep = e.target.closest('[data-date-step]');
 if(dateStep){changeDateWheel(dateStep.dataset.dateStep,Number(dateStep.dataset.direction));return;}
 const result = e.target.closest('[data-search-result]');
 if(result){await openSearchResult(searchMatches[Number(result.dataset.searchResult)]);return;}
 if(!e.target.closest('.project-search'))closeProjectSearch();
 const dropdown=e.target.closest('.dropdown'),create=e.target.closest('[data-create-type]');if(create){const point=dropdown?{x:Number(dropdown.dataset.worldX),y:Number(dropdown.dataset.worldY),locationId:dropdown.dataset.locationId}:{};dropdown?.remove();await createNode(create.dataset.createType,point.x,point.y,point.locationId);return;}
 if(!dropdown && !e.target.closest('[data-action="palette"]'))$('.dropdown')?.remove();
 const tab=e.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;render();return;}
 const inspectorTab=e.target.closest('[data-inspector-tab]');if(inspectorTab){state.inspectorTab=inspectorTab.dataset.inspectorTab;render();return;}
 const s=e.target.closest('[data-scene]');if(s){
   const id=s.dataset.scene;
   const rename=e.target.closest('[data-rename-scene]');
   const now=performance.now();
   if(rename && e.detail>0 && lastSceneClick?.id===id && now-lastSceneClick.at<500){
     lastSceneClick=null;
     openSceneInfo(id,true);
     return;
   }
   lastSceneClick=rename && e.detail>0 ? {id,at:now} : null;
   await switchScene(id);
   return;
 }
 const output=e.target.closest('[data-port-out]');if(output){state.link={from:output.dataset.portOut,output:Number(output.dataset.output)};render();return;}
 const input=e.target.closest('[data-port-in]');if(input){if(state.link){const link=state.link;state.link=null;await cmd('edge.create',{...link,to:input.dataset.portIn},t('节点已连接'));}else toast(t('先点击来源节点右侧输出点，再点击这里'));return;}
 const plus=e.target.closest('[data-add-port]');if(plus){await addNodeOutput(plus.dataset.addPort);return;}
 const focus=e.target.closest('[data-focus-node]');if(focus){await focusNode(focus.dataset.focusNode);return;}
 const group=e.target.closest('[data-group]');if(group){openGroup(group.dataset.group);return;}
 const role=e.target.closest('[data-pick-role]');if(role){await chooseRole(editorNodeId(role),role.dataset.pickRole);return;}
 const expandLine=e.target.closest('[data-expand-line]');
 if(expandLine){await openDialogueEditor(editorNodeId(expandLine),Number(expandLine.dataset.expandLine));return;}
 const finish=e.target.closest('[data-finish-line]');if(finish){
   const textarea=finish.closest('.dialogue-row').querySelector('textarea');
   await addDialogueLine(editorNodeId(finish),Number(finish.dataset.finishLine),textarea.value);
   return;
 }
 const removeLine=e.target.closest('[data-remove-line]');if(removeLine){
   const id=editorNodeId(removeLine),index=Number(removeLine.dataset.removeLine);
   await changeDialogueLines(id,node=>{
     if(!node.lines[index])return;
     const lines=node.lines.filter((_,i)=>i!==index);
     const rule=ST.defaultDialogueRule(node);
     const firstSpeaker=rule.mode==='manual'?'':rule.participants[0]||'';
     return {type:'node.update',args:{id,patch:{lines:lines.length?lines:[{characterId:firstSpeaker,text:''}]}}};
   });
   return;
 }
 const removeOp=e.target.closest('[data-remove-operation]');if(removeOp){const n=selectedNode();await cmd('node.update',{id:n.id,patch:{operations:n.operations.filter((_,i)=>i!==Number(removeOp.dataset.removeOperation))}});return;}
 const removeRef=e.target.closest('[data-remove-ref]');if(removeRef){const n=selectedNode(),[kind,id]=removeRef.dataset.removeRef.split(':');await cmd('node.update',{id:n.id,patch:{refs:n.refs.filter(r=>r.kind!==kind||r.id!==id)}});return;}
 const removeOutput=e.target.closest('[data-remove-output]');if(removeOutput){const n=selectedNode(),i=Number(removeOutput.dataset.removeOutput);if(state.p.edges.some(e=>e.from===n.id&&e.output===i)){toast(t('请先双击移除此输出点上的连线'));return;}const commands=state.p.edges.filter(e=>e.from===n.id&&e.output>i).flatMap(e=>[{type:'edge.delete',args:{id:e.id}},{type:'edge.create',args:{from:e.from,to:e.to,output:e.output-1}}]);commands.unshift({type:'node.update',args:{id:n.id,patch:{outputs:n.outputs.filter((_,j)=>j!==i)}}});await run(commands);return;}
 const action=e.target.closest('[data-action]')?.dataset.action;if(action)await actionHandler(action,e);
 }catch(err){toast(err.message);}});
document.addEventListener('change',async e=>{try{
 const el=e.target;
 if(el.matches(replacementInputs)){resetReplacementPreview();return;}
 if(el.id==='project-replace-all'||el.hasAttribute('data-replace-row')){
   const rows=$$('#project-replace-results [data-replace-row]'),all=$('#project-replace-all');
   if(el===all)for(const row of rows)row.checked=all.checked;
   all.checked=rows.every(row=>row.checked);
   all.indeterminate=!all.checked&&rows.some(row=>row.checked);
   updateReplacementSelection();
   return;
 }
 if(el.id==='map-object-file'&&el.files.length)$('#map-object-art').value='';
 if(el.id==='map-object-art'&&el.value)$('#map-object-file').value='';
 if(el.matches('#scene-map-scope,#scene-map-background,#map-element-picker,#map-shape-name,#map-shape-color,[data-map-route-name],[data-map-layer]')){
   await sceneMapView.handleChange(el);return;
 }
 if(el.id==='outline-assets-kind'){renderOutlineAssetList();return;}
 if(el.id==='story-route-start'){
   state.treeRouteStart=el.value;
   state.treeRouteChoices={};
   redrawStoryTree();
   return;
 }
 if(state.modal?.kind==='script-import'){
   if(el.id==='script-file'){await previewScript(el.files[0]);return;}
   if(el.id==='script-preview-scene'){renderScriptNodes(Number(el.value));return;}
   if(el.id==='script-create-characters'||el.id==='script-connect-scenes'){renderScriptSummary();return;}
 }
 if(el.id==='excel-file' && state.modal?.kind==='excel-import'){await previewExcel(el.files[0]);return;}
 if(el.dataset.storyDate){await commitDateText(el);return;}
 if(el.id==='dialogue-rule-mode' && state.modal?.kind==='dialogue-rule'){
   state.modal.draft.mode=el.value;
   return;
 }
 if(el.hasAttribute('data-dialogue-mode')){
   const id=editorNodeId(el),mode=el.value;
   await updateDefaultDialogueRule(id,rule=>({...rule,mode}));
   return;
 }
 if(el.hasAttribute('data-dialogue-add')){
   const id=editorNodeId(el),characterId=el.value;
   if(characterId)await updateDefaultDialogueRule(id,rule=>({...rule,participants:[...new Set([...rule.participants,characterId])]}));
   return;
 }
 if(el.dataset.nodePath){
   const id=editorNodeId(el);
   if(id)await updateNodeFor(id,el.dataset.nodePath,el.value,el.tagName!=='SELECT');
   return;
 }
 if(el.dataset.displaySetting){
   updateDisplaySetting(el);
   render();
   if(el.dataset.displaySetting==='language')openSettings();
   await saveDisplaySettings();
   return;
 }
 if(el.hasAttribute('data-condition-value')){const id=editorNodeId(el);if(id)await updateNodeFor(id,'condition.value',el.value==='true');return;}
 if(el.hasAttribute('data-label-tags')){
   const node=nodeById(editorNodeId(el));
   if(!node)return;
   const tags = splitTags(el.value);
   const itemFilter = node.labelQuery.entity==='item';
   await updateNodeFor(node.id,'labelQuery.tags',itemFilter && state.language==='en' ? tags.map(normalizeItemFilterTag) : tags);
   return;
 }
 if(el.dataset.excludeCharacter){const n=nodeById(editorNodeId(el));if(n)await updateNodeFor(n.id,'condition.excludedCharacters',el.checked?[...new Set([...n.condition.excludedCharacters,el.dataset.excludeCharacter])]:n.condition.excludedCharacters.filter(id=>id!==el.dataset.excludeCharacter));return;}
 await modalChange(el);
 }catch(err){toast(err.message);}});
function handleInput(el) {
  if(el.matches(replacementInputs))resetReplacementPreview();
  if(el.id==='outline-assets-search')renderOutlineAssetList();
  if(el.id==='tree-search'){
    state.treeQuery=el.value;
    const content=$('.tree-content');
    content.innerHTML=state.treeQuery.trim()?renderTreeSearchResults():renderTreeContents(getTimelineEntries());
    content.scrollTop=0;
    content.scrollLeft=0;
    if(!state.treeQuery.trim()&&state.treeMode==='branches')centerStoryRoot();
  }
  if(el.id==='character-import-source'){
    state.modal.characterImport.result=null;
    $('#character-import-preview').replaceChildren();
  }
  if (el.dataset.storyDate) {
    el.removeAttribute('aria-invalid');
    $('#story-date-error').hidden = true;
  }
  if (el.dataset.nodePath) scheduleEdit(el);
  if (el.id==='library-search') {
    state.search = el.value;
    $('.library-list').innerHTML = renderLibraryList();
  }
  if (el.id==='project-search') {
    state.projectQuery = el.value;
    state.searchOpen = true;
    state.searchCursor = 0;
    renderSearchResults();
  }
  if (el.dataset.displaySetting && el.type==='range') updateDisplaySetting(el);
  if (el.dataset.meter) {
    const row = el.closest('.meter-row');
    row.querySelectorAll('input').forEach(input=>input.value=el.value);
    if (state.modal?.draft) state.modal.draft[el.dataset.meter][el.dataset.key]=Number(el.value);
  }
}
document.addEventListener('compositionstart',event=>{
  if (event.target.matches('input,textarea,[contenteditable]')) composingInput = event.target;
});
document.addEventListener('compositionend',event=>{
  if (composingInput===event.target) composingInput = null;
  handleInput(event.target);
  if (renderAfterComposition) {
    renderAfterComposition = false;
    setTimeout(render,0);
  }
});
document.addEventListener('input',event=>{
  if (!event.isComposing && composingInput!==event.target) handleInput(event.target);
});
document.addEventListener('focusin',event=>{
  if (event.target.id==='project-search' && state.projectQuery) {
    state.searchOpen = true;
    renderSearchResults();
  }
});
document.addEventListener('dblclick',e=>{
 if(e.target.closest('[data-edit-asset]'))return;
 const scene=e.target.closest('[data-rename-scene]');
 if(scene){lastSceneClick=null;openSceneInfo(scene.dataset.renameScene,true);return;}
 const entity=e.target.closest('[data-entity-id]');
 if(!entity)return;
 e.stopPropagation();
 const kind=entity.dataset.entityKind,id=entity.dataset.entityId,nodeId=entity.dataset.inNode;
 try{if(kind==='character')openCharacter(id,nodeId?'pending':entity.dataset.current?'current':'library',nodeId);else openItem(id);}
 catch(err){toast(err.message);}
});
document.addEventListener('keydown',async e=>{try{
 if(e.target.closest('#entity-deletion'))return;
 if(e.target.closest('.variable-details'))return;
 if(e.isComposing||e.keyCode===229||e.target===composingInput)return;
 if(state.modal?.kind==='dialogue-edit'&&e.key==='Enter'){
   if(e.ctrlKey||e.metaKey){
     e.preventDefault();
     await saveDialogueEditor(state.modal);
     return;
   }
   if(e.shiftKey&&state.modal.index===undefined&&e.target.id==='dialogue-edit-text'&&!e.target.readOnly){
     e.preventDefault();
     document.execCommand('insertText',false,'\n\t');
     return;
   }
 }
 if(e.key==='Enter'&&e.target.id==='trace-player-name'&&state.modal?.kind==='simulation'){
   e.preventDefault();
   await modalAction('simulate-name',e);
   return;
 }
 if(e.key==='Enter' && e.target.id==='scene-name' && state.modal?.kind==='scene-info'){
   e.preventDefault();
   await modalAction('scene-save',e);
   return;
 }
 if(e.target.dataset.datePart && (e.key==='ArrowUp'||e.key==='ArrowDown')){
   e.preventDefault();
   changeDateWheel(e.target.dataset.datePart,e.key==='ArrowUp'?1:-1);
   return;
 }
 if(e.target.dataset.storyDate && e.key==='Enter'){
   e.preventDefault();
   e.target.blur();
   return;
 }
 if(datePicker && e.key==='Escape' && e.target.closest('.date-picker,.date-field')){
   e.preventDefault();
   datePicker=null;
   render();
   return;
 }
 if(!state.modal && (e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='f'){
   e.preventDefault();
   if(state.mapOpen&&!state.treeExpanded){
     if(state.tab!=='locations'){state.tab='locations';state.search='';render();}
     if(state.libraryCollapsed)await togglePanel('libraryCollapsed');
   }
   const search=$(state.treeExpanded?'#tree-search':state.mapOpen?'#library-search':'#project-search');
   search?.focus();
   search?.select();
   return;
 }
 if(e.target.id==='project-search'){
   if(e.key==='Escape' && state.searchOpen){e.preventDefault();closeProjectSearch();return;}
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
     e.preventDefault();
     if(!state.searchOpen){state.searchOpen=true;renderSearchResults();return;}
     state.searchCursor=Math.max(0,state.searchCursor+(e.key==='ArrowDown'?1:-1));
     updateSearchCursor(true);
     return;
   }
   if(e.key==='Enter' && state.searchOpen){
     e.preventDefault();
     await openSearchResult(searchMatches[state.searchCursor]);
     return;
   }
 }
 if(e.target.matches('.overview-node') && (e.key==='Enter'||e.code==='Space')){
   e.preventDefault();
   await focusNode(e.target.dataset.overviewNode);
   $('#canvas').focus();
   return;
 }
 if(e.key==='Escape'&&!state.modal&&state.treeExpanded){state.treeExpanded=false;render();return;}
 if(e.key==='Escape'&&!state.modal&&state.mapOpen&&sceneMapView.cancelRoute())return;
 if(!state.modal&&(state.treeExpanded||e.target.closest('.tree'))&&(e.key==='Delete'||e.code==='Space')&&!e.target.matches('input,textarea,select'))return;
 const editable=e.target.matches('input,textarea,select,[contenteditable]');if(e.key==='Escape'){state.link=null;state.rolePicker=null;$('.dropdown')?.remove();if(state.modal)closeModal();else render();return;}
 const lineIndex=e.target.dataset.lineIndex===undefined?null:Number(e.target.dataset.lineIndex);
 const dialogueId=lineIndex===null?null:editorNodeId(e.target);
 const picker=state.rolePicker;
 if(picker && picker.nodeId===dialogueId && picker.index===lineIndex && (e.key==='Tab'||(e.key==='Enter'&&!e.shiftKey))){
   e.preventDefault();
   if(e.key==='Tab'){
     picker.cursor=(picker.cursor+(e.shiftKey?-1:1)+state.p.characters.length+1)%(state.p.characters.length+1);
     render();
     focusDialogueLine(picker.nodeId,picker.index);
   }else if(!e.repeat){
     const role=[{id:''},...state.p.characters][picker.cursor];
     if(role)await chooseRole(dialogueId,role.id);
   }
   return;
 }
 if(lineIndex!==null && e.key==='Enter'&&!e.shiftKey){
   e.preventDefault();
   if(!e.repeat)await addDialogueLine(dialogueId,lineIndex,e.target.value);
   return;
 }
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();await saveProject();return;}
 if(!editable&&!state.modal && (e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();await history(e.shiftKey?'redo':'undo');return;}
 if(!editable&&!state.modal&&!state.mapOpen && e.key==='Delete' && state.selected.size){e.preventDefault();await cmd('node.delete',{ids:[...state.selected]},t('已删除，可用 Ctrl+Z 撤销'));return;}
 if(!editable&&!state.modal && (e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();state.selected=new Set(state.p.nodes.filter(n=>n.sceneId===state.p.currentSceneId).map(n=>n.id));render();}
 if(!editable&&!state.modal && e.code==='Space'){e.preventDefault();spaceDown=true;}
 }catch(err){toast(err.message);}});
document.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});
document.addEventListener('wheel',event=>{
  const wheel = event.target.closest('[data-date-wheel]');
  if (!wheel || !event.deltaY) return;
  event.preventDefault();
  changeDateWheel(wheel.dataset.dateWheel,Math.sign(event.deltaY));
},{passive:false});
const splitTags=s=>[...new Set(s.split(/[,，]/).map(x=>x.trim()).filter(Boolean))];
function normalizeItemFilterTag(tag) {
  if (state.p.items.some(item=>item.tags.includes(tag))) return tag;
  const match = tag.match(/^(type|grade)\s*:\s*(.+)$/iu);
  const labels = !match ? ST.ITEM_A : match[1].toLowerCase()==='type' ? ST.ITEM_B : ST.ITEM_C;
  const label = (match?.[2] || tag).toLowerCase();
  const canonical = labels.find(value=>english[value]?.toLowerCase()===label);
  if (!canonical || !match) return canonical || tag;
  return (labels===ST.ITEM_B?'类型:':'品级:')+canonical;
}
async function history(action){
 if(!await flushDrafts())return;
 const previous=state.p.currentSceneId;
 const result=await api('history',{action,revision:state.p.revision});
 state.p=result.project;
 resetSceneView(previous);
 state.selected=new Set([...state.selected].filter(id=>nodeById(id)));
 render();
 toast(action==='undo'?t('已撤销'):t('已重做'));
}
function dialogueEditor(id){return $$('.dialogue-editor').find(el=>el.dataset.dialogueNode===id);}
function focusDialogueLine(id,index){focusNodeEditor(dialogueEditor(id)?.querySelector(`[data-line-index="${index}"]`));}
function lockDialogue(id,locked){
 const editor=dialogueEditor(id);
 for(const input of editor?.querySelectorAll('select,button,textarea')||[]){
   if(input.tagName==='TEXTAREA')input.readOnly=locked;
   else input.disabled=locked;
 }
}
async function updateDefaultDialogueRule(id,transform){
 if(!id||!await flushDrafts(id))return;
 await run(()=>{
   const node=nodeById(id);
   if(!ST.hasDialogue(node))return [];
   return [{type:'node.dialogueRule',args:{id,rule:transform(ST.defaultDialogueRule(node))}}];
 });
}
async function changeDialogueLines(id,change,draft){
 if(!ST.hasDialogue(nodeById(id))||dialogueBusy.has(id))return false;
 dialogueBusy.add(id);
 lockDialogue(id,true);
 try{
   if(draft)stageDraft(id,`lines.${draft.index}.text`,draft.text,true);
   if(!await flushDrafts(id))return false;
   return !!await run(()=>{
     const node=nodeById(id);
     const command=ST.hasDialogue(node) && change(node);
     return command?[command]:[];
   });
 }finally{
   dialogueBusy.delete(id);
   lockDialogue(id,false);
 }
}
async function addDialogueLine(id,after,text){
 const original=nodeById(id);
 if(!ST.hasDialogue(original)||(after>=0&&!original.lines[after])){
   if(id&&after>=0&&text!==undefined)await updateNodeFor(id,`lines.${after}.text`,text,true);
   return;
 }
 if(!await changeDialogueLines(id,node=>{
   if(node.lines.length!==original.lines.length || !node.lines[after])throw Error('对话框已变动，请重新选择');
   return {type:'node.dialogueContinue',args:{id,index:after}};
 },text===undefined?null:{index:after,text}))return;
 const node=nodeById(id);
 if(!ST.hasDialogue(node)||selectedNode()?.id!==id||!dialogueEditor(id))return;
 if(ST.dialogueRuleAt(node,after+1).mode==='manual'){
   state.rolePicker={nodeId:id,index:after+1,cursor:Math.max(0,[{id:''},...state.p.characters].findIndex(c=>c.id===node.lines[after+1].characterId))};
   render();
 }
 focusDialogueLine(id,after+1);
}
async function chooseRole(nodeId,id){
 const picker=state.rolePicker;
 if(!picker||picker.nodeId!==nodeId||dialogueBusy.has(nodeId))return;
 const node=nodeById(nodeId);
 if(!ST.hasDialogue(node)||!node.lines[picker.index])return;
 await updateNodeFor(nodeId,`lines.${picker.index}.characterId`,id);
 if(state.rolePicker===picker)state.rolePicker=null;
 render();
 if(selectedNode()?.id===nodeId)focusDialogueLine(nodeId,picker.index);
}
async function switchScene(id) {
  const previous = currentScene();
  if (previous.id===id) return;
  if(state.mapOpen)sceneMapView.cancelRoute();
  await run([
    {type:'scene.update',args:{id:previous.id,view:state.view}},
    {type:'scene.activate',args:{id}}
  ]);
  state.selected.clear();
  state.view = ST.clone(currentScene().view);
  render();
}
function resetSceneView(previousId){
 if(state.p.currentSceneId===previousId)return;
 state.selected.clear();
 state.view=ST.clone(currentScene().view);
 state.link=null;
 state.rolePicker=null;
 state.mapOpen=false;
}
async function focusNode(id) {
  const node = nodeById(id);
  if (!node) return;
 state.treeExpanded=false;
 if(state.mapOpen)sceneMapView.cancelRoute();
 state.mapOpen=false;
  await switchScene(node.sceneId);
  state.selected = new Set([id]);
  state.inspectorTab = 'node';
  render();
  const canvas = $('#canvas');
  state.view = {zoom:.9,x:canvas.clientWidth/2-(node.x+150)*.9,y:canvas.clientHeight/2-(node.y+100)*.9};
  applyView();
  renderMinimap();
}
async function openSceneMap(id=currentScene().id,scope){
  if(!await flushDrafts())return;
  state.treeExpanded=false;
  await switchScene(id);
  state.mapOpen=true;
  if(scope!==undefined)sceneMapView.setScope(scope);
  render();
}
function focusMapArea(area,create){
  sceneMapView.cancelRoute();
  state.mapOpen=false;
  state.selected.clear();
  render();
  const canvas=$('#canvas'),bounds=canvas.getBoundingClientRect();
  const zoom=Math.max(.2,Math.min(1,canvas.clientWidth/(area.width+80),canvas.clientHeight/(area.height+80)));
  state.view={zoom,x:canvas.clientWidth/2-(area.x+area.width/2)*zoom,
    y:canvas.clientHeight/2-(area.y+area.height/2)*zoom};
  applyView();
  renderMinimap();
  if(create){
    const point={x:area.x+20,y:area.y+45,locationId:area.locationId};
    showPalette(bounds.left+state.view.x+point.x*zoom,bounds.top+state.view.y+point.y*zoom,point);
  }
}

function centerStoryRoot() {
  const card = $('.story-chart .story-card');
  card?.scrollIntoView({block:'nearest',inline:'center'});
}

async function togglePanel(key) {
  const previousWidth = $('#canvas').clientWidth;
  state[key] = !state[key];
  if(key==='tree'&&!state.tree)state.treeExpanded=false;
  render();
  state.view.x += ($('#canvas').clientWidth-previousWidth)/2;
  applyView();
  renderMinimap();
  if (key==='tree' && state.tree && state.treeMode==='branches') centerStoryRoot();
  await saveDisplaySettings();
}

function updateDisplaySetting(input) {
  const key = input.dataset.displaySetting;
  const value = key==='language' || key==='fontFamily' ? input.value : Number(input.value);
  state[key] = ST.displaySettings({...state,[key]:value})[key];
  const output = $(`[data-display-value="${key}"]`);
  if (output) output.textContent = state[key]+'%';
  applyDisplayStyles();
  applyView();
}

function openSettings() {
  state.modal = {kind:'settings'};
  const slider = (key,title,min,max) => `<div class="display-setting">
    <label for="display-${key}">${title}<output data-display-value="${key}">${state[key]}%</output></label>
    <input id="display-${key}" data-display-setting="${key}" type="range" min="${min}" max="${max}" step="5" value="${state[key]}">
  </div>`;
  const families = {
    default:t('系统默认'),
    sans:t('无衬线'),
    serif:t('宋体 / 衬线'),
    kai:t('楷体'),
    mono:t('等宽')
  };
  showModal(t('设置'),html`
    <div class="form-row settings-selects">
      <div>
        <label for="display-language">${t('界面语言')}</label>
        <select id="display-language" data-display-setting="language" data-focus="settings-language">
          <option value="zh-CN" ${state.language==='zh-CN'?'selected':''}>中文</option>
          <option value="en" ${state.language==='en'?'selected':''}>English</option>
        </select>
      </div>
      <div>
        <label for="display-fontFamily">${t('字体')}</label>
        <select id="display-fontFamily" data-display-setting="fontFamily" data-focus="settings-font">
          ${Object.entries(families).map(([key,label])=>`<option value="${key}" ${state.fontFamily===key?'selected':''}>${esc(label)}</option>`).join('')}
        </select>
      </div>
    </div>
    ${slider('uiFont',t('界面字号'),85,140)}
    ${slider('nodeFont',t('画布节点字号'),85,175)}
    <label for="display-overviewAt">${t('方块概览')}</label>
    <select id="display-overviewAt" data-display-setting="overviewAt">
      ${[0,35,45,55,65].map(value=>`<option value="${value}" ${state.overviewAt===value?'selected':''}>${value?message`缩放低于 ${value}% 时开启`:t('关闭')}</option>`).join('')}
    </select>
    <div class="settings-data">${button('open-data',t('打开数据与备份目录'),'small ghost')}</div>
    <div class="settings-update">
      <div class="row between"><span>当前版本 <strong>${esc(state.connection?.version||'—')}</strong></span>
        ${window.desktop?.checkUpdate?button('check-update',t('检查更新'),'small'):''}
      </div>
      <div id="update-status" role="status" aria-live="polite"></div>
    </div>`,
    button('reset-display',t('恢复默认显示'),'ghost left')+button('modal-close',t('完成'),'primary'),'narrow');
}
async function actionHandler(action,e){const n=selectedNode();switch(action){
 case 'plugins':await pluginView.open();break;
 case 'scene-map':
   if(state.mapOpen){sceneMapView.cancelRoute();state.mapOpen=false;render();}
   else await openSceneMap();
   break;
 case 'map-guide':sceneMapView.toggleGuide();break;
 case 'tree':await togglePanel('tree');break;
 case 'toggle-library':await togglePanel('libraryCollapsed');break;
 case 'toggle-inspector':await togglePanel('inspectorCollapsed');break;
 case 'tree-branches':
 case 'tree-route':
 case 'tree-outline':
   state.treeMode=action.slice(5);
   state.treeQuery='';
   redrawStoryTree(true);
   if(state.treeMode==='branches')centerStoryRoot();
   await saveDisplaySettings();
   break;
 case 'tree-expand':
   state.treeExpanded=!state.treeExpanded;
   if(state.treeExpanded)state.treeFiltersOpen=true;
   redrawStoryTree();
   break;
 case 'tree-filter-apply':
 case 'tree-filter-reset':
   state.treeScope=action==='tree-filter-apply'?readStoryScope('tree-scope'):{};
   redrawStoryTree(true);
   break;
 case 'outline-create':openOutlineEditor();break;
 case 'item-set-new':openItemSet();break;
 case 'settings':openSettings();break;
 case 'clear-project-search':{
   const input=$('#project-search');
   input.value='';
   handleInput(input);
   input.focus();
   break;
 }
 case 'new-character-direct':openCharacter();break;
 case 'new-item-direct':openItem();break;
 case 'rail-canvas':state.treeExpanded=false;if(state.mapOpen)sceneMapView.cancelRoute();state.mapOpen=false;state.selected.clear();render();break;
 case 'rail-characters':case 'rail-items':case 'rail-scenes':case 'rail-art':
   state.tab=action.replace('rail-','');
   state.search='';
   if(state.libraryCollapsed)await togglePanel('libraryCollapsed');
   else render();
   break;
 case 'palette':{const r=e.target.closest('button').getBoundingClientRect();showPalette(r.left,r.bottom+7);break;}
 case 'zoom-in':zoomAt(1.15);break;case 'zoom-out':zoomAt(1/1.15);break;case 'fit':fitGraph();break;
 case 'new-entity':if(state.tab==='characters')openCharacter();else if(state.tab==='items')openItem();else if(state.tab==='art')openArtAdd();else if(state.tab==='locations')openLocation(undefined,state.locationLibraryScope);else openSimple('new-scene',t('新建场景'),t('场景名称'),t('第二幕'));break;
 case 'location-assign':openLocationAssignment();break;
 case 'excel-import':openExcelImport();break;
 case 'script-import':openScriptImport();break;
 case 'script-example':{
   const modal=state.modal;
   const current=modal.request;
   const source=await api('script-example.txt');
   if(state.modal===modal && modal.request===current){
     $('#script-file').value='';
     await previewScript(new File([source],'Mist-Harbor-Script.txt',{type:'text/plain'}));
   }
   break;
 }
 case 'excel-template':await desktop.saveExcelTemplate();break;
 case 'art-add':openArtAdd();break;
 case 'new-scene':openSimple('new-scene',t('新建场景'),t('场景名称'),t('第二幕'));break;
 case 'rename-project':openSimple('rename-project',t('故事设置'),t('故事名称'),state.p.title);break;
 case 'new-group':{
   const kind=e.target.closest('[data-action]').dataset.groupKind || (state.tab==='items'?'item':'character');
   openSimple('new-group',t(kind==='item'?'新建物品分组':'新建角色分组'),t('分组名称'),t('新分组'));
   state.modal.groupKind=kind;
   break;
 }
 case 'scene-info':openSceneInfo();break;
 case 'dialogue-default-rule':await openDialogueRule(editorNodeId(e.target));break;
 case 'text-find':case 'text-replace':textFind.openFrom(e.target,action==='text-replace');break;
 case 'project-replace':await openProjectReplacement();break;
 case 'project-replace-preview':showReplacementPreview();break;
 case 'project-replace-apply':await applyProjectReplacement();break;
 case 'dialogue-log-edit':await openDialogueEditor(editorNodeId(e.target)||(state.modal?.kind==='node-log'?state.modal.id:undefined));break;
 case 'dialogue-edit-save':if(state.modal?.kind==='dialogue-edit')await saveDialogueEditor(state.modal);break;
 case 'map-object-save':{
   const modal=state.modal;
   if(modal?.kind!=='map-object')break;
   const upload=$('#map-object-file').files[0];
   const name=$('#map-object-name').value.trim();
   const artId=$('#map-object-art').value;
   if(!upload&&!artId)throw Error(t('请选择图片'));
   if(upload?.size>ST.ART_FILE_LIMIT)throw Error(t('每张概念图最大为 4 MB'));
   const save=e.target.closest('button');
   save.disabled=true;
   try{
     const file=upload?{name:name||upload.name.replace(/\.[^.]+$/u,'')||upload.name,image:await readArtImage(upload)}:null;
     if(state.modal!==modal)break;
     await sceneMapView.addImage(modal.destination,{artId:file?ST.uid('art'):artId,name,file},modal.point);
     if(state.modal===modal)closeModal();
   }finally{save.disabled=false;}
   break;
 }
 case 'node-log':await openNodeLog(editorNodeId(e.target));break;
 case 'add-output':await addNodeOutput(n.id);break;
 case 'toggle-date-wheels':
   if(n){
     const nearby=state.p.nodes.find(node=>node.sceneId===n.sceneId && node.date)?.date;
     datePicker=datePicker?.nodeId===n.id?null:{nodeId:n.id,draft:n.date||nearby||'0001.01.01'};
     render();
   }
   break;
 case 'cancel-date-wheels':datePicker=null;render();break;
 case 'apply-date-wheels':{
   const picker=datePicker;
   datePicker=null;
   if(picker && n && picker.nodeId===n.id && picker.draft!==n.date)await updateNodeFor(n.id,'date',picker.draft);
   else render();
   break;
 }
 case 'delete-selected':await cmd('node.delete',{ids:[...state.selected]},t('节点已删除，可撤销恢复'));break;
 case 'transfer':case 'copy-transfer':openTransfer(action==='copy-transfer');break;
 case 'add-operation':openOperation(n.id);break;
 case 'event-board':openEventBoard(n.id);break;
 case 'custom-event-name':openSimple('custom-event',t('自定义事件'),t('事件类型名称'),n.eventType==='自定义'?'':n.eventType);break;
 case 'go-jump':await focusNode(n.targetNodeId);break;
 case 'edit-rules':openRules(n.id);break;
 case 'scene-characters':openSceneCharacters();break;
 case 'simulate':state.traceChoices={};state.traceInputs={};openSimulation('');break;
 case 'undo':case 'redo':await history(action);break;
 case 'manual-save':case 'retry-save':await saveProject();break;
 case 'export':{if(!await window.flushEdits())break;if(window.desktop){const ok=await desktop.exportProject(JSON.stringify(state.p,null,2));if(ok)toast(t('项目已导出'));}else download(t('故事.storytree.json'),JSON.stringify(state.p,null,2));break;}
 case 'import':{if(window.desktop){const raw=await desktop.importProject();if(raw)openImport(JSON.parse(raw));}else {const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{openImport(JSON.parse(await input.files[0].text()));}catch(err){toast(err.message);}};input.click();}break;}
 case 'mcp':openMcp();break;case 'definitions':openDefinitions();break;
 default:
   if(action.startsWith('map-'))await sceneMapView.handleAction(action);
   else if(action.startsWith('plugin-'))await pluginView.handle(action,e);
   else await modalAction(action,e);
 }}
function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
async function init(){try{state.connection=window.desktop?await desktop.getConnection():{token:sessionStorage.getItem('storytree-token')||new URLSearchParams(location.hash.slice(1)).get('token')};if(!state.connection.token)throw Error(t('请从 StoryTree.exe 打开软件'));await loadDisplaySettings();await refresh(true);state.view=ST.clone(currentScene().view);render();if(state.tree&&state.treeMode==='branches')centerStoryRoot();setTimeout(fitGraph,100);setInterval(()=>{if(!state.modal&&!pointer&&!sceneMapView.dragging()&&!state.saves&&!editTimers.size&&!document.activeElement?.matches('input,textarea,select'))refresh();},1800);}catch(e){$('#app').innerHTML=html`<div class="loading"><div><h2>无法打开项目</h2><p class="error" style="margin-top:15px">${esc(localizeError(e.message))}</p></div></div>`;}}

function showModal(title,body,footer='',size=''){const root=$('#modal-root'),scroll=$('.modal-body')?.scrollTop||0,f=focusCapture();root.innerHTML=`<div class="modal-backdrop"><section class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><div><h2>${esc(title)}</h2></div>${button('modal-close',icon('close',17),'icon ghost',t('关闭窗口'))}</header><div class="modal-body">${body}</div><footer class="modal-footer">${footer||button('modal-close',t('关闭'))}</footer></section></div>`;$('.modal-body').scrollTop=scroll;focusRestore(f);textFind.sync();}
function closeModal(){state.modal?.abort?.abort();state.modal=null;$('#modal-root').innerHTML='';document.body.classList.remove('character-reference-drag');textFind.sync();updateSave();}
const deleteEntryButton=kind=>`<button type="button" class="danger ghost left" data-action="delete-entry" data-delete-kind="${esc(kind)}">${esc(t('删除'))}</button>`;
const deletionEffectLabels={
 sceneNodes:'删除场景节点',sceneEdges:'删除场景连线',externalNodes:'解除其他场景的跳转或回溯引用',
 sceneCharacters:'删除场景角色快照',maps:'删除地图布局',mapMarkers:'移除地图角色标记',
 children:'将子地点移至上一级',mapAreas:'移除地图上的地点区域',mapRoutes:'移除相关地图路线',
 nodes:'涉及的节点',scenes:'涉及的场景',characterCards:'涉及的角色卡',itemSets:'涉及的物品组合',
 outlines:'解除大纲的地点指定',members:'取消卡片的分组归属',mapBackgrounds:'清除地图底图',mapImages:'移除地图图片物体'
};
async function confirmEntryDeletion(kind,id){
 const modal=state.modal;
 if($('#entity-deletion')||!await flushDrafts()||state.modal!==modal||$('#entity-deletion'))return;
 const {name,effects,blocked}=ST.deletionImpact(state.p,kind,id);
 const parentId=kind==='location'?(locationById(id)?.parentId||''):'';
 const revision=state.p.revision,projectId=state.p.id,sceneId=state.p.currentSceneId;
 const dialog=document.createElement('dialog');
 dialog.id='entity-deletion';
 dialog.className='entry-delete-dialog';
 dialog.setAttribute('aria-labelledby','entry-delete-title');
 dialog.innerHTML=html`
   <header class="modal-header"><h2 id="entry-delete-title">${t(blocked?'无法删除':'确认删除')}</h2></header>
   <div class="modal-body">
     <p class="entry-delete-name">${esc(name)}</p>
     <ul class="entry-delete-effects">${Object.entries(effects).filter(([,count])=>count>0).map(([effect,count])=>
       `<li><span>${esc(t(deletionEffectLabels[effect]))}</span><strong>${count}</strong></li>`).join('')}</ul>
     <p class="${blocked?'warning':'hint'}">${esc(t(blocked||'保存后可用 Ctrl+Z 撤销。'))}</p>
     <p class="error" role="alert" data-delete-error hidden></p>
   </div>
   <footer class="modal-footer">
     <button type="button" data-delete-cancel autofocus>${t(blocked?'关闭':'取消')}</button>
     ${blocked?'':`<button type="button" class="danger" data-delete-confirm>${t('确认删除')}</button>`}
   </footer>`;
 const cancel=dialog.querySelector('[data-delete-cancel]');
 const confirm=dialog.querySelector('[data-delete-confirm]');
 const dismiss=()=>{dialog.close();dialog.remove();};
 dialog.addEventListener('cancel',event=>{
   event.preventDefault();
   if(!cancel.disabled)dismiss();
 });
 cancel.addEventListener('click',dismiss);
 confirm?.addEventListener('click',async()=>{
   const error=dialog.querySelector('[data-delete-error]');
   error.hidden=true;
   cancel.disabled=confirm.disabled=true;
   try{
     await run(()=>{
       if(projectId!==state.p.id||revision!==state.p.revision)throw Error(t('项目已更改，请取消后重新查看删除影响。'));
       return [{type:kind+'.delete',args:{id}}];
     },t('已删除，可用 Ctrl+Z 撤销'),()=>{
       resetSceneView(sceneId);
       if(kind==='location'&&state.locationLibraryScope===id)state.locationLibraryScope=parentId;
       render();
     });
     dismiss();
     closeModal();
   }catch(failure){
     if(modal)delete modal.failedSave;
     updateSave();
     error.textContent=revision===state.p.revision?localizeError(failure.message):t('项目已更改，请取消后重新查看删除影响。');
     error.hidden=false;
     if(projectId===state.p.id&&revision===state.p.revision)confirm.disabled=false;
     cancel.disabled=false;
     cancel.focus();
   }
 });
 $('#modal-root').append(dialog);
 dialog.showModal();
}
function openSimple(kind,title,label,value){state.modal={kind};showModal(title,`<label>${esc(label)}</label><input id="simple-value" value="${esc(value)}" data-focus="simple" autofocus>`,(kind==='rename-project'?button('new-project',t('新建空白故事'),'left ghost'):'')+button('modal-close',t('取消'))+button('simple-save',t('保存'),'primary'),'narrow');setTimeout(()=>$('#simple-value')?.focus(),0);}
function nodeRoute(n){const q={...state.p,currentSceneId:n.sceneId};let trace=ST.trace(q),h=trace.history.find(h=>h.nodeId===n.id);if(h)return {trace,h,defaultRoute:true};
 const nodes=state.p.nodes.filter(x=>x.sceneId===n.sceneId),roots=nodes.filter(x=>!state.p.edges.some(e=>e.to===x.id));const todo=roots.map(x=>({id:x.id,path:[],seen:[]}));let route;
 while(todo.length && todo.length<3000){const r=todo.shift();if(r.id===n.id){route=r;break;}if(r.seen.includes(r.id))continue;for(const e of state.p.edges.filter(e=>e.from===r.id))todo.push({id:e.to,path:[...r.path,e],seen:[...r.seen,r.id]});}
 if(route){const choices={};for(const e of route.path)choices[e.from]=e.id;trace=ST.trace(q,{startNodeId:route.path[0]?.from||n.id,choices});h=trace.history.find(h=>h.nodeId===n.id);}
 if(!h){trace=ST.trace(q,{startNodeId:n.id});h=trace.history[0];}
 return {trace,h,defaultRoute:false};
}
function nodeCharacters(nodeId){const n=nodeById(nodeId);return nodeRoute(n).h?.after||ST.clone(ST.sceneOf(state.p,n.sceneId).characters);}
function openCharacter(id,mode='library',nodeId){const p=state.p;let c=id?p.characters.find(c=>c.id===id):ST.character(p,{name:t('新角色')});if(!c)throw Error(t('角色不存在'));let note='';
 if(mode==='pending'){const n=nodeById(nodeId),r=nodeRoute(n);c=r.h?.after[id]||c;note=r.defaultRoute?t('此卡片显示当前路径到达该节点后的待变化状态。'):t('此节点不在默认路径中，已选取一条可达路径预览。');}
 if(mode==='current'){c=ST.present(p,p.currentSceneId).characters[id]||c;note=t('保存后立即叠加到所有已推演节点之后，并更新角色库。历史节点的快照会保留。');}
 state.modal={kind:'character',id,mode,nodeId,draft:ST.clone(c),original:ST.clone(c),note};renderCharacterModal();
}
function captureCharacter(){const m=state.modal;if(m?.kind!=='character')return;for(const el of $$('[data-character-field]'))m.draft[el.dataset.characterField]=el.dataset.characterField==='displayName'?el.value.trim():el.value;if($('#character-tags'))m.draft.tags=splitTags($('#character-tags').value);if($('#character-import-source'))m.characterImport.source=$('#character-import-source').value;}
function updateCharacterImport(modal,action){
  captureCharacter();
  const importer=modal.characterImport||={source:'',open:false};
  if(action==='character-import-toggle'){
    importer.open=!importer.open;
    $('#character-import-panel').innerHTML=renderCharacterImport(modal);
    if(importer.open)$('#character-import-source').focus();
    else $('[data-action="character-import-toggle"]').focus();
    return;
  }
  if(action==='character-import-scan'){
    if(!importer.source.trim())throw Error(t('请先粘贴人物设定。'));
    importer.result=CharacterImport.suggest(importer.source,state.p,modal.draft,{isNew:!modal.id});
    $('#character-import-preview').innerHTML=characterImportPreview(importer.result);
    return;
  }
  const selected=$$('[data-character-import-choice]:checked');
  if(!selected.length)throw Error(t('请至少勾选一个字段。'));
  const current=CharacterImport.suggest(importer.source,state.p,modal.draft,{isNew:!modal.id});
  if(JSON.stringify(current)!==JSON.stringify(importer.result)){
    importer.result=current;
    $('#character-import-preview').innerHTML=characterImportPreview(current);
    throw Error(t('卡片内容已更改，请重新核对提取结果。'));
  }
  const draft=ST.clone(modal.draft),sets=[];
  for(const choice of selected){
    const {field,key,value}=current.changes[Number(choice.dataset.characterImportChoice)];
    if(field==='itemSet')sets.push(key);
    else if(key===undefined)draft[field]=value;
    else draft[field][key]=value;
  }
  draft.inventory=ST.inventoryWithItemSets(state.p,draft.inventory,sets);
  modal.draft=draft;
  importer.result=null;
  importer.open=false;
  renderCharacterModal();
  toast(t('已填入角色卡草稿'));
}
async function saveCharacter(){
 captureCharacter();
 const m=state.modal,c=m.draft;
 const imageRead=m.imageRead;
 if(imageRead){
   const image=await imageRead;
   if(m.imageRead===imageRead)c.image=image;
 }
 if(state.modal!==m)return;
 ST.character(state.p,c);
 const {id,name,...patch}=c;
 if(m.mode==='pending'){
   const base=m.original;
   const diff=ST.diffCharacters({[id]:base},{[id]:c}).filter(change=>change.kind!=='itemAttribute'||c.inventory[change.itemId]>0);
   const ops=diff.map(change=>({kind:change.kind,characterId:id,key:change.key,itemId:change.itemId||change.key,mode:'set',value:change.after}));
   for(const tag of c.tags.filter(tag=>!base.tags.includes(tag)))ops.push({kind:'tag',characterId:id,key:tag,mode:'add'});
   for(const tag of base.tags.filter(tag=>!c.tags.includes(tag)))ops.push({kind:'tag',characterId:id,key:tag,mode:'remove'});
   ops.push(...ST.profileOperations(base,c));
   if(ops.length)await run(()=>{
     const node=nodeById(m.nodeId);
     if(!node)throw Error(t('原节点或编辑位置已变动，草稿已保留。'));
     const fields=new Set(ops.filter(op=>op.kind==='characterField').map(op=>op.key));
     const prior=node.operations.filter(op=>!(op.kind==='characterField'&&op.characterId===id&&fields.has(op.key)&&!op.targetTag&&(node.type!=='label'||op.direct)));
     const operations=[...prior,...ops.map(op=>node.type==='label'?{...op,direct:true}:op)];
     return [{type:'node.update',args:{id:node.id,patch:{operations}}}];
   },t('待变化已记录'));
 }else if(m.mode==='current')await cmd('character.current',{sceneId:state.p.currentSceneId,characterId:id,patch},t('当前角色状态已保存'));
 else if(m.id)await cmd('character.update',{id:m.id,patch},t('角色卡已保存'));
 else await cmd('character.create',c,t('角色卡已创建'));
 closeModal();
}
async function loadCharacterImage(modal,file){
 if(file.size>8e6)throw Error(t('请选择小于8MB的图片'));
 if(!/^image\/(png|jpeg|webp|gif)$/u.test(file.type))throw Error(t('图片格式不支持'));
 const reading=readArtImage(file);
 modal.imageRead=reading;
 try{
   const image=await reading;
   if(state.modal!==modal||modal.imageRead!==reading)return;
   captureCharacter();
   modal.draft.image=image;
   renderCharacterModal();
 }finally{
   if(modal.imageRead===reading)modal.imageRead=null;
 }
}
async function inventoryDrop(target,d){const m=state.modal;
 if(d.kind==='itemset'&&target==='character-modal'&&m?.kind==='character'){addCharacterItemSet(d.id);return;}
 if(d.kind!=='item')return;
 if(target==='character-modal'&&m?.kind==='character'){captureCharacter();m.draft.inventory[d.id]=(m.draft.inventory[d.id]||0)+1;renderCharacterModal();return;}
 if(target.startsWith('board:')&&m?.kind==='event-board'){const to=target.slice(6);if(d.fromCharacterId && d.fromCharacterId!==to){const before=m.characters[d.fromCharacterId]?.inventory[d.id]||0;if(before<1)throw Error(t('原角色没有这件物品'));m.operations.push({kind:'transfer',characterId:d.fromCharacterId,toCharacterId:to,itemId:d.id,value:1});m.characters=ST.applyOperations(state.p,nodeById(m.nodeId).sceneId,m.characters,[m.operations.at(-1)]).characters;renderEventBoard();}else if(!d.fromCharacterId){m.operations.push({kind:'item',characterId:to,itemId:d.id,mode:'add',value:1});m.characters=ST.applyOperations(state.p,nodeById(m.nodeId).sceneId,m.characters,[m.operations.at(-1)]).characters;renderEventBoard();}return;}}
function openItem(id){const c=id?state.p.items.find(i=>i.id===id):ST.item({name:t('新物品')});state.modal={kind:'item',id,draft:ST.clone(c)};renderItemModal();}
function itemSetChip(set){
  return `<span class="entity-chip item" draggable="true" data-drag-kind="itemset" data-drag-id="${esc(set.id)}" title="${esc(set.entries.map(entry=>itemSetEntryName(entry)+' × '+entry.quantity).join(' · '))}">${icon('items',11)}${esc(set.name)}</span>`;
}
function openItemSet(id){
  const sets=state.p.itemSets||[];
  const original=id?ST.find({itemSets:sets},'itemSets',id):null;
  state.modal={kind:'item-set',id,original,draft:original?ST.clone(original):{name:'',entries:[]}};
  renderItemSetEditor();
}
function renderItemSetEditor(){
  const modal=state.modal,set=modal.draft;
  const sets=(state.p.itemSets||[]).filter(entry=>entry.id!==modal.id);
  const items=state.p.items;
  const options=(kind,list)=>list.map(entry=>`<option value="${kind}:${esc(entry.id)}">${esc(entry.name)}</option>`).join('');
  showModal(t(modal.id?'编辑物品组合':'新建物品组合'),html`
    <label for="item-set-name">组合名称</label>
    <input id="item-set-name" data-focus="item-set-name" value="${esc(set.name)}">
    <p class="hint">同一物品可用于多个组合。拖入物品或子组合后，在这里设定各自的数量。</p>
    <div class="item-set-members" data-item-set-drop>
      ${set.entries.map((entry,index)=>html`<div class="row item-set-member">
        <span class="flex">${esc(itemSetEntryName(entry))} ${entry.kind==='set'?`<small class="muted">${t('物品组合')}</small>`:''}</span>
        <input class="number-inline" type="number" min="1" max="${ST.INVENTORY_LIMIT}" step="1" data-item-set-quantity
          aria-label="数量" data-focus="item-set-qty-${index}" value="${entry.quantity}">
        ${button('item-set-remove-entry','×','small ghost',t('移除成员'))}
      </div>`).join('')||html`<p class="hint">将物品或子组合拖到这里</p>`}
    </div>
    <label for="item-set-entry">选择要加入的物品或组合</label>
    <div class="row">
      <select id="item-set-entry" ${!items.length&&!sets.length?'disabled':''}>
        ${items.length?html`<optgroup label="物品">${options('item',items)}</optgroup>`:''}
        ${sets.length?html`<optgroup label="物品组合">${options('set',sets)}</optgroup>`:''}
      </select>
      ${button('item-set-add-entry',t('添加'),'small')}
    </div>
    <div class="item-set-tray peek-chars">${items.map(item=>entityChip({kind:'item',id:item.id})).join('')}${sets.map(itemSetChip).join('')}</div>`,
    (modal.id?deleteEntryButton('itemSet'):'')+
    button('modal-close',t('取消'))+button('item-set-save',t('保存组合'),'primary'),'narrow');
}
function captureItemSet(){
  const draft=state.modal.draft;
  draft.name=$('#item-set-name').value.trim();
  $$('[data-item-set-quantity]').forEach((input,index)=>{draft.entries[index].quantity=input.valueAsNumber;});
}
function addItemSetDraftEntry(entry){
  captureItemSet();
  const entries=state.modal.draft.entries;
  const match=entries.find(row=>row.kind===entry.kind&&row.id===entry.id);
  if(match)match.quantity=(match.quantity||0)+entry.quantity;
  else entries.push(entry);
  renderItemSetEditor();
}
function renderCharacterItemSets(){
  const sets=state.p.itemSets||[];
  if(!sets.length)return '';
  return html`<label for="inventory-add-set">物品组合</label>
    <div class="row">
      <select id="inventory-add-set" data-focus="inventory-add-set">${sets.map(set=>`<option value="${esc(set.id)}">${esc(set.name)}</option>`).join('')}</select>
      ${button('inventory-add-set',t('添加组合'),'small')}
    </div>
    <div class="item-set-tray peek-chars">${sets.map(itemSetChip).join('')}</div>`;
}
function addCharacterItemSet(id){
  captureCharacter();
  const draft=state.modal.draft;
  draft.inventory=ST.inventoryWithItemSets(state.p,draft.inventory,[id]);
  renderCharacterModal();
}
function captureItem(){const m=state.modal;if(m?.kind!=='item')return;for(const el of $$('[data-item-field]'))m.draft[el.dataset.itemField]=el.value;m.draft.tags=splitTags($('#item-tags')?.value||'');for(const el of $$('[data-item-attribute]'))m.draft.attributes[el.dataset.itemAttribute]=Number(el.value);}
function renderItemModal(){const m=state.modal,i=m.draft;showModal(m.id?t('编辑物品卡'):t('创建物品卡'),html`<div class="modal-grid"><div><label style="margin-top:0">物品名称</label><input data-item-field="name" data-focus="item-name" value="${esc(i.name)}"><label>简介</label><textarea data-item-field="summary" data-focus="item-summary" rows="2">${esc(i.summary)}</textarea><label>详情</label><textarea data-item-field="details" data-focus="item-details" rows="5">${esc(i.details)}</textarea><label>物品分组</label><select data-item-field="groupId" data-focus="item-group"><option value="">未分组</option>${ST.groupsOf(state.p,'item').map(g=>`<option value="${esc(g.id)}" ${g.id===i.groupId?'selected':''}>${esc(g.name)}</option>`).join('')}</select><label>自定义标签 · 逗号分隔</label><input id="item-tags" value="${esc(i.tags.join(', '))}" data-focus="item-tags"></div><div><label style="margin-top:0">A 组 · 必选一个</label><select data-item-field="category" data-focus="item-category">${options(ST.ITEM_A,i.category)}</select><label>B 组 · 可选一个</label><select data-item-field="type" data-focus="item-type">${options(['',...ST.ITEM_B],i.type)}</select><label>C 组 · 品级，需先选择 B 组</label><select data-item-field="grade" ${i.type?'':'disabled'} data-focus="item-grade">${options(['',...ST.ITEM_C],i.grade)}</select><div class="section-title">物品属性 <span class="tiny muted">0–100</span></div>${i.category==='特殊物品'?staticHtml('<div class="inline-note">特殊物品没有属性栏。</div>'):html`${Object.entries(i.attributes).map(([k,v])=>`<div class="row" style="margin:8px 0"><span class="flex smalltext">${esc(k)}</span><input class="number-inline" type="number" min="0" max="100" data-item-attribute="${esc(k)}" data-focus="item-attr-${esc(k)}" value="${v}"><button class="small ghost" data-item-remove-attr="${esc(k)}">×</button></div>`).join('')}<div class="row"><input id="new-item-attr" placeholder="新属性名称">${button('item-add-attr',t('添加'),'small')}</div>`}<div class="hint">同组标签互斥。物品进入角色物品栏后可堆叠，双击数量编辑。</div></div></div>`,(m.id?deleteEntryButton('item'):'')+button('modal-close',t('取消'))+button('item-save',t('保存物品卡'),'primary'),'');}
function openOperation(nodeId){
 const n=nodeById(nodeId),ids=Object.keys(ST.sceneOf(state.p,n.sceneId).characters);
 const characterId=n.refs.find(ref=>ref.kind==='character')?.id||ids[0]||'';
 state.modal={kind:'operation',nodeId,draft:{kind:'attribute',characterId,toCharacterId:ids.find(id=>id!==characterId)||'',key:state.p.definitions.attributes[0]||'生命',itemId:state.p.items[0]?.id||'',mode:'set',value:20,nameSource:'fixed',fixedName:'',namePrompt:t('请输入你的角色名称'),defaultName:''}};
 renderOperation();
}
function captureOperation(){
 const m=state.modal;if(m?.kind!=='operation')return;
 for(const el of $$('[data-op-field]'))m.draft[el.dataset.opField]=el.type==='number'?Number(el.value):el.value;
}
function renderNameOperation(o){
 return html`<label for="op-name-source">名称来源</label>
 <select id="op-name-source" data-op-field="nameSource" data-focus="op-name-source">
   <option value="fixed" ${o.nameSource==='fixed'?'selected':''}>固定名称</option>
   <option value="player" ${o.nameSource==='player'?'selected':''}>由玩家输入</option>
 </select>
 ${o.nameSource==='player'?html`<label for="op-name-prompt">显示给玩家的提示</label>
 <input id="op-name-prompt" data-op-field="namePrompt" value="${esc(o.namePrompt)}">
 <label for="op-name-default">默认角色名称</label>
 <input id="op-name-default" data-op-field="defaultName" value="${esc(o.defaultName)}">
 <p class="hint">在「剧情推演」中可试填。节点日志和项目导出会记录提示、默认名称和输入 ID。</p>`:html`<label for="op-fixed-name">新的角色名称</label>
 <input id="op-fixed-name" data-op-field="fixedName" value="${esc(o.fixedName)}">`}
 <p class="hint">名称留空时沿用角色ID。</p>`;
}
function renderOperation(){
 const m=state.modal,o=m.draft,n=nodeById(m.nodeId);
 const rename=o.kind==='characterField';
 const characters=rename?state.p.characters:Object.values(ST.sceneOf(state.p,n.sceneId).characters);
 const castOptions=(selected)=>characters.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('');
 const fieldOptions=o.kind==='skill'?state.p.definitions.skills:state.p.definitions.attributes;
 const kinds={
   attribute:'修改属性（0–100）',skill:'修改技能（0–10）',item:'给予 / 掉落物品',
   itemAttribute:'修改携带物品的属性',transfer:'角色之间转移物品',tag:'添加 / 移除角色标签',
   characterField:'角色名称'
 };
 const fields=rename?renderNameOperation(o):html`
 ${['attribute','skill','itemAttribute'].includes(o.kind)?html`<label>${o.kind==='skill'?t('技能'):t('属性')}名称</label>
 <input data-op-field="key" list="op-key-list" value="${esc(o.key)}"><datalist id="op-key-list">${fieldOptions.map(k=>`<option value="${esc(k)}">`).join('')}</datalist>`:''}
 ${['item','transfer','itemAttribute'].includes(o.kind)?html`<label>物品</label>
 <select data-op-field="itemId">${state.p.items.map(i=>`<option value="${esc(i.id)}" ${o.itemId===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select>`:''}
 ${o.kind==='transfer'?html`<label>接收角色</label><select data-op-field="toCharacterId">${castOptions(o.toCharacterId)}</select>`:
 o.kind==='tag'?html`<label>标签名称</label><input data-op-field="key" value="${esc(o.key)}">
 <select data-op-field="mode" style="margin-top:9px"><option value="add" ${o.mode==='add'?'selected':''}>添加标签</option><option value="remove" ${o.mode==='remove'?'selected':''}>移除标签</option></select>`:
 html`<label>修改方式</label><select data-op-field="mode"><option value="set" ${o.mode==='set'?'selected':''}>设为指定值</option><option value="add" ${o.mode==='add'?'selected':''}>增加 / 减少（负数表示减少）</option></select>`}
 ${o.kind!=='tag'?html`<label>${o.kind==='transfer'?t('转移数量'):t('数值')}</label><input type="number" data-op-field="value" value="${esc(o.value)}">`:''}
 <div class="hint">先将角色拖入节点 / 场景后再添加变化。转移操作会同步扣减原主人的物品。</div>`;
 showModal(t('记录一项待变化'),html`<div class="inline-note">到达「${esc(n.title)}」时应用这项变化。</div>
 <label for="op-kind">变化类型</label><select id="op-kind" data-op-field="kind" data-focus="op-kind">${Object.entries(kinds).map(([value,label])=>`<option value="${value}" ${o.kind===value?'selected':''}>${esc(t(label))}</option>`).join('')}</select>
 <label for="op-character">${n.type==='label'&&!rename?t('预览角色（执行时按标签批量匹配）'):rename?t('角色ID'):t('操作角色')}</label>
 <select id="op-character" data-op-field="characterId">${castOptions(o.characterId)}</select>
 ${rename&&!characters.length?html`<p class="hint">请先创建一张角色卡。</p>`:''}${fields}`,
 button('modal-close',t('取消'))+button('operation-save',t('加入待变化'),'primary'),'narrow');
}
function openEventBoard(nodeId){state.modal={kind:'event-board',nodeId,characters:nodeCharacters(nodeId),operations:[]};renderEventBoard();}
function renderEventBoard(){const m=state.modal,n=nodeById(m.nodeId),refs=n.refs.filter(r=>r.kind==='character').map(r=>r.id),all=Object.keys(m.characters),ids=[...new Set([...refs,...n.factions.A,...n.factions.B])];if(!ids.length)ids.push(...all);
 const card=id=>{const c=m.characters[id];if(!c)return '';return html`<div class="tool-card" data-inventory-drop="board:${esc(id)}" style="margin:0"><div class="row">${avatar(c)}<h3>${esc(c.name)}</h3></div><div class="hint">${Object.entries(c.attributes).map(([k,v])=>esc(k)+' '+v).join(' · ')}</div><div class="section-label">物品 · 拖给另一名角色</div>${Object.entries(c.inventory).filter(([,q])=>q>0).map(([itemId,q])=>`<div class="inventory-row" draggable="true" data-drag-kind="item" data-drag-id="${esc(itemId)}" data-from-character="${esc(id)}" data-qty="${q}" data-drag-node="${esc(n.id)}">${icon('items',13)}<strong>${esc(itemName(itemId))}</strong><span class="qty">× ${q}</span></div>`).join('')}<div class="empty-drop">拖入物品，表示此角色获得物品</div></div>`;};
 showModal(t('事件角色面板 · ')+n.title,html`<div class="inline-note">每次拖放转移 1 件物品，也可以在“添加变化”中指定数量。此处先预览，点击“保存待变化”才写入事件。</div><div class="row between" style="margin-bottom:16px"><span class="event-kind">${esc(eventTypeLabel(n.eventType))}</span><span class="smalltext muted">阵营 A：${esc(n.factions.A.map(charName).join('、')||t('未分配'))}　阵营 B：${esc(n.factions.B.map(charName).join('、')||t('未分配'))}</span></div><div style="display:grid;grid-template-columns:repeat(${Math.min(3,ids.length)||1},1fr);gap:13px">${ids.map(card).join('')}</div><div class="section-title">可给予的物品 · 拖入角色物品栏</div><div class="peek-chars">${state.p.items.map(i=>entityChip({kind:'item',id:i.id},'data-modal-tray="true"')).join('')}</div><div class="section-title">本次待保存变化 · ${m.operations.length} 项</div>${m.operations.map(o=>`<div class="op-card">${esc(operationText(o))}</div>`).join('')||staticHtml('<div class="hint">拖动物品后会在这里记录。</div>')}`,button('modal-close',t('取消'))+button('event-board-save',t('保存待变化'),'primary'),'wide');}
function openRules(nodeId){const n=nodeById(nodeId);state.modal={kind:'rules',nodeId,draft:ST.clone(n.condition)};renderRules();}
function captureRules(){const m=state.modal;if(m?.kind!=='rules')return;m.draft.logic=$('#rules-logic')?.value||m.draft.logic;for(const el of $$('[data-rule-field]')){const i=Number(el.dataset.ruleIndex);m.draft.rules[i][el.dataset.ruleField]=el.value;}}
function renderRules(){const m=state.modal,c=m.draft;showModal(t('结构化条件规则'),html`<div class="inline-note">规则读取事件执行后的角色状态。可使用属性、技能、物品数量或角色标签判断；规则结果决定走真 / 假分支。</div><label>组合方式</label><select id="rules-logic"><option value="all" ${c.logic==='all'?'selected':''}>满足全部规则（AND）</option><option value="any" ${c.logic==='any'?'selected':''}>满足任一规则（OR）</option></select><div style="margin-top:16px">${c.rules.map((r,i)=>`<div class="rule-row"><div class="row"><select data-rule-index="${i}" data-rule-field="characterId">${characterOptions(r.characterId,false)}</select><select data-rule-index="${i}" data-rule-field="kind">${['attribute','skill','item','tag'].map((v,j)=>`<option value="${v}" ${r.kind===v?'selected':''}>${[t('属性'),t('技能'),t('物品数量'),t('具有标签')][j]}</option>`).join('')}</select><button class="small ghost" data-rule-remove="${i}">×</button></div><div class="row">${r.kind==='item'?`<select data-rule-index="${i}" data-rule-field="key">${state.p.items.map(it=>`<option value="${esc(it.id)}" ${r.key===it.id?'selected':''}>${esc(it.name)}</option>`).join('')}</select>`:`<input data-rule-index="${i}" data-rule-field="key" value="${esc(r.key)}" placeholder="${r.kind==='tag'?t('标签名称'):t('名称')}">`}<select style="width:85px" data-rule-index="${i}" data-rule-field="op">${['eq','ne','gt','gte','lt','lte'].map((v,j)=>`<option value="${v}" ${r.op===v?'selected':''}>${['=','≠','>','≥','<','≤'][j]}</option>`).join('')}</select>${r.kind==='tag'?html`<select data-rule-index="${i}" data-rule-field="value"><option value="true" ${r.value==='true'?'selected':''}>具有</option><option value="false" ${r.value==='false'?'selected':''}>不具有</option></select>`:`<input type="number" data-rule-index="${i}" data-rule-field="value" value="${esc(r.value)}">`}</div></div>`).join('')}</div>${button('rule-add',t('＋ 添加规则'),'small full')}`,button('modal-close',t('取消'))+button('rules-save',t('保存规则'),'primary'),'');}
function openSceneInfo(id=state.p.currentSceneId,rename=false){
 const scene=ST.sceneOf(state.p,id);
 if(state.modal?.kind==='scene-info' && state.modal.id===id)return;
 state.modal={kind:'scene-info',id};
 showModal(t(rename?'修改场景名称':'场景设置'),html`
   <label for="scene-name">场景名称</label><input id="scene-name" value="${esc(scene.name)}">
   <label for="scene-summary">场景简介</label><textarea id="scene-summary" rows="5">
${esc(scene.summary)}</textarea>`,
 deleteEntryButton('scene')+button('modal-close',t('取消'))+button('scene-save',t('保存场景'),'primary'),'narrow');
 $('#scene-name').focus();
 if(rename)$('#scene-name').select();
}
function openItemGroup(group){
 state.modal={kind:'item-group',id:group.id};
 const members=state.p.items.filter(item=>item.groupId===group.id);
 showModal(t('物品分组'),html`
   <label for="item-group-name">分组名称</label><input id="item-group-name" value="${esc(group.name)}">
   <label>组内物品</label><div class="group-members">${members.map(item=>entityChip({kind:'item',id:item.id})).join('')||t('将物品卡拖到分组标题，或在物品卡中选择分组。')}</div>
   <label for="group-tags">批量添加标签 · 逗号分隔</label><input id="group-tags">
   <p class="hint">可以拖动分组标题，把整组物品加入节点。</p>`,
   deleteEntryButton('group')+button('modal-close',t('取消'))+button('item-group-save',t('保存分组'),'primary'),'narrow');
}
function openTransfer(copy){state.modal={kind:'transfer',copy,ids:[...state.selected]};showModal(copy?t('复制节点到场景'):t('移动节点到场景'),html`<div class="inline-note">将${copy?t('复制'):t('移动')} ${state.selected.size} 个节点，保留选中节点之间的连线。${copy?'':t('与未选中节点的连线将断开。')}角色将复制为目标场景中的独立快照。</div><label>目标场景</label><select id="transfer-scene"><option value="new">＋ 新建一个场景</option>${state.p.scenes.filter(s=>s.id!==state.p.currentSceneId).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><label>新场景名称（选择新建时使用）</label><input id="transfer-scene-name" value="新场景">`,button('modal-close',t('取消'))+button('transfer-save',copy?t('复制'):t('移动'),'primary'),'narrow');}
function openSceneCharacters(){const s=currentScene(),r=ST.present(state.p,s.id);state.modal={kind:'scene-characters'};showModal(t('场景角色 · 当前状态'),html`<div class="inline-note">显示默认路径推演完毕、再叠加检查器即时编辑后的状态。${r.status==='choice'?t('当前存在未选分支，状态停在分叉处。'):''}</div>${r.error?`<p class="error">${esc(localizeError(r.error))}</p>`:''}<div class="stack">${Object.values(r.characters).map(c=>html`<div class="tool-card"><div class="row">${avatar(c)}<div class="flex"><h3>${esc(c.name)}</h3><p>${esc(Object.entries(c.attributes).map(([k,v])=>k+' '+v).join(' · '))}</p></div><button class="small" data-open-current="${esc(c.id)}">即时编辑</button></div><p style="margin-top:9px">${Object.entries(c.inventory).filter(([,q])=>q>0).map(([id,q])=>esc(itemName(id))+' × '+q).join(' · ')||t('暂无物品')}</p></div>`).join('')||staticHtml('<div class="hint">将角色拖进场景或节点即可创建独立快照。</div>')}</div>`,button('modal-close',t('关闭')),'');}
function openGroup(id){
 const group=ST.find(state.p,'groups',id);
 if(group.kind==='item'){openItemGroup(group);return;}
 state.modal={kind:'group',id};
 showModal(t('分组批量操作 · ')+group.name,html`
   <label for="character-group-name">分组名称</label><input id="character-group-name" value="${esc(group.name)}">
   <div class="group-members">${state.p.characters.filter(c=>c.groupId===id)
     .map(c=>entityChip({kind:'character',id:c.id})).join('')||staticHtml('<span class="muted">此组还没有角色，在角色卡中选择分组。</span>')}</div>
   <label for="group-tags">批量添加标签 · 逗号分隔</label><input id="group-tags" placeholder="例如：同伴, 第一幕登场">
   <div class="form-row">
     <div><label for="group-field">修改技能 / 属性</label><select id="group-field"><option value="none">不修改数值</option>
     ${state.p.definitions.skills.map(key=>html`<option value="skill:${esc(key)}">技能 · ${esc(key)}</option>`).join('')}
     ${state.p.definitions.attributes.map(key=>html`<option value="attribute:${esc(key)}">属性 · ${esc(key)}</option>`).join('')}</select></div>
     <div><label for="group-value">设为数值</label><input id="group-value" type="number" value="0"></div>
   </div>
   <label for="group-item">批量给予物品</label>
   <div class="row"><select id="group-item"><option value="">不发放物品</option>
     ${state.p.items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select>
     <input id="group-item-qty" class="number-inline" type="number" min="1" value="1">
   </div>
   <label for="group-scene">将全组角色加入场景</label><select id="group-scene"><option value="">不加入场景</option>
     ${state.p.scenes.map(scene=>`<option value="${esc(scene.id)}">${esc(scene.name)}</option>`).join('')}</select>
   <div class="hint">批量数值、物品和标签更新角色库的当前设定。拖动分组标题可将全组加入节点。</div>`,
   deleteEntryButton('group')+button('modal-close',t('取消'))+button('group-save',t('保存分组'),'primary'));
}
function openDefinitions(){state.modal={kind:'definitions'};showModal(t('技能与属性设定'),html`<div class="inline-note">每行一个名称。新角色将使用这些默认栏位；已有角色保留自己的自定义栏位。</div><div class="modal-grid"><div><label>默认技能 · 0–10，默认 0</label><textarea id="definitions-skills" rows="10">${esc(state.p.definitions.skills.join('\n'))}</textarea><div class="hint">0：完全未习得<br>6：人类极限<br>7–10：人类能力范围之外</div></div><div><label>默认属性 · 0–100，默认 20</label><textarea id="definitions-attributes" rows="10">${esc(state.p.definitions.attributes.join('\n'))}</textarea></div></div>`,button('modal-close',t('取消'))+button('definitions-save',t('保存设定'),'primary'),'');}
function openSimulation(startNodeId=state.modal?.startNodeId){
 const start=startNodeId||undefined;
 const result=ST.trace(state.p,{startNodeId:start,choices:state.traceChoices,inputs:state.traceInputs,waitForInput:true});
 state.modal={kind:'simulation',startNodeId:start,result};
 renderSimulation();
 if(result.pendingInput)$('#trace-player-name').focus();
}
function renderPlayerNameRequest(request){
 return html`<div class="trace-choices">
   <h3>${t('玩家命名')} · ${esc(nodeById(request.nodeId)?.title||'')}</h3>
   <label for="trace-player-name">${esc(request.prompt)}</label>
   <input id="trace-player-name" placeholder="${esc(request.defaultValue)}" autocomplete="off">
   <div class="modal-actions">${button('simulate-name',t('确认名称'),'primary small')}${button('simulate-name-default',t('使用默认名称'),'ghost small')}</div>
 </div>`;
}
function renderSimulatedText(h){
 const node=nodeById(h.nodeId),name=id=>ST.characterDisplayName(h.after[id])||charName(id);
 const resolve=text=>richText(text,node,h.after);
 const lines=ST.hasDialogue(node)?node.lines.filter(line=>line.text?.trim()).map(line=>`${esc(name(line.characterId))}：${resolve(line.text)}`):[];
 if(node.text?.trim())lines.unshift((node.type==='monologue'?esc(name(node.speakerId))+'：':'')+resolve(node.text));
 if(node.condition.description?.trim()&&node.type==='condition')lines.push(resolve(node.condition.description));
 return lines.length?`<div class="simulated-text">${lines.join('\n')}</div>`:'';
}
function renderSimulation(){const m=state.modal,r=m.result;const roots=state.p.nodes.filter(n=>!state.p.edges.some(e=>e.to===n.id));
 showModal(t('剧情推演'),html`<div class="row"><label style="margin:0;white-space:nowrap">从哪里开始</label><select id="simulate-start"><option value="">当前场景的起点</option>${state.p.scenes.map(s=>`<optgroup label="${esc(s.name)}">${state.p.nodes.filter(n=>n.sceneId===s.id).map(n=>`<option value="${esc(n.id)}" ${n.id===m.startNodeId?'selected':''}>${esc(n.title)}</option>`).join('')}</optgroup>`).join('')}</select>${button('simulate-again',t('重新推演'),'small')}</div><div class="hint">推演只读取剧情，不修改角色库。你可以选择条件的真假，观察回溯前后的不同状态。</div><div class="divider"></div>${r.history.map((h,i)=>html`<div class="trace-step"><div class="row between"><h3>${String(i+1).padStart(2,'0')}　${esc(h.title)}</h3><span class="tiny muted">${esc(ST.sceneOf(state.p,h.sceneId).name+' · '+h.date)}</span></div>${renderSimulatedText(h)}${h.changes.map(d=>`<div class="change">${esc(changeText(d))}</div>`).join('')}${h.rolledBack?.length?staticHtml('<p style="color:#c19bac">↶ 已按条件回溯事件；角色状态已恢复。</p>'):''}${h.type==='condition'?html`<div class="row" style="margin-top:10px"><span class="tiny muted">此处判定：</span><button data-trace-choice="${esc(h.nodeId)}" data-choice="0" class="small ${h.outcome?'active':''}">真</button><button data-trace-choice="${esc(h.nodeId)}" data-choice="1" class="small ${h.outcome===false?'active':''}">假</button></div>`:''}${h.error?`<p class="error">${esc(localizeError(h.error))}</p>`:''}<details class="smalltext" style="margin-top:9px"><summary class="muted">查看此刻角色状态</summary><div class="preview-states">${Object.values(h.after).map(c=>`<div class="tool-card"><h3>${esc(ST.characterDisplayName(c))}</h3><p>${esc(Object.entries(c.attributes).map(([k,v])=>k+' '+v).join(' · '))}<br>${esc(Object.entries(c.skills).map(([k,v])=>k+' '+v).join(' · '))}<br>${esc(Object.entries(c.inventory).filter(([,q])=>q>0).map(([id,q])=>itemName(id)+' ×'+q).join(' · ')||t('暂无物品'))}</p></div>`).join('')}</div></details></div>`).join('')}${r.pendingInput?renderPlayerNameRequest(r.pendingInput):r.status==='choice'?html`<div class="trace-choices"><p class="smalltext">请选择接下来发生的分支：</p>${(()=>{const n=nodeById(r.history.at(-1).nodeId);return state.p.edges.filter(e=>e.from===n.id).map(e=>`<button data-trace-choice="${esc(n.id)}" data-choice="${esc(e.id)}" class="small" style="margin:8px 5px 0 0">${esc((n.type==='condition'?t(n.outputs[e.output]):n.outputs[e.output])+' → '+nodeById(e.to).title)}</button>`).join('');})()}</div>`:r.status==='cycle'?staticHtml('<p class="warning">遇到循环，已停止继续推演。循环不会被重复叠加到当前角色状态。</p>'):r.status==='limit'?staticHtml('<p class="warning">达到推演步数上限。</p>'):r.status==='error'?html`<p class="error">推演停止：${esc(localizeError(r.error))}</p>`:staticHtml('<div class="badge">本段剧情推演结束</div>')}`,button('modal-close',t('返回画布')),'wide');}
async function openMcp(){const config=window.desktop?await desktop.getMcpConfig():{json:{mcpServers:{storytree:{command:'D:\\storytree\\StoryTree.MCP.exe',args:[]}}},toml:"[mcp_servers.storytree]\ncommand = 'D:\\storytree\\StoryTree.MCP.exe'\nargs = []"};state.modal={kind:'mcp',config};showModal(t('连接你的 AI agent'),html`<div class="inline-note">本地 stdio MCP · ${24} 个工具 · 与画布共享同一份项目<br>AI 可创建角色、物品、场景与节点，连线、记录事件、推演条件及读取故事树。软件未打开时也可调用。</div><h3>Codex · config.toml</h3><pre class="code-block">${esc(config.toml)}</pre><h3 style="margin-top:18px">DeepSeek Harness / 通用 MCP · JSON</h3><pre class="code-block">${esc(JSON.stringify(config.json,null,2))}</pre><div class="hint">将配置加入 agent 的 MCP 配置后重启连接。数据保存在软件目录的 data 文件夹，自动保留最近 40 份备份。</div><div class="section-title">可直接对 AI 说</div><div class="tool-card"><p>“读取 StoryTree 当前故事，为米拉卡和渡鸦建立一场战斗，连接一个条件节点：如果米拉卡没赶上战斗，撤销她在战斗中的属性和物品变化。”</p></div><p class="hint">StoryTree.MCP.exe 是专用无窗口入口，无需另装 Node.js。MCP 资源 storytree://schema 说明节点、条件和变化的字段。所有 AI 编辑都会记录在本地项目的 audit 中，并可在软件中撤销。</p>`,button('mcp-copy',t('复制 JSON 配置'))+button('mcp-download',t('保存配置文件'))+button('modal-close',t('完成'),'primary'),'');}
function openImport(project){ST.validateProject(project,{legacyNumbers:true});state.modal={kind:'import',project};showModal(t('打开故事项目'),html`<h2>${esc(project.title)}</h2><p class="smalltext muted" style="margin-top:12px">${project.scenes.length} 场景 · ${project.characters.length} 角色 · ${project.nodes.length} 节点</p><div class="inline-note" style="margin-top:18px">打开后将替换当前工作项目。当前版本会保留在自动备份中，也可以使用撤销恢复。</div>${recoveryMarkup(project)}`,button('modal-close',t('取消'))+button('import-save',t('打开这个故事'),'primary'),'narrow');}
async function modalChange(el){const m=state.modal;if(!m)return;
 if(m.kind==='attribute-picker'&&['attribute-character','character-variable-field'].includes(el.id)){
   if(el.id==='attribute-character')m.characterId=el.value;
   else m.field=el.value;
   renderAttributePicker();
 }
 if(m.kind==='character'){captureCharacter();if(el.dataset.quantityEdit){const n=Number(el.value);if(!Number.isInteger(n)||n<0||n>999999)throw Error(t('请输入 0–999999 的整数'));m.draft.inventory[el.dataset.quantityEdit]=n;renderCharacterModal();}if(el.dataset.carriedAttribute){m.draft.itemAttributes[m.itemEditor][el.dataset.carriedAttribute]=Number(el.value);}if(el.id==='character-image'&&el.files[0])await loadCharacterImage(m,el.files[0]);}
 if(m.kind==='item'){captureItem();if(el.dataset.itemField==='type'&&!m.draft.type)m.draft.grade='';if(el.dataset.itemField==='category'&&m.draft.category==='特殊物品')m.draft.attributes={};if(['category','type'].includes(el.dataset.itemField))renderItemModal();}
 if(m.kind==='operation'){
   captureOperation();
   if(el.dataset.opField==='kind'){
     const o=m.draft;
     if(o.kind==='skill')o.key=state.p.definitions.skills[0]||'观察';
     if(o.kind==='attribute')o.key=state.p.definitions.attributes[0]||'生命';
     if(o.kind==='tag'){o.key='';o.mode='add';}
     else{o.mode='set';o.value=o.kind==='skill'?0:o.kind==='attribute'?20:1;}
   }
   if(['kind','nameSource'].includes(el.dataset.opField))renderOperation();
 }
 if(m.kind==='rules'){captureRules();if(el.dataset.ruleField==='kind'){const r=m.draft.rules[Number(el.dataset.ruleIndex)];r.key=r.kind==='item'?state.p.items[0]?.id||'':r.kind==='skill'?state.p.definitions.skills[0]||'':r.kind==='tag'?'':state.p.definitions.attributes[0]||'';r.value=r.kind==='tag'?'true':0;renderRules();}}
}
document.addEventListener('dblclick',e=>{const attrs=e.target.closest('[data-inventory-item-attrs]');if(attrs&&state.modal?.kind==='character'){captureCharacter();const itemId=attrs.dataset.inventoryItemAttrs,def=state.p.items.find(i=>i.id===itemId);if(def.category==='特殊物品'){toast(t('特殊物品没有属性'));return;}if(!state.modal.draft.itemAttributes)state.modal.draft.itemAttributes={};if(!state.modal.draft.itemAttributes[itemId])state.modal.draft.itemAttributes[itemId]=ST.clone(def.attributes);state.modal.itemEditor=itemId;renderCharacterModal();return;}const el=e.target.closest('[data-inventory-qty]');if(el && state.modal?.kind==='character'){captureCharacter();const id=el.dataset.inventoryQty;el.innerHTML='<input type="number" min="0" max="999999" style="width:80px;padding:3px" data-quantity-edit="'+esc(id)+'" value="'+state.modal.draft.inventory[id]+'">';const input=el.querySelector('input');input.focus();input.select();}});
document.addEventListener('click',async e=>{try{const remove=e.target.closest('[data-inventory-remove]');if(remove&&state.modal?.kind==='character'){captureCharacter();state.modal.draft.inventory[remove.dataset.inventoryRemove]=0;renderCharacterModal();return;}const attr=e.target.closest('[data-item-remove-attr]');if(attr&&state.modal?.kind==='item'){captureItem();delete state.modal.draft.attributes[attr.dataset.itemRemoveAttr];renderItemModal();return;}const rule=e.target.closest('[data-rule-remove]');if(rule&&state.modal?.kind==='rules'){captureRules();state.modal.draft.rules.splice(Number(rule.dataset.ruleRemove),1);renderRules();return;}const cur=e.target.closest('[data-open-current]');if(cur){openCharacter(cur.dataset.openCurrent,'current');return;}const choice=e.target.closest('[data-trace-choice]');if(choice){state.traceChoices[choice.dataset.traceChoice]=/^\d+$/.test(choice.dataset.choice)?Number(choice.dataset.choice):choice.dataset.choice;openSimulation();}}catch(err){toast(err.message);}});
async function modalAction(action,e){const m=state.modal;if(!m)return;switch(action){
 case 'delete-entry':await confirmEntryDeletion(e.target.closest('[data-delete-kind]').dataset.deleteKind,m.id);break;
 case 'item-set-add-entry':{
   const value=$('#item-set-entry').value,split=value.indexOf(':');
   if(split<0)throw Error(t('请先创建物品卡'));
   addItemSetDraftEntry({kind:value.slice(0,split),id:value.slice(split+1),quantity:1});
   break;
 }
 case 'item-set-remove-entry':{
   captureItemSet();
   const row=e.target.closest('.item-set-member');
   m.draft.entries.splice($$('.item-set-member').indexOf(row),1);
   renderItemSetEditor();
   break;
 }
 case 'item-set-save':{
   captureItemSet();
   const data={name:m.draft.name,entries:m.draft.entries};
   if(data.entries.some(entry=>!Number.isInteger(entry.quantity)||entry.quantity<1||entry.quantity>ST.INVENTORY_LIMIT))
     throw Error(t('物品数量须为 1–999999 的整数'));
   await run(()=>{
     if(!m.id)return [{type:'itemSet.create',args:data}];
     const current=(state.p.itemSets||[]).find(set=>set.id===m.id);
     if(JSON.stringify(current)!==JSON.stringify(m.original))throw Error(t('该物品组合已在别处更改，草稿仍保留。'));
     return [{type:'itemSet.update',args:{id:m.id,patch:data}}];
   },t('物品组合已保存'));
   closeModal();
   break;
 }
 case 'outline-section-add':{
   const host=$('#outline-sections');
   host.insertAdjacentHTML('beforeend',outlineSectionEditor({title:'',text:''}));
   syncOutlineSectionControls();
   const editor=host.lastElementChild.querySelector('[data-outline-editor]');
   m.outlineEditor=editor;
   m.outlineCaret=null;
   editor.focus();
   break;
 }
 case 'outline-section-up':case 'outline-section-down':case 'outline-section-remove':{
   const control=e.target.closest('button');
   const section=control.closest('.outline-section-editor');
   if(action==='outline-section-up')section.previousElementSibling?.before(section);
   if(action==='outline-section-down')section.nextElementSibling?.after(section);
   if(action==='outline-section-remove')section.remove();
   syncOutlineSectionControls();
   if(section.isConnected)section.querySelector('[data-outline-section-title]').focus();
   break;
 }
 case 'outline-save':{
   const scope=readStoryScope('outline-scope');
   const sections=$$('.outline-section-editor').map(section=>({
     title:section.querySelector('[data-outline-section-title]').value.trim(),
     text:outlineEditorText(section.querySelector('[data-outline-editor]'))
   })).filter(section=>section.title||section.text);
   const fields={...scope,title:$('#outline-title').value.trim(),sections};
   if(!fields.title)throw Error(t('请输入大纲标题'));
   const result=await cmd(m.id?'outline.update':'outline.create',m.id?{id:m.id,patch:fields}:fields,t('大纲已保存'));
   closeModal();
   const entry=result.results[0];
   if(!ST.storyScope(state.p,state.treeScope).outline(entry))state.treeScope={};
   if(!m.id){
     state.treeMode='outline';
     state.treeQuery='';
     await saveDisplaySettings();
   }
   render();
   $$('[data-outline-card]').find(el=>el.dataset.outlineCard===entry.id)?.scrollIntoView({block:'nearest'});
   break;
 }
 case 'attribute-insert':{
   const subitem=$('#attribute-key');
   if(subitem&&!subitem.value)break;
   const keys=subitem?JSON.parse(subitem.value):[];
   const editor=$$('textarea[data-node-path]').find(el=>editorNodeId(el)===m.id&&el.dataset.nodePath===m.path);
   if(!editor||editor.readOnly)throw Error(t('原编辑位置已变动，请重新选择。'));
   const token=ST.characterToken(m.characterId,m.field,...keys);
   closeModal();
   await insertCharacterReference(m.id,m.path,token,m.characterId,editor,m.start,m.end);
   break;
 }
 case 'check-update':{
   const control=e.target.closest('button'),status=$('#update-status');
   if(!status||control.disabled)break;
   control.disabled=true;
   status.textContent=t('正在检查更新…');
   try{
     const version=await desktop.checkUpdate();
     if(state.modal!==m)break;
     status.innerHTML=version
       ?html`<p>发现新版本 ${esc(version)}。可以打开发布页下载。</p>${button('open-update',t('打开下载页'),'small primary')}`
       :`<p>${t('当前已是最新版本。')}</p>`;
   }catch{
     status.textContent=t('暂时无法检查更新。请检查网络连接后重试。');
   }finally{
     control.disabled=false;
   }
   break;
 }
 case 'open-update':await desktop.openUpdate();break;
 case 'location-save':{
   const name=$('#location-name').value.trim(),notes=$('#location-notes').value;
   const parentId=$('#location-parent').value,color=$('#location-color').value;
   await cmd(m.id?'location.update':'location.create',{id:m.id,name,notes,parentId,color});
   closeModal();
   break;
 }
 case 'location-new-child':openLocation(undefined,m.id);break;
 case 'location-map':{const scope=m.id;closeModal();await openSceneMap(currentScene().id,scope);break;}
 case 'location-assign-save':{
   await cmd('location.assign',{nodeIds:m.ids,locationId:$('#location-assignment').value},t('地点已指定'));
   closeModal();
   break;
 }
 case 'node-log-export':{
   if(m.kind!=='node-log')return;
   const saved=window.desktop?.exportNodeLog
     ?await desktop.exportNodeLog(m.title,m.text)
     :(download('StoryTree-node.txt',m.text,'text/plain; charset=utf-8'),true);
   if(saved)toast(t('节点日志已导出'));
   break;
 }
 case 'dialogue-rule-add':{
   const select=$('#dialogue-rule-add');
   if(select&&!m.draft.participants.includes(select.value))m.draft.participants.push(select.value);
   renderDialogueRule();
   break;
 }
 case 'dialogue-rule-save':{
   await run(()=>{
     const node=nodeById(m.id);
     if(!ST.hasDialogue(node)||(m.index!==undefined&&!sameValue(node.lines[m.index],m.original))){
       throw Error('对话框已变动，请重新选择');
     }
     return [{type:'node.dialogueRule',args:{id:m.id,index:m.index,rule:m.draft}}];
   });
   if(state.rolePicker?.nodeId===m.id)state.rolePicker=null;
   closeModal();
   render();
   break;
 }
 case 'reset-display':{
   const {fontFamily,uiFont,nodeFont,overviewAt}=ST.displaySettings();
   Object.assign(state,{fontFamily,uiFont,nodeFont,overviewAt});
   applyDisplayStyles();
   render();
   openSettings();
   await saveDisplaySettings();
   break;
 }
 case 'modal-close':closeModal();break;
 case 'new-project':openImport(ST.emptyProject(t('新的故事')));break;
 case 'simple-save':{const value=$('#simple-value').value.trim();if(!value)throw Error(t('请输入名称'));if(m.kind==='new-scene'){const r=await cmd('scene.create',{name:value});state.selected.clear();state.view=ST.clone(currentScene().view);render();}if(m.kind==='new-group')await cmd('group.create',{name:value,kind:m.groupKind});if(m.kind==='rename-project')await cmd('project.rename',{title:value});if(m.kind==='custom-event')await cmd('node.update',{id:selectedNode().id,patch:{eventType:value}});closeModal();break;}
 case 'character-save':await saveCharacter();break;
 case 'character-import-toggle':case 'character-import-scan':case 'character-import-apply':updateCharacterImport(m,action);break;
 case 'remove-character-image':captureCharacter();m.imageRead=null;m.draft.image='';renderCharacterModal();break;
 case 'close-item-editor':captureCharacter();m.itemEditor=null;renderCharacterModal();break;
 case 'skills-zero':captureCharacter();for(const k of Object.keys(m.draft.skills))m.draft.skills[k]=0;renderCharacterModal();break;
 case 'add-skill':case 'add-attribute':{captureCharacter();const field=action==='add-skill'?'skills':'attributes',key=$('#new-'+(action==='add-skill'?'skill':'attribute')+'-name').value.trim();if(!key)throw Error(t('请输入名称'));if(['__proto__','prototype','constructor'].includes(key))throw Error(t('名称无效'));m.draft[field][key]=action==='add-skill'?0:20;renderCharacterModal();break;}
 case 'inventory-add':captureCharacter();{const id=$('#inventory-add-item').value;if(!id)throw Error(t('请先创建物品卡'));m.draft.inventory[id]=(m.draft.inventory[id]||0)+1;renderCharacterModal();}break;
 case 'inventory-add-set':addCharacterItemSet($('#inventory-add-set').value);break;
 case 'open-current':openCharacter(m.id,'current');break;
 case 'item-add-attr':{captureItem();const key=$('#new-item-attr').value.trim();if(!key)throw Error(t('请输入属性名称'));if(['__proto__','prototype','constructor'].includes(key))throw Error(t('名称无效'));m.draft.attributes[key]=20;renderItemModal();break;}
 case 'item-save':{captureItem();const i=ST.item(m.draft);if(m.id)await cmd('item.update',{id:m.id,patch:i});else await cmd('item.create',i);closeModal();toast(t('物品卡已保存'));break;}
 case 'operation-save':{
   captureOperation();
   const {nameSource,namePrompt,defaultName,fixedName,...draft}=m.draft;
   const rename=draft.kind==='characterField';
   if(rename&&!draft.characterId)throw Error(t('请先创建一张角色卡。'));
   const operation=rename?{
     kind:'characterField',key:'displayName',mode:'set',characterId:draft.characterId,direct:true,
     value:(nameSource==='player'?defaultName:fixedName).trim()
   }:draft;
   if(rename&&nameSource==='player')operation.input={id:ST.uid('input'),prompt:namePrompt.trim()};
   await run(()=>{
     const n=nodeById(m.nodeId);
     if(!n)throw Error(t('找不到节点'));
     const characters={...nodeCharacters(n.id)};
     if(rename&&!characters[operation.characterId])characters[operation.characterId]=ST.find(state.p,'characters',operation.characterId);
     const ops=n.type==='label'?ST.labelOperations(state.p,{...n,operations:[operation]},characters):[operation];
     ST.applyOperations(state.p,n.sceneId,characters,ops);
     return [{type:'node.update',args:{id:n.id,patch:{operations:[...n.operations,operation]}}}];
   },t('待变化已添加'));
   closeModal();
   break;
 }
 case 'event-board-save':{const n=nodeById(m.nodeId);await cmd('node.update',{id:n.id,patch:{operations:[...n.operations,...m.operations]}});closeModal();toast(t('物品转移已记录为待变化'));break;}
 case 'rule-add':captureRules();m.draft.rules.push({characterId:state.p.characters[0]?.id||'',kind:'attribute',key:state.p.definitions.attributes[0]||'生命',op:'gte',value:20});renderRules();break;
 case 'rules-save':captureRules();m.draft.mode='rules';if(!m.draft.rules.length)throw Error(t('至少添加一条规则'));ST.conditionValue({condition:m.draft},ST.sceneOf(state.p,nodeById(m.nodeId).sceneId).characters);await cmd('node.update',{id:m.nodeId,patch:{condition:m.draft}});closeModal();break;
 case 'scene-save':await cmd('scene.update',{id:m.id,name:$('#scene-name').value.trim(),summary:$('#scene-summary').value});closeModal();break;
 case 'item-group-save':{
   const tags=splitTags($('#group-tags').value),name=$('#item-group-name').value.trim();
   await run(()=>{
     const changes=[{type:'group.rename',args:{id:m.id,name}}];
     if(tags.length){
       for(const item of state.p.items.filter(item=>item.groupId===m.id)){
         changes.push({type:'item.update',args:{id:item.id,patch:{tags:[...new Set([...item.tags,...tags])]}}});
       }
     }
     return changes;
   },t('批量操作已保存'));
   closeModal();
   break;
 }
 case 'excel-save':{
   if(!m.preview)return;
   const save=e.target.closest('button');
   save.disabled=true;
   try {
     const response=await cmd('library.import',m.preview);
     const {characters,items}=response.results[0];
     state.search='';
     state.tab=characters && (m.cardKind==='character'||!items)?'characters':'items';
     closeModal();
     render();
     toast(state.language==='en'?`Imported ${characters} character cards and ${items} item cards.`:`已导入 ${characters} 张角色卡和 ${items} 张物品卡`);
   }finally{save.disabled=false;}
   break;
 }
 case 'script-save':{
   if(!m.preview || m.saving)return;
   const preview=m.preview;
   const save=e.target.closest('button');
   const options={createCharacters:$('#script-create-characters').checked,connectScenes:$('#script-connect-scenes').checked,
     continueLabel:t('继续'),jumpLabel:t('前往')};
   m.saving=true;
   save.disabled=true;
   let imported;
   try{
     await run(()=>{
       imported=StoryScript.plan(state.p,preview,options);
       return [{type:'scene.update',args:{id:state.p.currentSceneId,view:state.view}},...imported.commands];
     });
     state.link=null;
     state.rolePicker=null;
     state.selected=new Set([imported.firstNodeId]);
     state.inspectorTab='node';
     state.view=ST.clone(currentScene().view);
     closeModal();
     render();
     if(currentScene().id===imported.sceneId && state.p.nodes.filter(node=>node.sceneId===imported.sceneId).length<=6)fitGraph();
     toast(state.language==='en'
       ?`Imported ${preview.scenes.length} scenes and ${imported.nodes} nodes.`
       :`已导入 ${preview.scenes.length} 个场景、${imported.nodes} 个节点。`);
   }finally{m.saving=false;save.disabled=false;}
   break;
 }
 case 'art-add-save':{
   const files=[...$('#art-files').files],category=$('#art-category').value;
   if(!files.length)throw Error(t('请选择图片'));
   if(files.some(file=>file.size>ST.ART_FILE_LIMIT))throw Error(t('每张概念图最大为 4 MB'));
   if(files.reduce((total,file)=>total+file.size,0)>ST.ART_PROJECT_LIMIT)throw Error(t('项目中的概念图合计不能超过 12 MB'));
   const save=e.target.closest('button');
   save.disabled=true;
   try {
     const changes=[];
     for(const file of files){
       const image=await readArtImage(file);
       changes.push({type:'art.create',args:{image,category,name:file.name.replace(/\.[^.]+$/u,'')||file.name}});
     }
     if(state.modal!==m)return;
     await run(changes,t('概念图已添加'));
     closeModal();
   }finally{save.disabled=false;}
   break;
 }
 case 'art-zoom':{
   const full=$('.art-preview').classList.toggle('original');
   e.target.closest('button').textContent=t(full?'适应窗口':'原始大小');
   break;
 }
 case 'art-save':await cmd('art.update',{id:m.id,name:$('#art-name').value.trim(),category:$('#art-category').value,notes:$('#art-notes').value});closeModal();break;
 case 'transfer-save':{let id=$('#transfer-scene').value;if(id==='new'){const r=await cmd('scene.create',{name:$('#transfer-scene-name').value||t('新场景')});id=r.results[0].id;}const r=await cmd('node.transfer',{ids:m.ids,sceneId:id,copy:m.copy});state.selected=new Set(r.results[0].ids);state.view={x:50,y:60,zoom:.8};closeModal();render();fitGraph();break;}
 case 'group-save':{
   const name=$('#character-group-name').value.trim(),tags=splitTags($('#group-tags').value);
   const field=$('#group-field').value,value=Number($('#group-value').value);
   const itemId=$('#group-item').value,quantity=Number($('#group-item-qty').value),sceneId=$('#group-scene').value;
   const scoreField=field.startsWith('skill:')?'skills':'attributes',scoreKey=field.slice(field.indexOf(':')+1);
   const hasCardChanges=tags.length||field!=='none'||itemId;
   await run(()=>{
     const members=state.p.characters.filter(card=>card.groupId===m.id);
     if((hasCardChanges||sceneId)&&!members.length)throw Error(t('这个分组还没有角色'));
     if(itemId&&(!Number.isInteger(quantity)||quantity<1))throw Error(t('物品数量须为 1–999999 的整数'));
     const commands=[{type:'group.rename',args:{id:m.id,name}}];
     if(hasCardChanges)for(const card of members){
       const patch={tags:[...new Set([...card.tags,...tags])]};
       if(field!=='none')patch[scoreField]={...card[scoreField],[scoreKey]:value};
       if(itemId)patch.inventory={...card.inventory,[itemId]:(card.inventory[itemId]||0)+quantity};
       commands.push({type:'character.update',args:{id:card.id,patch}});
     }
     if(sceneId)commands.push({type:'scene.addCharacters',args:{sceneId,characterIds:members.map(card=>card.id)}});
     return commands;
   },t('分组已保存'));
   closeModal();
   break;
 }
 case 'definitions-save':{const parse=id=>$('#'+id).value.split('\n').map(s=>s.trim()).filter(Boolean);await cmd('definitions.update',{skills:parse('definitions-skills'),attributes:parse('definitions-attributes')});closeModal();break;}
 case 'simulate-again':state.traceChoices={};state.traceInputs={};openSimulation($('#simulate-start').value);break;
 case 'simulate-name':
 case 'simulate-name-default':{
   const request=m.kind==='simulation'&&m.result.pendingInput;
   if(!request)break;
   state.traceInputs[request.id]=action==='simulate-name-default'?'':$('#trace-player-name').value;
   openSimulation();
   break;
 }
 case 'mcp-copy':await navigator.clipboard.writeText(JSON.stringify(m.config.json,null,2));toast(t('MCP 配置已复制'));break;
 case 'mcp-download':download('storytree-mcp.json',JSON.stringify(m.config.json,null,2));break;
 case 'open-data':if(window.desktop)await desktop.openData();else toast(state.lastDirectory);break;
 case 'import-save':{if(!await flushDrafts())break;const r=await api('import',{project:m.project,revision:state.p.revision});state.p=r.project;state.selected.clear();state.view=ST.clone(currentScene().view);closeModal();render();fitGraph();toast(t('故事已打开'));break;}
 }}
const english = {
  "插件": "Plugins",
  "安装或更新插件": "Install or update plugin",
  "安装示例插件": "Install example plugin",
  "正在读取插件…": "Loading plugins…",
  "还没有安装插件。": "No plugins installed.",
  "读取当前项目": "Read the current project",
  "提议修改项目": "Propose project changes",
  "无需项目权限": "No project access",
  "已启用": "Enabled",
  "已停用": "Disabled",
  "启用": "Enable",
  "停用": "Disable",
  "卸载": "Uninstall",
  "先选择一个节点": "Select a node first",
  "所选节点": "Selected node",
  "插件已更新。": "Plugin updated.",
  "插件已安装，请查看权限后启用。": "Plugin installed. Review its permissions before enabling it.",
  "返回插件列表": "Back to plugins",
  "运行插件": "Run plugin",
  "正在运行插件…": "Running plugin…",
  "应用修改": "Apply changes",
  "待确认的项目修改 ·": "Proposed project changes ·",
  "修改已保存，可用撤销恢复。": "Changes saved. You can undo them.",
  "插件修改已保存": "Plugin changes saved",
  "插件运行超时。": "Plugin timed out.",
  "已取消运行插件。": "Plugin run canceled.",
  "插件结果过大或无效。": "Plugin result is too large or invalid.",
  "此插件尚未启用。": "This plugin is disabled.",
  "此插件没有提议修改项目的权限。": "This plugin lacks permission to propose project changes.",
  "项目已变化，请重新运行插件生成预览。": "The project changed. Rerun the plugin to generate a preview.",
  "已安装相同或更高版本的插件。": "The same or a newer version is already installed.",
  "插件已更新，请重新打开操作。": "The plugin was updated. Reopen the action.",
  "插件 API 版本不兼容。": "Incompatible plugin API version.",
  "插件文件须为有效的 UTF-8 JSON。": "The plugin file must be valid UTF-8 JSON.",
  "插件文件过大或格式无效。": "The plugin file is too large or invalid.",
  "插件命令含有无效字段。": "Plugin commands contain an invalid field.",
  "插件提议了不受支持的项目命令。": "The plugin proposed an unsupported project command.",
  "双击地点查看子地点 · 拖动卡片可布置地点": "Double-click a location to open its children. Drag cards to place them.",
  "双击查看子地点": "Double-click to open child locations",
  "查看子地点": "Open child locations",
  "所有地点": "Top-level locations",
  "搜索全部地点": "Search all locations",
  "这里还没有子地点。": "There are no child locations here yet.",
  "地点卡片": "Location cards",
  "已布置": "Placed",
  "未布置": "Unplaced",
  "布置地点": "Place location",
  "当前地点已作为地图范围。": "This location is already the scope of the map.",
  "项目已切换，请重新编辑地图。": "The project changed. Reopen the map to edit it.",
  "场景地图": "Scene map",
  "返回剧情画布": "Back to story canvas",
  "地图指引": "Map guide",
  "显示或隐藏地图指引": "Show or hide map guide",
  "查看地点地图": "Open location map",
  "地图范围": "Map scope",
  "全场景": "Entire scene",
  "底图": "Background",
  "无底图": "No background",
  "地图画布": "Map canvas",
  "地图图层": "Map layers",
  "地点和路线": "Locations and routes",
  "物体": "Objects",
  "隐藏": "Hide",
  "锁定": "Lock",
  "拖动空白处框选 · Shift 追加": "Drag on empty space to select · Shift to add",
  "已选 {count} 个地图单位": "{count} map elements selected",
  "复制物体": "Copy objects",
  "创建物体副本": "Duplicate objects",
  "取消选择": "Clear selection",
  "查找替换": "Find and replace",
  "查找": "Find",
  "跨节点替换": "Replace across nodes",
  "预览替换": "Preview replacements",
  "替换选中项": "Replace selected",
  "输入已修改，请重新预览。": "The input changed. Refresh the preview.",
  "请输入查找文字": "Enter text to find",
  "第 {index} 句对白": "Dialogue line {index}",
  "找到 {count} 个可替换字段": "{count} fields with replacements",
  "没有需要替换的内容。": "No text to replace.",
  "项目在预览后已修改，请重新预览。": "The project changed. Refresh the preview before applying replacements.",
  "查找替换 · Ctrl+H": "Find and replace · Ctrl+H",
  "查找文字": "Find text",
  "上一个匹配": "Previous match",
  "下一个匹配": "Next match",
  "替换为": "Replace with",
  "替换": "Replace",
  "全部替换": "Replace all",
  "区分大小写": "Match case",
  "请选择一个文字编辑框": "Select a text editor",
  "在当前编辑框内查找": "Search in the current field",
  "没有匹配文字": "No matches",
  "找到 {count} 处": "{count} matches",
  "第 {index} 处，共 {count} 处": "{index} of {count} matches",
  "已替换 {count} 处": "Replaced {count} matches",
  "自定义物体": "Custom object",
  "图片物体": "Image object",
  "图库图片": "Gallery image",
  "选择已有图片": "Choose an existing image",
  "或上传本地图片": "Or upload a local image",
  "放入地图": "Place on map",
  "粘贴物体": "Paste object",
  "创建副本": "Duplicate",
  "复制 · Ctrl+C": "Copy · Ctrl+C",
  "创建副本 · Ctrl+D": "Duplicate · Ctrl+D",
  "删除 · Delete": "Delete · Delete",
  "删除": "Delete",
  "已复制地图物体": "Map object copied",
  "找不到地图物体的图片": "Map object image not found",
  "编辑对白日志": "Edit dialogue log",
  "放大编辑对白": "Expand dialogue editor",
  "放大": "Expand",
  "对白": "Dialogue",
  "事件正文": "Event text",
  "每句以角色 ID 和冒号开头。冒号前留空表示旁白，Shift+Enter 在同一句内换行。": "Start each entry with the character ID and a colon. Leave the ID blank for narration. Use Shift+Enter to start a new line within the same entry.",
  "节点内容已更新": "Node content updated",
  "节点内容已在别处修改，请保留草稿后重新打开。": "This node was edited elsewhere. Keep a copy of your draft and reopen the editor.",
  "日志第 {line} 行": "Log line {line}",
  "对白行需要以角色和冒号开头": "Start the entry with a character ID and a colon",
  "对白角色不存在或名称重复": "The speaker ID is unknown or ambiguous",
  "拖入地点卡或角色卡，也可从右侧添加。": "Drop a location or character card, or add one from the sidebar.",
  "选择地图角色": "Choose a character for the map",
  "选择角色": "Select a character",
  "放置角色": "Place character",
  "打开角色卡": "Open character card",
  "矩形": "Rectangle",
  "椭圆": "Ellipse",
  "三角形": "Triangle",
  "选择地图元素": "Select a map element",
  "物体名称": "Object name",
  "物体颜色": "Object color",
  "拖动调整大小": "Drag to resize",
  "每张地图最多包含 256 个角色和物体": "Each map supports up to 256 characters and objects",
  "角色和物体必须放在地图内": "Characters and objects must fit inside the map",
  "地图元素 ID 重复": "Duplicate map element ID",
  "找不到地图上的角色": "Mapped character not found",
  "角色在同一地图上只能布置一次": "A character can only be placed once per map",
  "地图物体资料无效": "Invalid map object",
  "↑ 上一级": "↑ Parent map",
  "布置全部": "Place all",
  "拖入地点卡，或从列表添加地点。": "Drop a location card or add a location from the list.",
  "选中一个已布置的地点，可查看路线和剧情节点。": "Select a location to see its routes and story nodes.",
  "查看子地图": "Open submap",
  "连接路线": "Connect route",
  "取消连线": "Cancel route",
  "在此新建节点": "Create node here",
  "拖动调整地点范围": "Drag to resize the location area",
  "从地图移除": "Remove from map",
  "请选择地图上的另一个地点。": "Select another location on the map.",
  "路线": "Routes",
  "路线名称": "Route name",
  "路线名称（可选）": "Route name (optional)",
  "移除路线": "Remove route",
  "此地点的剧情节点": "Story nodes at this location",
  "此场景还没有分配到这里的节点。": "No nodes in this scene are assigned here.",
  "地点已布置": "Location placed",
  "路线已连接": "Route connected",
  "地点已从地图移除": "Location removed from the map",
  "地图空位不足，请先缩小或移动已布置的范围。": "There is no free space. Resize or move a placed area first.",
  "场景地图资料无效": "Invalid scene map data",
  "找不到地图所属地点": "Map scope location not found",
  "同一地点已有一张场景地图": "A map already exists for this location in the scene",
  "找不到地图底图": "Map background not found",
  "每张地图最多包含 256 个地点和 512 条路线": "Each map supports up to 256 locations and 512 routes",
  "找不到地图上的地点": "Mapped location not found",
  "地点在同一地图上只能布置一次": "A location can only be placed once per map",
  "地点范围必须在地图内": "The location area must fit inside the map",
  "路线需要连接两个已布置的地点": "A route must connect two placed locations",
  "路线名称最多 80 个字符": "Route names can contain up to 80 characters",
  "两个地点之间已有路线": "These locations already have a route",
  "搜索节点和大纲": "Search nodes and outlines",
  "搜索节点和大纲…": "Search nodes and outlines…",
  "已应用日期和地点筛选": "Date and location filters applied",
  "没有匹配的节点或大纲。": "No matching nodes or outlines.",
  "物品组合": "Item sets",
  "新建物品组合": "New item set",
  "编辑物品组合": "Edit item set",
  "组合名称": "Set name",
  "空组合": "Empty set",
  "点击编辑，或拖入物品及其他组合": "Click to edit, or drop items or other sets here",
  "保存可重复添加到角色的定量物品组合。": "Save groups of items with quantities that you can add to characters.",
  "同一物品可用于多个组合。拖入物品或子组合后，在这里设定各自的数量。": "An item can belong to multiple sets. Drop items or nested sets here and set their quantities.",
  "将物品或子组合拖到这里": "Drop items or nested sets here",
  "选择要加入的物品或组合": "Choose an item or set to add",
  "移除成员": "Remove entry",
  "添加组合": "Add set",
  "保存组合": "Save set",
  "移除组合": "Remove set",
  "已加入物品组合": "Added to item set",
  "物品组合已保存": "Item set saved",
  "物品组合已移除": "Item set removed",
  "找不到同名物品组合": "No item set with this name",
  "按预设数量追加": "Adds the preset quantities",
  "从描述匹配的组合，请核对后勾选": "Suggested from the description. Check to add the listed quantities.",
  "该物品组合已在别处更改，草稿仍保留。": "The item set changed elsewhere. Your draft is still open.",
  "请输入组合名称": "Enter an item set name",
  "物品组合资料无效": "Invalid item set data",
  "物品组合需要名称与成员列表": "An item set needs a name and a list of entries",
  "物品组合名称或 ID 重复": "Duplicate item set name or ID",
  "物品组合成员类型无效": "Invalid item set entry type",
  "物品数量须为 1–999999 的整数": "Quantity must be a whole number from 1 to 999999",
  "物品组合成员重复": "Duplicate item set entry",
  "找不到子物品组合": "Nested item set not found",
  "找不到物品组合": "Item set not found",
  "物品组合展开后超过数量上限": "The expanded item set exceeds the quantity limit",
  "物品组合不能循环引用": "Item sets cannot contain circular references",
  "物品组合加入后超过角色的物品数量上限": "Adding this item set would exceed the character inventory limit",
  "此物品组合正在被其他组合使用": "This item set is used by another set",
  "段落标题": "Section title",
  "段落标题（可选）": "Section title (optional)",
  "段落正文": "Section body",
  "上移段落": "Move section up",
  "下移段落": "Move section down",
  "移除段落": "Remove section",
  "＋ 添加段落": "+ Add section",
  "拖入或点击右侧素材可在段落内插入链接，保存后点击链接跳转。": "Drag or click an asset to insert a link in a section. Save to follow the links.",
  "大纲分段资料无效": "Invalid outline sections",
  "从长文生成角色卡": "Character card from text",
  "从长文填卡": "Fill from text",
  "收起": "Collapse",
  "粘贴人物设定或背景故事": "Paste a character profile or backstory",
  "她叫林夏，是一名地图绘师。&#10;技能：观察 6；属性：生命 75；标签：港城、向导": "Her name is Lin Xia. She is a mapmaker.&#10;Skills: Surveying 6; Stats: Vitality 75; Tags: harbor, guide",
  "本机离线识别。自然段可以作为简介或详情。写明姓名、技能、属性、标签或物品可提高识别准确率。": "Extracted offline. Prose can fill the summary and details. Labels such as Name, Skills, Stats, Tags, or Inventory improve extraction.",
  "识别并预览": "Extract and preview",
  "已有角色的 ID 保持原值": "Existing character ID is kept",
  "分组未找到或存在同名": "Group missing or ambiguous",
  "技能需填写 0–10 的整数": "Skills require whole numbers from 0 to 10",
  "属性需填写 0–100 的整数": "Attributes require whole numbers from 0 to 100",
  "物品需匹配唯一的现有物品卡，数量须为非负整数": "Inventory needs an unambiguous existing item and a nonnegative whole quantity",
  "勾选要填入卡片草稿的内容。替换现有值的建议默认不勾选。": "Select what to add to the draft. Suggestions that replace existing values are unchecked by default.",
  "未找到可填入的字段，或识别值与当前卡片相同。": "No fields to add, or the extracted values match the current card.",
  "当前值": "Current value",
  "填入已选字段": "Fill selected fields",
  "请先粘贴人物设定。": "Paste a character profile first.",
  "请至少勾选一个字段。": "Select at least one field.",
  "卡片内容已更改，请重新核对提取结果。": "The card has changed. Review the updated suggestions.",
  "已填入角色卡草稿": "Character draft updated",
  "角色设定最多 60,000 个字符。": "Character text is limited to 60,000 characters.",
  "链接目标已移除": "Link target removed",
  "可插入的链接": "Available links",
  "写下大纲，或拖入链接…": "Write your outline or drop a link…",
  "拖入或点击右侧素材可插入链接，保存后点击链接跳转。": "Drag or click an asset to insert a link. Click links in the saved outline to open them.",
  "请搜索以缩小素材范围。": "Search to narrow the asset list.",
  "拖入大纲": "Drag into outline",
  "已插入大纲链接": "Outline link added",
  "按地点": "By location",
  "剧情概要": "Story overview",
  "大纲": "Outline",
  "＋ 新建大纲": "＋ New outline",
  "展开": "Expand",
  "返回画布": "Return to canvas",
  "开始日期": "Start date",
  "结束日期": "End date",
  "地点范围": "Location scope",
  "自": "From",
  "起": "",
  "截至": "Until",
  "日期与地点筛选": "Date and location filters",
  "已应用": "Applied",
  "全部地点": "All locations",
  "清除筛选": "Clear filters",
  "应用筛选": "Apply filters",
  "范围外": "Outside scope",
  "在画布定位": "Locate on canvas",
  "此节点还没有填写剧情内容。": "This node has no story text yet.",
  "先在画布新建节点，就可以沿连线阅读剧情。": "Create nodes on the canvas to read the connected story here.",
  "从这个节点开始读": "Start reading at this node",
  "选择接下来的分支": "Choose the next branch",
  "选一条分支继续读。": "Choose a branch to continue.",
  "连线回到了已读节点。": "A connection loops back to a node already shown.",
  "已到达本次概要的节点上限。": "This overview has reached its node limit.",
  "这条路线到此结束。": "End of this route.",
  "编辑": "Edit",
  "不限地点": "Any location",
  "个范围内节点": "nodes in scope",
  "范围内还没有节点，可以先写下计划。": "There are no nodes in scope yet. You can still write the plan.",
  "还没有符合筛选条件的大纲。可以从一条计划开始写。": "No outlines match the filters. Start with a new plan.",
  "范围内没有节点或大纲。": "There are no nodes or outlines in scope.",
  "范围内没有节点。": "There are no nodes in scope.",
  "范围内无直接连线的节点": "Nodes without direct connections in this scope",
  "编辑故事大纲": "Edit story outline",
  "新建故事大纲": "New story outline",
  "大纲标题": "Outline title",
  "大纲正文": "Outline text",
  "选定地点后会纳入它的所有子地点。只填一端日期时，范围会向另一端开放。": "A location includes its sublocations. Leave one date blank for an open-ended range.",
  "移除大纲": "Remove outline",
  "保存大纲": "Save outline",
  "大纲已保存": "Outline saved",
  "请输入大纲标题": "Enter an outline title.",
  "大纲资料无效": "Invalid outline data.",
  "结束日期不能早于开始日期": "The end date must be on or after the start date.",
  "编辑文本": "Edit text",
  "暂无可用值": "No value available",
  "当前版本": "Version",
  "检查更新": "Check for updates",
  "正在检查更新…": "Checking for updates…",
  "发现新版本": "New version available",
  "。可以打开发布页下载。": ". Open the release page to download it.",
  "打开下载页": "Open download page",
  "当前已是最新版本。": "You have the latest version.",
  "暂时无法检查更新。请检查网络连接后重试。": "Could not check for updates. Check your internet connection and try again.",
  "角色变量": "Character variables",
  "插入角色变量": "Insert character variable",
  "角色卡栏目": "Character card field",
  "子项": "Subitem",
  "没有可选子项": "No subitems available",
  "引用读取节点当时的角色状态。项目和节点日志保留原始变量。": "References use the character state at this node. Projects and node logs retain the original variables.",
  "可拖入节点的角色变量": "Drag character variables into nodes",
  "把任意变量拖到正文光标处，或拖到画布上的节点。": "Drag a variable into a text field or onto a canvas node.",
  "全部标签": "All tags",
  "携带物品名称": "Carried item name",
  "携带数量": "Carried quantity",
  "携带物品属性": "Carried item attribute",
  "上级地点": "Parent location",
  "无上级地点": "No parent",
  "新建子地点": "New sublocation",
  "范围颜色": "Area color",
  "地点颜色无效": "Invalid location color.",
  "上级地点无效": "Invalid parent location.",
  "找不到上级地点": "Parent location not found.",
  "地点不能成为自己的上级": "A location cannot be its own ancestor.",
  "应用": "Apply",
  "地点": "Location",
  "地点名称": "Location name",
  "编辑地点": "Edit location",
  "删除地点": "Delete location",
  "新建地点": "New location",
  "未指定地点": "No location",
  "指定地点": "Assign location",
  "地点已指定": "Location assigned",
  "请输入地点名称": "Enter a location name.",
  "找不到地点": "Location not found.",
  "点击右上角 ＋ 创建地点。": "Click ＋ to create a location.",
  "可把地点卡拖到画布节点上；框选多个节点后，也可以一次指定地点。": "Drag this location onto a node, or select multiple nodes to assign it to all of them.",
  "此设置会应用到": "This will apply to",
  "个节点。": "nodes.",
  "角色属性": "Character attribute",
  "角色属性引用": "Character attribute references",
  "插入属性引用": "Insert attribute reference",
  "预览值": "Preview value",
  "插入": "Insert",
  "同一个属性可以在多个节点引用。画布预览按当前节点的状态显示，项目和节点日志保留原始引用。": "Reuse an attribute across nodes. The canvas previews its value at the node. Project exports and node logs keep the original reference.",
  "所选角色没有可引用的属性。": "This character has no attributes to reference.",
  "原编辑位置已变动，请重新选择。": "The editing position changed. Select it again.",
  "名称来源": "Name source",
  "固定名称": "Fixed name",
  "由玩家输入": "Player input",
  "显示给玩家的提示": "Prompt shown to the player",
  "请输入你的角色名称": "Enter your character name",
  "默认角色名称": "Default character name",
  "新的角色名称": "New character name",
  "名称留空时沿用角色ID。": "Leave blank to use the character ID.",
  "在「剧情推演」中可试填。节点日志和项目导出会记录提示、默认名称和输入 ID。": "Try it in Story simulation. The node log and project export record the prompt, default name, and input ID.",
  "到达「": "Applies on reaching “",
  "」时应用这项变化。": "”.",
  "请先创建一张角色卡。": "Create a character card first.",
  "输入提示": "Prompt",
  "默认名称": "Default name",
  "输入 ID": "Input ID",
  "玩家命名": "Player naming",
  "确认名称": "Confirm name",
  "使用默认名称": "Use default name",
  "玩家命名需要一个角色和输入提示": "Player naming requires a character and a prompt.",
  "玩家命名需要指定单个角色": "Player naming requires a single character.",
  "角色名称必须是单行文本": "Character names must be on one line.",
  "玩家输入 ID 重复": "Duplicate player input ID.",
  "角色ID": "Character ID",
  "角色ID不能修改": "The character ID cannot be changed.",
  "角色名称必须是文本": "The character name must be text.",
  "角色资料字段无效": "Invalid character profile field.",
  "留空时，游戏内名称沿用角色ID。": "Leave blank to use the character ID in game.",
  "移除形象": "Remove portrait",
  "更新": "updated",
  "已变更": "changed",
  "节点日志": "Node log",
  "导出节点日志": "Export node log",
  "节点日志已导出": "Node log exported",
  "项目已保存到本机": "Project saved locally",
  "仍有待保存的编辑，请重试": "Some edits are unsaved. Please retry.",
  "事件类型": "Event type",
  "跳转目标": "Jump destination",
  "编辑默认规则": "Edit default rule",
  "节点默认规则": "Default dialogue rule",
  "规则": "Rule",
  "参与角色与发言顺序": "Participants and speaking order",
  "上移": "Move up",
  "下移": "Move down",
  "移除角色": "Remove participant",
  "默认规则用于开始对话。已有对白的规则会保留。": "The default rule starts a dialogue. Existing lines keep their rules.",
  "这条规则用于本句和从本句新续写的对白，已有其他对白的规则会保留。": "This rule applies to this line and new lines continued from it. Other existing lines keep their rules.",
  "对话框已变动，请重新选择": "The dialogue line changed. Select it again.",
  "对话规则无效": "Invalid dialogue rule.",
  "轮谈按规则顺序切换说话人。点「完成并续写」或按 Enter 才会生成下一句。": "Round-robin follows the rule's speaking order. Click Finish and continue or press Enter to create the next line.",
  "对谈续写时沿用当前说话人。点「完成并续写」或按 Enter 才会生成下一句。": "Same-speaker mode keeps the current speaker. Click Finish and continue or press Enter to create the next line.",
  "对话模式": "Dialogue mode",
  "手动": "Manual",
  "轮谈": "Round-robin",
  "对谈": "Same speaker",
  "参与角色": "Participants",
  "添加参与角色": "Add participant",
  "添加参与角色…": "Add participant…",
  "可在下方添加角色，或把角色卡拖进节点。": "Add participants below or drop character cards into the node.",
  "完成并续写": "Finish and continue",
  "角色按加入顺序轮流发言。点「完成并续写」或按 Enter，切到下一位。Shift+Enter 在当前句内换行。": "Speakers take turns in the order they joined. Click Finish and continue or press Enter for the next speaker. Shift+Enter adds a line break.",
  "点「完成并续写」或按 Enter，下一句沿用当前角色。可随时切换说话人。Shift+Enter 在当前句内换行。": "Click Finish and continue or press Enter to keep the same speaker. You can change the speaker at any time. Shift+Enter adds a line break.",
  "对白日志": "Dialogue log",
  "恢复草稿": "Recovered drafts",
  "待保存内容": "Pending edits",
  "展开草稿后，可以复制文字到正确的位置。": "Expand a recovered draft and copy the text to the correct place.",
  "草稿原位置已变动，可在项目检查器查看恢复草稿。": "The original edit location changed. The draft is available in the project inspector.",
  "保存未完成 · 重试": "Save incomplete · Retry",
  "保存未完成，请在对话框中重试": "Save incomplete. Retry in the dialog.",
  "有待保存的编辑": "Unsaved edits",
  "本地数据服务暂时无法连接，请重试保存。": "The local data service is unavailable. Retry saving.",
  "原节点或编辑位置已变动，草稿已保留。": "The original node or field changed. Your draft was kept.",
  "该字段已在别处修改，草稿已保留。": "This field was edited elsewhere. Your draft was kept.",
  "导入剧本": "Import Script",
  "从 TXT 导入剧本": "Import Script from TXT",
  "根据场景标题、对白标记和段落拆分节点。先看预览，确认后会把新场景追加到当前项目。": "Split the script into nodes by scene headings, speaker cues, and paragraphs. Preview the result before adding the new scenes to this project.",
  "选择 .txt 文件": "Choose a .txt file",
  "试用示例": "Try Sample",
  "支持「场景：码头」、INT./EXT.、Markdown 标题和「角色：对白」。无法识别的段落保留为独白。": "Supports Scene: Wharf, INT./EXT., Markdown headings, and Speaker: Dialogue. Other paragraphs become monologue nodes.",
  "用「日期：1024.04.16」标注当前场景内的日期。缺少明确年月日的段落会保留为未定日期。": "Use Date: 1024.04.16 to date the following text in the same scene. Passages without a calendar date stay undated.",
  "为新说话者创建角色卡": "Create character cards for new speakers",
  "用跳转节点连接新场景": "Connect new scenes with jump nodes",
  "确认导入剧本": "Import Script",
  "场景预览": "Scene Preview",
  "这个场景只有标题。": "This scene only has a heading.",
  "未定日期": "Undated",
  "剧本来源": "Script source",
  "正在拆分剧本…": "Reading script…",
  "请选择 .txt 剧本文件": "Choose a .txt script file.",
  "TXT 文件最大为 1 MB": "The TXT file can be up to 1 MB.",
  "无法读取文本编码，请用 UTF-8 重新保存 TXT": "Could not read the text encoding. Save the TXT file as UTF-8 and try again.",
  "没有找到可以导入的剧本正文": "The script contains no text to turn into nodes.",
  "以下行的日期无效，原文已保留。": "These lines contain invalid dates. Their text has been kept.",
  "以下名字对应多张角色卡，导入时会保留原说话者名字。": "These names match multiple character cards. The imported dialogue will keep the original speaker names.",
  "每次最多导入 60 个场景": "Import up to 60 scenes at a time.",
  "每次最多导入 500 个节点（含跳转）": "Import up to 500 nodes at a time, including jumps.",
  "无法读取剧本示例": "Could not read the script sample.",
  "前往": "Go to",
  "双击修改场景名称": "Double-click to rename the scene",
  "修改场景名称": "Rename Scene",
  "物品分组": "Item Group",
  "组内物品": "Items in this group",
  "将物品卡拖到分组标题，或在物品卡中选择分组。": "Drop an item on the group heading or choose the group in its item card.",
  "可以拖动分组标题，把整组物品加入节点。": "Drag the group heading into a node to add all its items.",
  "保存分组": "Save Group",
  "新建物品分组": "New Item Group",
  "＋ 新建物品分组": "+ New Item Group",
  "找不到物品分组": "Item group not found.",
  "分组类型无效": "Invalid group type.",
  "导入 Excel": "Import Excel",
  "从 Excel 批量导入": "Import from Excel",
  "首行填写列名，名称必填。工作表命名为「角色」或「物品」，也可使用 Characters 或 Items。一份工作簿可同时导入两类卡片。": "Use the first row for column headers. Name is required. Call the sheets Characters or Items. The Chinese names 角色 and 物品 also work. One workbook can contain both kinds of cards.",
  "下载 Excel 模板": "Download Excel Template",
  "工作表未使用上述名称时，第一张表按物品导入。": "If neither sheet name matches, the first sheet is imported as items.",
  "工作表未使用上述名称时，第一张表按角色导入。": "If neither sheet name matches, the first sheet is imported as characters.",
  "导入会新增卡片，并按分组名称归类。": "Import adds new cards and assigns them by group name.",
  "选择 .xlsx 文件": "Choose an .xlsx file",
  "确认导入": "Import Cards",
  "正在读取工作簿…": "Reading workbook…",
  "工作簿里没有可导入的卡片。": "The workbook contains no cards to import.",
  "Excel 文件最大为 5 MB": "The Excel file can be up to 5 MB.",
  "无法读取 Excel 文件，请选择有效的 .xlsx 工作簿": "Choose a valid .xlsx workbook.",
  "每次最多导入 2,000 张卡片": "Import up to 2,000 cards at a time.",
  "名称不能为空": "Name is required.",
  "缺少名称列": "Missing Name column.",
  "重复的列标题": "Duplicate column header.",
  "数值超出范围": "Value out of range.",
  "分类、类型或品级无效": "Invalid category, type, or grade.",
  "概念图": "Concept Art",
  "地图": "Maps",
  "角色设定": "Character Designs",
  "场景设定图": "Environment Designs",
  "其他": "Other",
  "添加概念图": "Add Concept Art",
  "添加图片": "Add Images",
  "选择图片": "Choose Images",
  "请选择图片": "Choose images to add.",
  "分类": "Category",
  "备注": "Notes",
  "原始大小": "Actual Size",
  "适应窗口": "Fit to Window",
  "移除图片": "Remove Image",
  "图片已移除，可撤销": "Image removed. You can undo this.",
  "在这里保存地图、角色设定和场景参考图。": "Keep maps, character designs, and environment references here.",
  "支持 PNG、JPEG、WebP 和 GIF。单张最多 4 MB，每个项目合计最多 12 MB。图片随项目一起保存和导出。": "PNG, JPEG, WebP, and GIF. Up to 4 MB per image and 12 MB per project. Images are saved and exported with the project.",
  "仅支持 PNG、JPEG、WebP 或 GIF 图片": "Choose a PNG, JPEG, WebP, or GIF image.",
  "无法读取图片": "Could not read this image.",
  "每张概念图最大为 4 MB": "Each concept image can be up to 4 MB.",
  "项目中的概念图合计不能超过 12 MB": "Concept images can total up to 12 MB per project.",
  "概念图资料无效": "Invalid concept art data.",
  "概念图已添加": "Concept art added.",
  "· 概览": "· Overview",
  "· 拖入角色": "· Drop characters here",
  "· 携带属性": "· Carried attributes",
  "“读取 StoryTree 当前故事，为米拉卡和渡鸦建立一场战斗，连接一个条件节点：如果米拉卡没赶上战斗，撤销她在战斗中的属性和物品变化。”": "“Read the current story in StoryTree. Create a battle for Milaka and Raven, then add a condition that undoes Milaka’s attribute and item changes if she misses the battle.”",
  "」节点，条件为假时可回溯。": "”. A false condition can undo it.",
  "% 时开启": "%",
  "↶ 已按条件回溯事件；角色状态已恢复。": "↶ Condition rollback applied. Character state restored.",
  "＋ 创建": "＋ Create",
  "＋ 添加": "＋ Add",
  "＋ 添加变化": "＋ Add change",
  "＋ 添加规则": "＋ Add rule",
  "＋ 新建场景": "＋ New scene",
  "＋ 新建角色分组": "＋ New character group",
  "＋ 新建一个场景": "＋ Create a new scene",
  "0 未习得": "0 Unlearned",
  "0–100 · 默认 20": "0–100 · Default 20",
  "0：完全未习得": "0 Unlearned",
  "6 人类极限": "6 Human limit",
  "6：人类极限": "6 Human limit",
  "7–10 超越人类": "7–10 Superhuman",
  "7–10：人类能力范围之外": "7–10 Above the human limit",
  "按日期": "By date",
  "按条件豁免角色": "Exempt selected characters",
  "保存": "Save",
  "保存场景": "Save scene",
  "保存待变化": "Save pending changes",
  "保存规则": "Save rules",
  "保存后立即叠加到所有已推演节点之后，并更新角色库。历史节点的快照会保留。": "Saving applies these edits after the simulated nodes and updates the library. Earlier snapshots are kept.",
  "保存会写入节点的待变化记录；剧情推演及条件回溯会决定它是否发生。": "These changes are recorded on the node. Simulation and conditions determine whether they take effect.",
  "保存角色卡": "Save character",
  "保存配置文件": "Save configuration file",
  "保存设定": "Save defaults",
  "保存失败": "Save failed",
  "保存物品卡": "Save item",
  "保留事件": "Keep event",
  "保留事件全部变化": "Keep all event changes",
  "本次待保存变化 ·": "Unsaved changes ·",
  "本地 MCP 可读取、建立和修改剧情，编辑会同步显示在画布中。": "Local MCP can read, create, and edit your story. Edits appear on the canvas.",
  "本地 stdio MCP ·": "Local stdio MCP ·",
  "本地服务连接失败：": "Local service connection failed:",
  "本地项目": "Local project",
  "本段剧情推演结束": "End of this path",
  "编辑场景当前状态": "Edit current scene state",
  "编辑当前场景": "Edit current scene",
  "编辑场景": "Edit scene",
  "编辑分组": "Edit group",
  "打开场景": "Open scene",
  "无法删除": "Cannot delete",
  "确认删除": "Confirm deletion",
  "删除场景节点": "Scene nodes removed",
  "删除场景连线": "Scene connections removed",
  "解除其他场景的跳转或回溯引用": "Nodes with jump or rollback references cleared",
  "删除场景角色快照": "Scene character snapshots removed",
  "删除地图布局": "Map layouts removed",
  "移除地图角色标记": "Map character markers removed",
  "将子地点移至上一级": "Sublocations moved up one level",
  "移除地图上的地点区域": "Map location areas removed",
  "移除相关地图路线": "Map routes removed",
  "涉及的节点": "Affected nodes",
  "涉及的场景": "Affected scenes",
  "涉及的角色卡": "Affected character cards",
  "涉及的物品组合": "Affected item sets",
  "解除大纲的地点指定": "Outline location assignments cleared",
  "取消卡片的分组归属": "Cards ungrouped",
  "清除地图底图": "Map backgrounds cleared",
  "移除地图图片物体": "Map image objects removed",
  "项目至少需要保留一个场景": "The project must keep at least one scene.",
  "角色仍有剧情或场景引用，请先解除引用": "This character is still used in the story or a scene. Remove those references first.",
  "物品仍在使用，请先解除引用": "This item is still in use. Remove its references first.",
  "分组仍被剧情变化引用，请先移除对应变化": "This group is still used in story changes. Remove those changes first.",
  "此物品组合正在被其他组合使用": "This item set is used by another item set.",
  "保存后可用 Ctrl+Z 撤销。": "Use Ctrl+Z to undo this deletion.",
  "项目已更改，请取消后重新查看删除影响。": "The project changed. Cancel and reopen the deletion preview.",
  "分组已保存": "Group saved",
  "编辑角色卡": "Edit character",
  "编辑结构化规则 ·": "Edit rules ·",
  "编辑物品卡": "Edit item",
  "变化类型": "Change type",
  "标签 · 逗号分隔": "Tags · comma separated",
  "标签「": "Tag “",
  "标签名称": "Tag name",
  "标签批量操作": "Batch actions by tag",
  "标签匹配：": "Tag match:",
  "不发放物品": "No item",
  "不发生变化的角色": "Characters to exempt",
  "不加入场景": "Keep current scene",
  "不具有": "Absent",
  "不设置": "None",
  "不修改数值": "Keep existing values",
  "参与素材": "Referenced assets",
  "操作角色": "Character",
  "操作属于「": "This change belongs to “",
  "查看此刻角色状态": "View character state here",
  "查看连接方式 →": "View connection settings →",
  "查看状态": "View state",
  "场景": "Scene",
  "场景 ·": "scenes ·",
  "场景简介": "Scene summary",
  "场景角色": "Scene characters",
  "场景角色 · 当前状态": "Scene characters · Current state",
  "场景名称": "Scene name",
  "场景设定": "Scene settings",
  "场景设置": "Scene settings",
  "撤销 Ctrl+Z": "Undo Ctrl+Z",
  "创建角色卡": "Create character",
  "创建物品卡": "Create item",
  "此处判定：": "Result:",
  "此节点不在默认路径中，已选取一条可达路径预览。": "This node is outside the default path. The preview uses a reachable path.",
  "此卡片显示当前路径到达该节点后的待变化状态。": "This preview shows pending changes after reaching the node on the current path.",
  "此组还没有角色，在角色卡中选择分组。": "This group is empty. Assign a character to it on their character card.",
  "从哪里开始": "Start from",
  "达到推演步数上限。": "Simulation step limit reached.",
  "打开": "Open",
  "打开场景 →": "Open scene →",
  "打开故事项目": "Open story project",
  "打开后将替换当前工作项目。当前版本会保留在自动备份中，也可以使用撤销恢复。": "Opening this story replaces the active project. An automatic backup and Undo are available.",
  "打开事件角色面板 · 拖动物品": "Open event participants",
  "打开数据与备份目录": "Open data and backups folder",
  "打开这个故事": "Open this story",
  "待变化": "Pending changes",
  "待变化已记录": "Pending changes recorded",
  "待变化已添加": "Pending change added",
  "单击隐藏此提示": "Click to hide this tip",
  "当前场景的起点": "Start of current scene",
  "当前场景角色": "Characters in this scene",
  "当前存在未选分支，状态停在分叉处。": "A branch needs to be chosen. State is shown at the fork.",
  "当前角色状态已保存": "Current character state saved",
  "当前剧情结果": "Current result",
  "导出": "Export",
  "导出项目": "Export project",
  "的": "’s ",
  "等宽": "Monospace",
  "第": "Speaker for line ",
  "第二幕": "Act Two",
  "点击目标节点左侧的输入点 · Esc 取消": "Click the input port on the target node. Esc cancels.",
  "独白与长描述": "Monologue and description",
  "返回画布": "Back to canvas",
  "方块概览": "Square overview",
  "分支": "Branches",
  "分组名称": "Group name",
  "分组批量操作 ·": "Group actions ·",
  "分组也可以整组拖入": "Drag a group to add all its characters",
  "复制": "Copy",
  "复制 JSON 配置": "Copy JSON configuration",
  "复制到场景": "Copy to scene",
  "复制到场景…": "Copy to scene…",
  "复制节点到场景": "Copy nodes to a scene",
  "个工具 · 与画布共享同一份项目": "tools · Shared project with the canvas",
  "个节点": "nodes",
  "个节点 ·": "nodes ·",
  "个节点，保留选中节点之间的连线。": "nodes. Connections between selected nodes are kept.",
  "给予 / 掉落物品": "Give or drop items",
  "共": "Total",
  "故事 /": "Story /",
  "故事.storytree.json": "Story.storytree.json",
  "故事名称": "Story name",
  "故事设置": "Story settings",
  "故事时间": "Story date",
  "故事树": "Story tree",
  "故事已打开": "Story opened",
  "关闭": "Close",
  "关闭窗口": "Close window",
  "规则读取哪个时间点": "Evaluate state at",
  "规则读取事件执行后的角色状态。可使用属性、技能、物品数量或角色标签判断；规则结果决定走真 / 假分支。": "Rules compare attributes, skills, item quantities, or tags to choose the true or false branch.",
  "还有": "",
  "何时回溯": "Rollback trigger",
  "和 AI 一起梳理故事": "Write with AI",
  "滑块": " slider",
  "画布节点字号": "Canvas node text size",
  "恢复默认显示": "Reset display defaults",
  "回车另起一句并弹出角色框；Tab 切换角色，Enter 确定；Shift+Enter 换行。": "Enter adds a line. Tab chooses a character. Enter confirms. Shift+Enter adds a line break.",
  "回溯的事件": "Event to roll back",
  "回溯范围": "Rollback scope",
  "回溯该事件全部变化": "Undo all changes from the event",
  "回溯事件": " rolls back the event",
  "回溯事件发生前": "Before the rollback event",
  "豁免指定角色（只回溯其相关变化）": "Undo changes affecting selected characters",
  "即时编辑": "Edit current state",
  "记录一项待变化": "Record a pending change",
  "记录这个节点的目的…": "What is this node for?",
  "技能": "Skill",
  "技能 ·": "Skill ·",
  "技能栏": "Skills",
  "技能与属性设定": "Skill and attribute defaults",
  "加入待变化": "Add pending change",
  "假": "False",
  "假 · 走红色分支": "False · Red branch",
  "假分支": "False branch",
  "检查器": "Inspector",
  "简介": "Summary",
  "简介 · 悬停卡片时显示": "Summary · shown on hover",
  "简介 / 创作笔记": "Summary and notes",
  "将": "",
  "将角色 / 物品拖进节点": "Drop characters or items onto the node",
  "将角色和物品拖进节点，让他们参与故事": "Drag characters and items onto nodes to add them to the story",
  "将角色拖进场景或节点即可创建独立快照。": "Drag a character into a scene or node to create a separate snapshot.",
  "将角色拖入，设计待发生的变化": "Drop a character here to plan changes",
  "将配置加入 agent 的 MCP 配置后重启连接。数据保存在软件目录的 data 文件夹，自动保留最近 40 份备份。": "Add the configuration to your agent and reconnect. Project data and the last 40 backups are stored in the data folder.",
  "将全组角色加入场景": "Add the group to a scene",
  "将素材拖到这里": "Drop assets here",
  "将下方物品卡拖入此处，或选择物品后点 ＋": "Drag an item below into the inventory, or select it and click ＋",
  "角色": "Characters",
  "角色 ·": "characters ·",
  "角色按自定义标签匹配；物品可按 A 组名称、类型:装备、品级:传说等及自定义标签匹配，批量修改携带物品。": "Match character tags or item categories, types, grades, and custom tags to update carried items in bulk.",
  "角色标签": "Character tags",
  "角色不存在": "Character not found",
  "角色当前状态 · 即时编辑": "Current character state",
  "角色分组": "Character group",
  "角色将复制为目标场景中的独立快照。": "Characters get separate snapshots in the target scene.",
  "角色卡": "Character card",
  "角色卡已保存": "Character saved",
  "角色卡已创建": "Character created",
  "角色库": "Character library",
  "角色名称": "Character name",
  "角色携带的物品标签": "Tags on carried items",
  "角色之间转移物品": "Transfer items between characters",
  "角色资料仅预览；可记录技能、属性、物品和标签变化。": "Profile fields are read only here. You can record changes to skills, attributes, items, and tags.",
  "接收角色": "Receiving character",
  "节点": "Node",
  "节点 ·": "nodes ·",
  "节点故事日期": "Story date for this node",
  "节点名称": "Node name",
  "节点已连接": "Nodes connected",
  "节点已删除，可撤销恢复": "Node deleted. Use Undo to restore it.",
  "节点中的角色 · 待变化": "Character · Pending changes",
  "结构化规则": "Rules",
  "结构化规则 ·": "Rules ·",
  "结构化条件规则": "Condition rules",
  "界面语言": "Interface language",
  "界面字号": "Interface text size",
  "经历、动机、关系与秘密…": "History, motives, relationships, and secrets…",
  "句对白…": "more lines…",
  "句角色": "",
  "具有": "Present",
  "具有标签": "Has tag",
  "剧情画布": "Story canvas",
  "剧情节点": "Story nodes",
  "剧情节点画布": "Story node canvas",
  "剧情推演": "Story simulation",
  "开始编辑后，会自动记录操作。": "Edits will be listed here.",
  "楷体": "KaiTi",
  "可给予的物品 · 拖入角色物品栏": "Items to give · Drag into an inventory",
  "可输入日期，也可用日历按钮滚动选择。新节点默认继承上一节点日期。": "Type a date or use the calendar button to scroll through dates. New nodes inherit the previous node’s date.",
  "可直接对 AI 说": "Example prompt",
  "跨场景 / 跨时间跳转": "Jump across scenes or dates",
  "例如：旅人 或 类型:装备": "For example, Traveler or Type: Equipment",
  "例如：米拉卡在战斗前是否睡过了头？": "For example, did Milaka oversleep before the battle?",
  "例如：同伴, 第一幕登场": "For example, Companion, Appears in Act One",
  "连接画布上的节点，故事树就会在这里生长。": "Connect nodes on the canvas to build the story tree.",
  "连接你的 AI agent": "Connect an AI agent",
  "连线": "connections",
  "连线已移除，可用 Ctrl+Z 恢复": "Connection removed. Ctrl+Z restores it.",
  "另有": "",
  "六种节点，一条故事脉络": "Node types",
  "路径中最近的事件": "Most recent event on the path",
  "满足全部规则（AND）": "All rules (AND)",
  "满足任一规则（OR）": "Any rule (OR)",
  "没有匹配的内容。": "No matching results.",
  "没有匹配的素材。": "No matching assets.",
  "每次拖放转移 1 件物品，也可以在“添加变化”中指定数量。此处先预览，点击“保存待变化”才写入事件。": "Each drag transfers one item. Use Add change to enter another quantity. Save pending changes to record the transfers.",
  "每个场景都有空白画布和独立角色快照。复制节点时，会一并保留内部连线。": "Each scene has its own canvas and character snapshots. Copying nodes keeps their internal connections.",
  "每个故事，都始于一个节点": "Start with a node",
  "每行一个名称。新角色将使用这些默认栏位；已有角色保留自己的自定义栏位。": "Enter one name per line. These defaults apply to new characters. Existing characters keep their fields.",
  "描述角色、物品和属性之间发生的事件…": "Describe what happens between the characters, items, and attributes…",
  "名称": "Name",
  "名称无效": "Invalid name",
  "命名自定义事件…": "Name the custom event…",
  "默认技能 · 0–10，默认 0": "Default skills · 0–10, default 0",
  "默认属性 · 0–100，默认 20": "Default attributes · 0–100, default 20",
  "目标场景": "Target scene",
  "目标匹配标签（逗号分隔，必须全部匹配）": "Required tags (comma separated)",
  "年": "Year",
  "判定方式": "Evaluation method",
  "旁白": "Narrator",
  "旁白 / 未指定": "Narrator / Unassigned",
  "批量操作": "Batch actions",
  "批量操作已保存": "Group changes saved",
  "批量给予物品": "Give items to group",
  "批量数值、物品和标签更新角色库的当前设定。拖动分组标题可将全组加入节点。": "Batch edits update the character library. Drag the group title onto a node to add its members.",
  "批量添加标签 · 逗号分隔": "Add tags · comma separated",
  "匹配对象": "Match",
  "前往目标节点 →": "Go to target node →",
  "前序节点执行后": "After preceding nodes",
  "清空搜索": "Clear search",
  "请从 StoryTree.exe 打开软件": "Open StoryTree.exe to start the app",
  "请输入 0–999999 的整数": "Enter a whole number from 0 to 999999",
  "请输入名称": "Enter a name",
  "请输入属性名称": "Enter an attribute name",
  "请输入有效日期，例如 1024.04.16。": "Enter a valid date, for example 1024.04.16.",
  "请先创建物品卡": "Create an item first",
  "请先双击移除此输出点上的连线": "Remove the connections from this output first",
  "请选择接下来发生的分支：": "Choose what happens next:",
  "请选择小于8MB的图片": "Choose an image under 8 MB",
  "取消": "Cancel",
  "让变化沿剧情发生": "Plan story changes",
  "日": "Day",
  "删除此节点": "Delete this node",
  "删除选中": "Delete selected nodes",
  "尚未指定": "Unspecified",
  "尚无成员": "No members",
  "设为数值": "Set value",
  "设为指定值": "Set to a value",
  "设置": "Settings",
  "设置一个判断条件": "Set a condition",
  "使用事件角色面板，将物品从原主人拖给接收者，自动记录一增一减。": "Drag items between participants in the event panel to record a transfer.",
  "事件记录待变化，条件决定是否发生。打开故事树，查看每一刻的角色状态。": "Events record pending changes. Conditions determine whether they take effect. Inspect character states in the story tree.",
  "事件角色面板 ·": "Event participants ·",
  "事件类型名称": "Event type name",
  "事件描述": "Event description",
  "事件设置": "Event settings",
  "适应画布": "Fit canvas",
  "适应全部节点": "Fit all nodes",
  "收起故事树": "Collapse story tree",
  "收起检查器": "Collapse inspector",
  "收起素材库": "Collapse library",
  "手动判定": "Manual",
  "手动判定 ·": "Manual ·",
  "输出": "output",
  "输出：": "Output:",
  "输出点": "Output ports",
  "输入": "input",
  "输入点（可接受任意数量连线）": "Input port (accepts multiple connections)",
  "属性": "Attribute",
  "属性 ·": "Attribute ·",
  "属性栏": "Attributes",
  "数值": "value",
  "双击编辑": "Double-click to edit",
  "双击编辑携带物品的属性": "Double-click to edit carried item attributes",
  "双击画布开始创作": "Double-click the canvas to begin",
  "双击节点，开始写下一句…": "Double-click the node to write a line…",
  "双击节点，写下这一刻…": "Double-click the node to describe this moment…",
  "双击节点里的角色可编辑待变化；在角色物品栏间拖放可记录转移。": "Open a character on the node to edit pending changes. Drag items between inventories to record transfers.",
  "双击卡片编辑 · 悬停查看简介": "Double-click to edit · Hover for summary",
  "双击卡片编辑；可从这里拖入画布节点或正文。": "Double-click a card to edit it. Drag it to a node or its text.",
  "双击数量 / 名称可编辑": "Double-click a name or quantity to edit",
  "双击修改数量": "Double-click to change quantity",
  "双击移除连线": "Double-click to remove this connection",
  "宋体 / 衬线": "Song / Serif",
  "搜索检查器和故事树": "Search inspector and story tree",
  "搜索节点、角色、物品、场景…": "Search nodes, characters, items, and scenes…",
  "搜索名称、标签或描述…": "Search names, tags, or descriptions…",
  "搜索素材": "Search assets",
  "素材库": "Library",
  "素材已加入节点": "Asset added to node",
  "缩放低于": "Below",
  "特殊物品没有属性": "Special items have no attributes",
  "特殊物品没有属性栏。": "Special items have no attributes.",
  "添加": "Add",
  "添加 / 移除角色标签": "Add or remove character tags",
  "添加标签": "Add tag",
  "添加节点": "Add node",
  "条": "",
  "条 · 显示前": "matches · showing first",
  "条件和跳转节点只预览角色；请在事件、对话或独白中记录变化": "Conditions and jumps preview character state. Record changes on an event, dialogue, or monologue node.",
  "条件描述": "Condition description",
  "条件判断": "Condition",
  "条件为假（默认）": "False (default)",
  "条件为真": "True",
  "条匹配": "matches",
  "跳转": "Jump",
  "同组标签互斥。物品进入角色物品栏后可堆叠，双击数量编辑。": "Choose one label per group. Items can stack in an inventory. Double-click the quantity to edit it.",
  "图片格式不支持": "Unsupported image format",
  "推演剧情": "Simulate",
  "推演停止：": "Simulation stopped:",
  "推演只读取剧情，不修改角色库。你可以选择条件的真假，观察回溯前后的不同状态。": "Simulation previews the story and rollback without writing to the character library.",
  "拖动节点 · 空格拖动画布 · 滚轮缩放 · Shift 框选": "Drag nodes · Space to pan · Scroll to zoom · Shift to select",
  "拖动物品后会在这里记录。": "Drag items to record changes here.",
  "拖入角色，建立此场景的独立角色快照": "Drop a character here to create a scene snapshot",
  "拖入节点 / 场景以建立独立快照": "Drop into a node or scene to create a snapshot",
  "拖入节点开始使用": "Drag onto a node to use",
  "拖入物品，表示此角色获得物品": "Drop an item here to give it to this character",
  "完成": "Done",
  "唯一说话角色": "Speaker",
  "为这个场景写一段简介，让每个节点有迹可循。": "Add a summary to this scene.",
  "未分类": "Uncategorized",
  "未分配": "Unassigned",
  "未分组": "Ungrouped",
  "未连接的节点": "Unconnected nodes",
  "无衬线": "Sans serif",
  "无法打开项目": "Could not open project",
  "物品": "Items",
  "物品 · 拖给另一名角色": "Items · Drag to another character",
  "物品卡": "Item cards",
  "物品卡已保存": "Item saved",
  "物品库": "Item library",
  "物品栏": "Inventory",
  "物品名称": "Item name",
  "物品属性": "Item attributes",
  "物品数量": "Item quantity",
  "物品转移": "Item transfer",
  "物品转移已记录为待变化": "Transfer recorded as a pending change",
  "系统默认": "System default",
  "先点击来源节点右侧输出点，再点击这里": "Click the source output port first",
  "先将角色拖入节点 / 场景后再添加变化。转移操作会同步扣减原主人的物品。": "Add characters to the node or scene before recording changes. A transfer subtracts the item from the original owner.",
  "显示或收起故事树": "Toggle story tree",
  "显示或收起素材库": "Toggle library",
  "显示默认路径推演完毕、再叠加检查器即时编辑后的状态。": "Shows the simulated state along the default path with current edits applied.",
  "显示设置未能保存": "Could not save display settings",
  "线": "links",
  "详情": "Details",
  "项": "changes",
  "项待变化": "more pending changes",
  "项目": "Project",
  "项目设置": "Project settings",
  "项目搜索结果": "Project search results",
  "项目已导出": "Project exported",
  "项目已自动保存在本机": "Project saved locally",
  "项目总览": "Project overview",
  "写下角色的一段话，或描述眼前的事物…": "Write a monologue or describe what the character sees…",
  "写下一句对白…": "Write the next line…",
  "新场景": "New scene",
  "新场景名称（选择新建时使用）": "New scene name",
  "新的故事": "New story",
  "新分组": "New group",
  "新技能名称": "New skill name",
  "新建场景": "New scene",
  "新建角色分组": "New character group",
  "新建空白故事": "New blank story",
  "新建素材": "New asset",
  "新角色": "New character",
  "新属性名称": "New attribute name",
  "新物品": "New item",
  "形象图片 · 最大 8MB": "Portrait · up to 8 MB",
  "修改方式": "Operation",
  "修改技能 / 属性": "Change skill or attribute",
  "修改技能（0–10）": "Change skill (0–10)",
  "修改属性（0–100）": "Change attribute (0–100)",
  "修改携带物品的属性": "Change carried item attribute",
  "悬停看摘要": "Hover for summary",
  "选择故事日期": "Choose story date",
  "选择跨场景跳转目标": "Choose a jump target",
  "选择目标节点…": "Choose a target node…",
  "一键归 0": "Reset to zero",
  "移除": "Remove",
  "移除标签": "Remove tag",
  "移除此变化": "Remove this change",
  "移除引用": "Remove reference",
  "移除这句": "Remove this line",
  "移到场景…": "Move to scene…",
  "移动": "Move",
  "移动节点到场景": "Move nodes to a scene",
  "移入场景": "Move to scene",
  "已保存到本机": "Saved locally",
  "已撤销": "Undone",
  "已复制到场景，各场景的角色状态相互独立": "Copied to scene with independent character snapshots",
  "已回溯事件变化": "Event changes rolled back",
  "已加入当前场景": "Added to current scene",
  "已将素材插入正文": "Asset inserted in text",
  "已删除，可用 Ctrl+Z 撤销": "Deleted. Ctrl+Z restores it.",
  "已选": "Selected",
  "已选择": "Selected",
  "已重做": "Redone",
  "应用到全组": "Apply to group",
  "应用日期": "Apply date",
  "用一句话介绍这个角色…": "Describe this character in one sentence…",
  "与未选中节点的连线将断开。": "Connections to nodes outside the selection will be removed.",
  "预览角色（执行时按标签批量匹配）": "Preview character (matched by tag during simulation)",
  "遇到循环，已停止继续推演。循环不会被重复叠加到当前角色状态。": "Simulation stopped at a loop. Changes are applied once.",
  "原角色没有这件物品": "The original owner does not have this item",
  "月": "Month",
  "暂无物品": "No items",
  "增加 / 减少（负数表示减少）": "Add or subtract (use a negative value to subtract)",
  "增加输出点": "Add output port",
  "展开": "Expand ",
  "这个分组还没有角色": "This group has no characters",
  "这里还没有素材，点击右上角 ＋ 创建。": "No assets yet. Click ＋ to create one.",
  "真": "True",
  "真 · 走绿色分支": "True · Green branch",
  "真分支": "True branch",
  "阵营 A": "Team A",
  "阵营 A：": "Team A:",
  "阵营 B": "Team B",
  "阵营 B：": "Team B:",
  "正文": "Text",
  "正在保存…": "Saving…",
  "至少添加一条规则": "Add at least one rule",
  "重新推演": "Run again",
  "重做 Ctrl+Shift+Z": "Redo Ctrl+Shift+Z",
  "逐句对白": "Dialogue lines",
  "转移数量": "Quantity to transfer",
  "字体": "Font",
  "自定义标签 · 逗号分隔": "Custom tags · comma separated",
  "自定义事件": "Custom event",
  "自然语言保留你的设想。请用手动结果或结构化规则确定真假；规则读取前序节点后的角色状态。": "Write the condition in your own words, then choose a manual result or define rules to evaluate it.",
  "组合方式": "Rule combination",
  "最近编辑记录": "Recent edits",
  "A 组 · 必选一个": "Group A · Required",
  "AI 可创建角色、物品、场景与节点，连线、记录事件、推演条件及读取故事树。软件未打开时也可调用。": "AI can create characters, items, scenes, nodes, and connections, record changes, and run story simulations. MCP also works when the app is closed.",
  "B 组 · 可选一个": "Group B · Optional",
  "C 组 · 品级，需先选择 B 组": "Group C · Grade, available after choosing Group B",
  "DeepSeek Harness / 通用 MCP · JSON": "DeepSeek Harness / Generic MCP · JSON",
  "MCP 配置已复制": "MCP configuration copied",
  "StoryTree · 故事树": "StoryTree",
  "· 所有更改自动保存": "· Autosaved",
  "StoryTree.MCP.exe 是专用无窗口入口，无需另装 Node.js。MCP 资源 storytree://schema 说明节点、条件和变化的字段。所有 AI 编辑都会记录在本地项目的 audit 中，并可在软件中撤销。": "StoryTree.MCP.exe runs in the background with its bundled runtime. Read storytree://schema for fields and rules. AI edits appear in the project audit and can be undone.",
  "Tab 切换角色 · Enter 确定": "Tab to choose a speaker · Enter to confirm",
  "对话": "Dialogue",
  "独白": "Monologue",
  "事件": "Event",
  "条件": "Condition",
  "标签": "Tag",
  "继续": "Continue",
  "战斗": "Battle",
  "交易": "Trade",
  "自定义": "Custom",
  "副本物品": "Instance item",
  "单机物品": "Single-player item",
  "特殊物品": "Special item",
  "任务物品": "Quest item",
  "装备": "Equipment",
  "道具": "Utility item",
  "材料": "Material",
  "未知": "Unknown",
  "普通": "Common",
  "优质": "Fine",
  "稀世": "Rare",
  "异世": "Otherworldly",
  "传说": "Legendary",
  "字段名称无效": "Invalid field name",
  "日期请使用有效的 年.月.日": "Enter a valid date in YYYY.MM.DD format",
  "角色需要名称": "Enter a character name",
  "物品需要名称": "Enter an item name",
  "物品不存在": "Item not found",
  "物品数量必须为整数": "Item quantity must be a whole number",
  "图片必须为小于 8MB 的 PNG/JPEG/WebP/GIF": "Choose a PNG, JPEG, WebP, or GIF under 8 MB",
  "必须选择一个 A 组标签": "Choose a Group A label",
  "B 组标签无效": "Invalid Group B label",
  "品级需要先选择 B 组类型": "Choose a Group B type before setting a grade",
  "角色未携带此物品": "The character is not carrying this item",
  "操作角色尚未加入场景": "Add the character to the scene first",
  "接收角色无效": "Invalid receiving character",
  "转移数量必须为正整数": "Transfer quantity must be a positive whole number",
  "请输入标签": "Enter a tag",
  "未知变化类型": "Unknown change type",
  "条件引用的角色尚未入场": "The character used in this condition is not in the scene",
  "结构化条件至少需要一条规则": "Add at least one condition rule",
  "标签节点至少需要一个目标标签": "Enter at least one target tag",
  "物品标签只支持物品数量、属性及转移操作": "Item tags support quantity, attribute, and transfer changes",
  "回溯事件必须已经在当前路径中经过": "The rollback event must come earlier on the current path",
  "回溯事件不在当前路径": "The rollback event is not on this path",
  "嵌套回溯请紧接相应事件设置条件": "Place a nested rollback condition directly after its event",
  "不是有效的 StoryTree 1 项目": "This is not a valid StoryTree 1 project",
  "节点类型无效": "Invalid node type",
  "跨场景请使用跳转节点": "Use a jump node to connect scenes",
  "跨场景请用跳转节点": "Use a jump node to connect scenes",
  "故事需要标题": "Enter a story title",
  "分组中没有角色": "This group has no characters",
  "此类型不能增加输出点": "This node type does not support extra outputs",
  "未选择节点": "Select one or more nodes",
  "输出点不存在": "Output port not found",
  "连线已存在": "This connection already exists",
  "没有可撤销的操作": "Nothing to undo",
  "没有可重做的操作": "Nothing to redo",
  "项目超过40MB": "The project exceeds 40 MB",
  "请选择保存位置": "Choose where to save",
  "本地数据服务启动失败，请检查 data 目录是否可写": "The local service could not start. Check that the data folder is writable."
};

const {renderTree,renderTreeContents,renderTreeSearchResults,syncTreeProject,scopeFields,readStoryScope}=createStoryTreeView({state,$,ST,t,esc,html,message,button,icon,nodeType,dateLabel,locationName,locationById,DEFAULT_LOCATION_COLOR,nodePreview,changeText,locationOptions,speakerName,formatReferenceValue,previewCharacterText,renderOutlineText,outlineLinkLabel,getTimelineEntries,getSearchEntries,searchSnippet,searchLimit});
const {renderCharacterImport,characterImportPreview,renderCharacterModal}=createCharacterCardView({state,ST,t,esc,html,staticHtml,button,icon,showModal,deleteEntryButton,avatar,charName,itemName,itemSetName,entityChip,renderCharacterReferenceTray,renderCharacterItemSets});
const sceneMapView=createSceneMapView({state,ST,$,esc,html,t,button,icon,currentScene,locationsInOrder,locationById,
  locationName,locationOptions,defaultColor:DEFAULT_LOCATION_COLOR,run,render,toast,openLocation,openCharacter,openMapObject,focusMapArea,renderLocationCard,locationCardActions,saveDisplaySettings});
const pluginView=createPluginView({state,ST,$,esc,html,t,button,showModal,closeModal,toast,run,updateSave,flushDrafts,focusNode,selectedNode});
const textFind=createTextFindReplace({ST,t,html,getModal:()=>state.modal,getProjectId:()=>state.p?.id,editorNodeId,focusEditor:focusNodeEditor});
sceneMapView.bind();
textFind.bind();

init();
