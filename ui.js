'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS={
 tree:'<path d="M7 3v18M7 11h6a5 5 0 0 0 5-5V3M7 11h6a5 5 0 0 1 5 5v5"/><circle cx="7" cy="3" r="1.4"/><circle cx="18" cy="3" r="1.4"/><circle cx="18" cy="21" r="1.4"/>',
 dialogue:'<path d="M4 4h16v12H9l-5 4V4zM8 8h8M8 12h5"/>',monologue:'<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',condition:'<path d="m12 2 10 10-10 10L2 12zM12 8v5M12 16v.1"/>',jump:'<path d="M3 7h11v11M14 7l-9 9M18 3h3v18h-3"/>',event:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',label:'<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',characters:'<circle cx="10" cy="7" r="4"/><path d="M3 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8M20 15a5 5 0 0 1 2 4v2"/>',items:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M8 5l9 5"/>',scenes:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 2v6M16 2v6"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',save:'<path d="M4 3h13l4 4v14H3V3zM7 3v7h10V3M7 21v-7h10v7"/>',play:'<path d="m7 3 14 9-14 9z"/>',undo:'<path d="M8 5 3 10l5 5M3 10h12a6 6 0 0 1 0 12"/>',redo:'<path d="m16 5 5 5-5 5M21 10H9a6 6 0 0 0 0 12"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',settings:'<path d="M4 7h16M4 17h16M9 3v8M16 13v8"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v.2"/>',mcp:'<path d="m8 3-5 5 5 5M16 11l5 5-5 5M16 3 8 21"/>',fit:'<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',folder:'<path d="M3 5h7l2 3h9v12H3z"/>',chevron:'<path d="m9 5 7 7-7 7"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',arrow:'<path d="M3 12h18m-6-6 6 6-6 6"/>'};
