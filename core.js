(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = {dialogue:'对话',monologue:'独白',condition:'条件',jump:'跳转',event:'事件',label:'标签'};
  const ITEM_A = ['副本物品','单机物品','特殊物品','任务物品'];
  const ITEM_B = ['装备','道具','材料','未知'];
  const ITEM_C = ['未知','普通','优质','稀世','异世','传说'];
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = p => p + '_' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const assert = (ok,msg) => {if (!ok) throw Error(msg);};
  const safeKey = k => {assert(typeof k === 'string' && k.length > 0 && k.length < 100 && !['__proto__','constructor','prototype'].includes(k),'字段名称无效');return k;};
  const num = (n,lo,hi) => {n=Number(n);assert(Number.isFinite(n) && n>=lo && n<=hi,`数值必须在 ${lo}–${hi} 之间`); return n;};
  const find = (p,list,id) => {const v=p[list].find(x=>x.id===id);assert(v,`找不到 ${list}: ${id}`);return v;};
  const sceneOf = (p,id) => find(p,'scenes',id || p.currentSceneId);
  function dateKey(s) { const a=String(s).split('.').map(Number);assert(a.length===3 && Number.isInteger(a[0]) && a[0]>=1 && a[0]<=9999 && a[1]>=1 && a[1]<=12 && a[2]>=1 && a[2]<=new Date(a[0],a[1],0).getDate(),'日期请使用有效的 年.月.日');return a[0]*10000+a[1]*100+a[2]; }
  const dateText = s => {dateKey(s);return s.split('.').map((x,i)=>i?String(Number(x)).padStart(2,'0'):String(Number(x)).padStart(4,'0')).join('.');};
  function character(p,data={}) {
    const c={id:data.id||uid('char'),name:data.name||'未命名角色',summary:'',details:'',image:'',tags:[],groupId:'',skills:{},attributes:{},inventory:{},itemAttributes:{},...clone(data)};
    for (const k of p.definitions.skills) if(c.skills[k]===undefined)c.skills[k]=0;
    for (const k of p.definitions.attributes) if(c.attributes[k]===undefined)c.attributes[k]=20;
    validateCharacter(p,c);return c;
  }
  function validateCharacter(p,c) {
    assert(typeof c.name==='string' && c.name.trim(),'角色需要名称');
    assert(Array.isArray(c.tags),'标签必须为数组');
    for (const [k,v] of Object.entries(c.skills)) {safeKey(k);num(v,0,10);}
    for (const [k,v] of Object.entries(c.attributes)) {safeKey(k);num(v,0,100);}
    for (const [k,v] of Object.entries(c.inventory)) {assert(p.items.some(i=>i.id===k),'物品不存在');assert(Number.isInteger(v),'物品数量必须为整数');num(v,0,999999);}
    for(const [id,attrs]of Object.entries(c.itemAttributes||{})){find(p,'items',id);for(const[k,v]of Object.entries(attrs)){safeKey(k);num(v,0,100);}}
    if(c.image)assert(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(c.image) && c.image.length<12e6,'图片必须为小于 8MB 的 PNG/JPEG/WebP/GIF');
  }
  function item(data={}) {
    const i={id:data.id||uid('item'),name:'未命名物品',summary:'',details:'',category:'单机物品',type:'',grade:'',tags:[],attributes:{耐久:20},...clone(data)};
    assert(i.name?.trim(),'物品需要名称');assert(ITEM_A.includes(i.category),'必须选择一个 A 组标签');assert(!i.type || ITEM_B.includes(i.type),'B 组标签无效');assert(!i.grade || (i.type && ITEM_C.includes(i.grade)),'品级需要先选择 B 组类型');
    if(i.category==='特殊物品')i.attributes={};
    for(const [k,v] of Object.entries(i.attributes)){safeKey(k);num(v,0,100);}
    return i;
  }
  function emptyProject(title='未命名故事') {
    const s={id:uid('scene'),name:'第一幕',summary:'',characters:{},overrides:[],view:{x:70,y:70,zoom:1}};
    return {version:1,id:uid('project'),title,revision:0,currentSceneId:s.id,definitions:{skills:['观察','交涉','战斗','学识'],attributes:['生命','体力','意志']},characters:[],items:[],groups:[],scenes:[s],nodes:[],edges:[],audit:[],createdAt:new Date().toISOString()};
  }
  function makeNode(p,type,sceneId,data={}) {
    assert(TYPES[type],'只有六种节点类型');const scene=sceneOf(p,sceneId);
    const last=p.nodes.filter(n=>n.sceneId===scene.id).at(-1);
    const n={id:uid('node'),sceneId:scene.id,type,title:TYPES[type],summary:'',date:last?.date||'0001.01.01',x:100,y:120,refs:[],lines:[{characterId:'',text:''}],speakerId:'',text:'',eventType:'自定义',factions:{A:[],B:[]},operations:[],condition:{mode:'manual',value:true,description:'',sourceEventId:'',rollback:'all',excludedCharacters:[],rules:[],logic:'all'},targetNodeId:'',labelQuery:{entity:'character',tags:[]},outputs:type==='condition'?['真','假']:['继续'],...clone(data)};
    n.type=type;n.sceneId=scene.id;n.date=dateText(n.date);return n;
  }
  function syncNodeCharacters(p,n) {
    const ids=[...n.lines.map(l=>l.characterId),n.speakerId,...(n.factions.A||[]),...(n.factions.B||[]),...n.operations.flatMap(o=>[o.characterId,o.toCharacterId]),...n.condition.rules.map(r=>r.characterId)].filter(Boolean);
    for(const id of ids){find(p,'characters',id);if(!n.refs.some(r=>r.kind==='character'&&r.id===id))n.refs.push({kind:'character',id});}
    for(const r of n.refs){assert(['character','item'].includes(r.kind),'素材类型无效');find(p,r.kind==='character'?'characters':'items',r.id);if(r.kind==='character')ensureSceneCharacter(p,n.sceneId,r.id);}
  }
  function ensureSceneCharacter(p,sceneId,id,sourceSceneId) {
    const s=sceneOf(p,sceneId);safeKey(id);
    if(!s.characters[id]) {
      const src=sourceSceneId?present(p,sourceSceneId).characters[id]:null;
      s.characters[id]=clone(src||find(p,'characters',id));
    }
    return s.characters[id];
  }
  function tagMatches(tags,query) {return query.every(t=>tags.includes(t));}
  function selectedTargets(p,scene,state,op) {
    if(op.targetTag)return Object.values(state).filter(c=>tagMatches(c.tags,op.targetTag.split(',').map(x=>x.trim()).filter(Boolean))).map(c=>c.id);
    assert(op.characterId && state[op.characterId],'操作角色尚未加入场景');return [op.characterId];
  }
  function applyOperations(p,sceneId,state,ops,excluded=[]) {
    const next=clone(state), log=[];
    const scene=sceneOf(p,sceneId);
    for(const op of ops) {
      const targets=selectedTargets(p,scene,next,op);
      for(const id of targets) {
        if(excluded.includes(id))continue;
        const c=next[id];
        if(op.kind==='attribute'||op.kind==='skill') {
          const field=op.kind==='attribute'?'attributes':'skills';safeKey(op.key);
          const before=c[field][op.key]??(field==='skills'?0:20), max=field==='skills'?10:100;
          const val=op.mode==='add'?before+Number(op.value):Number(op.value);
          c[field][op.key]=num(val,0,max);log.push({characterId:id,kind:op.kind,key:op.key,before,after:val});
        } else if(op.kind==='itemAttribute') {
          const item=find(p,'items',op.itemId);assert(item.category!=='特殊物品','特殊物品没有属性');assert(c.inventory[op.itemId]>0,'角色未携带此物品');safeKey(op.key);
          if(!c.itemAttributes)c.itemAttributes={};if(!c.itemAttributes[op.itemId])c.itemAttributes[op.itemId]=clone(item.attributes);
          const before=c.itemAttributes[op.itemId][op.key]??20,after=num(op.mode==='add'?before+Number(op.value):Number(op.value),0,100);
          c.itemAttributes[op.itemId][op.key]=after;log.push({characterId:id,kind:'itemAttribute',itemId:op.itemId,key:op.key,before,after});
        } else if(op.kind==='item') {
          find(p,'items',op.itemId);const before=c.inventory[op.itemId]||0;
          const qty=op.mode==='set'?Number(op.value):before+Number(op.value);
          assert(Number.isInteger(qty),'物品数量必须为整数');num(qty,0,999999);c.inventory[op.itemId]=qty;
          log.push({characterId:id,kind:'item',key:op.itemId,before,after:qty});
        } else if(op.kind==='transfer') {
          find(p,'items',op.itemId);assert(next[op.toCharacterId] && id!==op.toCharacterId,'接收角色无效');
          if(excluded.includes(op.toCharacterId))continue;
          const qty=Number(op.value);assert(Number.isInteger(qty)&&qty>0,'转移数量必须为正整数');
          const before=c.inventory[op.itemId]||0;assert(before>=qty,`${c.name} 的物品数量不足`);
          const to=next[op.toCharacterId], b=to.inventory[op.itemId]||0;num(b+qty,0,999999);
          c.inventory[op.itemId]=before-qty;to.inventory[op.itemId]=b+qty;
          if(b===0 && c.itemAttributes?.[op.itemId]){if(!to.itemAttributes)to.itemAttributes={};to.itemAttributes[op.itemId]=clone(c.itemAttributes[op.itemId]);}
          log.push({characterId:id,kind:'item',key:op.itemId,before,after:before-qty},{characterId:to.id,kind:'item',key:op.itemId,before:b,after:b+qty});
        } else if(op.kind==='tag') {
          assert(op.key?.trim(),'请输入标签');const before=c.tags.join(',');c.tags=op.mode==='remove'?c.tags.filter(t=>t!==op.key):[...new Set([...c.tags,op.key])];
          log.push({characterId:id,kind:'tag',key:op.key,before,after:c.tags.join(',')});
        } else throw Error('未知变化类型');
      }
    }
    return {characters:next,changes:log};
  }
  function conditionValue(node,characters) {
    const c=node.condition;
    if(c.mode==='manual')return !!c.value;
    const results=c.rules.map(r=>{
      const char=characters[r.characterId];assert(char,'条件引用的角色尚未入场');
      let a=r.kind==='tag'?char.tags.includes(r.key):r.kind==='item'?(char.inventory[r.key]||0):(char[r.kind==='skill'?'skills':'attributes'][r.key]??0);
      const b=r.kind==='tag'?r.value==='true'||r.value===true:Number(r.value);
      return r.op==='eq'?a===b:r.op==='ne'?a!==b:r.op==='gt'?a>b:r.op==='gte'?a>=b:r.op==='lt'?a<b:a<=b;
    });
    assert(results.length,'结构化条件至少需要一条规则');return c.logic==='any'?results.some(Boolean):results.every(Boolean);
  }
  function labelOperations(p,n,state) {
    assert(n.labelQuery.tags.length,'标签节点至少需要一个目标标签');
    if(n.labelQuery.entity!=='item')return n.operations.map(o=>({...o,targetTag:n.labelQuery.tags.join(',')}));
    const matching=p.items.filter(i=>tagMatches([...i.tags,i.category,...(i.type?['类型:'+i.type]:[]),...(i.grade?['品级:'+i.grade]:[])],n.labelQuery.tags));
    const ops=[];for(const i of matching)for(const c of Object.values(state))if(c.inventory[i.id]>0)for(const o of n.operations) {
      assert(['item','itemAttribute','transfer'].includes(o.kind),'物品标签只支持物品数量、属性及转移操作');
      ops.push({...o,characterId:c.id,itemId:i.id,targetTag:''});
    }return ops;
  }
  function outgoing(p,n,choice) {
    if(n.type==='jump' && n.targetNodeId)return [find(p,'nodes',n.targetNodeId)];
    return p.edges.filter(e=>e.from===n.id && (choice===undefined || (typeof choice==='string'?(e.id===choice||e.to===choice):e.output===choice))).map(e=>find(p,'nodes',e.to));
  }
  // A trace is one explicit route, never a merge of mutually exclusive branches.
  function trace(p,{startNodeId,choices={},maxSteps=500,includeOverrides=false}={}) {
    maxSteps=num(maxSteps,1,2000);
    const perScene={}, history=[],checkpoints={},visits={};let n=startNodeId?find(p,'nodes',startNodeId):null;
    if(!n){const ns=p.nodes.filter(x=>x.sceneId===p.currentSceneId);n=ns.find(x=>!p.edges.some(e=>e.to===x.id))||ns[0];}
    let pending=[],status='end',error='';
    while(n && history.length<maxSteps) {
      if((visits[n.id]=(visits[n.id]||0)+1)>1){status='cycle';break;}
      if(!perScene[n.sceneId])perScene[n.sceneId]=clone(sceneOf(p,n.sceneId).characters);
      const before=clone(perScene[n.sceneId]);let changes=[],outcome,rolledBack=[];
      try {
        if(n.type==='event'||n.type==='label'||(['dialogue','monologue'].includes(n.type)&&n.operations.length)) {
          checkpoints[n.id]={sceneId:n.sceneId,before:clone(before),operations:clone(n.operations)};
          const ops=n.type==='label'?labelOperations(p,n,before):n.operations;
          checkpoints[n.id].operations=ops;
          const r=applyOperations(p,n.sceneId,before,ops);perScene[n.sceneId]=r.characters;changes=r.changes;
          if(n.type==='event'||n.type==='label')pending.push(n.id);
        }
        if(n.type==='condition') {
          const source=n.condition.sourceEventId || pending.filter(id=>checkpoints[id].sceneId===n.sceneId).at(-1);
          const evaluation=n.condition.evaluateAt==='beforeEvent' && checkpoints[source]?checkpoints[source].before:before;
          const chosenEdge=typeof choices[n.id]==='string'?p.edges.find(e=>e.from===n.id&&(e.id===choices[n.id]||e.to===choices[n.id])):null;
          outcome=choices[n.id]===undefined?conditionValue(n,evaluation):chosenEdge?chosenEdge.output===0:choices[n.id]===0;
          const rollback=n.condition.rollbackWhen==='true'?outcome:!outcome;
          if(source && rollback && n.condition.rollback!=='none') {
            const checkpoint=checkpoints[source];assert(checkpoint && checkpoint.sceneId===n.sceneId,'回溯事件必须已经在当前路径中经过');
            const idx=history.findIndex(h=>h.nodeId===source);assert(idx>=0,'回溯事件不在当前路径');
            let state=clone(checkpoint.before);
            const excluded=n.condition.rollback==='selected'?n.condition.excludedCharacters:[];
            for(const h of history.slice(idx)) {
              if(h.sceneId!==n.sceneId)continue;
              const oldNode=find(p,'nodes',h.nodeId);
              if(oldNode.type==='condition' && h.rolledBack?.length)throw Error('嵌套回溯请紧接相应事件设置条件');
              if(checkpoints[h.nodeId]) {
                if(h.nodeId===source && n.condition.rollback==='all')continue;
                const omit=h.nodeId===source?excluded:[];
                state=applyOperations(p,n.sceneId,state,checkpoints[h.nodeId].operations,omit).characters;
              }
            }
            perScene[n.sceneId]=state;rolledBack=[source];
            changes=diffCharacters(before,state);pending=pending.filter(id=>id!==source);
          }
        }
      }catch(e){error=e.message;status='error';history.push({nodeId:n.id,sceneId:n.sceneId,title:n.title,date:n.date,type:n.type,before,after:clone(before),changes:[],error});break;}
      history.push({nodeId:n.id,sceneId:n.sceneId,title:n.title,date:n.date,type:n.type,before,after:clone(perScene[n.sceneId]),changes,outcome,rolledBack});
      const output=typeof choices[n.id]==='string'?choices[n.id]:n.type==='condition'?(outcome?0:1):choices[n.id];
      const next=outgoing(p,n,output);
      if(next.length>1){status='choice';pending=next.map(x=>x.id);break;}
      n=next[0];
    }
    if(history.length>=maxSteps && n)status='limit';
    if(includeOverrides)for(const [sid,state]of Object.entries(perScene))perScene[sid]=applyOperations(p,sid,state,sceneOf(p,sid).overrides).characters;
    return {history,states:perScene,status,error,nextNodeIds:status==='choice'?pending:[]};
  }
  function diffCharacters(a,b) {
    const changes=[];
    for(const [id,c]of Object.entries(b))for(const kind of ['attributes','skills','inventory'])for(const k of new Set([...Object.keys(a[id]?.[kind]||{}),...Object.keys(c[kind])])) {
      const before=a[id]?.[kind]?.[k]??0,after=c[kind][k]??0;
      if(before!==after)changes.push({characterId:id,kind:kind==='attributes'?'attribute':kind==='skills'?'skill':'item',key:k,before,after});
    }
    for(const[id,c]of Object.entries(b))for(const[itemId,attrs]of Object.entries(c.itemAttributes||{}))for(const[k,after]of Object.entries(attrs)){const before=a[id]?.itemAttributes?.[itemId]?.[k];if(before!==after)changes.push({characterId:id,kind:'itemAttribute',itemId,key:k,before:before??20,after});}
    return changes;
  }
  function present(p,sceneId) {
    const s=sceneOf(p,sceneId),q={...p,currentSceneId:s.id},r=trace(q,{includeOverrides:false});
    const base=r.states[s.id]||clone(s.characters);
    try{const characters=applyOperations(p,s.id,base,s.overrides).characters;for(const[id,metadata]of Object.entries(s.currentMetadata||{}))if(characters[id])Object.assign(characters[id],clone(metadata));return {...r,characters};}
    catch(e){return {...r,characters:base,error:e.message,status:'error'};}
  }
  function timeline(p) {
    const cache={};return [...p.nodes].sort((a,b)=>dateKey(a.date)-dateKey(b.date)||p.nodes.indexOf(a)-p.nodes.indexOf(b)).map(n=>{
      if(!cache[n.sceneId]) {const q={...p,currentSceneId:n.sceneId};cache[n.sceneId]=trace(q);}
      const h=cache[n.sceneId].history.find(h=>h.nodeId===n.id);
      return {...n,result:h||null,sceneName:sceneOf(p,n.sceneId).name,links:outgoing(p,n).map(x=>x.id)};
    });
  }
  function displaySettings(input = {}) {
    const value = input || {};
    const number = (key, fallback, min, max) => Number.isFinite(value[key])
      ? Math.round(Math.min(max, Math.max(min, value[key])))
      : fallback;
    return {
      language: value.language === 'en' ? 'en' : 'zh-CN',
      fontFamily: ['sans','serif','kai','mono'].includes(value.fontFamily) ? value.fontFamily : 'default',
      uiFont: number('uiFont', 100, 85, 140),
      nodeFont: number('nodeFont', 100, 85, 175),
      overviewAt: [0, 35, 45, 55, 65].includes(value.overviewAt) ? value.overviewAt : 45,
      libraryCollapsed: value.libraryCollapsed === true,
      inspectorCollapsed: value.inspectorCollapsed === true,
      tree: value.tree === true,
      treeMode: value.treeMode === 'dates' ? 'dates' : 'branches'
    };
  }
  function validateProject(p) {
    assert(p.version===1 && Array.isArray(p.scenes)&&p.scenes.length,'不是有效的 StoryTree 1 项目');
    for(const k of ['characters','items','nodes','edges','groups'])assert(Array.isArray(p[k]),`项目缺少 ${k}`);
    for(const list of ['characters','items','nodes','edges','scenes','groups']) {const ids=p[list].map(x=>x.id);assert(new Set(ids).size===ids.length,'ID 重复');ids.forEach(safeKey);}
    sceneOf(p,p.currentSceneId);
    for(const c of p.characters)validateCharacter(p,c);
    for(const i of p.items)item(i);
    for(const s of p.scenes){assert(s.characters && Array.isArray(s.overrides),'场景快照无效');for(const c of Object.values(s.characters))validateCharacter(p,c);}
    for(const n of p.nodes){assert(TYPES[n.type],'节点类型无效');sceneOf(p,n.sceneId);dateKey(n.date);assert(Number.isFinite(n.x)&&Number.isFinite(n.y),'节点坐标无效');assert(Array.isArray(n.outputs)&&n.outputs.length>=1 && n.outputs.length<=100,'输出点必须为1–100个');assert(Array.isArray(n.refs)&&Array.isArray(n.operations),'节点数据无效');if(n.type==='condition')assert(n.outputs.length===2,'条件节点只有真假两个输出');if(['jump','label'].includes(n.type))assert(n.outputs.length===1,'跳转/标签节点只有一个输出');if(n.targetNodeId)find(p,'nodes',n.targetNodeId);}
    for(const e of p.edges){const a=find(p,'nodes',e.from),b=find(p,'nodes',e.to);assert(a.sceneId===b.sceneId,'跨场景请使用跳转节点');assert(Number.isInteger(e.output)&&e.output>=0&&e.output<a.outputs.length,'输出点无效');}
    return p;
  }
  function command(p,cmd) {
    const a=cmd.args||{};let result={};
    switch(cmd.type) {
      case 'project.rename':assert(a.title?.trim(),'故事需要标题');p.title=a.title;break;
      case 'scene.create': {const s={id:uid('scene'),name:a.name||'新场景',summary:a.summary||'',characters:{},overrides:[],view:{x:70,y:70,zoom:1}};p.scenes.push(s);p.currentSceneId=s.id;result=s;break;}
      case 'scene.update': {const s=sceneOf(p,a.id);for(const k of ['name','summary','view'])if(a[k]!==undefined)s[k]=clone(a[k]);break;}
      case 'scene.activate':sceneOf(p,a.id);p.currentSceneId=a.id;break;
      case 'scene.addCharacters': {for(const id of a.characterIds)ensureSceneCharacter(p,a.sceneId,id,a.sourceSceneId);break;}
      case 'character.create': {const c=character(p,a);p.characters.push(c);result=c;break;}
      case 'character.update': {const c=find(p,'characters',a.id);Object.assign(c,clone(a.patch));c.id=a.id;validateCharacter(p,c);break;}
      case 'character.current': {const s=sceneOf(p,a.sceneId);ensureSceneCharacter(p,s.id,a.characterId);const current=present(p,s.id).characters[a.characterId], target={...current,...clone(a.patch),id:a.characterId};validateCharacter(p,target);const changes=diffCharacters({[current.id]:current},{[current.id]:target});
        for(const d of changes)s.overrides.push({kind:d.kind,characterId:d.characterId,key:d.key,itemId:d.itemId||d.key,mode:'set',value:d.after});
        for(const t of target.tags.filter(t=>!current.tags.includes(t)))s.overrides.push({kind:'tag',characterId:a.characterId,key:t,mode:'add'});
        for(const t of current.tags.filter(t=>!target.tags.includes(t)))s.overrides.push({kind:'tag',characterId:a.characterId,key:t,mode:'remove'});
        if(!s.currentMetadata)s.currentMetadata={};s.currentMetadata[a.characterId]=Object.fromEntries(['name','summary','details','image','groupId'].map(k=>[k,target[k]]));
        const master=find(p,'characters',a.characterId);Object.assign(master,clone(target));break;}
      case 'character.delete': {find(p,'characters',a.id);assert(!p.nodes.some(n=>n.refs.some(r=>r.kind==='character'&&r.id===a.id))&&!p.scenes.some(s=>s.characters[a.id]),'角色已在场景使用，请保留角色以维护历史');p.characters=p.characters.filter(x=>x.id!==a.id);break;}
      case 'item.create': {const i=item(a);p.items.push(i);result=i;break;}
      case 'item.update': {const old=find(p,'items',a.id);Object.assign(old,item({...old,...clone(a.patch),id:a.id}));break;}
      case 'group.create': {const g={id:uid('group'),name:a.name||'新分组'};p.groups.push(g);result=g;break;}
      case 'group.apply': {const members=p.characters.filter(c=>c.groupId===a.groupId);assert(members.length,'分组中没有角色');for(const c of members){if(a.tags)c.tags=[...new Set([...c.tags,...a.tags])];if(a.patch)Object.assign(c,clone(a.patch));validateCharacter(p,c);}break;}
      case 'definitions.update': {for(const k of ['skills','attributes'])if(a[k]){a[k].forEach(safeKey);p.definitions[k]=[...new Set(a[k])];}break;}
      case 'node.create': {const n=makeNode(p,a.type,a.sceneId,a.data);assert(!p.nodes.some(x=>x.id===n.id),'节点 ID 重复');p.nodes.push(n);result=n;syncNodeCharacters(p,n);break;}
      case 'node.update': {const n=find(p,'nodes',a.id),patch=clone(a.patch);delete patch.id;delete patch.type;delete patch.sceneId;Object.assign(n,patch);if(a.patch.date)n.date=dateText(n.date);syncNodeCharacters(p,n);break;}
      case 'node.addOutput': {const n=find(p,'nodes',a.id);assert(['dialogue','monologue','event'].includes(n.type),'此类型不能增加输出点');n.outputs.push(a.label||`分支 ${n.outputs.length+1}`);break;}
      case 'node.delete': {const ids=a.ids||[a.id];p.nodes=p.nodes.filter(n=>!ids.includes(n.id));p.edges=p.edges.filter(e=>!ids.includes(e.from)&&!ids.includes(e.to));for(const n of p.nodes){if(ids.includes(n.targetNodeId))n.targetNodeId='';if(ids.includes(n.condition.sourceEventId))n.condition.sourceEventId='';}break;}
      case 'node.transfer': {const ids=a.ids,s=sceneOf(p,a.sceneId),ns=p.nodes.filter(n=>ids.includes(n.id));assert(ns.length,'未选择节点');const map={};
        const sourceStates={};for(const sid of new Set(ns.map(n=>n.sceneId))){const t=trace({...p,currentSceneId:sid});sourceStates[sid]=t.history.find(h=>ids.includes(h.nodeId))?.before||clone(sceneOf(p,sid).characters);}
        for(const n of ns) {const newId=a.copy?uid('node'):n.id;map[n.id]=newId;for(const r of n.refs)if(r.kind==='character'&&!s.characters[r.id])s.characters[r.id]=clone(sourceStates[n.sceneId][r.id]||find(p,'characters',r.id));}
        const edges=p.edges.filter(e=>ids.includes(e.from)&&ids.includes(e.to));
        const minX=Math.min(...ns.map(n=>n.x)),minY=Math.min(...ns.map(n=>n.y));
        const copied=ns.map(n=>{const q=clone(n);q.id=map[n.id];q.sceneId=s.id;q.x=q.x-minX+100;q.y=q.y-minY+120;if(map[q.targetNodeId])q.targetNodeId=map[q.targetNodeId];if(map[q.condition.sourceEventId])q.condition.sourceEventId=map[q.condition.sourceEventId];else if(n.sceneId!==s.id)q.condition.sourceEventId='';return q;});
        if(!a.copy){p.nodes=p.nodes.filter(n=>!ids.includes(n.id));p.edges=p.edges.filter(e=>!ids.includes(e.from)&&!ids.includes(e.to));}
        p.nodes.push(...copied);p.edges.push(...edges.map(e=>({...e,id:uid('edge'),from:map[e.from],to:map[e.to]})));p.currentSceneId=s.id;result={ids:Object.values(map)};break;}
      case 'edge.create': {const from=find(p,'nodes',a.from),to=find(p,'nodes',a.to);assert(from.sceneId===to.sceneId,'跨场景请用跳转节点');const output=a.output??0;assert(output>=0&&output<from.outputs.length,'输出点不存在');assert(!p.edges.some(e=>e.from===a.from&&e.output===output&&e.to===a.to),'连线已存在');const e={id:uid('edge'),from:a.from,to:a.to,output};p.edges.push(e);result=e;break;}
      case 'edge.delete':p.edges=p.edges.filter(e=>e.id!==a.id);break;
      default:throw Error('未知命令: '+cmd.type);
    }
    return result;
  }
  function execute(project,commands) {const p=clone(project),results=[];for(const c of commands)results.push(command(p,c));validateProject(p);return {project:p,results};}
  function demoProject() {
    const p=emptyProject('雾港来信');p.scenes[0].name='01 · 雾港的清晨';p.scenes[0].summary='一封来信，让原本平静的港口发生了变化。';
    const i=item({id:'item_letter',name:'密封的来信',summary:'封口上印着一枚银色的月亮。',category:'任务物品',type:'道具',grade:'稀世',attributes:{完整度:100}});p.items.push(i);
    p.items.push(item({id:'item_coin',name:'银币',summary:'旧王国发行的通用货币。',type:'材料',grade:'普通'}));
    p.groups=[{id:'group_main',name:'雾港同行者'}];
    const a=character(p,{id:'char_mira',name:'米拉卡',summary:'不太守时的旅人，擅长观察细微的变化。',details:'她在清晨抵达雾港。那封从未署名的信，是她此行唯一的线索。',tags:['旅人','主角'],groupId:'group_main',skills:{观察:7,交涉:4,战斗:5,学识:3},attributes:{生命:80,体力:65,意志:70},inventory:{item_letter:1,item_coin:10}});
    const b=character(p,{id:'char_ferryman',name:'渡鸦',summary:'港口的摆渡人，似乎认识每一个秘密。',tags:['雾港','同行者'],groupId:'group_main',skills:{观察:6,交涉:5,战斗:4,学识:5},attributes:{生命:90,体力:75,意志:60},inventory:{item_coin:4}});
    p.characters.push(a,b);ensureSceneCharacter(p,p.currentSceneId,a.id);ensureSceneCharacter(p,p.currentSceneId,b.id);
    const d=makeNode(p,'dialogue',p.currentSceneId,{id:'node_arrival',title:'渡口的相遇',summary:'雾中的第一个声音',date:'1024.04.16',x:80,y:130,refs:[{kind:'character',id:a.id},{kind:'character',id:b.id}],lines:[{characterId:b.id,text:'你迟到了。潮水可不会等人。'},{characterId:a.id,text:'我在找这封信的主人。'}]});
    const e=makeNode(p,'event',p.currentSceneId,{id:'node_trade',title:'将信交给渡鸦',date:d.date,x:460,y:160,eventType:'交易',summary:'一封信，换取一条通向旧城的线索。',refs:d.refs,factions:{A:[a.id],B:[b.id]},operations:[{kind:'transfer',characterId:a.id,toCharacterId:b.id,itemId:i.id,value:1}]});
    const c=makeNode(p,'condition',p.currentSceneId,{id:'node_condition',title:'她是否赶上了渡船？',date:d.date,x:840,y:145,condition:{mode:'manual',value:true,description:'如果米拉卡睡过了头，这次交换就不会发生。',sourceEventId:e.id,rollback:'all',excludedCharacters:[],rules:[],logic:'all'}});
    const m=makeNode(p,'monologue',p.currentSceneId,{id:'node_city',title:'旧城的入口',date:'1024.04.17',x:1220,y:90,speakerId:a.id,text:'信离开手心的那一刻，雾仿佛消散了一些。她终于看清了河对岸的城门。',refs:[{kind:'character',id:a.id}]});
    const f=makeNode(p,'monologue',p.currentSceneId,{id:'node_wait',title:'错过的清晨',date:d.date,x:1220,y:410,text:'渡船已经离岸。信仍在米拉卡的口袋里，等待下一次交付。',refs:[{kind:'character',id:a.id}]});
    p.nodes.push(d,e,c,m,f);p.edges=[{id:'edge_1',from:d.id,to:e.id,output:0},{id:'edge_2',from:e.id,to:c.id,output:0},{id:'edge_3',from:c.id,to:m.id,output:0},{id:'edge_4',from:c.id,to:f.id,output:1}];
    return p;
  }
  return {TYPES,ITEM_A,ITEM_B,ITEM_C,uid,clone,find,sceneOf,dateKey,dateText,character,item,emptyProject,makeNode,ensureSceneCharacter,applyOperations,conditionValue,labelOperations,trace,present,timeline,displaySettings,diffCharacters,validateProject,execute,demoProject};
});
