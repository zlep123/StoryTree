(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = {dialogue:'对话',monologue:'独白',condition:'条件',jump:'跳转',event:'事件',label:'标签'};
  const DIALOGUE_MODES = ['manual','round','same'];
  const CHARACTER_FIELDS = ['displayName','summary','details','image','groupId'];
  const CHARACTER_EDIT_FIELDS = [...CHARACTER_FIELDS,'tags','skills','attributes','inventory','itemAttributes'];
  const ITEM_A = ['副本物品','单机物品','特殊物品','任务物品'];
  const ITEM_B = ['装备','道具','材料','未知'];
  const ITEM_C = ['未知','普通','优质','稀世','异世','传说'];
  const ART_CATEGORIES = ['map','character','location','other'];
  const ART_FILE_LIMIT = 4 * 1024 * 1024;
  const ART_PROJECT_LIMIT = 12 * 1024 * 1024;
  const INVENTORY_LIMIT = 999999;
  const MAP_SIZE = Object.freeze({width:1600,height:1000,minWidth:76,minHeight:50});
  const MAP_ELEMENT_MIN = 30;
  const MAP_SHAPES = Object.freeze(['rectangle','ellipse','triangle']);
  const MAP_LAYERS = Object.freeze(['background','locations','characters','objects']);
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = p => p + '_' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
  const assert = (ok,msg) => {if (!ok) throw Error(msg);};
  const safeKey = k => {assert(typeof k === 'string' && k.length > 0 && k.length < 100 && !['__proto__','constructor','prototype'].includes(k),'字段名称无效');return k;};
  const record = value => value&&typeof value==='object'&&!Array.isArray(value);
  const strings = value => Array.isArray(value)&&value.every(entry=>typeof entry==='string');
  const num = (n,lo,hi) => {n=Number(n);assert(Number.isFinite(n) && n>=lo && n<=hi,`数值必须在 ${lo}–${hi} 之间`); return n;};
  const find = (p,list,id) => {const v=p[list].find(x=>x.id===id);assert(v,`找不到 ${list}: ${id}`);return v;};
  const sceneOf = (p,id) => find(p,'scenes',id || p.currentSceneId);
  const sceneMap = (scene,locationId='') => (scene.maps||[]).find(map=>map.locationId===locationId)||
    {locationId,backgroundArtId:'',areas:[],routes:[]};
  const hasMapContent = map => map.backgroundArtId||map.areas.length||map.routes.length||map.elements?.length;
  function fitsMap({x,y,width,height},minWidth,minHeight){
    return [x,y,width,height].every(Number.isInteger)&&x>=0&&y>=0&&width>=minWidth&&height>=minHeight&&
      x+width<=MAP_SIZE.width&&y+height<=MAP_SIZE.height;
  }
  const groupsOf = (p,kind) => p.groups.filter(g => (g.kind || 'character') === kind);
  const hasDialogue = node => node?.type==='dialogue'||node?.type==='event';
  const characterDisplayName = character => character?.displayName?.trim()||character?.name||'';
  const escapeReferencePart = text => text.replace(/[%:{}\r\n]/gu,encodeURIComponent);
  const attributeToken = (characterId,key) => '{{attr:'+escapeReferencePart(characterId)+':'+escapeReferencePart(key)+'}}';
  const characterToken = (characterId,field,...keys) => '{{char:'+ [characterId,field,...keys].map(escapeReferencePart).join(':')+'}}';
  const referencePattern = /\{\{(attr|char):([^{}\r\n]+)\}\}/gu;
  const CHARACTER_REFERENCE_FIELDS = {
    id:0,name:0,summary:0,details:0,image:0,group:0,tags:1,attributes:1,skills:1,item:1,inventory:1,itemAttributes:2
  };
  function parseCharacterReference(token,kind,payload) {
    let parts;
    try{parts=payload.split(':').map(decodeURIComponent);}
    catch{return null;}
    if(kind==='attr'){
      if(parts.length!==2)return null;
      parts.splice(1,0,'attributes');
    }
    const [characterId,field,...keys]=parts;
    if(!parts.every(Boolean)||!Object.hasOwn(CHARACTER_REFERENCE_FIELDS,field)||
      (keys.length!==CHARACTER_REFERENCE_FIELDS[field]&&!(field==='tags'&&!keys.length)))return null;
    return {token,characterId,field,keys};
  }
  function characterTextParts(text) {
    text=String(text??'');
    const parts=[];
    let offset=0;
    for(const match of text.matchAll(referencePattern)){
      const ref=parseCharacterReference(...match);
      if(!ref)continue;
      if(match.index>offset)parts.push(text.slice(offset,match.index));
      parts.push(ref);
      offset=match.index+ref.token.length;
    }
    if(offset<text.length)parts.push(text.slice(offset));
    return parts;
  }
  function literalTextPattern(query,matchCase){
    return new RegExp(query.replace(/[.*+?^$\u007b\u007d()|[\]\\]/gu,'\\$&'),matchCase?'gu':'giu');
  }
  function textMatches(value,pattern){
    let offset=0;
    return characterTextParts(value).flatMap(part=>{
      const start=offset;
      offset+=typeof part==='string'?part.length:part.token.length;
      return typeof part==='string'?Array.from(part.matchAll(pattern),match=>({
        start:start+match.index,end:start+match.index+match[0].length
      })):[];
    });
  }
  function replaceTextRanges(value,hits,replacement){
    const parts=[];
    let offset=0;
    for(const {start,end} of hits){
      parts.push(value.slice(offset,start),replacement);
      offset=end;
    }
    parts.push(value.slice(offset));
    return parts.join('');
  }
  function previewNodeTextReplacements(project,{query,replacement,matchCase,sceneId}){
    if(!query)return [];
    const pattern=literalTextPattern(query,matchCase),rows=[];
    for(const node of project.nodes){
      if(sceneId&&node.sceneId!==sceneId)continue;
      const fields=[['title',node.title],['summary',node.summary],['text',node.text]];
      if(node.type==='condition')fields.push(['condition.description',node.condition.description]);
      if(hasDialogue(node))node.lines.forEach((line,index)=>fields.push(['lines.'+index+'.text',line.text]));
      for(const [path,before] of fields){
        if(!before)continue;
        const hits=textMatches(before,pattern);
        if(!hits.length)continue;
        const after=replaceTextRanges(before,hits,replacement);
        if(after!==before)rows.push({nodeId:node.id,path,before,after,first:hits[0],count:hits.length});
      }
    }
    return rows;
  }
  function nodeCharacterReferences(node) {
    const refs=new Map();
    for(const text of [node.summary,node.text,node.condition?.description,...(node.lines||[]).map(line=>line.text)])
      for(const part of characterTextParts(text))if(typeof part!=='string')refs.set(part.token,part);
    return [...refs.values()];
  }
  function characterReferenceValue(ref,characters,project) {
    const c=Object.hasOwn(characters,ref.characterId)&&characters[ref.characterId];
    if(!c)return undefined;
    const [key,property]=ref.keys;
    const own=(object,k)=>object&&Object.hasOwn(object,k)?object[k]:undefined;
    switch(ref.field){
      case 'id':return c.name;
      case 'name':return characterDisplayName(c);
      case 'summary':case 'details':case 'image':return c[ref.field]||'';
      case 'group':return project?.groups.find(group=>group.id===c.groupId)?.name||'';
      case 'tags':return key===undefined?c.tags:c.tags.includes(key)?key:'';
      case 'attributes':case 'skills':return own(c[ref.field],key);
      case 'item':return own(c.inventory,key)?project?.items.find(item=>item.id===key)?.name:'';
      case 'inventory':return own(c.inventory,key)??0;
      case 'itemAttributes':{
        if(!own(c.inventory,key))return undefined;
        const defaults=project?.items.find(item=>item.id===key)?.attributes;
        return own(own(c.itemAttributes,key),property)??own(defaults,property);
      }
    }
  }
  function resolveCharacterText(text,characters,project,format=(value,ref)=>
    ref.field==='image'&&value?'[image]':Array.isArray(value)?value.join(', '):String(value??ref.token)){
    return characterTextParts(text).map(part=>typeof part==='string'?part:format(characterReferenceValue(part,characters,project),part)).join('');
  }
  function nodeAttributeReferences(node){
    return nodeCharacterReferences(node).filter(ref=>ref.field==='attributes').map(({token,characterId,keys})=>({token,characterId,key:keys[0]}));
  }
  const resolveAttributeText = (text,characters) => resolveCharacterText(text,characters,undefined,
    (value,ref)=>ref.field==='attributes'?String(value??ref.token):ref.token);
  const dialogueSpeakers = node => [...new Set(node.refs.filter(ref=>ref.kind==='character').map(ref=>ref.id))];
  const defaultDialogueRule = node => node.dialogueRule || {mode:node.dialogueMode||'manual',participants:dialogueSpeakers(node)};
  const dialogueRuleAt = (node,index) => node.lines[index]?.rule || defaultDialogueRule(node);
  const logNewlines = value => (value||'').replace(/\r\n?/gu,'\n');
  function dialogueLogText(node,characters){
    const byId=new Map(characters.map(c=>[c.id,c.name])),counts=new Map();
    for(const {name} of characters)counts.set(name,(counts.get(name)||0)+1);
    return node.lines.map(line=>{
      const name=byId.get(line.characterId);
      const speaker=!line.characterId?'':name&&name===name.trim()&&/^[^:：@\r\n]+$/u.test(name)&&counts.get(name)===1
        ?name:'@'+JSON.stringify(line.characterId);
      return speaker+'：'+logNewlines(line.text).replaceAll('\n','\n\t');
    }).join('\n');
  }
  function parseDialogueLog(text,node,characters){
    const fail=(line,reason)=>{
      const error=Error(reason);
      error.line=line+1;
      throw error;
    };
    const names=new Map(),ids=new Set();
    for(const {id,name} of characters){
      ids.add(id);
      names.set(name,names.has(name)?null:id);
    }
    const rows=[];
    for(const [index,line] of logNewlines(text).split('\n').entries()){
      const indent=/^(?:\t| {2})/u.exec(line);
      if(indent&&rows.length){
        rows.at(-1).text+='\n'+line.slice(indent[0].length);
        continue;
      }
      if(!line.trim())continue;
      const quoted=/^(@"(?:\\.|[^"\\])*")\s*[:：]/u.exec(line);
      const separator=quoted?quoted[0].length-1:line.search(/[:：]/u);
      if(separator<0)fail(index,'对白行需要以角色和冒号开头');
      const speaker=line.slice(0,separator).trim();
      let characterId='';
      if(quoted){
        try{characterId=JSON.parse(quoted[1].slice(1));}
        catch{fail(index,'对白角色不存在或名称重复');}
        if(!ids.has(characterId))fail(index,'对白角色不存在或名称重复');
      }else if(speaker){
        characterId=names.get(speaker);
        if(!characterId)fail(index,'对白角色不存在或名称重复');
      }
      rows.push({characterId,text:line.slice(separator+1)});
    }
    const rule=defaultDialogueRule(node);
    if(!rows.length)return [{characterId:rule.mode==='manual'?'':rule.participants[0]||'',text:''}];
    const key=row=>JSON.stringify([row.characterId||'',logNewlines(row.text)]);
    const matches=rows.map((row,index)=>node.lines[index]&&key(node.lines[index])===key(row)?index:-1);
    const reserved=new Set(matches);
    const oldRows=new Map();
    for(const [index,line] of node.lines.entries()){
      if(reserved.has(index))continue;
      const signature=key(line);
      if(!oldRows.has(signature))oldRows.set(signature,{indexes:[],used:0});
      oldRows.get(signature).indexes.push(index);
    }
    // Keep equal lines in place before matching moved lines and pairing edits in the gaps.
    for(const [index,line] of rows.entries()){
      if(matches[index]>=0)continue;
      const candidates=oldRows.get(key(line));
      const original=candidates?.indexes[candidates.used++];
      if(original!==undefined){
        matches[index]=original;
        reserved.add(original);
      }
    }
    let cursor=0;
    for(let i=0;i<matches.length;){
      if(matches[i]>=0){
        cursor=Math.max(cursor,matches[i++]+1);
        continue;
      }
      let next=i+1;
      while(next<matches.length&&matches[next]===-1)next++;
      const boundary=next===matches.length?node.lines.length:matches[next];
      while(i<next){
        while(cursor<boundary&&reserved.has(cursor))cursor++;
        if(cursor<boundary)matches[i]=cursor++;
        i++;
      }
    }
    let inherited=rule;
    return rows.map((line,index)=>{
      const old=node.lines[matches[index]];
      if(!old)return {...line,rule:clone(inherited)};
      inherited=old.rule||rule;
      return {...old,...line,text:logNewlines(old.text)===line.text?old.text:line.text};
    });
  }
  const validDialogueRule = rule => rule && DIALOGUE_MODES.includes(rule.mode) && Array.isArray(rule.participants) &&
    rule.participants.every(id=>typeof id==='string') && new Set(rule.participants).size===rule.participants.length;
  function nextDialogueSpeaker(node,index) {
    const current=node.lines[index]?.characterId||'';
    const {mode,participants:cast}=dialogueRuleAt(node,index);
    if(mode!=='round')return current;
    return cast.length ? cast[(cast.indexOf(current)+1)%cast.length] : current;
  }
  function dateKey(s) {
    const fields=String(s).split('.').map(Number);
    const [year,month,day]=fields;
    const last=new Date(0);
    last.setUTCFullYear(year,month,0);
    assert(fields.length===3 && fields.every(Number.isInteger) && year>=1 && year<=9999 &&
      month>=1 && month<=12 && day>=1 && day<=last.getUTCDate(),'日期请使用有效的 年.月.日');
    return year*10000+month*100+day;
  }
  const dateText = s => {dateKey(s);return s.split('.').map((x,i)=>i?String(Number(x)).padStart(2,'0'):String(Number(x)).padStart(4,'0')).join('.');};
  const nodeDateKey = s => s==='' ? Infinity : dateKey(s);
  const nodeDateText = s => s==='' ? '' : dateText(s);
  function character(p,data={}) {
    const c={id:data.id||uid('char'),name:data.name||'未命名角色',summary:'',details:'',image:'',tags:[],groupId:'',skills:{},attributes:{},inventory:{},itemAttributes:{},...clone(data)};
    for (const k of p.definitions.skills) if(c.skills[k]===undefined)c.skills[k]=0;
    for (const k of p.definitions.attributes) if(c.attributes[k]===undefined)c.attributes[k]=20;
    validateCharacter(p,c);return c;
  }
  function validateScores(values,max,legacyNumbers){
    assert(record(values),'属性或技能必须是键值对象');
    for(const [key,value] of Object.entries(values)){
      safeKey(key);
      const score=legacyNumbers&&typeof value==='string'&&/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/iu.test(value)?Number(value):value;
      assert(typeof score==='number','属性和技能数值必须是数字');
      num(score,0,max);
      if(score!==value)values[key]=score;
    }
  }
  function validateCharacter(p,c,legacyNumbers=false){
    assert(record(c),'角色资料无效');
    assert(typeof c.name==='string' && c.name.trim(),'角色需要名称');
    for(const field of CHARACTER_FIELDS)assert(c[field]===undefined||typeof c[field]==='string','角色资料字段必须是文本');
    assert(!c.groupId||groupsOf(p,'character').some(group=>group.id===c.groupId),'找不到角色分组');
    assert(strings(c.tags),'标签必须为文本数组');
    validateScores(c.skills,10,legacyNumbers);
    validateScores(c.attributes,100,legacyNumbers);
    assert(record(c.inventory)&&(!Object.hasOwn(c,'itemAttributes')||record(c.itemAttributes)),'角色物品栏无效');
    for (const [k,v] of Object.entries(c.inventory)) {assert(p.items.some(i=>i.id===k),'物品不存在');assert(Number.isInteger(v),'物品数量必须为整数');num(v,0,999999);}
    for(const [id,attrs]of Object.entries(c.itemAttributes||{})){find(p,'items',id);validateScores(attrs,100,legacyNumbers);}
    if(c.image)assert(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(c.image) && c.image.length<12e6,'图片必须为小于 8MB 的 PNG/JPEG/WebP/GIF');
  }
  function characterPatch(data,existing){
    assert(record(data),'角色更新必须是键值对象');
    for(const key of Object.keys(data)){
      if(key==='id'||key==='name')assert(existing&&data[key]===existing[key],'角色ID不能修改');
      else assert(CHARACTER_EDIT_FIELDS.includes(key),'不能更新角色字段 '+key);
    }
    return clone(data);
  }
  function item(data={}) {
    const i={id:data.id||uid('item'),name:'未命名物品',summary:'',details:'',category:'单机物品',type:'',grade:'',tags:[],attributes:{耐久:20},groupId:'',...clone(data)};
    assert(i.name?.trim(),'物品需要名称');assert(ITEM_A.includes(i.category),'必须选择一个 A 组标签');assert(!i.type || ITEM_B.includes(i.type),'B 组标签无效');assert(!i.grade || (i.type && ITEM_C.includes(i.grade)),'品级需要先选择 B 组类型');
    if(i.category==='特殊物品')i.attributes={};
    validateScores(i.attributes,100,false);
    return i;
  }
  function itemSetTotals(p) {
    const sets=p.itemSets===undefined?[]:p.itemSets;
    assert(Array.isArray(sets),'物品组合资料无效');
    const byId=new Map(),names=new Set();
    const itemIds=new Set(p.items.map(item=>item.id));
    for(const set of sets){
      assert(set&&typeof set==='object','物品组合资料无效');
      safeKey(set.id);
      assert(typeof set.name==='string'&&set.name.trim()&&Array.isArray(set.entries),'物品组合需要名称与成员列表');
      const name=set.name.trim().toLowerCase();
      assert(!byId.has(set.id)&&!names.has(name),'物品组合名称或 ID 重复');
      byId.set(set.id,set);
      names.add(name);
    }
    const dependencies=new Map(),parents=new Map(),ready=[],totals=new Map();
    for(const set of sets){
      const seen=new Set();
      let count=0;
      for(const entry of set.entries){
        assert(entry&&['item','set'].includes(entry.kind),'物品组合成员类型无效');
        assert(Number.isInteger(entry.quantity)&&entry.quantity>=1&&entry.quantity<=INVENTORY_LIMIT,'物品数量须为 1–999999 的整数');
        const key=entry.kind+':'+entry.id;
        assert(!seen.has(key),'物品组合成员重复');
        seen.add(key);
        if(entry.kind==='item'){assert(itemIds.has(entry.id),'物品不存在');continue;}
        assert(byId.has(entry.id),'找不到子物品组合');
        if(!parents.has(entry.id))parents.set(entry.id,[]);
        parents.get(entry.id).push(set.id);
        count++;
      }
      dependencies.set(set.id,count);
      if(!count)ready.push(set);
    }
    for(let index=0;index<ready.length;index++){
      const set=ready[index],items=new Map();
      const add=(id,quantity)=>{
        const total=(items.get(id)||0)+quantity;
        assert(total<=INVENTORY_LIMIT,'物品组合展开后超过数量上限');
        items.set(id,total);
      };
      for(const {kind,id,quantity} of set.entries){
        if(kind==='item')add(id,quantity);
        else for(const [itemId,count] of totals.get(id))add(itemId,count*quantity);
      }
      totals.set(set.id,items);
      for(const id of parents.get(set.id)||[]){
        const count=dependencies.get(id)-1;
        dependencies.set(id,count);
        if(!count)ready.push(byId.get(id));
      }
    }
    assert(totals.size===sets.length,'物品组合不能循环引用');
    return totals;
  }
  function inventoryWithItemSets(p,inventory,setIds){
    if(!setIds.length)return inventory;
    const totals=itemSetTotals(p),updated={...inventory};
    for(const id of setIds){
      const items=totals.get(id);
      assert(items,'找不到物品组合');
      for(const [itemId,quantity] of items){
        const count=(updated[itemId]||0)+quantity;
        assert(count<=INVENTORY_LIMIT,'物品组合加入后超过角色的物品数量上限');
        updated[itemId]=count;
      }
    }
    return updated;
  }
  function artBytes(art) {
    assert(typeof art.name==='string' && art.name.trim(),'请输入名称');
    assert(ART_CATEGORIES.includes(art.category) && typeof art.notes==='string','概念图资料无效');
    const match = typeof art.image==='string' && /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(art.image);
    assert(match,'仅支持 PNG、JPEG、WebP 或 GIF 图片');
    const bytes = Math.floor(match[2].length * 3 / 4) - (match[2].match(/=*$/)[0].length);
    assert(bytes <= ART_FILE_LIMIT,'每张概念图最大为 4 MB');
    return bytes;
  }
  function emptyProject(title='未命名故事') {
    const s={id:uid('scene'),name:'第一幕',summary:'',characters:{},overrides:[],view:{x:70,y:70,zoom:1}};
    return {version:1,id:uid('project'),title,revision:0,currentSceneId:s.id,definitions:{skills:['观察','交涉','战斗','学识'],attributes:['生命','体力','意志']},characters:[],items:[],locations:[],outline:[],groups:[],conceptArt:[],scenes:[s],nodes:[],edges:[],audit:[],createdAt:new Date().toISOString()};
  }
  function makeNode(p,type,sceneId,data={}) {
    assert(Object.hasOwn(TYPES,type),'只有六种节点类型');const scene=sceneOf(p,sceneId);
    const last=p.nodes.filter(n=>n.sceneId===scene.id).at(-1);
    const n={id:uid('node'),sceneId:scene.id,type,title:TYPES[type],summary:'',date:last?.date??'0001.01.01',x:100,y:120,refs:[],lines:[{characterId:'',text:''}],speakerId:'',text:'',eventType:'自定义',factions:{A:[],B:[]},operations:[],condition:{mode:'manual',value:true,description:'',sourceEventId:'',rollback:'all',excludedCharacters:[],rules:[],logic:'all'},targetNodeId:'',labelQuery:{entity:'character',tags:[]},outputs:type==='condition'?['真','假']:['继续'],...clone(data)};
    n.type=type;n.sceneId=scene.id;n.date=nodeDateText(n.date);return n;
  }
  function syncNodeCharacters(p,n) {
    const ids=[...n.lines.map(l=>l.characterId),n.speakerId,...(n.factions.A||[]),...(n.factions.B||[]),...n.operations.flatMap(o=>[o.characterId,o.toCharacterId]),...n.condition.rules.map(r=>r.characterId)].filter(Boolean);
    for(const {characterId} of nodeCharacterReferences(n))if(p.characters.some(c=>c.id===characterId))ids.push(characterId);
    if(hasDialogue(n)){
      const rules=[n.dialogueRule,...n.lines.map(line=>line.rule)].filter(rule=>rule!==undefined);
      for(const rule of rules){
        assert(validDialogueRule(rule),'对话规则无效');
        ids.push(...rule.participants.filter(Boolean));
      }
    }
    for(const id of new Set(ids)){find(p,'characters',id);if(!n.refs.some(r=>r.kind==='character'&&r.id===id))n.refs.push({kind:'character',id});}
    for(const r of n.refs){assert(['character','item'].includes(r.kind),'素材类型无效');find(p,r.kind==='character'?'characters':'items',r.id);if(r.kind==='character')ensureSceneCharacter(p,n.sceneId,r.id);}
  }
  function startDialogueSpeaker(n) {
    if(!hasDialogue(n)||n.lines.length!==1)return;
    const line=n.lines[0];
    const rule=dialogueRuleAt(n,0);
    if(rule.mode!=='manual'&&!line.characterId&&!line.text)line.characterId=rule.participants[0]||'';
  }
  function setDialogueRule(n,index,rule){
    assert(hasDialogue(n)&&validDialogueRule(rule),'对话规则无效');
    const previous=defaultDialogueRule(n);
    const snapshot=clone(rule);
    if(index!==undefined){
      assert(Number.isInteger(index)&&n.lines[index],'对话框已变动，请重新选择');
      n.dialogueRule ||= clone(previous);
      const line=n.lines[index];
      line.rule=snapshot;
      if(rule.participants.length&&!rule.participants.includes(line.characterId))line.characterId=rule.participants[0];
      return;
    }
    const starter=n.lines.length===1&&!n.lines[0].text&&!n.lines[0].rule;
    if(starter){
      if(rule.mode!=='manual')n.lines[0].characterId=rule.participants[0]||'';
    }else{
      for(const line of n.lines)line.rule ||= clone(previous);
    }
    n.dialogueRule=snapshot;
    n.dialogueMode=rule.mode;
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
  function profileValue(c,key) {
    if(key==='displayName')return characterDisplayName(c);
    if(key==='image')return !!c?.image;
    return c?.[key]||'';
  }
  function profileOperations(before,after) {
    return CHARACTER_FIELDS.filter(key=>(before[key]??'')!==(after[key]??'')).map(key=>({
      kind:'characterField',characterId:after.id,key,mode:'set',value:after[key]??''
    }));
  }
  function nameInputSpec(op) {
    const input=op.input;
    assert(op.kind==='characterField'&&op.key==='displayName'&&op.characterId&&!op.targetTag&&
      input&&typeof input.prompt==='string'&&input.prompt.trim(),'玩家命名需要一个角色和输入提示');
    safeKey(input.id);
    return input;
  }
  function applyOperations(p,sceneId,state,ops,excluded=[],{inputs={},waitForInput=false}={}) {
    const next=clone(state), log=[];
    const scene=sceneOf(p,sceneId);
    for(const op of ops) {
      const input=op.input===undefined?null:nameInputSpec(op);
      const targets=selectedTargets(p,scene,next,op);
      for(const id of targets) {
        if(excluded.includes(id))continue;
        const c=next[id];
        if(op.kind==='characterField'){
          assert(CHARACTER_FIELDS.includes(op.key)&&typeof op.value==='string','角色资料字段无效');
          if(op.key==='groupId'&&op.value)assert(groupsOf(p,'character').some(g=>g.id===op.value),'找不到角色分组');
          const before=profileValue(c,op.key);
          let value=op.value;
          if(input) {
            if(Object.hasOwn(inputs,input.id)) {
              const answer=inputs[input.id];
              assert(typeof answer==='string'&&!/[\r\n]/u.test(answer),'角色名称必须是单行文本');
              value=answer.trim()||value;
            } else if(waitForInput) {
              const request={id:input.id,characterId:id,prompt:input.prompt,defaultValue:op.value.trim()||c.name};
              throw Object.assign(Error('等待玩家输入角色名称'),{inputRequest:request});
            }
          }
          c[op.key]=value;
          validateCharacter(p,c);
          log.push({characterId:id,kind:op.kind,key:op.key,before,after:profileValue(c,op.key)});
        } else if(op.kind==='attribute'||op.kind==='skill') {
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
    if(n.operations.length && n.operations.every(op=>op.direct))return n.operations;
    assert(n.labelQuery.tags.length,'标签节点至少需要一个目标标签');
    if(n.labelQuery.entity!=='item')return n.operations.map(o=>o.direct?o:{...o,targetTag:n.labelQuery.tags.join(',')});
    const matching=p.items.filter(i=>tagMatches([...i.tags,i.category,...(i.type?['类型:'+i.type]:[]),...(i.grade?['品级:'+i.grade]:[])],n.labelQuery.tags));
    const ops=[],batch=[];
    const expand=()=>{
      for(const i of matching)for(const c of Object.values(state))if(c.inventory[i.id]>0)for(const o of batch){
        assert(['item','itemAttribute','transfer'].includes(o.kind),'物品标签只支持物品数量、属性及转移操作');
        ops.push({...o,characterId:c.id,itemId:i.id,targetTag:''});
      }
      batch.length=0;
    };
    for(const op of n.operations){if(op.direct){expand();ops.push(op);}else batch.push(op);}
    expand();
    return ops;
  }
  function outgoing(p,n,choice) {
    if(n.type==='jump' && n.targetNodeId)return [find(p,'nodes',n.targetNodeId)];
    return p.edges.filter(e=>e.from===n.id && (choice===undefined || (typeof choice==='string'?(e.id===choice||e.to===choice):e.output===choice))).map(e=>find(p,'nodes',e.to));
  }
  // A trace is one explicit route, never a merge of mutually exclusive branches.
  function trace(p,{startNodeId,choices={},maxSteps=500,includeOverrides=false,inputs={},waitForInput=false}={}) {
    maxSteps=num(maxSteps,1,2000);
    const perScene={}, history=[],checkpoints={},visits={};let n=startNodeId?find(p,'nodes',startNodeId):null;
    if(!n){const ns=p.nodes.filter(x=>x.sceneId===p.currentSceneId);n=ns.find(x=>!p.edges.some(e=>e.to===x.id))||ns[0];}
    const inputOptions={inputs,waitForInput};
    let pending=[],status='end',error='',pendingInput;
    while(n && history.length<maxSteps) {
      if((visits[n.id]=(visits[n.id]||0)+1)>1){status='cycle';break;}
      if(!perScene[n.sceneId])perScene[n.sceneId]=clone(sceneOf(p,n.sceneId).characters);
      const before=clone(perScene[n.sceneId]);let changes=[],outcome,rolledBack=[];
      try {
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
                state=applyOperations(p,n.sceneId,state,checkpoints[h.nodeId].operations,omit,inputOptions).characters;
              }
            }
            perScene[n.sceneId]=state;rolledBack=[source];
            changes=diffCharacters(before,state,true);pending=pending.filter(id=>id!==source);
          }
        }
        if(n.type==='event'||n.type==='label'||n.operations.length){
          const prior=perScene[n.sceneId];
          const ops=n.type==='label'?labelOperations(p,n,prior):n.operations;
          checkpoints[n.id]={sceneId:n.sceneId,before:clone(prior),operations:ops};
          const result=applyOperations(p,n.sceneId,prior,ops,[],inputOptions);
          perScene[n.sceneId]=result.characters;
          changes.push(...result.changes);
          if(n.type==='event'||n.type==='label')pending.push(n.id);
        }
      }catch(e){
        perScene[n.sceneId]=before;
        if(e.inputRequest){pendingInput={...e.inputRequest,nodeId:n.id};status='input';break;}
        error=e.message;status='error';
        history.push({nodeId:n.id,sceneId:n.sceneId,title:n.title,date:n.date,type:n.type,before,after:clone(before),changes:[],error});
        break;
      }
      history.push({nodeId:n.id,sceneId:n.sceneId,title:n.title,date:n.date,type:n.type,...(n.locationId?{locationId:n.locationId}:{}),before,after:clone(perScene[n.sceneId]),changes,outcome,rolledBack});
      const output=typeof choices[n.id]==='string'?choices[n.id]:n.type==='condition'?(outcome?0:1):choices[n.id];
      const next=outgoing(p,n,output);
      if(next.length>1){status='choice';pending=next.map(x=>x.id);break;}
      n=next[0];
    }
    if(history.length>=maxSteps && n)status='limit';
    if(includeOverrides)for(const [sid,state]of Object.entries(perScene))perScene[sid]=applyOperations(p,sid,state,sceneOf(p,sid).overrides).characters;
    return {history,states:perScene,status,error,nextNodeIds:status==='choice'?pending:[],...(pendingInput?{pendingInput}:{})};
  }
  function diffCharacters(a,b,includeProfile=false) {
    const changes=[];
    for(const [id,c]of Object.entries(b))for(const kind of ['attributes','skills','inventory'])for(const k of new Set([...Object.keys(a[id]?.[kind]||{}),...Object.keys(c[kind])])) {
      const before=a[id]?.[kind]?.[k]??0,after=c[kind][k]??0;
      if(before!==after||(kind!=='inventory'&&Object.hasOwn(c[kind],k)&&!Object.hasOwn(a[id]?.[kind]||{},k)))changes.push({characterId:id,kind:kind==='attributes'?'attribute':kind==='skills'?'skill':'item',key:k,before,after});
    }
    for(const[id,c]of Object.entries(b))for(const[itemId,attrs]of Object.entries(c.itemAttributes||{}))for(const[k,after]of Object.entries(attrs)){const before=a[id]?.itemAttributes?.[itemId]?.[k];if(before!==after)changes.push({characterId:id,kind:'itemAttribute',itemId,key:k,before:before??20,after});}
    if(includeProfile)for(const [id,character] of Object.entries(b)){
      for(const key of CHARACTER_FIELDS){
        if((a[id]?.[key]??'')===(character[key]??''))continue;
        changes.push({characterId:id,kind:'characterField',key,before:profileValue(a[id],key),after:profileValue(character,key)});
      }
    }
    return changes;
  }
  function present(p,sceneId) {
    const s=sceneOf(p,sceneId),q={...p,currentSceneId:s.id},r=trace(q,{includeOverrides:false});
    const base=r.states[s.id]||clone(s.characters);
    try{const characters=applyOperations(p,s.id,base,s.overrides).characters;for(const[id,metadata]of Object.entries(s.currentMetadata||{}))if(characters[id])Object.assign(characters[id],clone(metadata));return {...r,characters};}
    catch(e){return {...r,characters:base,error:e.message,status:'error'};}
  }
  function timeline(p) {
    const cache={};return [...p.nodes].sort((a,b)=>nodeDateKey(a.date)-nodeDateKey(b.date)).map(n=>{
      if(!cache[n.sceneId]) {const q={...p,currentSceneId:n.sceneId};cache[n.sceneId]=trace(q);}
      const h=cache[n.sceneId].history.find(h=>h.nodeId===n.id);
      return {...n,result:h||null,sceneName:sceneOf(p,n.sceneId).name,links:outgoing(p,n).map(x=>x.id)};
    });
  }
  function storyLinks(p) {
    const nodes=new Map(p.nodes.map(node=>[node.id,node]));
    const links=new Map(p.nodes.map(node=>[node.id,[]]));
    for(const edge of p.edges){
      const from=nodes.get(edge.from);
      if(from.type==='jump'&&from.targetNodeId)continue;
      links.get(from.id).push({id:edge.id,targetNodeId:edge.to,output:edge.output});
    }
    for(const node of p.nodes){
      const outputs=links.get(node.id);
      if(node.type==='jump'&&node.targetNodeId)outputs.push({id:node.targetNodeId,targetNodeId:node.targetNodeId,jump:true});
      outputs.sort((a,b)=>(a.output??0)-(b.output??0)||
        nodeDateKey(nodes.get(a.targetNodeId).date)-nodeDateKey(nodes.get(b.targetNodeId).date));
    }
    return links;
  }
  function storyRoute(p,{startNodeId,choices={},maxSteps=500}={}) {
    maxSteps=num(maxSteps,1,2000);
    const nodes=new Map(p.nodes.map(node=>[node.id,node])),links=storyLinks(p);
    const incoming=new Set([...links.values()].flat().map(link=>link.targetNodeId));
    const sceneNodes=p.nodes.filter(node=>node.sceneId===p.currentSceneId);
    const roots=sceneNodes.filter(node=>!incoming.has(node.id));
    const start=roots.find(node=>links.get(node.id).length)||roots[0]||sceneNodes[0]||p.nodes[0];
    if(startNodeId)assert(nodes.has(startNodeId),'找不到剧情起点');
    let id=startNodeId||start?.id,status='end';
    const seen=new Set(),steps=[];
    while(id){
      if(seen.has(id)){status='cycle';break;}
      if(steps.length>=maxSteps){status='limit';break;}
      seen.add(id);
      const options=links.get(id);
      const selected=options.length===1?options[0]:options.find(link=>link.id===choices[id]);
      steps.push({nodeId:id,options,selectedId:selected?.id||''});
      if(options.length>1&&!selected){status='choice';break;}
      id=selected?.targetNodeId;
    }
    return {steps,status};
  }
  function storyScope(p,{startDate='',endDate='',locationId=''}={}) {
    const from=startDate?dateKey(startDate):-Infinity,to=endDate?dateKey(endDate):Infinity;
    assert(from<=to,'结束日期不能早于开始日期');
    const parents=new Map((p.locations||[]).map(location=>[location.id,location.parentId]));
    assert(!locationId||parents.has(locationId),'找不到地点');
    const ancestors=new Set();
    for(let parent=parents.get(locationId);parent;parent=parents.get(parent))ancestors.add(parent);
    const descendants=new Map();
    function includes(id){
      if(!locationId)return true;
      if(!descendants.has(id)){
        let cursor=id;
        while(cursor&&cursor!==locationId)cursor=parents.get(cursor);
        descendants.set(id,cursor===locationId);
      }
      return descendants.get(id);
    }
    return {
      node(node){
        if(!includes(node.locationId))return false;
        if(!startDate&&!endDate)return true;
        const date=node.date&&dateKey(node.date);
        return !!date&&from<=date&&date<=to;
      },
      outline(entry){
        if(!includes(entry.locationId)&&!ancestors.has(entry.locationId))return false;
        if(!startDate&&!endDate)return true;
        if(!entry.startDate&&!entry.endDate)return false;
        return (!entry.startDate||dateKey(entry.startDate)<=to)&&(!entry.endDate||dateKey(entry.endDate)>=from);
      }
    };
  }
  const outlinePlainText=sections=>sections.map(section=>[section.title,section.text].filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
  function outlineEntry(data,id){
    const {title,text='',startDate='',endDate='',locationId='',sections}=data;
    assert(typeof title==='string'&&title.trim(),'请输入大纲标题');
    assert([text,startDate,endDate,locationId].every(value=>typeof value==='string'),'大纲资料无效');
    const entry={id,title:title.trim(),text,startDate:nodeDateText(startDate.trim()),endDate:nodeDateText(endDate.trim()),locationId};
    if(sections!==undefined){
      assert(Array.isArray(sections)&&sections.every(section=>section&&typeof section.title==='string'&&typeof section.text==='string'),'大纲分段资料无效');
      entry.sections=sections.map(({title,text})=>({title:title.trim(),text}));
      entry.text=outlinePlainText(entry.sections);
    }
    return entry;
  }
  function outlineSections(entry){
    // Older versions can edit the text projection without updating the sections.
    if(entry?.sections&&(entry.text===undefined||entry.text===outlinePlainText(entry.sections)))return entry.sections;
    return [{title:'',text:entry?.text||''}];
  }
  const OUTLINE_LINK_KINDS=['node','scene','character','item','itemset','location','art','group','outline','variable'];
  function outlineLinkToken(kind,id){
    assert(OUTLINE_LINK_KINDS.includes(kind)&&typeof id==='string'&&id,'大纲链接无效');
    return '{{link:'+kind+':'+encodeURIComponent(id)+'}}';
  }
  function outlineTextParts(text){
    const parts=[];
    let offset=0;
    for(const match of text.matchAll(/\{\{link:([a-z]+):([^:{}\r\n]+)\}\}/gu)){
      const [token,kind,encoded]=match;
      if(!OUTLINE_LINK_KINDS.includes(kind))continue;
      let id;
      try{id=decodeURIComponent(encoded);}
      catch{continue;}
      if(match.index>offset)parts.push(text.slice(offset,match.index));
      parts.push({kind,id,token});
      offset=match.index+token.length;
    }
    if(offset<text.length)parts.push(text.slice(offset));
    return parts;
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
      treeMode: ['route','outline'].includes(value.treeMode)?value.treeMode:'branches',
      mapLayers: Object.fromEntries(MAP_LAYERS.map(key=>[key,{
        hidden:value.mapLayers?.[key]?.hidden===true,
        locked:value.mapLayers?.[key]?.locked===true
      }]))
    };
  }
  function validateSceneMaps(scene,locations,artIds,characterIds){
    if(scene.maps===undefined)return;
    assert(Array.isArray(scene.maps),'场景地图资料无效');
    const scopes=new Set();
    for(const map of scene.maps){
      assert(record(map)&&(map.locationId===''||locations.has(map.locationId)),'找不到地图所属地点');
      assert(!scopes.has(map.locationId),'同一地点已有一张场景地图');
      scopes.add(map.locationId);
      assert(map.backgroundArtId===''||artIds.has(map.backgroundArtId),'找不到地图底图');
      assert(Array.isArray(map.areas)&&Array.isArray(map.routes)&&map.areas.length<=256&&map.routes.length<=512,'每张地图最多包含 256 个地点和 512 条路线');
      const placed=new Set(),routes=new Map();
      for(const area of map.areas){
        assert(record(area)&&locations.has(area.locationId)&&area.locationId!==map.locationId,'找不到地图上的地点');
        assert(!placed.has(area.locationId),'地点在同一地图上只能布置一次');
        placed.add(area.locationId);
        assert(fitsMap(area,MAP_SIZE.minWidth,MAP_SIZE.minHeight),'地点范围必须在地图内');
      }
      for(const route of map.routes){
        assert(record(route)&&route.from!==route.to&&placed.has(route.from)&&placed.has(route.to),'路线需要连接两个已布置的地点');
        assert(typeof route.name==='string'&&route.name.length<=80,'路线名称最多 80 个字符');
        const [from,to]=[route.from,route.to].sort();
        if(!routes.has(from))routes.set(from,new Set());
        assert(!routes.get(from).has(to),'两个地点之间已有路线');
        routes.get(from).add(to);
      }
      if(map.elements===undefined)continue;
      assert(Array.isArray(map.elements)&&map.elements.length<=256,'每张地图最多包含 256 个角色和物体');
      const elementIds=new Set(),markedCharacters=new Set();
      for(const entry of map.elements){
        assert(record(entry)&&fitsMap(entry,MAP_ELEMENT_MIN,MAP_ELEMENT_MIN),'角色和物体必须放在地图内');
        const id=safeKey(entry.id);
        assert(!elementIds.has(id),'地图元素 ID 重复');
        elementIds.add(id);
        if(entry.kind==='character'){
          assert(characterIds.has(entry.characterId),'找不到地图上的角色');
          assert(!markedCharacters.has(entry.characterId),'角色在同一地图上只能布置一次');
          markedCharacters.add(entry.characterId);
        }else if(entry.kind==='image'){
          assert(artIds.has(entry.artId),'找不到地图物体的图片');
          assert(typeof entry.name==='string'&&entry.name.length<=80,'地图物体资料无效');
        }else{
          assert(entry.kind==='shape'&&MAP_SHAPES.includes(entry.shape)&&
            typeof entry.name==='string'&&entry.name.length<=80&&
            typeof entry.color==='string'&&/^#[0-9a-f]{6}$/i.test(entry.color),'地图物体资料无效');
        }
      }
    }
  }
  function validateProject(p,{legacyNumbers=false}={}) {
    assert(p?.version===1&&Array.isArray(p.scenes)&&p.scenes.length&&!Object.hasOwn(p,'_storytreeStorage'),'不是有效的 StoryTree 1 项目');
    for(const k of ['characters','items','nodes','edges','groups'])assert(Array.isArray(p[k]),`项目缺少 ${k}`);
    for(const list of ['characters','items','nodes','edges','scenes','groups']) {const ids=p[list].map(x=>x.id);assert(new Set(ids).size===ids.length,'ID 重复');ids.forEach(safeKey);}
    sceneOf(p,p.currentSceneId);
    assert(record(p.definitions)&&strings(p.definitions.skills)&&strings(p.definitions.attributes),'技能与属性定义无效');
    [...p.definitions.skills,...p.definitions.attributes].forEach(safeKey);
    for(const c of p.characters)validateCharacter(p,c,legacyNumbers);
    for(const i of p.items){
      if(legacyNumbers&&i.attributes!==undefined&&i.category!=='特殊物品')validateScores(i.attributes,100,true);
      item(i);
      assert(!i.groupId || groupsOf(p,'item').some(g=>g.id===i.groupId),'找不到物品分组');
    }
    itemSetTotals(p);
    for (const g of p.groups) assert(!g.kind || ['character','item'].includes(g.kind),'分组类型无效');
    const locationsById=new Map();
    if(p.locations!==undefined){
      assert(Array.isArray(p.locations),'地点资料无效');
      for(const location of p.locations){
        safeKey(location.id);
        assert(typeof location.name==='string'&&location.name.trim()&&typeof location.notes==='string','地点需要名称和文字备注');
        assert(!locationsById.has(location.id),'地点 ID 重复');
        assert(location.color===undefined||/^#[0-9a-f]{6}$/iu.test(location.color),'地点颜色无效');
        assert(location.parentId===undefined||typeof location.parentId==='string','上级地点无效');
        locationsById.set(location.id,location);
      }
      const checked=new Set();
      for(const location of p.locations){
        const path=new Set();
        let cursor=location;
        while(!checked.has(cursor.id)){
          assert(!path.has(cursor.id),'地点不能成为自己的上级');
          path.add(cursor.id);
          if(!cursor.parentId)break;
          cursor=locationsById.get(cursor.parentId);
          assert(cursor,'找不到上级地点');
        }
        for(const id of path)checked.add(id);
      }
    }
    if (p.conceptArt !== undefined) {
      assert(Array.isArray(p.conceptArt),'概念图资料无效');
      const ids = p.conceptArt.map(art=>safeKey(art.id));
      assert(new Set(ids).size===ids.length,'ID 重复');
      assert(p.conceptArt.reduce((bytes,art)=>bytes+artBytes(art),0)<=ART_PROJECT_LIMIT,'项目中的概念图合计不能超过 12 MB');
    }
    const characterIds=new Set(p.characters.map(character=>character.id));
    const itemIds=new Set(p.items.map(item=>item.id));
    const checkCharacter=id=>assert(typeof id==='string'&&(!id||characterIds.has(id)),'找不到引用的角色 '+id);
    const checkOperations=operations=>{
      assert(Array.isArray(operations),'节点或场景的变化记录无效');
      for(const op of operations){
        assert(record(op),'变化记录无效');
        if(op.characterId!==undefined)checkCharacter(op.characterId);
        if(op.toCharacterId!==undefined)checkCharacter(op.toCharacterId);
        if(['item','transfer','itemAttribute'].includes(op.kind)&&op.itemId)assert(itemIds.has(op.itemId),'物品不存在');
      }
    };
    const artIds=new Set((p.conceptArt||[]).map(art=>art.id));
    for(const s of p.scenes){
      validateSceneMaps(s,locationsById,artIds,characterIds);
      assert(record(s.characters),'场景快照无效');
      for(const [id,c] of Object.entries(s.characters)){
        assert(characterIds.has(id)&&c?.id===id,'场景快照引用无效');
        validateCharacter(p,c,legacyNumbers);
      }
      if(s.currentMetadata!==undefined){
        assert(record(s.currentMetadata),'场景快照无效');
        for(const [id,data] of Object.entries(s.currentMetadata)){
          assert(Object.hasOwn(s.characters,id)&&record(data),'场景快照引用无效');
          validateCharacter(p,{...s.characters[id],...data},legacyNumbers);
        }
      }
      checkOperations(s.overrides);
    }
    const inputIds=new Set();
    if(p.outline!==undefined){
      assert(Array.isArray(p.outline),'大纲资料无效');
      const ids=new Set();
      for(const entry of p.outline){
        safeKey(entry.id);
        assert(!ids.has(entry.id),'大纲 ID 重复');
        ids.add(entry.id);
        const normalized=outlineEntry(entry,entry.id);
        assert(!normalized.locationId||locationsById.has(normalized.locationId),'找不到地点');
        assert(!normalized.startDate||!normalized.endDate||dateKey(normalized.startDate)<=dateKey(normalized.endDate),'结束日期不能早于开始日期');
      }
    }
    for(const n of p.nodes){
      if(n.locationId!==undefined&&n.locationId!=='')assert(locationsById.has(n.locationId),'找不到地点');
      assert(Array.isArray(n.refs),'节点数据无效');
      for(const ref of n.refs){
        assert(ref&&(ref.kind==='character'?characterIds:ref.kind==='item'?itemIds:null)?.has(ref.id),'节点素材引用无效');
      }
      assert(Array.isArray(n.lines)&&n.lines.every(line=>record(line)&&typeof line.text==='string'),'对白资料无效');
      for(const line of n.lines)checkCharacter(line.characterId??'');
      if(n.speakerId!==undefined)checkCharacter(n.speakerId);
      if(n.factions!==undefined){
        assert(strings(n.factions?.A)&&strings(n.factions?.B),'事件阵营无效');
        [...n.factions.A,...n.factions.B].forEach(checkCharacter);
      }
      checkOperations(n.operations);
      for(const op of n.operations){
        if(op.input===undefined)continue;
        const input=nameInputSpec(op);
        assert(typeof op.value==='string'&&!/[\r\n]/u.test(op.value),'角色名称必须是单行文本');
        assert(characterIds.has(op.characterId)&&(n.type!=='label'||op.direct),'玩家命名需要指定单个角色');
        assert(!inputIds.has(input.id),'玩家输入 ID 重复');
        inputIds.add(input.id);
      }
      if(!hasDialogue(n))continue;
      for(const rule of [n.dialogueRule,...n.lines.map(line=>line.rule)].filter(rule=>rule!==undefined)){
        assert(validDialogueRule(rule)&&rule.participants.every(id=>!id||characterIds.has(id)),'对话规则无效');
      }
    }
    for(const n of p.nodes){assert(Object.hasOwn(TYPES,n.type),'节点类型无效');sceneOf(p,n.sceneId);nodeDateKey(n.date);assert(Number.isFinite(n.x)&&Number.isFinite(n.y),'节点坐标无效');assert(strings(n.outputs)&&n.outputs.length>=1&&n.outputs.length<=100,'输出点必须为1–100个');if(n.dialogueMode!==undefined)assert(hasDialogue(n)&&DIALOGUE_MODES.includes(n.dialogueMode),'对话模式无效');if(n.type==='condition')assert(n.outputs.length===2,'条件节点只有真假两个输出');if(['jump','label'].includes(n.type))assert(n.outputs.length===1,'跳转/标签节点只有一个输出');if(n.targetNodeId)find(p,'nodes',n.targetNodeId);}
    for(const e of p.edges){const a=find(p,'nodes',e.from),b=find(p,'nodes',e.to);assert(a.sceneId===b.sceneId,'跨场景请使用跳转节点');assert(Number.isInteger(e.output)&&e.output>=0&&e.output<a.outputs.length,'输出点无效');}
    return p;
  }
  function importLibrary(p,{characters=[],items=[]}) {
    assert(Array.isArray(characters) && Array.isArray(items) && characters.length+items.length<=2000,'每次最多导入 2,000 张卡片');
    function addCards(cards, kind) {
      const groups = new Map(groupsOf(p,kind).map(g=>[g.name,g]));
      for (const {group,...data} of cards) {
        if (group && !groups.has(group)) groups.set(group,command(p,{type:'group.create',args:{name:group,kind}}));
        command(p,{type:kind+'.create',args:{...data,id:undefined,groupId:groups.get(group)?.id || ''}});
      }
    }
    addCards(items,'item');
    addCards(characters,'character');
    return {characters:characters.length,items:items.length};
  }
  const deletableCollections={
    scene:'scenes',character:'characters',item:'items',location:'locations',
    group:'groups',itemSet:'itemSets',outline:'outline',art:'conceptArt'
  };
  function deletionImpact(p,kind,id) {
    assert(Object.hasOwn(deletableCollections,kind),'无法删除此类型的内容');
    const collection=deletableCollections[kind];
    const entry=find({[collection]:p[collection]||[]},collection,id);
    const maps=()=>p.scenes.flatMap(scene=>scene.maps||[]);
    const count=(entries,test)=>entries.filter(test).length;
    const effects={};
    let blocked='';
    if(kind==='scene'){
      const ids=new Set(p.nodes.filter(node=>node.sceneId===id).map(node=>node.id));
      effects.sceneNodes=ids.size;
      effects.sceneEdges=count(p.edges,edge=>ids.has(edge.from)||ids.has(edge.to));
      effects.externalNodes=count(p.nodes,node=>!ids.has(node.id)&&
        (ids.has(node.targetNodeId)||ids.has(node.condition?.sourceEventId)));
      effects.sceneCharacters=Object.keys(entry.characters).length;
      effects.maps=entry.maps?.length||0;
      if(p.scenes.length===1)blocked='项目至少需要保留一个场景';
    }else if(kind==='character'){
      const used=op=>op.characterId===id||op.toCharacterId===id;
      effects.nodes=count(p.nodes,n=>n.refs.some(ref=>ref.kind==='character'&&ref.id===id)||
        n.lines.some(line=>line.characterId===id||line.rule?.participants.includes(id))||
        n.dialogueRule?.participants.includes(id)||n.speakerId===id||
        n.factions?.A?.includes(id)||n.factions?.B?.includes(id)||n.operations.some(used)||
        n.condition?.rules?.some(used)||n.condition?.excludedCharacters?.includes(id)||
        nodeCharacterReferences(n).some(ref=>ref.characterId===id));
      effects.scenes=count(p.scenes,s=>Object.hasOwn(s.characters,id)||s.overrides.some(used));
      effects.mapMarkers=maps().reduce((sum,map)=>sum+count(map.elements||[],element=>element.kind==='character'&&element.characterId===id),0);
      if(effects.nodes||effects.scenes)blocked='角色仍有剧情或场景引用，请先解除引用';
    }else if(kind==='item'){
      const used=op=>['item','transfer','itemAttribute'].includes(op.kind)&&op.itemId===id;
      const carried=c=>Object.hasOwn(c.inventory||{},id)||Object.hasOwn(c.itemAttributes||{},id);
      effects.nodes=count(p.nodes,n=>n.refs.some(ref=>ref.kind==='item'&&ref.id===id)||
        n.operations.some(used)||n.condition?.rules?.some(rule=>rule.kind==='item'&&rule.key===id)||
        nodeCharacterReferences(n).some(ref=>['item','inventory','itemAttributes'].includes(ref.field)&&ref.keys[0]===id));
      effects.scenes=count(p.scenes,s=>Object.values(s.characters).some(carried)||
        Object.values(s.currentMetadata||{}).some(carried)||s.overrides.some(used));
      effects.characterCards=count(p.characters,carried);
      effects.itemSets=count(p.itemSets||[],set=>set.entries.some(member=>member.kind==='item'&&member.id===id));
      if(Object.values(effects).some(Boolean))blocked='物品仍在使用，请先解除引用';
    }else if(kind==='location'){
      const remainingMaps=maps().filter(map=>map.locationId!==id);
      effects.children=count(p.locations,location=>location.parentId===id);
      effects.nodes=count(p.nodes,node=>node.locationId===id);
      effects.outlines=count(p.outline||[],outline=>outline.locationId===id);
      effects.maps=count(maps(),map=>map.locationId===id);
      effects.mapAreas=count(remainingMaps,map=>map.areas.some(area=>area.locationId===id));
      effects.mapRoutes=remainingMaps.reduce((sum,map)=>sum+count(map.routes,route=>route.from===id||route.to===id),0);
    }else if(kind==='group'){
      const used=op=>op.kind==='characterField'&&op.key==='groupId'&&op.value===id;
      effects.nodes=count(p.nodes,n=>n.operations.some(used));
      effects.scenes=count(p.scenes,s=>s.overrides.some(used));
      effects.members=count(entry.kind==='item'?p.items:p.characters,card=>card.groupId===id);
      if(effects.nodes||effects.scenes)blocked='分组仍被剧情变化引用，请先移除对应变化';
    }else if(kind==='itemSet'){
      effects.itemSets=count(p.itemSets,set=>set.entries.some(member=>member.kind==='set'&&member.id===id));
      if(effects.itemSets)blocked='此物品组合正在被其他组合使用';
    }else if(kind==='art'){
      const all=maps();
      effects.mapBackgrounds=count(all,map=>map.backgroundArtId===id);
      effects.mapImages=all.reduce((sum,map)=>sum+count(map.elements||[],element=>element.kind==='image'&&element.artId===id),0);
    }
    return {name:entry.name??entry.title,effects,blocked};
  }
  function requireDeletion(p,kind,id) {
    const impact=deletionImpact(p,kind,id);
    assert(!impact.blocked,impact.blocked);
  }
  function removeNodes(p,ids) {
    p.nodes=p.nodes.filter(node=>!ids.has(node.id));
    p.edges=p.edges.filter(edge=>!ids.has(edge.from)&&!ids.has(edge.to));
    for(const node of p.nodes){
      if(ids.has(node.targetNodeId))node.targetNodeId='';
      if(ids.has(node.condition?.sourceEventId))node.condition.sourceEventId='';
    }
  }
  function editSceneMaps(p,edit) {
    for(const scene of p.scenes)if(scene.maps)scene.maps=scene.maps.map(edit).filter(map=>map&&hasMapContent(map));
  }
  function command(p,cmd) {
    const a=cmd.args||{};let result={};
    switch(cmd.type) {
      case 'project.rename':assert(a.title?.trim(),'故事需要标题');p.title=a.title;break;
      case 'project.keepRecoveryEdit':{
        safeKey(a.id);
        const entries=Array.isArray(p.recoveryEdits)?p.recoveryEdits:[];
        const edit={id:a.id,nodeId:a.nodeId,title:a.title,field:a.field,value:clone(a.value),refs:clone(a.refs||[])};
        const index=entries.findIndex(entry=>entry.id===edit.id);
        if(index<0)entries.push(edit);else entries[index]=edit;
        p.recoveryEdits=entries;
        result={recoveredDraftId:edit.id};
        break;
      }
      case 'scene.create': {const s={id:a.id||uid('scene'),name:a.name||'新场景',summary:a.summary||'',characters:{},overrides:[],view:{x:70,y:70,zoom:1}};assert(!p.scenes.some(scene=>scene.id===s.id),'ID 重复');p.scenes.push(s);p.currentSceneId=s.id;result=s;break;}
      case 'scene.update': {const s=sceneOf(p,a.id);if(a.name!==undefined)assert(typeof a.name==='string' && a.name.trim(),'请输入名称');for(const k of ['name','summary','view'])if(a[k]!==undefined)s[k]=clone(a[k]);break;}
      case 'scene.delete': {
        requireDeletion(p,'scene',a.id);
        const index=p.scenes.findIndex(scene=>scene.id===a.id);
        p.scenes.splice(index,1);
        removeNodes(p,new Set(p.nodes.filter(node=>node.sceneId===a.id).map(node=>node.id)));
        if(p.currentSceneId===a.id)p.currentSceneId=p.scenes[Math.min(index,p.scenes.length-1)].id;
        break;
      }
      case 'scene.map.update': {
        const scene=find(p,'scenes',a.sceneId),locationId=a.locationId??'';
        assert(record(a.patch),'场景地图资料无效');
        const current=sceneMap(scene,locationId);
        const map={...current};
        for(const key of ['backgroundArtId','areas','routes','elements']){
          if(Object.hasOwn(a.patch,key))map[key]=clone(a.patch[key]);
        }
        // Validate the scope before dropping an empty map from storage.
        validateSceneMaps({maps:[map]},new Set((p.locations||[]).map(location=>location.id)),
          new Set((p.conceptArt||[]).map(art=>art.id)),new Set(p.characters.map(c=>c.id)));
        const maps=(scene.maps||[]).filter(entry=>entry.locationId!==locationId);
        if(hasMapContent(map))maps.push(map);
        scene.maps=maps;
        result=map;
        break;
      }
      case 'scene.activate':sceneOf(p,a.id);p.currentSceneId=a.id;break;
      case 'scene.addCharacters': {for(const id of a.characterIds)ensureSceneCharacter(p,a.sceneId,id,a.sourceSceneId);break;}
      case 'character.create': {const c=character(p,a);p.characters.push(c);result=c;break;}
      case 'character.update': {
        const c=find(p,'characters',a.id),patch=characterPatch(a.patch,c);
        Object.assign(c,patch);
        validateCharacter(p,c);
        break;
      }
      case 'character.current': {const master=find(p,'characters',a.characterId),patch=characterPatch(a.patch,master);
        const s=sceneOf(p,a.sceneId);ensureSceneCharacter(p,s.id,a.characterId);
        const current=present(p,s.id).characters[a.characterId], target={...current,...patch,id:a.characterId,name:master.name};validateCharacter(p,target);const changes=diffCharacters({[current.id]:current},{[current.id]:target});
        for(const d of changes)s.overrides.push({kind:d.kind,characterId:d.characterId,key:d.key,itemId:d.itemId||d.key,mode:'set',value:d.after});
        for(const t of target.tags.filter(t=>!current.tags.includes(t)))s.overrides.push({kind:'tag',characterId:a.characterId,key:t,mode:'add'});
        for(const t of current.tags.filter(t=>!target.tags.includes(t)))s.overrides.push({kind:'tag',characterId:a.characterId,key:t,mode:'remove'});
        if(!s.currentMetadata)s.currentMetadata={};s.currentMetadata[a.characterId]=Object.fromEntries(['name',...CHARACTER_FIELDS].map(k=>[k,target[k]]));
        Object.assign(master,clone(target));break;}
      case 'character.delete': {
        requireDeletion(p,'character',a.id);
        editSceneMaps(p,map=>{
          if(map.elements)map.elements=map.elements.filter(entry=>entry.kind!=='character'||entry.characterId!==a.id);
          return map;
        });
        p.characters=p.characters.filter(x=>x.id!==a.id);
        break;
      }
      case 'item.create': {const i=item(a);p.items.push(i);result=i;break;}
      case 'item.update': {const old=find(p,'items',a.id);Object.assign(old,item({...old,...clone(a.patch),id:a.id}));break;}
      case 'item.delete':
        requireDeletion(p,'item',a.id);
        p.items=p.items.filter(item=>item.id!==a.id);
        break;
      case 'itemSet.create':
      case 'itemSet.update': {
        const sets=p.itemSets||=[];
        const current=cmd.type==='itemSet.create'?null:find(p,'itemSets',a.id);
        const data=current?{...current,...a.patch}:a;
        assert(typeof data.name==='string'&&data.name.trim(),'请输入组合名称');
        result={id:current?.id||uid('itemset'),name:data.name.trim(),entries:clone(data.entries===undefined?[]:data.entries)};
        if(current)sets[sets.indexOf(current)]=result;
        else sets.push(result);
        break;
      }
      case 'itemSet.addEntry': {
        const set=find({...p,itemSets:p.itemSets||[]},'itemSets',a.id);
        const {kind,id,quantity=1}=a.entry;
        assert(Number.isInteger(quantity)&&quantity>0,'物品数量须为 1–999999 的整数');
        const entry=set.entries.find(entry=>entry.kind===kind&&entry.id===id);
        if(entry)entry.quantity+=quantity;
        else set.entries.push({kind,id,quantity});
        result=set;
        break;
      }
      case 'itemSet.delete':
        requireDeletion(p,'itemSet',a.id);
        p.itemSets=p.itemSets.filter(set=>set.id!==a.id);
        break;
      case 'location.create':
      case 'location.update': {
        const locations=p.locations||=[];
        const location=cmd.type==='location.create'?{id:uid('location'),notes:''}:find(p,'locations',a.id);
        assert(typeof a.name==='string'&&a.name.trim(),'请输入地点名称');
        location.name=a.name.trim();
        if(a.notes!==undefined)location.notes=a.notes;
        if(a.parentId!==undefined)location.parentId=a.parentId;
        if(a.color!==undefined)location.color=a.color;
        if(cmd.type==='location.create')locations.push(location);
        result=location;
        break;
      }
      case 'location.delete': {
        requireDeletion(p,'location',a.id);
        const location=find(p,'locations',a.id);
        for(const child of p.locations)if(child.parentId===a.id)child.parentId=location.parentId||'';
        p.locations=p.locations.filter(entry=>entry.id!==a.id);
        for(const entry of [...p.nodes,...(p.outline||[])])if(entry.locationId===a.id)entry.locationId='';
        editSceneMaps(p,map=>{
          if(map.locationId===a.id)return null;
          map.areas=map.areas.filter(area=>area.locationId!==a.id);
          map.routes=map.routes.filter(route=>route.from!==a.id&&route.to!==a.id);
          return map;
        });
        break;
      }
      case 'location.assign': {
        const {nodeIds,locationId}=a;
        assert(Array.isArray(nodeIds)&&nodeIds.length,'请选择要指定地点的节点');
        if(locationId!=='')find({...p,locations:p.locations||[]},'locations',locationId);
        for(const id of new Set(nodeIds))find(p,'nodes',id).locationId=locationId;
        break;
      }
      case 'outline.create':
      case 'outline.update': {
        const entries=p.outline||=[];
        if(cmd.type==='outline.create'){
          result=outlineEntry(a,uid('outline'));
          entries.push(result);
        }else{
          const entry=find(p,'outline',a.id);
          const updated={...entry,...a.patch};
          if(!Object.hasOwn(a.patch,'sections')&&(Object.hasOwn(a.patch,'text')||outlineSections(entry)!==entry.sections))delete updated.sections;
          const normalized=outlineEntry(updated,entry.id);
          if(!normalized.sections)delete entry.sections;
          result=Object.assign(entry,normalized);
        }
        break;
      }
      case 'outline.delete':
        requireDeletion(p,'outline',a.id);
        p.outline=p.outline.filter(entry=>entry.id!==a.id);
        break;
      case 'group.create': {const g={id:uid('group'),name:a.name||'新分组',...(a.kind?{kind:a.kind}:{})};p.groups.push(g);result=g;break;}
      case 'group.rename': {const g=find(p,'groups',a.id);assert(typeof a.name==='string' && a.name.trim(),'请输入名称');g.name=a.name.trim();break;}
      case 'group.delete': {
        requireDeletion(p,'group',a.id);
        const cards=[...p.characters,...p.items,...p.scenes.flatMap(scene=>
          [...Object.values(scene.characters),...Object.values(scene.currentMetadata||{})])];
        for(const card of cards)if(card.groupId===a.id)card.groupId='';
        p.groups=p.groups.filter(group=>group.id!==a.id);
        break;
      }
      case 'library.import': result=importLibrary(p,a);break;
      case 'art.create': {
        const art={id:a.id??uid('art'),name:a.name,category:a.category||'other',notes:a.notes||'',image:a.image};
        (p.conceptArt ||= []).push(art);
        result={id:art.id};
        break;
      }
      case 'art.update': {
        const art=find({...p,conceptArt:p.conceptArt||[]},'conceptArt',a.id);
        Object.assign(art,{name:a.name,category:a.category,notes:a.notes});
        break;
      }
      case 'art.delete':
        requireDeletion(p,'art',a.id);
        p.conceptArt=(p.conceptArt||[]).filter(art=>art.id!==a.id);
        editSceneMaps(p,map=>{
          if(map.backgroundArtId===a.id)map.backgroundArtId='';
          if(map.elements)map.elements=map.elements.filter(entry=>entry.kind!=='image'||entry.artId!==a.id);
          return map;
        });
        break;
      case 'group.apply': {
        assert(groupsOf(p,'character').some(group=>group.id===a.groupId),'找不到角色分组');
        const members=p.characters.filter(c=>c.groupId===a.groupId);
        assert(members.length,'分组中没有角色');
        assert(a.tags===undefined||strings(a.tags),'标签必须为文本数组');
        const patch=a.patch===undefined?null:characterPatch(a.patch);
        for(const c of members){
          if(a.tags)c.tags=[...new Set([...c.tags,...a.tags])];
          if(patch)Object.assign(c,clone(patch));
          validateCharacter(p,c);
        }
        break;
      }
      case 'definitions.update': {for(const k of ['skills','attributes'])if(a[k]){a[k].forEach(safeKey);p.definitions[k]=[...new Set(a[k])];}break;}
      case 'node.create': {const n=makeNode(p,a.type,a.sceneId,a.data);assert(!p.nodes.some(x=>x.id===n.id),'节点 ID 重复');p.nodes.push(n);result=n;startDialogueSpeaker(n);syncNodeCharacters(p,n);break;}
      case 'node.update': {const n=find(p,'nodes',a.id),patch=clone(a.patch);delete patch.id;delete patch.type;delete patch.sceneId;Object.assign(n,patch);if(Object.hasOwn(patch,'date'))n.date=nodeDateText(n.date);if(Object.hasOwn(patch,'dialogueMode')||Object.hasOwn(patch,'refs'))startDialogueSpeaker(n);syncNodeCharacters(p,n);break;}
      case 'node.dialogueRule':{
        const n=find(p,'nodes',a.id);
        setDialogueRule(n,a.index,a.rule);
        syncNodeCharacters(p,n);
        break;
      }
      case 'node.dialogueContinue':{
        const n=find(p,'nodes',a.id);
        assert(hasDialogue(n)&&Number.isInteger(a.index)&&n.lines[a.index],'对话框已变动，请重新选择');
        n.dialogueRule ||= clone(defaultDialogueRule(n));
        const line={characterId:nextDialogueSpeaker(n,a.index),text:'',rule:clone(dialogueRuleAt(n,a.index))};
        n.lines.splice(a.index+1,0,line);
        syncNodeCharacters(p,n);
        result={index:a.index+1};
        break;
      }
      case 'node.addOutput': {const n=find(p,'nodes',a.id);assert(['dialogue','monologue','event'].includes(n.type),'此类型不能增加输出点');n.outputs.push(a.label||`分支 ${n.outputs.length+1}`);break;}
      case 'node.delete':removeNodes(p,new Set(a.ids||[a.id]));break;
      case 'node.transfer': {const ids=a.ids,s=sceneOf(p,a.sceneId),ns=p.nodes.filter(n=>ids.includes(n.id));assert(ns.length,'未选择节点');const map={};
        const sourceStates={};for(const sid of new Set(ns.map(n=>n.sceneId))){const t=trace({...p,currentSceneId:sid});sourceStates[sid]=t.history.find(h=>ids.includes(h.nodeId))?.before||clone(sceneOf(p,sid).characters);}
        for(const n of ns) {const newId=a.copy?uid('node'):n.id;map[n.id]=newId;for(const r of n.refs)if(r.kind==='character'&&!s.characters[r.id])s.characters[r.id]=clone(sourceStates[n.sceneId][r.id]||find(p,'characters',r.id));}
        const edges=p.edges.filter(e=>ids.includes(e.from)&&ids.includes(e.to));
        const minX=Math.min(...ns.map(n=>n.x)),minY=Math.min(...ns.map(n=>n.y));
        const copied=ns.map(n=>{
          const q=clone(n);q.id=map[n.id];q.sceneId=s.id;q.x=q.x-minX+100;q.y=q.y-minY+120;
          if(map[q.targetNodeId])q.targetNodeId=map[q.targetNodeId];
          if(map[q.condition.sourceEventId])q.condition.sourceEventId=map[q.condition.sourceEventId];
          else if(n.sceneId!==s.id)q.condition.sourceEventId='';
          if(a.copy)for(const op of q.operations)if(op.input)op.input.id=uid('input');
          return q;
        });
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
  return {TYPES,DIALOGUE_MODES,ITEM_A,ITEM_B,ITEM_C,ART_CATEGORIES,ART_FILE_LIMIT,ART_PROJECT_LIMIT,INVENTORY_LIMIT,MAP_SIZE,MAP_ELEMENT_MIN,MAP_SHAPES,MAP_LAYERS,uid,clone,find,sceneOf,sceneMap,groupsOf,hasDialogue,dialogueSpeakers,defaultDialogueRule,dialogueRuleAt,dialogueLogText,parseDialogueLog,nextDialogueSpeaker,dateKey,dateText,nodeDateKey,character,characterDisplayName,attributeToken,nodeAttributeReferences,resolveAttributeText,characterToken,characterTextParts,literalTextPattern,textMatches,replaceTextRanges,previewNodeTextReplacements,nodeCharacterReferences,characterReferenceValue,resolveCharacterText,profileOperations,item,itemSetTotals,inventoryWithItemSets,emptyProject,makeNode,ensureSceneCharacter,applyOperations,conditionValue,labelOperations,trace,present,timeline,storyLinks,storyRoute,storyScope,outlineLinkToken,outlineTextParts,outlineSections,displaySettings,diffCharacters,deletionImpact,validateProject,execute,demoProject};
});