const icon=(k,size=17)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||ICONS.label}</svg>`;
const button=(action,label,cls='',title='')=>`<button data-action="${action}" class="${cls}" ${title?`title="${esc(title)}"`:''}>${label}</button>`;
const state={
  ...ST.displaySettings(),
  p:null, connection:null, tab:'characters', search:'',
  projectQuery:'', searchOpen:false, searchCursor:0, focusedEntity:null,
  selected:new Set(), inspectorTab:'node', view:{x:60,y:90,zoom:.85},
  link:null, modal:null, rolePicker:null, saved:true,
  queue:Promise.resolve(), lastDirectory:'', traceChoices:{}
};
let composingInput = null;
let renderAfterComposition = false;
const displayKey = 'storytree-display-settings';
const dismissedTips = new Set();
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
  document.title = state.language === 'en' ? 'StoryTree' : t('StoryTree · 故事树');
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
const currentScene=()=>ST.sceneOf(state.p,state.p.currentSceneId);
const selectedNode=()=>state.selected.size===1?nodeById([...state.selected][0]):null;
const characterOptions=(selected='',blank=true)=>`${blank?html`<option value="" ${!selected?'selected':''}>旁白 / 未指定</option>`:''}${state.p.characters.map(c=>`<option value="${esc(c.id)}" ${selected===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}`;
const options=(values,value,label=t)=>values.map(v=>`<option ${v===value?'selected':''} value="${esc(v)}">${esc(v?label(v):t('不设置'))}</option>`).join('');
function avatar(c,i=0,large=false){return `<span class="avatar ${i%2?'alt':''}" ${large?'style="width:70px;height:82px"':''}>${c.image?`<img alt="${esc(c.name)}" src="${esc(c.image)}">`:esc(c.name.slice(0,1))}</span>`;}
function entityChip(ref,extra='') {const obj=ref.kind==='character'?state.p.characters.find(c=>c.id===ref.id):state.p.items.find(i=>i.id===ref.id);if(!obj)return '';return `<span class="entity-chip ${ref.kind==='item'?'item':''}" draggable="true" data-drag-kind="${ref.kind}" data-drag-id="${esc(ref.id)}" data-entity-kind="${ref.kind}" data-entity-id="${esc(ref.id)}" data-summary="${esc(obj.summary)}" title="${esc(obj.summary||obj.name)}" ${extra}>${icon(ref.kind==='character'?'characters':'items',11)}${esc(obj.name)}</span>`;}
function richText(text,n){let result=esc(text);for(const r of [...n.refs].sort((a,b)=>{const list=x=>x.kind==='character'?state.p.characters:state.p.items;return (list(b).find(x=>x.id===b.id)?.name.length||0)-(list(a).find(x=>x.id===a.id)?.name.length||0);})) {const obj=(r.kind==='character'?state.p.characters:state.p.items).find(x=>x.id===r.id);if(obj)result=result.split('@'+esc(obj.name)).join(entityChip(r,`data-in-node="${n.id}"`));}return result;}
async function api(route,body){const r=await fetch('/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-StoryTree-Token':state.connection.token},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();if(!r.ok){const e=Error(j.error||t('保存失败'));e.status=r.status;throw e;}return j;}
function run(commands,message='') {
 state.queue=state.queue.catch(()=>{}).then(async()=>{state.saved=false;updateSave();try{const batch=typeof commands==='function'?commands():commands;const r=await api('commands',{commands:batch,revision:state.p.revision});state.p=r.project;state.saved=true;state.selected=new Set([...state.selected].filter(id=>nodeById(id)));render();if(message)toast(message);return r;}catch(e){state.saved=false;updateSave();if(e.status===409)await refresh(true);toast(e.message);throw e;}});return state.queue;
}
const cmd=(type,args,message)=>run([{type,args}],message);
async function refresh(force=false){try{if(state.modal&&!force)return;const r=await api('project');state.lastDirectory=r.directory;if(!state.p||r.project.revision!==state.p.revision||force){state.p=r.project;state.saved=true;render();}}catch(e){toast(t('本地服务连接失败：')+e.message);}}
function updateSave(){const el=$('#save-label');if(el)el.innerHTML=state.saved?staticHtml('<span class="status-dot"></span>已保存到本机'):t('正在保存…');}
function focusCapture(){const a=document.activeElement;return a?.dataset?.focus?{key:a.dataset.focus,start:a.selectionStart,end:a.selectionEnd}:null;}
function focusRestore(f){if(!f)return;const el=$$('[data-focus]').find(x=>x.dataset.focus===f.key);if(el){el.focus({preventScroll:true});if(typeof f.start==='number' && el.setSelectionRange)try{el.setSelectionRange(f.start,f.end);}catch{}}}
function render(){
 if(!state.p)return;
 if(composingInput?.isConnected){renderAfterComposition=true;return;}
 hideOverviewTip();
 const focus=focusCapture(),scroll=$('.inspector-content')?.scrollTop||0,libScroll=$('.library-list')?.scrollTop||0;
 const treeScroll=$('.tree-content')?.scrollTop||0,treeLeft=$('.tree-content')?.scrollLeft||0;
 const p=state.p,s=currentScene();
 $('#app').innerHTML=html`<header class="topbar"><div class="brand"><img src="logo.svg" alt=""><div>StoryTree</div></div><div class="top-separator"></div>${button('rename-project',`<span class="project-name">${esc(p.title)}</span><span class="muted tiny"> ▾</span>`,'ghost')}<span class="save-state" id="save-label"></span><div class="top-actions">${button('undo',icon('undo',15),'icon ghost',t('撤销 Ctrl+Z'))}${button('redo',icon('redo',15),'icon ghost',t('重做 Ctrl+Shift+Z'))}<div class="top-separator"></div>${button('import', t('打开'),'ghost')}${button('export',icon('save',14)+t(' 导出'),'ghost')}${button('mcp',icon('mcp',14)+' AI / MCP','ghost')}${button('simulate',icon('play',14)+t(' 推演剧情'),'primary')}</div></header>
 <div class="body"><nav class="rail">${button('rail-canvas',icon('tree',22),'active',t('剧情画布'))}${button('rail-characters',icon('characters',21),state.tab==='characters'?'active':'',t('角色库'))}${button('rail-items',icon('items',21),state.tab==='items'?'active':'',t('物品库'))}${button('rail-scenes',icon('scenes',21),state.tab==='scenes'?'active':'',t('场景'))}${button('definitions',icon('label',20),'',t('技能与属性设定'))}<div class="bottom">${button('settings',icon('settings',21),'',t('设置'))}</div></nav>
 ${state.libraryCollapsed?panelRail('toggle-library',t('素材库'),'folder','left-rail'):renderLibrary()}<main class="workspace"><div class="scene-tabs">${p.scenes.map(x=>`<button class="scene-tab ${x.id===s.id?'active':''}" data-scene="${esc(x.id)}" data-drop-scene="${esc(x.id)}"><span class="tab-dot"></span>${esc(x.name)}<span class="muted tiny">${p.nodes.filter(n=>n.sceneId===x.id).length}</span></button>`).join('')}${button('new-scene',icon('plus',14),'ghost',t('新建场景'))}</div>
 <div class="canvas-toolbar">
   ${button('toggle-library',icon('folder',14),'icon ghost',t('显示或收起素材库'))}
   <div class="crumb">故事 / <strong>${esc(s.name)}</strong></div>
   ${button('palette',icon('plus',13)+staticHtml('<span class="tool-caption">添加节点</span>'),'primary',t('添加节点'))}
   ${button('fit',icon('fit',13)+staticHtml('<span class="tool-caption">适应画布</span>'),'ghost',t('适应画布'))}
   ${button('tree',icon('tree',13)+staticHtml('<span class="tool-caption">故事树</span>'),state.tree?'active':'ghost',t('显示或收起故事树'))}
 </div>
 ${renderProjectSearch()}
 <div class="canvas" id="canvas" tabindex="0" aria-label="剧情节点画布"><div class="stage" id="stage"><svg class="edges" id="edges"></svg><div id="nodes"></div></div>${!p.nodes.some(n=>n.sceneId===s.id)?html`<div class="canvas-empty"><div class="empty-icon">${icon('tree',53)}</div><h2>每个故事，都始于一个节点</h2><p>双击画布开始创作<br>将角色和物品拖进节点，让他们参与故事</p></div>`:''}<div class="canvas-overlay"><div class="zoom-controls">${button('zoom-out','−','ghost')}<span id="zoom-text">${Math.round(state.view.zoom*100)}%</span>${button('zoom-in','+','ghost')}${button('fit',icon('fit',13),'ghost',t('适应全部节点'))}</div></div><div id="minimap" class="minimap"></div><div class="canvas-help">拖动节点 · 空格拖动画布 · 滚轮缩放 · Shift 框选</div>${state.selected.size>1?html`<div class="selection-toolbar">已选 ${state.selected.size} 个节点 ${button('transfer',icon('scenes',12)+t(' 移入场景'),'small')}${button('copy-transfer',icon('copy',12)+t(' 复制到场景'),'small')}${button('delete-selected',icon('trash',12),'icon small danger',t('删除选中'))}</div>`:''}${state.link?staticHtml('<div class="canvas-banner">点击目标节点左侧的输入点 · Esc 取消</div>'):''}</div></main>
 ${state.inspectorCollapsed?panelRail('toggle-inspector',t('检查器'),'settings','right-rail'):renderInspectorPanel()}
 ${state.tree?renderTree():panelRail('tree',t('故事树'),'tree','right-rail')}</div>
 <footer class="statusbar"><span><span class="status-dot"></span>本地项目</span><span>${p.scenes.length} 场景</span><span>${p.characters.length} 角色</span><span>${p.nodes.length} 节点 · ${p.edges.length} 连线</span><span class="right">${state.selected.size?t('已选择 ')+state.selected.size+t(' 个节点 · '):''}StoryTree 1.0 · 所有更改自动保存</span></footer>`;
 renderGraph();
 updateSave();
 if($('.inspector-content'))$('.inspector-content').scrollTop=scroll;
 if($('.library-list'))$('.library-list').scrollTop=libScroll;
 const treeContent = $('.tree-content');
 if(treeContent){
   treeContent.scrollTop=treeScroll;
   treeContent.scrollLeft=treeLeft;
 }
 focusRestore(focus);
 bindCanvas();
 renderSearchResults();
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
    <div class="inspector-content">${renderInspector()}</div>
  </aside>`;
}
function renderLibraryList(){const p=state.p,q=state.search.trim().toLowerCase();
 const card=(c,i,kind)=>`<div class="library-card" draggable="true" data-drag-kind="${kind}" data-drag-id="${esc(c.id)}" data-entity-kind="${kind}" data-entity-id="${esc(c.id)}" data-summary="${esc(c.summary)}" title="${esc(c.summary||t('双击编辑'))}" data-library="true">${kind==='character'?avatar(c,i):`<span class="avatar item">${icon('items',19)}</span>`}<div class="flex"><div class="name">${esc(c.name)}</div><div class="desc">${esc(kind==='item'?t(c.category)+' · '+(t(c.type)||t('未分类')):(c.tags.slice(0,2).join(' · ')||c.summary||t('拖入节点开始使用')))}</div></div><span class="card-drag">⠿</span></div>`;
 let content='';
 if(state.tab==='characters') {for(const g of [...p.groups,{id:'',name:t('未分组')}]){const cs=p.characters.filter(c=>(c.groupId||'')===g.id&&(!q||JSON.stringify(c).toLowerCase().includes(q)));if(!cs.length && !g.id)continue;content+=`<div class="group-head" draggable="true" data-drag-kind="group" data-drag-id="${esc(g.id)}"><span>⌄ ${esc(g.name)} <span class="muted tiny">${cs.length}</span></span>${g.id?html`<button class="small ghost" data-group="${esc(g.id)}" title="批量操作">${icon('more',12)}</button>`:''}</div>${cs.map((c,i)=>card(c,i,'character')).join('')}`;}content+=button('new-group',t('＋ 新建角色分组'),'ghost small full');}
 if(state.tab==='items') content=html`<div class="section-label">物品卡 <span>${p.items.length}</span></div>`+p.items.filter(i=>!q||JSON.stringify(i).toLowerCase().includes(q)).map((c,i)=>card(c,i,'item')).join('');
 if(state.tab==='scenes')content=p.scenes.filter(s=>!q||s.name.includes(q)).map(s=>html`<div class="library-card" data-scene="${esc(s.id)}" data-drop-scene="${esc(s.id)}"><span class="avatar alt">${icon('scenes',18)}</span><div class="flex"><div class="name">${esc(s.name)}</div><div class="desc">${p.nodes.filter(n=>n.sceneId===s.id).length} 节点 · ${Object.keys(s.characters).length} 场景角色</div></div></div>`).join('');
 return content||`<div class="hint">${q?t('没有匹配的素材。'):t('这里还没有素材，点击右上角 ＋ 创建。')}</div>`;
}
function renderLibrary() {
  return html`<aside class="library">
    <div class="panel-heading">
      <h3>素材库</h3>
      <div class="panel-controls">
        ${button('new-entity',icon('plus',16),'icon ghost',t('新建素材'))}
        ${button('toggle-library',icon('chevron',14),'icon ghost fold-left',t('收起素材库'))}
      </div>
    </div>
    <div class="library-search"><input id="library-search" data-focus="library-search" autocomplete="off" placeholder="搜索名称、标签或描述…" value="${esc(state.search)}" aria-label="搜索素材"></div>
    <div class="library-tabs">${['characters','items','scenes'].map((tab,i)=>`<button data-tab="${tab}" class="${state.tab===tab?'active':''}">${[t('角色'),t('物品'),t('场景')][i]}</button>`).join('')}</div>
    <div class="library-list">${renderLibraryList()}</div>
    ${optionalTip('library', html`${icon('characters',11)} 双击卡片编辑 · 悬停查看简介<br>拖入节点 / 场景以建立独立快照<br>分组也可以整组拖入`, 'library-hint')}
  </aside>`;
}
function nodeBody(n){let h=`<div class="node-date">${icon('clock',10)} ${esc(n.date)}</div>`;if(n.summary)h+=`<div class="node-summary">${esc(n.summary)}</div>`;
 if(n.type==='dialogue')h+=n.lines.slice(0,3).map(l=>`<div class="node-line"><span class="node-speaker">${esc(charName(l.characterId))}</span><span class="node-line-text">${richText(l.text||t('双击节点，开始写下一句…'),n)}</span></div>`).join('')+(n.lines.length>3?html`<span class="muted tiny">还有 ${n.lines.length-3} 句对白…</span>`:'');
 if(n.type==='monologue')h+=`<div class="node-text">${n.speakerId?'<span class="node-speaker">'+esc(charName(n.speakerId))+' · </span>':''}${richText(n.text||t('双击节点，写下这一刻…'),n)}</div>`;
 if(n.type==='event'||n.type==='label'){h+=n.type==='event'?`<span class="event-kind">${esc(eventTypeLabel(n.eventType))}</span>`:html`<div class="condition-line">标签匹配：${esc(n.labelQuery.tags.join(' + ')||t('尚未指定'))}</div>`;if(n.text)h+=`<div class="node-text" style="margin-top:8px">${richText(n.text,n)}</div>`;h+=n.operations.slice(0,3).map(o=>`<div class="pending-line">${esc(operationText(o))}</div>`).join('');if(!n.operations.length)h+=staticHtml('<div class="hint">将角色拖入，设计待发生的变化</div>');if(n.operations.length>3)h+=html`<div class="tiny muted">另有 ${n.operations.length-3} 项待变化</div>`;}
 if(n.type==='condition')h+=`<div class="condition-line">${esc(n.condition.description||t('设置一个判断条件'))}</div><span class="tiny muted">${n.condition.mode==='manual'?t('手动判定 · ')+(n.condition.value?t('真'):t('假')):t('结构化规则 · ')+n.condition.rules.length+t(' 条')} · ${n.condition.rollback==='all'?(n.condition.rollbackWhen==='true'?t('真分支'):t('假分支'))+t('回溯事件'):n.condition.rollback==='selected'?t('按条件豁免角色'):t('保留事件')}</span>`;
 if(n.type==='jump'){const target=nodeById(n.targetNodeId);h+=`<div class="row" style="color:#ce9cbb">${icon('jump',15)}<span>${esc(target?ST.sceneOf(state.p,target.sceneId).name+' / '+target.title:t('选择跨场景跳转目标'))}</span></div>`;}
 return h;
}
function operationText(o){const name=o.targetTag?t('标签「')+o.targetTag+'」':charName(o.characterId),value=o.value;
 if(o.kind==='itemAttribute')return message`${name} · ${itemName(o.itemId)}的${o.key} ${o.mode==='add'?(Number(value)>=0?'+':''):'→'}${value}`;
 if(o.kind==='transfer')return `${name} → ${charName(o.toCharacterId)} · ${itemName(o.itemId)} ×${value}`;
 if(o.kind==='item')return `${name} · ${itemName(o.itemId)} ${o.mode==='set'?'→':Number(value)>=0?'+':''}${value}`;
 if(o.kind==='tag')return message`${name} ${o.mode==='remove'?t('移除'):t('添加')}标签「${o.key}」`;
 return `${name} · ${o.key} ${o.mode==='add'?(Number(value)>=0?'+':''):'→'}${value}${o.kind==='skill'?' / 10':''}`;
}
function renderGraph() {
  const nodes = state.p.nodes.filter(n => n.sceneId === state.p.currentSceneId);
  $('#nodes').innerHTML = nodes.map(n => html`<article class="node ${n.type} ${state.selected.has(n.id)?'selected':''}" data-node="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;min-height:${112+n.outputs.length*27}px">
    <div class="node-head" data-node-drag="${esc(n.id)}"><span class="type-icon">${icon(n.type,16)}</span><strong>${esc(n.title)}</strong><span class="type-name">${nodeType(n.type)}</span></div>
    <div class="node-body">${nodeBody(n)}</div>
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
function renderEdges() {
  const compact = inOverview();
  const radius = overviewSize() / 2;
  const nodes = new Map(state.p.nodes.filter(n => n.sceneId === state.p.currentSceneId).map(n => [n.id,n]));
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
function nodePreview(n) {
  const text = n.summary || n.text || n.condition?.description || n.lines?.find(line => line.text)?.text || '';
  const oneLine = String(text).replace(/\s+/g,' ').trim();
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
  tip.innerHTML = `<strong>${esc(node.title)}</strong><div class="overview-meta">${esc(nodeType(node.type))} · ${esc(node.date)}</div>${summary?`<div>${esc(summary)}</div>`:''}`;
  document.body.append(tip);
  const rect = target.getBoundingClientRect();
  tip.style.left = Math.max(8,Math.min(rect.left,innerWidth-tip.offsetWidth-12))+'px';
  tip.style.top = (rect.bottom+tip.offsetHeight+14 < innerHeight ? rect.bottom+8 : rect.top-tip.offsetHeight-8)+'px';
}
function worldPoint(e){const r=$('#canvas').getBoundingClientRect();return {x:(e.clientX-r.left-state.view.x)/state.view.zoom,y:(e.clientY-r.top-state.view.y)/state.view.zoom};}
function zoomAt(factor,clientX,clientY){const c=$('#canvas'),r=c.getBoundingClientRect(),cx=(clientX??r.left+r.width/2)-r.left,cy=(clientY??r.top+r.height/2)-r.top,v=state.view,z=Math.min(1.8,Math.max(.2,v.zoom*factor));v.x=cx-(cx-v.x)*z/v.zoom;v.y=cy-(cy-v.y)*z/v.zoom;v.zoom=z;applyView();renderMinimap();}
function fitGraph(){const ns=state.p.nodes.filter(n=>n.sceneId===state.p.currentSceneId);if(!ns.length){state.view={x:70,y:80,zoom:1};applyView();return;}const c=$('#canvas'),minX=Math.min(...ns.map(n=>n.x))-60,minY=Math.min(...ns.map(n=>n.y))-60,maxX=Math.max(...ns.map(n=>n.x+300))+60,maxY=Math.max(...ns.map(n=>n.y+nodeHeight(n.id)))+60;const z=Math.max(.2,Math.min(1.05,c.clientWidth/(maxX-minX),c.clientHeight/(maxY-minY)));state.view={x:(c.clientWidth-(maxX-minX)*z)/2-minX*z,y:(c.clientHeight-(maxY-minY)*z)/2-minY*z,zoom:z};applyView();renderMinimap();}
function nodeHeight(id){return [...$$('.node')].find(el=>el.dataset.node===id)?.offsetHeight||240;}
const dateFields = [
  {key:'year', label:t('年'), width:4},
  {key:'month', label:t('月'), width:2},
  {key:'day', label:t('日'), width:2}
];

function normalizeStoryDate(text) {
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
  return `<label for="story-date-input">${t('故事时间')}</label>
    <div class="date-field">
      <input id="story-date-input" data-story-date="${esc(node.id)}" data-focus="story-date-${esc(node.id)}"
        value="${esc(node.date)}" placeholder="YYYY.MM.DD" autocomplete="off" spellcheck="false"
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
  $('#story-date-error').hidden = !!value;
  if (!value) {
    input.setAttribute('aria-invalid','true');
    return;
  }
  input.removeAttribute('aria-invalid');
  input.value = value;
  if (value===node.date) return;
  datePicker = null;
  await updateNodeFor(node.id,'date',value);
}

function renderInspector(){const n=selectedNode(),p=state.p;
 if(datePicker?.nodeId!==n?.id)datePicker=null;
 if(state.inspectorTab==='project')return html`<h2>${esc(p.title)}</h2><div class="hint">${p.scenes.length} 场景 · ${p.nodes.length} 节点 · ${p.characters.length} 角色</div><div class="modal-actions">${button('rename-project',t('项目设置'),'small')}${button('export',t('导出项目'),'small')}</div><div class="section-title">最近编辑记录</div>${(p.audit||[]).slice(-15).reverse().map(a=>`<div class="tool-card"><h3>${esc(a.source)} · r${a.revision}</h3><p>${esc(new Date(a.at).toLocaleString(state.language))}<br>${esc(a.description)}</p></div>`).join('')||staticHtml('<div class="hint">开始编辑后，会自动记录操作。</div>')}`;
 if(['characters','items'].includes(state.inspectorTab)){const isChar=state.inspectorTab==='characters',list=isChar?p.characters:p.items;return html`<div class="row between">${button(isChar?'new-character-direct':'new-item-direct',t('＋ 创建'),'small')}</div><div class="hint">双击卡片编辑；可从这里拖入画布节点或正文。</div>${list.map((c,i)=>`<div class="library-card ${state.focusedEntity===c.id?'search-located':''}" draggable="true" data-drag-kind="${isChar?'character':'item'}" data-drag-id="${c.id}" data-entity-kind="${isChar?'character':'item'}" data-entity-id="${c.id}" title="${esc(c.summary)}">${isChar?avatar(c,i):`<span class="avatar item">${icon('items',17)}</span>`}<div class="flex"><div class="name">${esc(c.name)}</div><div class="desc">${esc(c.summary||c.tags.join(' · '))}</div></div></div>`).join('')}`;}
 if(state.inspectorTab==='scene')return `<div class="stack">${p.scenes.map(s=>html`<div class="tool-card" data-drop-scene="${s.id}"><h3>${esc(s.name)}</h3><p>${esc(s.summary)}<br>${p.nodes.filter(n=>n.sceneId===s.id).length} 节点 · ${Object.keys(s.characters).length} 角色</p><button class="small ghost" data-scene="${s.id}">打开场景 →</button></div>`).join('')}</div>${button('new-scene',t('＋ 新建场景'),'small full')}${button('scene-info',t('编辑当前场景'),'small ghost full')}`;
 if(!n){const s=currentScene();return html`<div class="scene-intro"><h2>${esc(s.name)}</h2><p>${esc(s.summary||t('为这个场景写一段简介，让每个节点有迹可循。'))}</p></div><div class="stat-grid"><div class="stat"><strong>${p.nodes.filter(n=>n.sceneId===s.id).length.toString().padStart(2,'0')}</strong><span>剧情节点</span></div><div class="stat"><strong>${Object.keys(s.characters).length.toString().padStart(2,'0')}</strong><span>场景角色</span></div></div><div class="section-title">六种节点，一条故事脉络</div><div class="node-palette">${Object.entries(ST.TYPES).map(([type,name])=>`<button class="palette-item" data-create-type="${type}">${icon(type,15)}${t(name)}</button>`).join('')}</div><div class="section-title">当前场景角色 ${button('scene-characters',t('查看状态'),'small ghost')}</div><div class="peek-chars">${Object.keys(s.characters).map(id=>entityChip({kind:'character',id},'data-current="true"')).join('')||staticHtml('<span class="hint">拖入角色，建立此场景的独立角色快照</span>')}</div><div class="tool-card" style="margin-top:23px"><h3>${icon('event',12)} 让变化沿剧情发生</h3><p>事件记录待变化，条件决定是否发生。打开故事树，查看每一刻的角色状态。</p></div><div class="tool-card"><h3>${icon('mcp',12)} 和 AI 一起梳理故事</h3><p>本地 MCP 可读取、建立和修改剧情，编辑会同步显示在画布中。</p>${button('mcp',t('查看连接方式 →'),'ghost small')}</div>`;}
 const bind=(path,value,type='input',extra='')=>type==='textarea'?`<textarea data-node-path="${path}" data-focus="node-${n.id}-${path}" ${extra}>${esc(value)}</textarea>`:`<input data-node-path="${path}" data-focus="node-${n.id}-${path}" value="${esc(value)}" ${extra}>`;
 let h=html`${optionalTip('node-type', nodeType(n.type), 'inspector-type')}<label>节点名称</label>${bind('title',n.title)}<label>简介 / 创作笔记</label>${bind('summary',n.summary,'textarea',staticHtml('rows="2" placeholder="记录这个节点的目的…"'))}${renderStoryDate(n)}`;
 if(n.type==='dialogue'){h+=html`<div class="section-title">逐句对白 ${button('add-line',t('＋ 添加'),'small ghost')}</div><div class="hint">回车另起一句并弹出角色框；Tab 切换角色，Enter 确定；Shift+Enter 换行。</div>`;
 h+=n.lines.map((l,i)=>html`${state.rolePicker?.nodeId===n.id&&state.rolePicker.index===i?renderRolePicker():''}<div class="dialogue-row"><div class="row"><span class="line-number">${String(i+1).padStart(2,'0')}</span><select data-node-path="lines.${i}.characterId" data-focus="line-role-${i}" aria-label="第${i+1}句角色">${characterOptions(l.characterId)}</select><span class="flex"></span><button class="small ghost" data-remove-line="${i}" title="移除这句">×</button></div><textarea data-node-path="lines.${i}.text" data-line-index="${i}" data-focus="line-text-${i}" rows="2" placeholder="写下一句对白…">${esc(l.text)}</textarea></div>`).join('');}
 if(n.type==='monologue')h+=html`<div class="section-title">独白与长描述</div><label>唯一说话角色</label><select data-node-path="speakerId" data-focus="speakerId">${characterOptions(n.speakerId)}</select><label>正文</label>${bind('text',n.text,'textarea',staticHtml('rows="9" placeholder="写下角色的一段话，或描述眼前的事物…"'))}`;
 if(n.type==='event'){h+=html`<div class="section-title">事件设置</div><select data-node-path="eventType" data-focus="eventType">${options([...new Set(['战斗','交易','自定义',n.eventType])],n.eventType,eventTypeLabel)}</select>${n.eventType==='自定义'?button('custom-event-name',t('命名自定义事件…'),'small ghost'):''}<label>事件描述</label>${bind('text',n.text,'textarea',staticHtml('rows="3" placeholder="描述角色、物品和属性之间发生的事件…"'))}<div class="form-row" style="margin-top:12px">${['A','B'].map(f=>html`<div class="faction ${f==='B'?'b':''}" data-faction="${f}" data-faction-node="${n.id}"><h3>${f==='A'?t('阵营 A'):t('阵营 B')} · 拖入角色</h3>${n.factions[f].map(id=>entityChip({kind:'character',id},`data-in-node="${n.id}"`)).join('')||staticHtml('<span class="tiny muted">尚无成员</span>')}</div>`).join('')}</div>`;}
 if(n.type==='label')h+=html`<div class="section-title">标签批量操作</div><label>匹配对象</label><select data-node-path="labelQuery.entity" data-focus="label-entity"><option value="character" ${n.labelQuery.entity==='character'?'selected':''}>角色标签</option><option value="item" ${n.labelQuery.entity==='item'?'selected':''}>角色携带的物品标签</option></select><label>目标匹配标签（逗号分隔，必须全部匹配）</label><input data-label-tags value="${esc(n.labelQuery.tags.join(', '))}" data-focus="label-tags" placeholder="例如：旅人 或 类型:装备"><div class="hint">角色按自定义标签匹配；物品可按 A 组名称、类型:装备、品级:传说等及自定义标签匹配，批量修改携带物品。</div>`;
 if(['event','label'].includes(n.type))h+=html`<div class="section-title">待变化 <span class="pill">${n.operations.length} 项</span></div><div class="hint">双击节点里的角色可编辑待变化；在角色物品栏间拖放可记录转移。</div>${n.operations.map((o,i)=>html`<div class="op-card"><div class="row"><span class="flex">${esc(operationText(o))}</span><button data-remove-operation="${i}" title="移除此变化">×</button></div></div>`).join('')}${button('add-operation',t('＋ 添加变化'),'small full')}${n.type==='event'?button('event-board',t('打开事件角色面板 · 拖动物品'),'ghost small full'):''}`;
 if(n.type==='condition'){const c=n.condition;h+=html`<div class="section-title">条件判断</div><label>条件描述</label>${bind('condition.description',c.description,'textarea',staticHtml('rows="3" placeholder="例如：米拉卡在战斗前是否睡过了头？"'))}<label>判定方式</label><select data-node-path="condition.mode" data-focus="condition-mode">${options(['manual','rules'],c.mode).replace('>manual<',staticHtml('>手动判定<')).replace('>rules<',staticHtml('>结构化规则<'))}</select>${c.mode==='manual'?html`<label>当前剧情结果</label><select data-condition-value data-focus="condition-value"><option value="true" ${c.value?'selected':''}>真 · 走绿色分支</option><option value="false" ${!c.value?'selected':''}>假 · 走红色分支</option></select>`:button('edit-rules',message`编辑结构化规则 · ${c.rules.length} 条`,'full small')}
 <label>回溯的事件</label><select data-node-path="condition.sourceEventId" data-focus="source-event"><option value="">路径中最近的事件</option>${p.nodes.filter(x=>x.sceneId===n.sceneId&&['event','label'].includes(x.type)).map(x=>`<option value="${x.id}" ${x.id===c.sourceEventId?'selected':''}>${esc(x.title)}</option>`).join('')}</select><label>规则读取哪个时间点</label><select data-node-path="condition.evaluateAt" data-focus="condition-at"><option value="current" ${c.evaluateAt!=='beforeEvent'?'selected':''}>前序节点执行后</option><option value="beforeEvent" ${c.evaluateAt==='beforeEvent'?'selected':''}>回溯事件发生前</option></select><label>何时回溯</label><select data-node-path="condition.rollbackWhen" data-focus="rollback-when"><option value="false" ${c.rollbackWhen!=='true'?'selected':''}>条件为假（默认）</option><option value="true" ${c.rollbackWhen==='true'?'selected':''}>条件为真</option></select><label>回溯范围</label><select data-node-path="condition.rollback" data-focus="condition-rollback"><option value="all" ${c.rollback==='all'?'selected':''}>回溯该事件全部变化</option><option value="selected" ${c.rollback==='selected'?'selected':''}>豁免指定角色（只回溯其相关变化）</option><option value="none" ${c.rollback==='none'?'selected':''}>保留事件全部变化</option></select>${c.rollback==='selected'?html`<label>不发生变化的角色</label>${Object.keys(currentScene().characters).map(id=>`<label class="check-row"><input type="checkbox" data-exclude-character="${esc(id)}" ${c.excludedCharacters.includes(id)?'checked':''}>${esc(charName(id))}</label>`).join('')}`:''}<div class="hint">自然语言保留你的设想。请用手动结果或结构化规则确定真假；规则读取前序节点后的角色状态。</div>`;}
 if(n.type==='jump')h+=html`<div class="section-title">跨场景 / 跨时间跳转</div><select data-node-path="targetNodeId" data-focus="jump-target"><option value="">选择目标节点…</option>${p.scenes.map(s=>`<optgroup label="${esc(s.name)}">${p.nodes.filter(x=>x.sceneId===s.id&&x.id!==n.id).map(x=>`<option value="${esc(x.id)}" ${x.id===n.targetNodeId?'selected':''}>${esc(x.date+' · '+x.title)}</option>`).join('')}</optgroup>`).join('')}</select>${n.targetNodeId?button('go-jump',t('前往目标节点 →'),'small ghost full'):''}`;
 h+=html`<div class="section-title">参与素材 <span class="pill">${n.refs.length}</span></div><div class="peek-chars" data-inspector-drop="${n.id}">${n.refs.map(r=>entityChip(r,`data-in-node="${n.id}"`)+html`<button class="ghost small" data-remove-ref="${esc(r.kind+':'+r.id)}" title="移除引用">×</button>`).join('')||staticHtml('<div class="empty-drop full">将角色 / 物品拖进节点</div>')}</div><div class="section-title">输出点 ${['dialogue','monologue','event'].includes(n.type)?button('add-output','＋','small ghost'):''}</div>${n.outputs.map((o,i)=>html`<div class="output-row"><span class="dot" style="background:${n.type==='condition'?(i===0?'#7ec5b2':'#c08492'):'#a28cc7'}"></span><input data-node-path="outputs.${i}" data-focus="output-${i}" value="${esc(n.type==='condition'?t(o):o)}" ${n.type==='condition'?'readonly':''}><span class="muted">${p.edges.filter(e=>e.from===n.id&&e.output===i).length} 线</span>${n.outputs.length>1&&['dialogue','monologue','event'].includes(n.type)?`<button class="small ghost" data-remove-output="${i}">×</button>`:''}</div>`).join('')}
 <div class="divider"></div><div class="row">${button('transfer',t('移到场景…'),'small ghost')}${button('copy-transfer',t('复制到场景…'),'small ghost')}${button('delete-selected',icon('trash',13),'icon danger ghost',t('删除此节点'))}</div><div class="hint" style="margin-top:15px;font-family:Consolas;font-size:9px">ID: ${esc(n.id)}</div>`;return h;
}
function renderRolePicker(){const list=[{id:'',name:t('旁白')},...state.p.characters],r=state.rolePicker;return html`<div class="role-picker"><div class="hint">Tab 切换角色 · Enter 确定</div>${list.map((c,i)=>`<div class="role-option ${r.cursor===i?'active':''}" data-pick-role="${esc(c.id)}">${esc(c.name)} ${r.cursor===i?' ↵':''}</div>`).join('')}</div>`;}
function changeText(d){return `${charName(d.characterId)} · ${d.kind==='item'?itemName(d.key):d.kind==='itemAttribute'?itemName(d.itemId)+t('的')+d.key:d.key} ${d.before} → ${d.after}`;}
let timelineProject, timelineEntries;
function getTimelineEntries() {
  if (timelineProject !== state.p) {
    timelineEntries = ST.timeline(state.p);
    timelineProject = state.p;
  }
  return timelineEntries;
}

function storyForest(nodes, edges) {
  const entries = new Map(nodes.map(node => [node.id,node]));
  const links = new Map(nodes.map(node => [node.id,[]]));
  const incoming = new Set();
  for (const edge of edges) {
    const from = entries.get(edge.from), to = entries.get(edge.to);
    if (!from || !to || (from.type==='jump' && from.targetNodeId)) continue;
    links.get(from.id).push({
      node:to, order:edge.output,
      label:from.outputs.length>1 ? (from.type==='condition'?t(from.outputs[edge.output]):from.outputs[edge.output]) : ''
    });
    incoming.add(to.id);
  }
  for (const node of nodes) {
    if (node.type!=='jump' || !entries.has(node.targetNodeId)) continue;
    links.get(node.id).push({node:entries.get(node.targetNodeId), order:0, label:t('跳转')});
    incoming.add(node.targetNodeId);
  }
  for (const branches of links.values()) {
    branches.sort((a,b) => a.order-b.order || ST.dateKey(a.node.date)-ST.dateKey(b.node.date));
  }

  const connected = nodes.filter(node => incoming.has(node.id) || links.get(node.id).length);
  const starts = connected.filter(node => !incoming.has(node.id));
  const seen = new Set();
  const charts = [];
  // Display each node once. Extra incoming edges and cycles end at a clickable reference.
  for (const node of [...starts,...connected]) {
    if (seen.has(node.id)) continue;
    const root = {node, depth:0, children:[]};
    const chart = [root];
    seen.add(node.id);
    for (let i=0; i<chart.length; i++) {
      const parent = chart[i];
      if (parent.reference) continue;
      for (const link of links.get(parent.node.id)) {
        const child = {
          node:link.node, label:link.label, depth:parent.depth+1,
          parentId:parent.node.id, reference:seen.has(link.node.id), children:[]
        };
        seen.add(link.node.id);
        parent.children.push(child);
        chart.push(child);
      }
    }
    charts.push(chart);
  }
  return {charts, loose:nodes.filter(node => !seen.has(node.id))};
}

function renderStoryCard(node, branch = {}, placement = '') {
  const result = node.result;
  const summary = [
    node.title, [node.sceneName,nodeType(node.type),node.date].join(' · '),
    nodePreview(node),
    result?.error,
    ...((result?.changes || []).slice(0,4).map(changeText)),
    result?.rolledBack?.length ? t('已回溯事件变化') : ''
  ].filter(Boolean).join('\n');
  const selected = state.selected.has(node.id) ? 'selected' : '';
  return `<button type="button" class="story-card ${selected} ${branch.reference?'story-reference':''}"
    data-focus-node="${esc(node.id)}" data-tree-node="${esc(node.id)}"
    ${branch.parentId?`data-tree-parent="${esc(branch.parentId)}"`:''}
    ${branch.reference?'data-tree-reference':''} title="${esc(summary)}" ${placement}>
      <span class="story-card-title">${branch.reference?'↗ ':''}${esc(node.title)}</span>
      ${branch.hideDate?'':`<span class="story-card-date">${esc(node.date)}</span>`}
  </button>`;
}

function renderStoryChart(chart) {
  const scale = Math.max(1,state.uiFont/100);
  const width = Math.round(101*scale), height = Math.round(52*scale);
  const column = width+10, row = height+35;
  for (let i=chart.length-1; i>=0; i--) {
    const branch = chart[i];
    branch.columns = branch.children.reduce((sum,child) => sum+child.columns,0) || 1;
  }
  chart[0].start = 0;
  for (const branch of chart) {
    branch.center = column*(branch.start+branch.columns/2);
    branch.top = branch.depth*row;
    let start = branch.start;
    for (const child of branch.children) {
      child.start = start;
      start += child.columns;
    }
  }
  const chartWidth = chart[0].columns*column;
  const chartHeight = chart.at(-1).top+height;
  const paths = chart.flatMap(branch => {
    const children = branch.children;
    if (!children.length) return [];
    const split = branch.top+height+13;
    return [
      `M${branch.center} ${branch.top+height}V${split}`,
      `M${children[0].center} ${split}H${children.at(-1).center}`,
      ...children.map(child => `M${child.center} ${split}V${child.top}`)
    ];
  });
  const cards = chart.map(branch => {
    const left = branch.center-width/2;
    const style = `style="left:${left}px;top:${branch.top}px;width:${width}px;height:${height}px"`;
    const label = branch.label
      ? `<span class="story-branch-label" style="left:${branch.center}px;top:${branch.top-17}px">${esc(branch.label)}</span>`
      : '';
    return label+renderStoryCard(branch.node,branch,style);
  });
  return `<div class="story-chart" style="width:${chartWidth}px;height:${chartHeight}px">
    <svg class="story-connectors" width="${chartWidth}" height="${chartHeight}" aria-hidden="true"><path d="${paths.join(' ')}"/></svg>
    ${cards.join('')}
  </div>`;
}

function renderTreeContents(entries) {
  if (!entries.length) return staticHtml('<div class="hint">连接画布上的节点，故事树就会在这里生长。</div>');
  if (state.treeMode==='dates') {
    let date = '';
    return entries.map(node => {
      const heading = node.date===date ? '' : `<div class="tree-day">${esc(node.date)}</div>`;
      date = node.date;
      return heading+renderStoryCard(node,{hideDate:true});
    }).join('');
  }
  const {charts,loose} = storyForest(entries,state.p.edges);
  const singles = loose.length
    ? html`<div class="story-loose"><div class="section-label">未连接的节点</div><div class="story-loose-cards">${loose.map(node=>renderStoryCard(node)).join('')}</div></div>`
    : '';
  return `<div class="story-forest">${charts.map(renderStoryChart).join('')}</div>${singles}`;
}

function renderTree() {
  return html`<aside class="tree">
    <div class="panel-heading"><h3>${icon('tree',14)} 故事树</h3>${button('tree',icon('chevron',14),'icon ghost',t('收起故事树'))}</div>
    <div class="tree-toolbar">
      ${button('tree-branches',t('分支'),state.treeMode==='branches'?'small active':'small ghost')}
      ${button('tree-dates',t('按日期'),state.treeMode==='dates'?'small active':'small ghost')}
      ${optionalTip('tree-summary',t('悬停看摘要'),'muted tiny')}
    </div>
    <div class="tree-content ${state.treeMode==='dates'?'story-dates':''}">${renderTreeContents(getTimelineEntries())}</div>
  </aside>`;
}

const searchLabels = {project:t('项目'),scene:t('场景'),node:t('节点'),character:t('角色'),item:t('物品')};
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
      character.summary,character.details,character.tags,inventory,
      Object.keys(character.attributes),Object.keys(character.skills)
    ]);
  }
  for (const item of p.items) {
    add('item',item.id,item.name,t(item.category),[item.summary,item.details,t(item.type),t(item.grade),item.tags,Object.keys(item.attributes)]);
  }
  for (const node of getTimelineEntries()) {
    const meta = [node.sceneName || scenes.get(node.sceneId), nodeType(node.type), node.date].join(' · ');
    const refs = node.refs.map(ref => ref.kind==='character' ? charName(ref.id) : itemName(ref.id));
    add('node',node.id,node.title,meta,[
      node.summary,node.text,node.eventType,node.condition.description,
      node.lines.map(line => [charName(line.characterId),line.text]),refs,
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
    </div>
    <div id="project-search-results" class="project-search-results" role="listbox" aria-label="项目搜索结果" hidden></div>
  </div>`;
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
  } else {
    state.inspectorTab = {project:'project',character:'characters',item:'items'}[entry.kind];
    if (entry.kind!=='project') state.focusedEntity = entry.id;
    render();
    $('.inspector-content .search-located')?.scrollIntoView({block:'nearest'});
  }
  await saveDisplaySettings();
}
function updateNodeFor(id,path,value){return run(()=>{const n=nodeById(id);if(!n)return [];const copy=ST.clone(n),parts=path.split('.');let o=copy;for(const k of parts.slice(0,-1))o=o[k];o[parts.at(-1)]=value;return [{type:'node.update',args:{id:n.id,patch:{[parts[0]]:copy[parts[0]]}}}];});}
function updateNode(path,value){const n=selectedNode();if(!n)return;return updateNodeFor(n.id,path,value);}
const editTimers=new Map();
function scheduleEdit(el){const n=selectedNode();if(!n)return;const key=n.id+':'+el.dataset.nodePath,old=editTimers.get(key);clearTimeout(old?.timer);const task={id:n.id,path:el.dataset.nodePath,value:el.value};task.timer=setTimeout(()=>{editTimers.delete(key);updateNodeFor(task.id,task.path,task.value).catch(()=>{});},750);editTimers.set(key,task);}
function cancelEdit(el){const n=selectedNode();if(!n)return;const key=n.id+':'+el.dataset.nodePath;clearTimeout(editTimers.get(key)?.timer);editTimers.delete(key);}
window.flushEdits=async()=>{document.activeElement?.blur();for(const[key,task]of editTimers){clearTimeout(task.timer);editTimers.delete(key);updateNodeFor(task.id,task.path,task.value).catch(()=>{});}try{await state.queue;return state.saved;}catch{return false;}};
let pointer=null,spaceDown=false;
function bindCanvas(){const canvas=$('#canvas');canvas.addEventListener('wheel',e=>{if(e.target.closest('.entity-chip'))return;e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0012),e.clientX,e.clientY);},{passive:false});canvas.addEventListener('pointerdown',e=>{
 if(e.button===2)return;if(e.target.closest('button:not(.overview-node),.entity-chip,.canvas-overlay,.selection-toolbar,.minimap'))return;
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
 });canvas.addEventListener('pointerup',e=>{if(!pointer)return;const pt=pointer;pointer=null;try{canvas.releasePointerCapture(e.pointerId);}catch{}$('.selection-box')?.remove();if(pt.mode==='nodes'&&pt.moved){const commands=pt.initial.map(v=>{const n=nodeById(v.id),patch={x:n.x,y:n.y};n.x=v.x;n.y=v.y;return {type:'node.update',args:{id:v.id,patch}};});run(commands).catch(()=>{});}else render();});
 canvas.addEventListener('dblclick',e=>{if(e.target.closest('.entity-chip'))return;const edge=e.target.closest('[data-edge]');if(edge){cmd('edge.delete',{id:edge.dataset.edge},t('连线已移除，可用 Ctrl+Z 恢复')).catch(()=>{});return;}const n=e.target.closest('.node');if(n){state.selected=new Set([n.dataset.node]);render();setTimeout(()=>$('.inspector-content textarea')?.focus(),0);return;}if(e.target.closest('button,.minimap'))return;showPalette(e.clientX,e.clientY,worldPoint(e));});
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
 if(el)el.innerHTML=renderInspector();
 $$('[data-inspector-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.inspectorTab===state.inspectorTab));
}
function showPalette(x,y,point){$('.dropdown')?.remove();const el=document.createElement('div');el.className='dropdown';el.style.left=Math.min(x,innerWidth-200)+'px';el.style.top=Math.min(y,innerHeight-310)+'px';el.innerHTML=Object.entries(ST.TYPES).map(([type,name])=>`<button data-create-type="${type}">${icon(type,15)}${t(name)}</button>`).join('');el.dataset.worldX=point?.x??150;el.dataset.worldY=point?.y??150;document.body.append(el);}
async function createNode(type,x,y) {
  const canvas = $('#canvas'), bounds = canvas.getBoundingClientRect();
  const point = worldPoint({clientX:bounds.left+canvas.clientWidth*.3,clientY:bounds.top+canvas.clientHeight*.3});
  const data = {title:nodeType(type),x:Math.round(x??point.x),y:Math.round(y??point.y)};
  if (type!=='condition') data.outputs = [t('继续')];
  const result = await cmd('node.create',{type,sceneId:state.p.currentSceneId,data});
  state.selected = new Set([result.results[0].id]);
  render();
}
function addNodeOutput(id) {
  const node = nodeById(id);
  return cmd('node.addOutput',{id,label:t('分支')+' '+(node.outputs.length+1)});
}
document.addEventListener('dragstart',e=>{const el=e.target.closest('[data-drag-kind]');if(!el)return;const data={kind:el.dataset.dragKind,id:el.dataset.dragId,fromCharacterId:el.dataset.fromCharacter||'',nodeId:el.dataset.dragNode||'',qty:Number(el.dataset.qty)||1};e.dataTransfer.setData('application/x-storytree',JSON.stringify(data));e.dataTransfer.setData('text/plain',data.kind+':'+data.id);e.dataTransfer.effectAllowed='copyMove';});
document.addEventListener('dragover',e=>{if(!e.dataTransfer.types.includes('application/x-storytree'))return;if(e.target.closest('.node,[data-node-path],[data-faction],[data-inventory-drop],[data-inspector-drop],[data-drop-scene],.canvas')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('drop',async e=>{const raw=e.dataTransfer.getData('application/x-storytree');if(!raw)return;e.preventDefault();try{const d=JSON.parse(raw);await handleDrop(e,d);}catch(err){toast(err.message);}});
async function handleDrop(e,d){const inv=e.target.closest('[data-inventory-drop]');if(inv){await inventoryDrop(inv.dataset.inventoryDrop,d);return;}
 const text=e.target.closest('textarea[data-node-path]');if(text&&['character','item'].includes(d.kind)){const n=selectedNode(),obj=(d.kind==='character'?state.p.characters:state.p.items).find(x=>x.id===d.id),path=text.dataset.nodePath,parts=path.split('.'),copy=ST.clone(n);let target=copy;for(const k of parts.slice(0,-1))target=target[k];const pos=text.selectionStart??text.value.length;target[parts.at(-1)]=text.value.slice(0,pos)+'@'+obj.name+text.value.slice(pos);if(!copy.refs.some(r=>r.kind===d.kind&&r.id===d.id))copy.refs.push({kind:d.kind,id:d.id});await cmd('node.update',{id:n.id,patch:{[parts[0]]:copy[parts[0]],refs:copy.refs}},t('已将素材插入正文'));return;}
 const faction=e.target.closest('[data-faction]');if(faction&&d.kind==='character'){const n=nodeById(faction.dataset.factionNode),fs=ST.clone(n.factions),other=faction.dataset.faction==='A'?'B':'A';fs[other]=fs[other].filter(id=>id!==d.id);fs[faction.dataset.faction]=[...new Set([...fs[faction.dataset.faction],d.id])];const refs=[...n.refs];if(!refs.some(r=>r.kind==='character'&&r.id===d.id))refs.push({kind:'character',id:d.id});await cmd('node.update',{id:n.id,patch:{factions:fs,refs}});return;}
 const s=e.target.closest('[data-drop-scene]');if(s && ['character','group'].includes(d.kind)){const ids=d.kind==='group'?state.p.characters.filter(c=>c.groupId===d.id).map(c=>c.id):[d.id];await cmd('scene.addCharacters',{sceneId:s.dataset.dropScene,characterIds:ids,sourceSceneId:state.p.currentSceneId},t('已复制到场景，各场景的角色状态相互独立'));return;}
 const node=e.target.closest('[data-node]'),insp=e.target.closest('[data-inspector-drop]');if(node||insp){const n=nodeById(node?.dataset.node||insp.dataset.inspectorDrop);const refs=[...n.refs];const added=d.kind==='group'?state.p.characters.filter(c=>c.groupId===d.id).map(c=>({kind:'character',id:c.id})):[{kind:d.kind,id:d.id}];for(const r of added)if(!refs.some(x=>x.kind===r.kind&&x.id===r.id))refs.push(r);await cmd('node.update',{id:n.id,patch:{refs}},t('素材已加入节点'));return;}
 if(e.target.closest('.canvas')&&['character','group'].includes(d.kind)){const ids=d.kind==='group'?state.p.characters.filter(c=>c.groupId===d.id).map(c=>c.id):[d.id];await cmd('scene.addCharacters',{sceneId:state.p.currentSceneId,characterIds:ids},t('已加入当前场景'));}
}
document.addEventListener('click',async e=>{try{
 const tip = e.target.closest('[data-dismiss-tip]');
 if(tip){dismissedTips.add(tip.dataset.dismissTip);tip.remove();return;}
 const dateStep = e.target.closest('[data-date-step]');
 if(dateStep){changeDateWheel(dateStep.dataset.dateStep,Number(dateStep.dataset.direction));return;}
 const result = e.target.closest('[data-search-result]');
 if(result){await openSearchResult(searchMatches[Number(result.dataset.searchResult)]);return;}
 if(!e.target.closest('.project-search'))closeProjectSearch();
 const dropdown=e.target.closest('.dropdown'),create=e.target.closest('[data-create-type]');if(create){const point=dropdown?{x:Number(dropdown.dataset.worldX),y:Number(dropdown.dataset.worldY)}:{};dropdown?.remove();await createNode(create.dataset.createType,point.x,point.y);return;}
 if(!dropdown && !e.target.closest('[data-action="palette"]'))$('.dropdown')?.remove();
 const tab=e.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;render();return;}
 const inspectorTab=e.target.closest('[data-inspector-tab]');if(inspectorTab){state.inspectorTab=inspectorTab.dataset.inspectorTab;render();return;}
 const s=e.target.closest('[data-scene]');if(s){await switchScene(s.dataset.scene);return;}
 const output=e.target.closest('[data-port-out]');if(output){state.link={from:output.dataset.portOut,output:Number(output.dataset.output)};render();return;}
 const input=e.target.closest('[data-port-in]');if(input){if(state.link){const link=state.link;state.link=null;await cmd('edge.create',{...link,to:input.dataset.portIn},t('节点已连接'));}else toast(t('先点击来源节点右侧输出点，再点击这里'));return;}
 const plus=e.target.closest('[data-add-port]');if(plus){await addNodeOutput(plus.dataset.addPort);return;}
 const focus=e.target.closest('[data-focus-node]');if(focus){await focusNode(focus.dataset.focusNode);return;}
 const group=e.target.closest('[data-group]');if(group){openGroup(group.dataset.group);return;}
 const role=e.target.closest('[data-pick-role]');if(role){await chooseRole(role.dataset.pickRole);return;}
 const removeLine=e.target.closest('[data-remove-line]');if(removeLine){const n=selectedNode();const lines=n.lines.filter((_,i)=>i!==Number(removeLine.dataset.removeLine));await cmd('node.update',{id:n.id,patch:{lines:lines.length?lines:[{characterId:'',text:''}]}});return;}
 const removeOp=e.target.closest('[data-remove-operation]');if(removeOp){const n=selectedNode();await cmd('node.update',{id:n.id,patch:{operations:n.operations.filter((_,i)=>i!==Number(removeOp.dataset.removeOperation))}});return;}
 const removeRef=e.target.closest('[data-remove-ref]');if(removeRef){const n=selectedNode(),[kind,id]=removeRef.dataset.removeRef.split(':');await cmd('node.update',{id:n.id,patch:{refs:n.refs.filter(r=>r.kind!==kind||r.id!==id)}});return;}
 const removeOutput=e.target.closest('[data-remove-output]');if(removeOutput){const n=selectedNode(),i=Number(removeOutput.dataset.removeOutput);if(state.p.edges.some(e=>e.from===n.id&&e.output===i)){toast(t('请先双击移除此输出点上的连线'));return;}const commands=state.p.edges.filter(e=>e.from===n.id&&e.output>i).flatMap(e=>[{type:'edge.delete',args:{id:e.id}},{type:'edge.create',args:{from:e.from,to:e.to,output:e.output-1}}]);commands.unshift({type:'node.update',args:{id:n.id,patch:{outputs:n.outputs.filter((_,j)=>j!==i)}}});await run(commands);return;}
 const action=e.target.closest('[data-action]')?.dataset.action;if(action)await actionHandler(action,e);
 }catch(err){toast(err.message);}});
document.addEventListener('change',async e=>{try{
 const el=e.target;
 if(el.dataset.storyDate){await commitDateText(el);return;}
 if(el.dataset.nodePath){cancelEdit(el);await updateNode(el.dataset.nodePath,el.value);return;}
 if(el.dataset.displaySetting){
   updateDisplaySetting(el);
   render();
   if(el.dataset.displaySetting==='language')openSettings();
   await saveDisplaySettings();
   return;
 }
 if(el.hasAttribute('data-condition-value')){await updateNode('condition.value',el.value==='true');return;}
 if(el.hasAttribute('data-label-tags')){
   const tags = splitTags(el.value);
   const itemFilter = selectedNode()?.labelQuery.entity==='item';
   await updateNode('labelQuery.tags',itemFilter && state.language==='en' ? tags.map(normalizeItemFilterTag) : tags);
   return;
 }
 if(el.dataset.excludeCharacter){const n=selectedNode();await updateNode('condition.excludedCharacters',el.checked?[...new Set([...n.condition.excludedCharacters,el.dataset.excludeCharacter])]:n.condition.excludedCharacters.filter(id=>id!==el.dataset.excludeCharacter));return;}
 await modalChange(el);
 }catch(err){toast(err.message);}});
function handleInput(el) {
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
document.addEventListener('dblclick',async e=>{const entity=e.target.closest('[data-entity-id]');if(!entity)return;e.stopPropagation();const kind=entity.dataset.entityKind,id=entity.dataset.entityId;const nodeId=entity.dataset.inNode;try{if(kind==='character')openCharacter(id,nodeId?'pending':entity.dataset.current?'current':'library',nodeId);else openItem(id);}catch(err){toast(err.message);}});
document.addEventListener('keydown',async e=>{try{
 if(e.isComposing||e.keyCode===229||e.target===composingInput)return;
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
   $('#project-search')?.focus();
   $('#project-search')?.select();
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
 const editable=e.target.matches('input,textarea,select,[contenteditable]');if(e.key==='Escape'){state.link=null;state.rolePicker=null;$('.dropdown')?.remove();if(state.modal)closeModal();else render();return;}
 if(state.rolePicker && (e.key==='Tab'||e.key==='Enter')){e.preventDefault();if(e.key==='Tab'){const r=state.rolePicker;r.cursor=(r.cursor+(e.shiftKey?-1:1)+state.p.characters.length+1)%(state.p.characters.length+1);render();setTimeout(()=>$$('[data-line-index]').find(x=>Number(x.dataset.lineIndex)===r.index)?.focus(),0);}else{const c=[{id:''},...state.p.characters][state.rolePicker.cursor];await chooseRole(c.id);}return;}
 if(e.target.dataset.lineIndex!==undefined && e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();cancelEdit(e.target);await addDialogueLine(Number(e.target.dataset.lineIndex),e.target.value);return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();document.activeElement?.blur();await state.queue;toast(t('项目已自动保存在本机'));return;}
 if(!editable&&!state.modal && (e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();await history(e.shiftKey?'redo':'undo');return;}
 if(!editable&&!state.modal && e.key==='Delete' && state.selected.size){e.preventDefault();await cmd('node.delete',{ids:[...state.selected]},t('已删除，可用 Ctrl+Z 撤销'));return;}
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
async function history(action){await state.queue;const r=await api('history',{action,revision:state.p.revision});state.p=r.project;state.selected=new Set([...state.selected].filter(id=>nodeById(id)));render();toast(action==='undo'?t('已撤销'):t('已重做'));}
async function addDialogueLine(after,text){const n=selectedNode();const lines=ST.clone(n.lines);if(text!==undefined)lines[after].text=text;lines.splice(after+1,0,{characterId:lines[after]?.characterId||'',text:''});const id=n.id;await cmd('node.update',{id,patch:{lines}});state.rolePicker={nodeId:id,index:after+1,cursor:Math.max(0,[{id:''},...state.p.characters].findIndex(c=>c.id===lines[after+1].characterId))};render();setTimeout(()=>$$('[data-line-index]').find(x=>Number(x.dataset.lineIndex)===after+1)?.focus(),0);}
async function chooseRole(id){const r=state.rolePicker;if(!r)return;const n=nodeById(r.nodeId),lines=ST.clone(n.lines);lines[r.index].characterId=id;state.rolePicker=null;await cmd('node.update',{id:n.id,patch:{lines}});setTimeout(()=>$$('[data-line-index]').find(x=>Number(x.dataset.lineIndex)===r.index)?.focus(),0);}
async function switchScene(id) {
  const previous = currentScene();
  if (previous.id===id) return;
  await run([
    {type:'scene.update',args:{id:previous.id,view:state.view}},
    {type:'scene.activate',args:{id}}
  ]);
  state.selected.clear();
  state.view = ST.clone(currentScene().view);
  render();
}
async function focusNode(id) {
  const node = nodeById(id);
  if (!node) return;
  await switchScene(node.sceneId);
  state.selected = new Set([id]);
  state.inspectorTab = 'node';
  render();
  const canvas = $('#canvas');
  state.view = {zoom:.9,x:canvas.clientWidth/2-(node.x+150)*.9,y:canvas.clientHeight/2-(node.y+100)*.9};
  applyView();
  renderMinimap();
}

function centerStoryRoot() {
  const card = $('.story-chart .story-card');
  card?.scrollIntoView({block:'nearest',inline:'center'});
}

async function togglePanel(key) {
  const previousWidth = $('#canvas').clientWidth;
  state[key] = !state[key];
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
    <div class="settings-data">${button('open-data',t('打开数据与备份目录'),'small ghost')}</div>`,
    button('reset-display',t('恢复默认显示'),'ghost left')+button('modal-close',t('完成'),'primary'),'narrow');
}
async function actionHandler(action,e){const n=selectedNode();switch(action){
 case 'tree':await togglePanel('tree');break;
 case 'toggle-library':await togglePanel('libraryCollapsed');break;
 case 'toggle-inspector':await togglePanel('inspectorCollapsed');break;
 case 'tree-branches':
 case 'tree-dates':
   state.treeMode=action==='tree-dates'?'dates':'branches';
   render();
   $('.tree-content').scrollTop=0;
   if(state.treeMode==='branches')centerStoryRoot();
   await saveDisplaySettings();
   break;
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
 case 'rail-canvas':state.selected.clear();render();break;
 case 'rail-characters':case 'rail-items':case 'rail-scenes':
   state.tab=action.replace('rail-','');
   if(state.libraryCollapsed)await togglePanel('libraryCollapsed');
   else render();
   break;
 case 'palette':{const r=e.target.closest('button').getBoundingClientRect();showPalette(r.left,r.bottom+7);break;}
 case 'zoom-in':zoomAt(1.15);break;case 'zoom-out':zoomAt(1/1.15);break;case 'fit':fitGraph();break;
 case 'new-entity':if(state.tab==='characters')openCharacter();else if(state.tab==='items')openItem();else openSimple('new-scene',t('新建场景'),t('场景名称'),t('第二幕'));break;
 case 'new-scene':openSimple('new-scene',t('新建场景'),t('场景名称'),t('第二幕'));break;
 case 'rename-project':openSimple('rename-project',t('故事设置'),t('故事名称'),state.p.title);break;
 case 'new-group':openSimple('new-group',t('新建角色分组'),t('分组名称'),t('新分组'));break;
 case 'scene-info':openSceneInfo();break;
 case 'add-line':await addDialogueLine(n.lines.length-1);break;
 case 'add-output':await addNodeOutput(n.id);break;
 case 'toggle-date-wheels':
   if(n){datePicker=datePicker?.nodeId===n.id?null:{nodeId:n.id,draft:n.date};render();}
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
 case 'simulate':state.traceChoices={};openSimulation();break;
 case 'undo':case 'redo':await history(action);break;
 case 'export':{document.activeElement?.blur();await state.queue;if(window.desktop){const ok=await desktop.exportProject(JSON.stringify(state.p,null,2));if(ok)toast(t('项目已导出'));}else download(t('故事.storytree.json'),JSON.stringify(state.p,null,2));break;}
 case 'import':{if(window.desktop){const raw=await desktop.importProject();if(raw)openImport(JSON.parse(raw));}else {const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{openImport(JSON.parse(await input.files[0].text()));}catch(err){toast(err.message);}};input.click();}break;}
 case 'mcp':openMcp();break;case 'definitions':openDefinitions();break;
 default:await modalAction(action,e);
 }}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
async function init(){try{state.connection=window.desktop?await desktop.getConnection():{token:sessionStorage.getItem('storytree-token')||new URLSearchParams(location.hash.slice(1)).get('token')};if(!state.connection.token)throw Error(t('请从 StoryTree.exe 打开软件'));await loadDisplaySettings();await refresh(true);state.view=ST.clone(currentScene().view);render();if(state.tree&&state.treeMode==='branches')centerStoryRoot();setTimeout(fitGraph,100);setInterval(()=>{if(!state.modal&&!pointer&&state.saved&&!document.activeElement?.matches('input,textarea,select'))refresh();},1800);}catch(e){$('#app').innerHTML=html`<div class="loading"><div><h2>无法打开项目</h2><p class="error" style="margin-top:15px">${esc(localizeError(e.message))}</p></div></div>`;}}

function showModal(title,body,footer='',size=''){const root=$('#modal-root'),scroll=$('.modal-body')?.scrollTop||0,f=focusCapture();root.innerHTML=`<div class="modal-backdrop"><section class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><div><h2>${esc(title)}</h2></div>${button('modal-close',icon('close',17),'icon ghost',t('关闭窗口'))}</header><div class="modal-body">${body}</div><footer class="modal-footer">${footer||button('modal-close',t('关闭'))}</footer></section></div>`;$('.modal-body').scrollTop=scroll;focusRestore(f);}
function closeModal(){state.modal=null;$('#modal-root').innerHTML='';}
function openSimple(kind,title,label,value){state.modal={kind};showModal(title,`<label>${esc(label)}</label><input id="simple-value" value="${esc(value)}" data-focus="simple" autofocus>`,(kind==='rename-project'?button('new-project',t('新建空白故事'),'left ghost'):'')+button('modal-close',t('取消'))+button('simple-save',t('保存'),'primary'),'narrow');setTimeout(()=>$('#simple-value')?.focus(),0);}
function nodeRoute(n){const q={...state.p,currentSceneId:n.sceneId};let trace=ST.trace(q),h=trace.history.find(h=>h.nodeId===n.id);if(h)return {trace,h,defaultRoute:true};
 const nodes=state.p.nodes.filter(x=>x.sceneId===n.sceneId),roots=nodes.filter(x=>!state.p.edges.some(e=>e.to===x.id));const todo=roots.map(x=>({id:x.id,path:[],seen:[]}));let route;
 while(todo.length && todo.length<3000){const r=todo.shift();if(r.id===n.id){route=r;break;}if(r.seen.includes(r.id))continue;for(const e of state.p.edges.filter(e=>e.from===r.id))todo.push({id:e.to,path:[...r.path,e],seen:[...r.seen,r.id]});}
 if(route){const choices={};for(const e of route.path)choices[e.from]=e.id;trace=ST.trace(q,{startNodeId:route.path[0]?.from||n.id,choices});h=trace.history.find(h=>h.nodeId===n.id);}
 if(!h){trace=ST.trace(q,{startNodeId:n.id});h=trace.history[0];}
 return {trace,h,defaultRoute:false};
}
function nodeCharacters(nodeId){const n=nodeById(nodeId),r=nodeRoute(n),base=r.h?.before||ST.clone(ST.sceneOf(state.p,n.sceneId).characters);try{return ST.applyOperations(state.p,n.sceneId,base,n.operations).characters;}catch{return base;}}
function openCharacter(id,mode='library',nodeId){const p=state.p;let c=id?p.characters.find(c=>c.id===id):ST.character(p,{name:t('新角色')});if(!c)throw Error(t('角色不存在'));let note='';
 if(mode==='pending'){const n=nodeById(nodeId),r=nodeRoute(n),chars=nodeCharacters(nodeId);c=chars[id]||c;note=(r.defaultRoute?t('此卡片显示当前路径到达该节点后的待变化状态。'):t('此节点不在默认路径中，已选取一条可达路径预览。'))+t(' 角色资料仅预览；可记录技能、属性、物品和标签变化。');}
 if(mode==='current'){c=ST.present(p,p.currentSceneId).characters[id]||c;note=t('保存后立即叠加到所有已推演节点之后，并更新角色库。历史节点的快照会保留。');}
 state.modal={kind:'character',id,mode,nodeId,draft:ST.clone(c),original:ST.clone(c),note};renderCharacterModal();
}
function captureCharacter(){const m=state.modal;if(m?.kind!=='character')return;for(const el of $$('[data-character-field]'))m.draft[el.dataset.characterField]=el.value;if($('#character-tags'))m.draft.tags=splitTags($('#character-tags').value);}
function renderCharacterModal(){const m=state.modal,c=m.draft,mode=m.mode,p=state.p;
 const meters=(field,max)=>Object.keys(c[field]).map(k=>html`<div class="meter-row"><span class="meter-label" title="${esc(k)}">${esc(k)}</span><input type="range" min="0" max="${max}" step="1" value="${c[field][k]}" data-meter="${field}" data-key="${esc(k)}" aria-label="${esc(k)}滑块"><input type="number" min="0" max="${max}" value="${c[field][k]}" data-meter="${field}" data-key="${esc(k)}" aria-label="${esc(k)}数值"></div>`).join('');
 const inv=Object.entries(c.inventory).filter(([,q])=>q>0).map(([id,q])=>html`<div class="inventory-row" draggable="true" data-drag-kind="item" data-drag-id="${esc(id)}" data-from-character="${c.id}" data-qty="${q}" data-drag-node="${m.nodeId||''}">${icon('items',14)}<strong data-inventory-item-attrs="${esc(id)}" style="cursor:pointer" title="双击编辑携带物品的属性">${esc(itemName(id))}</strong><span class="qty" data-inventory-qty="${esc(id)}" title="双击修改数量">× ${q}</span><button class="ghost small" data-inventory-remove="${esc(id)}">×</button></div>`).join('');
 showModal(mode==='pending'?t('节点中的角色 · 待变化'):mode==='current'?t('角色当前状态 · 即时编辑'):m.id?t('编辑角色卡'):t('创建角色卡'),html`${mode!=='library'?`<div class="inline-note">${esc(m.note)}${mode==='pending'?staticHtml('<br>保存会写入节点的待变化记录；剧情推演及条件回溯会决定它是否发生。'):''}</div>`:''}<div class="modal-grid"><div><div class="profile-head">${avatar(c,0,true)}<div class="flex"><label style="margin-top:0">角色名称</label><input data-character-field="name" value="${esc(c.name)}" data-focus="char-name"><label>形象图片 · 最大 8MB</label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" id="character-image"></div></div><label>简介 · 悬停卡片时显示</label><textarea rows="2" data-character-field="summary" data-focus="char-summary" placeholder="用一句话介绍这个角色…">${esc(c.summary)}</textarea><label>详情</label><textarea rows="5" data-character-field="details" data-focus="char-details" placeholder="经历、动机、关系与秘密…">${esc(c.details)}</textarea><div class="form-row"><div><label>角色分组</label><select data-character-field="groupId" data-focus="char-group"><option value="">未分组</option>${p.groups.map(g=>`<option value="${g.id}" ${g.id===c.groupId?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div><div><label>标签 · 逗号分隔</label><input id="character-tags" value="${esc(c.tags.join(', '))}" data-focus="char-tags"></div></div><div class="section-title">物品栏 <span class="tiny muted">双击数量 / 名称可编辑</span></div>${m.itemEditor?html`<div class="tool-card"><div class="row between"><h3>${esc(itemName(m.itemEditor))} · 携带属性</h3><button class="ghost small" data-action="close-item-editor">×</button></div>${Object.entries(c.itemAttributes[m.itemEditor]).map(([k,v])=>`<div class="row" style="margin-top:8px"><span class="flex tiny">${esc(k)}</span><input type="number" class="number-inline" min="0" max="100" value="${v}" data-carried-attribute="${esc(k)}"></div>`).join('')}</div>`:''}<div data-inventory-drop="character-modal">${inv}<div class="empty-drop">将下方物品卡拖入此处，或选择物品后点 ＋</div></div><div class="row" style="margin-top:10px"><select id="inventory-add-item">${p.items.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>${button('inventory-add','＋','small')}</div><div class="peek-chars" style="margin-top:12px">${p.items.map(i=>entityChip({kind:'item',id:i.id},'data-modal-tray="true"')).join('')}</div></div><div><div class="section-title" style="margin-top:0;border:0;padding-top:0">技能栏 ${button('skills-zero',t('一键归 0'),'small ghost')}</div>${meters('skills',10)}<div class="skill-legend"><span>0 未习得</span><span>6 人类极限</span><span>7–10 超越人类</span></div><div class="row" style="margin-top:12px"><input id="new-skill-name" placeholder="新技能名称" data-focus="new-skill">${button('add-skill',t('添加'),'small')}</div><div class="section-title">属性栏 <span class="tiny muted">0–100 · 默认 20</span></div>${meters('attributes',100)}<div class="row" style="margin-top:12px"><input id="new-attribute-name" placeholder="新属性名称" data-focus="new-attr">${button('add-attribute',t('添加'),'small')}</div>${mode==='pending'?html`<div class="tool-card" style="margin-top:20px"><h3>物品转移</h3><p>使用事件角色面板，将物品从原主人拖给接收者，自动记录一增一减。</p></div>`:''}</div></div>`,`${mode==='library'&&m.id?button('open-current',t('编辑场景当前状态'),'left ghost small'):''}${button('modal-close',t('取消'))}${button('character-save',mode==='pending'?t('保存待变化'):t('保存角色卡'),'primary')}`,'wide');
 if(mode==='pending')for(const el of $$('[data-character-field],#character-image'))el.disabled=true;
}
async function saveCharacter(){captureCharacter();const m=state.modal,c=m.draft;ST.character(state.p,c);
 if(m.mode==='pending'){const n=nodeById(m.nodeId),base=m.original,diff=ST.diffCharacters({[c.id]:base},{[c.id]:c});const ops=diff.map(d=>({kind:d.kind,characterId:c.id,key:d.key,itemId:d.itemId||d.key,mode:'set',value:d.after}));
 for(const t of c.tags.filter(t=>!base.tags.includes(t)))ops.push({kind:'tag',characterId:c.id,key:t,mode:'add'});for(const t of base.tags.filter(t=>!c.tags.includes(t)))ops.push({kind:'tag',characterId:c.id,key:t,mode:'remove'});
 if(!['event','label','dialogue','monologue'].includes(n.type)){toast(t('条件和跳转节点只预览角色；请在事件、对话或独白中记录变化'));return;}
 await cmd('node.update',{id:n.id,patch:{operations:[...n.operations,...ops]}},t('待变化已记录'));
 }else if(m.mode==='current')await cmd('character.current',{sceneId:state.p.currentSceneId,characterId:c.id,patch:c},t('当前角色状态已保存'));
 else if(m.id)await cmd('character.update',{id:m.id,patch:c},t('角色卡已保存'));
 else await cmd('character.create',c,t('角色卡已创建'));closeModal();}
async function inventoryDrop(target,d){if(d.kind!=='item')return;const m=state.modal;
 if(target==='character-modal'&&m?.kind==='character'){captureCharacter();m.draft.inventory[d.id]=(m.draft.inventory[d.id]||0)+1;renderCharacterModal();return;}
 if(target.startsWith('board:')&&m?.kind==='event-board'){const to=target.slice(6);if(d.fromCharacterId && d.fromCharacterId!==to){const before=m.characters[d.fromCharacterId]?.inventory[d.id]||0;if(before<1)throw Error(t('原角色没有这件物品'));m.operations.push({kind:'transfer',characterId:d.fromCharacterId,toCharacterId:to,itemId:d.id,value:1});m.characters=ST.applyOperations(state.p,nodeById(m.nodeId).sceneId,m.characters,[m.operations.at(-1)]).characters;renderEventBoard();}else if(!d.fromCharacterId){m.operations.push({kind:'item',characterId:to,itemId:d.id,mode:'add',value:1});m.characters=ST.applyOperations(state.p,nodeById(m.nodeId).sceneId,m.characters,[m.operations.at(-1)]).characters;renderEventBoard();}return;}}
function openItem(id){const c=id?state.p.items.find(i=>i.id===id):ST.item({name:t('新物品')});state.modal={kind:'item',id,draft:ST.clone(c)};renderItemModal();}
function captureItem(){const m=state.modal;if(m?.kind!=='item')return;for(const el of $$('[data-item-field]'))m.draft[el.dataset.itemField]=el.value;m.draft.tags=splitTags($('#item-tags')?.value||'');for(const el of $$('[data-item-attribute]'))m.draft.attributes[el.dataset.itemAttribute]=Number(el.value);}
function renderItemModal(){const m=state.modal,i=m.draft;showModal(m.id?t('编辑物品卡'):t('创建物品卡'),html`<div class="modal-grid"><div><label style="margin-top:0">物品名称</label><input data-item-field="name" data-focus="item-name" value="${esc(i.name)}"><label>简介</label><textarea data-item-field="summary" data-focus="item-summary" rows="2">${esc(i.summary)}</textarea><label>详情</label><textarea data-item-field="details" data-focus="item-details" rows="5">${esc(i.details)}</textarea><label>自定义标签 · 逗号分隔</label><input id="item-tags" value="${esc(i.tags.join(', '))}" data-focus="item-tags"></div><div><label style="margin-top:0">A 组 · 必选一个</label><select data-item-field="category" data-focus="item-category">${options(ST.ITEM_A,i.category)}</select><label>B 组 · 可选一个</label><select data-item-field="type" data-focus="item-type">${options(['',...ST.ITEM_B],i.type)}</select><label>C 组 · 品级，需先选择 B 组</label><select data-item-field="grade" ${i.type?'':'disabled'} data-focus="item-grade">${options(['',...ST.ITEM_C],i.grade)}</select><div class="section-title">物品属性 <span class="tiny muted">0–100</span></div>${i.category==='特殊物品'?staticHtml('<div class="inline-note">特殊物品没有属性栏。</div>'):html`${Object.entries(i.attributes).map(([k,v])=>`<div class="row" style="margin:8px 0"><span class="flex smalltext">${esc(k)}</span><input class="number-inline" type="number" min="0" max="100" data-item-attribute="${esc(k)}" data-focus="item-attr-${esc(k)}" value="${v}"><button class="small ghost" data-item-remove-attr="${esc(k)}">×</button></div>`).join('')}<div class="row"><input id="new-item-attr" placeholder="新属性名称">${button('item-add-attr',t('添加'),'small')}</div>`}<div class="hint">同组标签互斥。物品进入角色物品栏后可堆叠，双击数量编辑。</div></div></div>`,button('modal-close',t('取消'))+button('item-save',t('保存物品卡'),'primary'),'');}
function openOperation(nodeId){const n=nodeById(nodeId),ids=Object.keys(ST.sceneOf(state.p,n.sceneId).characters);state.modal={kind:'operation',nodeId,draft:{kind:'attribute',characterId:ids[0]||'',toCharacterId:ids[1]||'',key:state.p.definitions.attributes[0]||'生命',itemId:state.p.items[0]?.id||'',mode:'set',value:20}};renderOperation();}
function captureOperation(){const m=state.modal;if(m?.kind!=='operation')return;for(const el of $$('[data-op-field]'))m.draft[el.dataset.opField]=el.dataset.opField==='value'?Number(el.value):el.value;}
function renderOperation(){const m=state.modal,o=m.draft,n=nodeById(m.nodeId),characters=ST.sceneOf(state.p,n.sceneId).characters;const opts=Object.values(characters).map(c=>`<option value="${c.id}" ${c.id===o.characterId?'selected':''}>${esc(c.name)}</option>`).join('');const fieldOptions=o.kind==='skill'?state.p.definitions.skills:state.p.definitions.attributes;
 showModal(t('记录一项待变化'),html`<div class="inline-note">操作属于「${esc(n.title)}」节点，条件为假时可回溯。</div><label>变化类型</label><select data-op-field="kind"><option value="attribute" ${o.kind==='attribute'?'selected':''}>修改属性（0–100）</option><option value="skill" ${o.kind==='skill'?'selected':''}>修改技能（0–10）</option><option value="item" ${o.kind==='item'?'selected':''}>给予 / 掉落物品</option><option value="itemAttribute" ${o.kind==='itemAttribute'?'selected':''}>修改携带物品的属性</option><option value="transfer" ${o.kind==='transfer'?'selected':''}>角色之间转移物品</option><option value="tag" ${o.kind==='tag'?'selected':''}>添加 / 移除角色标签</option></select><label>${n.type==='label'?t('预览角色（执行时按标签批量匹配）'):t('操作角色')}</label><select data-op-field="characterId">${opts}</select>${['attribute','skill','itemAttribute'].includes(o.kind)?html`<label>${o.kind==='skill'?t('技能'):t('属性')}名称</label><input data-op-field="key" list="op-key-list" value="${esc(o.key)}"><datalist id="op-key-list">${fieldOptions.map(k=>`<option value="${esc(k)}">`).join('')}</datalist>`:''}${['item','transfer','itemAttribute'].includes(o.kind)?html`<label>物品</label><select data-op-field="itemId">${state.p.items.map(i=>`<option value="${i.id}" ${o.itemId===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}</select>`:''}${o.kind==='transfer'?html`<label>接收角色</label><select data-op-field="toCharacterId">${Object.values(characters).map(c=>`<option value="${c.id}" ${c.id===o.toCharacterId?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:`<label>${o.kind==='tag'?t('标签名称'):t('修改方式')}</label>${o.kind==='tag'?`<input data-op-field="key" value="${esc(o.key)}"><select data-op-field="mode" style="margin-top:9px">${options(['add','remove'],o.mode).replace('>add<',staticHtml('>添加标签<')).replace('>remove<',staticHtml('>移除标签<'))}</select>`:html`<select data-op-field="mode"><option value="set" ${o.mode==='set'?'selected':''}>设为指定值</option><option value="add" ${o.mode==='add'?'selected':''}>增加 / 减少（负数表示减少）</option></select>`}`}${o.kind!=='tag'?`<label>${o.kind==='transfer'?t('转移数量'):t('数值')}</label><input type="number" data-op-field="value" value="${o.value}">`:''}<div class="hint">先将角色拖入节点 / 场景后再添加变化。转移操作会同步扣减原主人的物品。</div>`,button('modal-close',t('取消'))+button('operation-save',t('加入待变化'),'primary'),'narrow');}
function openEventBoard(nodeId){state.modal={kind:'event-board',nodeId,characters:nodeCharacters(nodeId),operations:[]};renderEventBoard();}
function renderEventBoard(){const m=state.modal,n=nodeById(m.nodeId),refs=n.refs.filter(r=>r.kind==='character').map(r=>r.id),all=Object.keys(m.characters),ids=[...new Set([...refs,...n.factions.A,...n.factions.B])];if(!ids.length)ids.push(...all);
 const card=id=>{const c=m.characters[id];if(!c)return '';return html`<div class="tool-card" data-inventory-drop="board:${id}" style="margin:0"><div class="row">${avatar(c)}<h3>${esc(c.name)}</h3></div><div class="hint">${Object.entries(c.attributes).map(([k,v])=>esc(k)+' '+v).join(' · ')}</div><div class="section-label">物品 · 拖给另一名角色</div>${Object.entries(c.inventory).filter(([,q])=>q>0).map(([itemId,q])=>`<div class="inventory-row" draggable="true" data-drag-kind="item" data-drag-id="${itemId}" data-from-character="${id}" data-qty="${q}" data-drag-node="${n.id}">${icon('items',13)}<strong>${esc(itemName(itemId))}</strong><span class="qty">× ${q}</span></div>`).join('')}<div class="empty-drop">拖入物品，表示此角色获得物品</div></div>`;};
 showModal(t('事件角色面板 · ')+n.title,html`<div class="inline-note">每次拖放转移 1 件物品，也可以在“添加变化”中指定数量。此处先预览，点击“保存待变化”才写入事件。</div><div class="row between" style="margin-bottom:16px"><span class="event-kind">${esc(eventTypeLabel(n.eventType))}</span><span class="smalltext muted">阵营 A：${esc(n.factions.A.map(charName).join('、')||t('未分配'))}　阵营 B：${esc(n.factions.B.map(charName).join('、')||t('未分配'))}</span></div><div style="display:grid;grid-template-columns:repeat(${Math.min(3,ids.length)||1},1fr);gap:13px">${ids.map(card).join('')}</div><div class="section-title">可给予的物品 · 拖入角色物品栏</div><div class="peek-chars">${state.p.items.map(i=>entityChip({kind:'item',id:i.id},'data-modal-tray="true"')).join('')}</div><div class="section-title">本次待保存变化 · ${m.operations.length} 项</div>${m.operations.map(o=>`<div class="op-card">${esc(operationText(o))}</div>`).join('')||staticHtml('<div class="hint">拖动物品后会在这里记录。</div>')}`,button('modal-close',t('取消'))+button('event-board-save',t('保存待变化'),'primary'),'wide');}
function openRules(nodeId){const n=nodeById(nodeId);state.modal={kind:'rules',nodeId,draft:ST.clone(n.condition)};renderRules();}
function captureRules(){const m=state.modal;if(m?.kind!=='rules')return;m.draft.logic=$('#rules-logic')?.value||m.draft.logic;for(const el of $$('[data-rule-field]')){const i=Number(el.dataset.ruleIndex);m.draft.rules[i][el.dataset.ruleField]=el.value;}}
function renderRules(){const m=state.modal,c=m.draft;showModal(t('结构化条件规则'),html`<div class="inline-note">规则读取事件执行后的角色状态。可使用属性、技能、物品数量或角色标签判断；规则结果决定走真 / 假分支。</div><label>组合方式</label><select id="rules-logic"><option value="all" ${c.logic==='all'?'selected':''}>满足全部规则（AND）</option><option value="any" ${c.logic==='any'?'selected':''}>满足任一规则（OR）</option></select><div style="margin-top:16px">${c.rules.map((r,i)=>`<div class="rule-row"><div class="row"><select data-rule-index="${i}" data-rule-field="characterId">${characterOptions(r.characterId,false)}</select><select data-rule-index="${i}" data-rule-field="kind">${['attribute','skill','item','tag'].map((v,j)=>`<option value="${v}" ${r.kind===v?'selected':''}>${[t('属性'),t('技能'),t('物品数量'),t('具有标签')][j]}</option>`).join('')}</select><button class="small ghost" data-rule-remove="${i}">×</button></div><div class="row">${r.kind==='item'?`<select data-rule-index="${i}" data-rule-field="key">${state.p.items.map(it=>`<option value="${it.id}" ${r.key===it.id?'selected':''}>${esc(it.name)}</option>`).join('')}</select>`:`<input data-rule-index="${i}" data-rule-field="key" value="${esc(r.key)}" placeholder="${r.kind==='tag'?t('标签名称'):t('名称')}">`}<select style="width:85px" data-rule-index="${i}" data-rule-field="op">${['eq','ne','gt','gte','lt','lte'].map((v,j)=>`<option value="${v}" ${r.op===v?'selected':''}>${['=','≠','>','≥','<','≤'][j]}</option>`).join('')}</select>${r.kind==='tag'?html`<select data-rule-index="${i}" data-rule-field="value"><option value="true" ${r.value==='true'?'selected':''}>具有</option><option value="false" ${r.value==='false'?'selected':''}>不具有</option></select>`:`<input type="number" data-rule-index="${i}" data-rule-field="value" value="${esc(r.value)}">`}</div></div>`).join('')}</div>${button('rule-add',t('＋ 添加规则'),'small full')}`,button('modal-close',t('取消'))+button('rules-save',t('保存规则'),'primary'),'');}
function openSceneInfo(){const s=currentScene();state.modal={kind:'scene-info',id:s.id};showModal(t('场景设置'),html`<label>场景名称</label><input id="scene-name" value="${esc(s.name)}"><label>场景简介</label><textarea id="scene-summary" rows="5">${esc(s.summary)}</textarea><div class="hint">每个场景都有空白画布和独立角色快照。复制节点时，会一并保留内部连线。</div>`,button('modal-close',t('取消'))+button('scene-save',t('保存场景'),'primary'),'narrow');}
function openTransfer(copy){state.modal={kind:'transfer',copy,ids:[...state.selected]};showModal(copy?t('复制节点到场景'):t('移动节点到场景'),html`<div class="inline-note">将${copy?t('复制'):t('移动')} ${state.selected.size} 个节点，保留选中节点之间的连线。${copy?'':t('与未选中节点的连线将断开。')}角色将复制为目标场景中的独立快照。</div><label>目标场景</label><select id="transfer-scene"><option value="new">＋ 新建一个场景</option>${state.p.scenes.filter(s=>s.id!==state.p.currentSceneId).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><label>新场景名称（选择新建时使用）</label><input id="transfer-scene-name" value="新场景">`,button('modal-close',t('取消'))+button('transfer-save',copy?t('复制'):t('移动'),'primary'),'narrow');}
function openSceneCharacters(){const s=currentScene(),r=ST.present(state.p,s.id);state.modal={kind:'scene-characters'};showModal(t('场景角色 · 当前状态'),html`<div class="inline-note">显示默认路径推演完毕、再叠加检查器即时编辑后的状态。${r.status==='choice'?t('当前存在未选分支，状态停在分叉处。'):''}</div>${r.error?`<p class="error">${esc(localizeError(r.error))}</p>`:''}<div class="stack">${Object.values(r.characters).map(c=>html`<div class="tool-card"><div class="row">${avatar(c)}<div class="flex"><h3>${esc(c.name)}</h3><p>${esc(Object.entries(c.attributes).map(([k,v])=>k+' '+v).join(' · '))}</p></div><button class="small" data-open-current="${c.id}">即时编辑</button></div><p style="margin-top:9px">${Object.entries(c.inventory).filter(([,q])=>q>0).map(([id,q])=>esc(itemName(id))+' × '+q).join(' · ')||t('暂无物品')}</p></div>`).join('')||staticHtml('<div class="hint">将角色拖进场景或节点即可创建独立快照。</div>')}</div>`,button('modal-close',t('关闭')),'');}
function openGroup(id){const g=state.p.groups.find(g=>g.id===id);state.modal={kind:'group',id};showModal(t('分组批量操作 · ')+g.name,html`<div class="group-members">${state.p.characters.filter(c=>c.groupId===id).map(c=>entityChip({kind:'character',id:c.id})).join('')||staticHtml('<span class="muted">此组还没有角色，在角色卡中选择分组。</span>')}</div><label>批量添加标签 · 逗号分隔</label><input id="group-tags" placeholder="例如：同伴, 第一幕登场"><div class="form-row"><div><label>修改技能 / 属性</label><select id="group-field"><option value="none">不修改数值</option>${state.p.definitions.skills.map(k=>html`<option value="skill:${esc(k)}">技能 · ${esc(k)}</option>`).join('')}${state.p.definitions.attributes.map(k=>html`<option value="attribute:${esc(k)}">属性 · ${esc(k)}</option>`).join('')}</select></div><div><label>设为数值</label><input id="group-value" type="number" value="0"></div></div><label>批量给予物品</label><div class="row"><select id="group-item"><option value="">不发放物品</option>${state.p.items.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select><input id="group-item-qty" class="number-inline" type="number" min="1" value="1"></div><label>将全组角色加入场景</label><select id="group-scene"><option value="">不加入场景</option>${state.p.scenes.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><div class="hint">批量数值、物品和标签更新角色库的当前设定。拖动分组标题可将全组加入节点。</div>`,button('modal-close',t('取消'))+button('group-save',t('应用到全组'),'primary'),'');}
function openDefinitions(){state.modal={kind:'definitions'};showModal(t('技能与属性设定'),html`<div class="inline-note">每行一个名称。新角色将使用这些默认栏位；已有角色保留自己的自定义栏位。</div><div class="modal-grid"><div><label>默认技能 · 0–10，默认 0</label><textarea id="definitions-skills" rows="10">${esc(state.p.definitions.skills.join('\n'))}</textarea><div class="hint">0：完全未习得<br>6：人类极限<br>7–10：人类能力范围之外</div></div><div><label>默认属性 · 0–100，默认 20</label><textarea id="definitions-attributes" rows="10">${esc(state.p.definitions.attributes.join('\n'))}</textarea></div></div>`,button('modal-close',t('取消'))+button('definitions-save',t('保存设定'),'primary'),'');}
function openSimulation(startNodeId){const start=startNodeId||state.modal?.startNodeId||undefined;const r=ST.trace(state.p,{startNodeId:start,choices:state.traceChoices,includeOverrides:false});state.modal={kind:'simulation',startNodeId:start,result:r};renderSimulation();}
function renderSimulation(){const m=state.modal,r=m.result;const roots=state.p.nodes.filter(n=>!state.p.edges.some(e=>e.to===n.id));
 showModal(t('剧情推演'),html`<div class="row"><label style="margin:0;white-space:nowrap">从哪里开始</label><select id="simulate-start"><option value="">当前场景的起点</option>${state.p.scenes.map(s=>`<optgroup label="${esc(s.name)}">${state.p.nodes.filter(n=>n.sceneId===s.id).map(n=>`<option value="${n.id}" ${n.id===m.startNodeId?'selected':''}>${esc(n.title)}</option>`).join('')}</optgroup>`).join('')}</select>${button('simulate-again',t('重新推演'),'small')}</div><div class="hint">推演只读取剧情，不修改角色库。你可以选择条件的真假，观察回溯前后的不同状态。</div><div class="divider"></div>${r.history.map((h,i)=>html`<div class="trace-step"><div class="row between"><h3>${String(i+1).padStart(2,'0')}　${esc(h.title)}</h3><span class="tiny muted">${esc(ST.sceneOf(state.p,h.sceneId).name+' · '+h.date)}</span></div>${h.changes.map(d=>`<div class="change">${esc(changeText(d))}</div>`).join('')}${h.rolledBack?.length?staticHtml('<p style="color:#c19bac">↶ 已按条件回溯事件；角色状态已恢复。</p>'):''}${h.type==='condition'?html`<div class="row" style="margin-top:10px"><span class="tiny muted">此处判定：</span><button data-trace-choice="${h.nodeId}" data-choice="0" class="small ${h.outcome?'active':''}">真</button><button data-trace-choice="${h.nodeId}" data-choice="1" class="small ${h.outcome===false?'active':''}">假</button></div>`:''}${h.error?`<p class="error">${esc(localizeError(h.error))}</p>`:''}<details class="smalltext" style="margin-top:9px"><summary class="muted">查看此刻角色状态</summary><div class="preview-states">${Object.values(h.after).map(c=>`<div class="tool-card"><h3>${esc(c.name)}</h3><p>${esc(Object.entries(c.attributes).map(([k,v])=>k+' '+v).join(' · '))}<br>${esc(Object.entries(c.skills).map(([k,v])=>k+' '+v).join(' · '))}<br>${esc(Object.entries(c.inventory).filter(([,q])=>q>0).map(([id,q])=>itemName(id)+' ×'+q).join(' · ')||t('暂无物品'))}</p></div>`).join('')}</div></details></div>`).join('')}${r.status==='choice'?html`<div class="trace-choices"><p class="smalltext">请选择接下来发生的分支：</p>${(()=>{const n=nodeById(r.history.at(-1).nodeId);return state.p.edges.filter(e=>e.from===n.id).map(e=>`<button data-trace-choice="${n.id}" data-choice="${e.id}" class="small" style="margin:8px 5px 0 0">${esc((n.type==='condition'?t(n.outputs[e.output]):n.outputs[e.output])+' → '+nodeById(e.to).title)}</button>`).join('');})()}</div>`:r.status==='cycle'?staticHtml('<p class="warning">遇到循环，已停止继续推演。循环不会被重复叠加到当前角色状态。</p>'):r.status==='limit'?staticHtml('<p class="warning">达到推演步数上限。</p>'):r.status==='error'?html`<p class="error">推演停止：${esc(localizeError(r.error))}</p>`:staticHtml('<div class="badge">本段剧情推演结束</div>')}`,button('modal-close',t('返回画布')),'wide');}
async function openMcp(){const config=window.desktop?await desktop.getMcpConfig():{json:{mcpServers:{storytree:{command:'D:\\storytree\\StoryTree.MCP.exe',args:[]}}},toml:"[mcp_servers.storytree]\ncommand = 'D:\\storytree\\StoryTree.MCP.exe'\nargs = []"};state.modal={kind:'mcp',config};showModal(t('连接你的 AI agent'),html`<div class="inline-note">本地 stdio MCP · ${24} 个工具 · 与画布共享同一份项目<br>AI 可创建角色、物品、场景与节点，连线、记录事件、推演条件及读取故事树。软件未打开时也可调用。</div><h3>Codex · config.toml</h3><pre class="code-block">${esc(config.toml)}</pre><h3 style="margin-top:18px">DeepSeek Harness / 通用 MCP · JSON</h3><pre class="code-block">${esc(JSON.stringify(config.json,null,2))}</pre><div class="hint">将配置加入 agent 的 MCP 配置后重启连接。数据保存在软件目录的 data 文件夹，自动保留最近 40 份备份。</div><div class="section-title">可直接对 AI 说</div><div class="tool-card"><p>“读取 StoryTree 当前故事，为米拉卡和渡鸦建立一场战斗，连接一个条件节点：如果米拉卡没赶上战斗，撤销她在战斗中的属性和物品变化。”</p></div><p class="hint">StoryTree.MCP.exe 是专用无窗口入口，无需另装 Node.js。MCP 资源 storytree://schema 说明节点、条件和变化的字段。所有 AI 编辑都会记录在本地项目的 audit 中，并可在软件中撤销。</p>`,button('mcp-copy',t('复制 JSON 配置'))+button('mcp-download',t('保存配置文件'))+button('modal-close',t('完成'),'primary'),'');}
function openImport(project){ST.validateProject(project);state.modal={kind:'import',project};showModal(t('打开故事项目'),html`<h2>${esc(project.title)}</h2><p class="smalltext muted" style="margin-top:12px">${project.scenes.length} 场景 · ${project.characters.length} 角色 · ${project.nodes.length} 节点</p><div class="inline-note" style="margin-top:18px">打开后将替换当前工作项目。当前版本会保留在自动备份中，也可以使用撤销恢复。</div>`,button('modal-close',t('取消'))+button('import-save',t('打开这个故事'),'primary'),'narrow');}
async function modalChange(el){const m=state.modal;if(!m)return;
 if(m.kind==='character'){captureCharacter();if(el.dataset.quantityEdit){const n=Number(el.value);if(!Number.isInteger(n)||n<0||n>999999)throw Error(t('请输入 0–999999 的整数'));m.draft.inventory[el.dataset.quantityEdit]=n;renderCharacterModal();}if(el.dataset.carriedAttribute){m.draft.itemAttributes[m.itemEditor][el.dataset.carriedAttribute]=Number(el.value);}if(el.id==='character-image'&&el.files[0]){const f=el.files[0];if(f.size>8e6)throw Error(t('请选择小于8MB的图片'));if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type))throw Error(t('图片格式不支持'));m.draft.image=await new Promise((r,j)=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=j;fr.readAsDataURL(f);});renderCharacterModal();}}
 if(m.kind==='item'){captureItem();if(el.dataset.itemField==='type'&&!m.draft.type)m.draft.grade='';if(el.dataset.itemField==='category'&&m.draft.category==='特殊物品')m.draft.attributes={};if(['category','type'].includes(el.dataset.itemField))renderItemModal();}
 if(m.kind==='operation'){captureOperation();if(el.dataset.opField==='kind'){const o=m.draft;if(o.kind==='skill')o.key=state.p.definitions.skills[0]||'观察';if(o.kind==='attribute')o.key=state.p.definitions.attributes[0]||'生命';if(o.kind==='tag'){o.key='';o.mode='add';}else{o.mode='set';o.value=o.kind==='skill'?0:o.kind==='attribute'?20:1;}renderOperation();}}
 if(m.kind==='rules'){captureRules();if(el.dataset.ruleField==='kind'){const r=m.draft.rules[Number(el.dataset.ruleIndex)];r.key=r.kind==='item'?state.p.items[0]?.id||'':r.kind==='skill'?state.p.definitions.skills[0]||'':r.kind==='tag'?'':state.p.definitions.attributes[0]||'';r.value=r.kind==='tag'?'true':0;renderRules();}}
}
document.addEventListener('dblclick',e=>{const attrs=e.target.closest('[data-inventory-item-attrs]');if(attrs&&state.modal?.kind==='character'){captureCharacter();const itemId=attrs.dataset.inventoryItemAttrs,def=state.p.items.find(i=>i.id===itemId);if(def.category==='特殊物品'){toast(t('特殊物品没有属性'));return;}if(!state.modal.draft.itemAttributes)state.modal.draft.itemAttributes={};if(!state.modal.draft.itemAttributes[itemId])state.modal.draft.itemAttributes[itemId]=ST.clone(def.attributes);state.modal.itemEditor=itemId;renderCharacterModal();return;}const el=e.target.closest('[data-inventory-qty]');if(el && state.modal?.kind==='character'){captureCharacter();const id=el.dataset.inventoryQty;el.innerHTML='<input type="number" min="0" max="999999" style="width:80px;padding:3px" data-quantity-edit="'+esc(id)+'" value="'+state.modal.draft.inventory[id]+'">';const input=el.querySelector('input');input.focus();input.select();}});
document.addEventListener('click',async e=>{try{const remove=e.target.closest('[data-inventory-remove]');if(remove&&state.modal?.kind==='character'){captureCharacter();state.modal.draft.inventory[remove.dataset.inventoryRemove]=0;renderCharacterModal();return;}const attr=e.target.closest('[data-item-remove-attr]');if(attr&&state.modal?.kind==='item'){captureItem();delete state.modal.draft.attributes[attr.dataset.itemRemoveAttr];renderItemModal();return;}const rule=e.target.closest('[data-rule-remove]');if(rule&&state.modal?.kind==='rules'){captureRules();state.modal.draft.rules.splice(Number(rule.dataset.ruleRemove),1);renderRules();return;}const cur=e.target.closest('[data-open-current]');if(cur){openCharacter(cur.dataset.openCurrent,'current');return;}const choice=e.target.closest('[data-trace-choice]');if(choice){state.traceChoices[choice.dataset.traceChoice]=/^\d+$/.test(choice.dataset.choice)?Number(choice.dataset.choice):choice.dataset.choice;openSimulation();}}catch(err){toast(err.message);}});
async function modalAction(action,e){const m=state.modal;if(!m)return;switch(action){
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
 case 'simple-save':{const value=$('#simple-value').value.trim();if(!value)throw Error(t('请输入名称'));if(m.kind==='new-scene'){const r=await cmd('scene.create',{name:value});state.selected.clear();state.view=ST.clone(currentScene().view);render();}if(m.kind==='new-group')await cmd('group.create',{name:value});if(m.kind==='rename-project')await cmd('project.rename',{title:value});if(m.kind==='custom-event')await cmd('node.update',{id:selectedNode().id,patch:{eventType:value}});closeModal();break;}
 case 'character-save':await saveCharacter();break;
 case 'close-item-editor':captureCharacter();m.itemEditor=null;renderCharacterModal();break;
 case 'skills-zero':captureCharacter();for(const k of Object.keys(m.draft.skills))m.draft.skills[k]=0;renderCharacterModal();break;
 case 'add-skill':case 'add-attribute':{captureCharacter();const field=action==='add-skill'?'skills':'attributes',key=$('#new-'+(action==='add-skill'?'skill':'attribute')+'-name').value.trim();if(!key)throw Error(t('请输入名称'));if(['__proto__','prototype','constructor'].includes(key))throw Error(t('名称无效'));m.draft[field][key]=action==='add-skill'?0:20;renderCharacterModal();break;}
 case 'inventory-add':captureCharacter();{const id=$('#inventory-add-item').value;if(!id)throw Error(t('请先创建物品卡'));m.draft.inventory[id]=(m.draft.inventory[id]||0)+1;renderCharacterModal();}break;
 case 'open-current':openCharacter(m.id,'current');break;
 case 'item-add-attr':{captureItem();const key=$('#new-item-attr').value.trim();if(!key)throw Error(t('请输入属性名称'));if(['__proto__','prototype','constructor'].includes(key))throw Error(t('名称无效'));m.draft.attributes[key]=20;renderItemModal();break;}
 case 'item-save':{captureItem();const i=ST.item(m.draft);if(m.id)await cmd('item.update',{id:m.id,patch:i});else await cmd('item.create',i);closeModal();toast(t('物品卡已保存'));break;}
 case 'operation-save':{captureOperation();const n=nodeById(m.nodeId),o=ST.clone(m.draft);const characters=nodeCharacters(m.nodeId);const ops=n.type==='label'?ST.labelOperations(state.p,{...n,operations:[o]},characters):[o];ST.applyOperations(state.p,n.sceneId,characters,ops);await cmd('node.update',{id:n.id,patch:{operations:[...n.operations,o]}});closeModal();toast(t('待变化已添加'));break;}
 case 'event-board-save':{const n=nodeById(m.nodeId);await cmd('node.update',{id:n.id,patch:{operations:[...n.operations,...m.operations]}});closeModal();toast(t('物品转移已记录为待变化'));break;}
 case 'rule-add':captureRules();m.draft.rules.push({characterId:state.p.characters[0]?.id||'',kind:'attribute',key:state.p.definitions.attributes[0]||'生命',op:'gte',value:20});renderRules();break;
 case 'rules-save':captureRules();m.draft.mode='rules';if(!m.draft.rules.length)throw Error(t('至少添加一条规则'));ST.conditionValue({condition:m.draft},ST.sceneOf(state.p,nodeById(m.nodeId).sceneId).characters);await cmd('node.update',{id:m.nodeId,patch:{condition:m.draft}});closeModal();break;
 case 'scene-save':await cmd('scene.update',{id:m.id,name:$('#scene-name').value,summary:$('#scene-summary').value});closeModal();break;
 case 'transfer-save':{let id=$('#transfer-scene').value;if(id==='new'){const r=await cmd('scene.create',{name:$('#transfer-scene-name').value||t('新场景')});id=r.results[0].id;}const r=await cmd('node.transfer',{ids:m.ids,sceneId:id,copy:m.copy});state.selected=new Set(r.results[0].ids);state.view={x:50,y:60,zoom:.8};closeModal();render();fitGraph();break;}
 case 'group-save':{const members=state.p.characters.filter(c=>c.groupId===m.id),tags=splitTags($('#group-tags').value),field=$('#group-field').value,value=Number($('#group-value').value),itemId=$('#group-item').value,qty=Number($('#group-item-qty').value),sceneId=$('#group-scene').value;const commands=[];
 for(const c of members){const patch={tags:[...new Set([...c.tags,...tags])]};if(field!=='none'){const[k,key]=field.split(':');patch[k==='skill'?'skills':'attributes']={...c[k==='skill'?'skills':'attributes'],[key]:value};}if(itemId)patch.inventory={...c.inventory,[itemId]:(c.inventory[itemId]||0)+qty};commands.push({type:'character.update',args:{id:c.id,patch}});}if(sceneId)commands.push({type:'scene.addCharacters',args:{sceneId,characterIds:members.map(c=>c.id)}});if(!commands.length)throw Error(t('这个分组还没有角色'));await run(commands);closeModal();toast(t('批量操作已保存'));break;}
 case 'definitions-save':{const parse=id=>$('#'+id).value.split('\n').map(s=>s.trim()).filter(Boolean);await cmd('definitions.update',{skills:parse('definitions-skills'),attributes:parse('definitions-attributes')});closeModal();break;}
 case 'simulate-again':state.traceChoices={};openSimulation($('#simulate-start').value||undefined);break;
 case 'mcp-copy':await navigator.clipboard.writeText(JSON.stringify(m.config.json,null,2));toast(t('MCP 配置已复制'));break;
 case 'mcp-download':download('storytree-mcp.json',JSON.stringify(m.config.json,null,2));break;
 case 'open-data':if(window.desktop)await desktop.openData();else toast(state.lastDirectory);break;
 case 'import-save':{const r=await api('import',{project:m.project,revision:state.p.revision});state.p=r.project;state.selected.clear();state.view=ST.clone(currentScene().view);closeModal();render();fitGraph();toast(t('故事已打开'));break;}
 }}
const english = {
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
  "StoryTree 1.0 · 所有更改自动保存": "StoryTree 1.0 · Autosaved",
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

init();
