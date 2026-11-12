(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
  else root.CharacterImport=factory(root.ST);
})(globalThis,function(ST){
  'use strict';

  const MAX_LENGTH=60000;
  const fields={
    name:['角色id','角色 id','id','character id'],
    displayName:['角色名称','角色名','姓名','名字','名称','name','display name','character name'],
    summary:['简介','概述','summary','bio','short bio'],
    details:['详情','描述','背景','经历','人物设定','details','description','backstory','background'],
    tags:['标签','tags'],
    groupId:['分组','角色分组','group'],
    skills:['技能','技能栏','skills'],
    attributes:['属性','属性栏','attributes','stats'],
    inventory:['物品','物品栏','携带','装备','inventory','items','equipment'],
    itemSets:['物品组合','预设物品','物品预设','item set','item sets','inventory presets']
  };
  const aliases=new Map(Object.entries(fields).flatMap(([field,names])=>names.map(name=>[name,field])));
  const listFields=['tags','skills','attributes','inventory','itemSets'];
  const paragraphs=['summary','details'];
  const splitList=text=>text.split(/[\n,，、;；]+/u).map(value=>value.trim()).filter(Boolean);
  const unquote=text=>text.trim().replace(/^[「『“"'‘]|[」』”"'’]$/gu,'').trim();
  const isKey=key=>key.length>0&&key.length<=80&&!['__proto__','constructor','prototype'].includes(key);
  const sameName=(a,b)=>a.toLowerCase()===b.toLowerCase();

  function headings(text){
    const found=new Map(),prose=[];
    let active;
    for(const line of text.split(/\n|[；;](?=\s*[^；;:：\n]{1,30}[:：])/u)){
      const heading=/^\s*(?:[-*]\s+)?(?:#{1,6}\s*)?(?:\*\*)?([^:：\n]{1,30}?)(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*(.*)$/u.exec(line);
      const field=heading&&aliases.get(heading[1].trim().toLowerCase());
      if(field){
        const value=heading[2];
        if(listFields.includes(field)&&found.has(field))found.set(field,found.get(field)+'\n'+value);
        else found.set(field,value);
        active=paragraphs.includes(field)||listFields.includes(field)?field:null;
      }else if(active&&paragraphs.includes(active)){
        found.set(active,found.get(active)+'\n'+line);
      }else if(active&&listFields.includes(active)&&/^\s*[-*]\s+/u.test(line)){
        found.set(active,found.get(active)+'\n'+line.replace(/^\s*[-*]\s+/u,''));
      }else{
        active=null;
        prose.push(line);
      }
    }
    return {found,prose:prose.join('\n').trim()};
  }
  function proseName(text){
    const chinese=/(?:名叫|名字叫|叫作|叫做|我叫|他叫|她叫)\s*(?:[「『“"]([^」』”"\n]{1,40})[」』”"]|([\p{Script=Han}·]{1,14}?)(?=来自|是一|是个|今年|住在|[,，。！？；、\n]|$))/u.exec(text);
    if(chinese)return chinese[1]||chinese[2];
    const english=/\b(?:[Nn]amed|[Mm]y name is|[Hh]is name is|[Hh]er name is)\s+["“]?([A-Z][\p{L}'’-]*(?:[ \t]+[A-Z][\p{L}'’-]*){0,3})(?=[",.”;!?\n]|\s|$)/u.exec(text);
    return english?.[1]||'';
  }
  function profileHeader(text){
    const match=/^([\p{L}\p{N}_ .·'’－-]{1,40})[：:][ \t]*(?=(?:是|为|曾|原|从小|有着|穿着|戴着|来自|出生|她|他|they\b|is\b|was\b|wears\b))/iu.exec(text);
    if(!match||/^(?:旁白|场景|地点|时间|说明|备注|剧情|narrator|scene|note)$/iu.test(match[1].trim()))return {id:'',text};
    return {id:match[1].trim(),text:text.slice(match[0].length)};
  }
  function separateAppearance(text){
    const sentence=/^[^。！？!?\n]+[。！？!?]?/u.exec(text)?.[0]||'';
    const end=sentence.match(/[。！？!?]$/u)?.[0]||'';
    const clauses=(end?sentence.slice(0,-1):sentence).split(/[，,；;]/u).map(clause=>clause.trim());
    const appearance=[],rest=[];
    for(const clause of clauses){
      if(/^(?:(?:她|他)?(?:戴着|穿着|身穿|披着)|(?:她|他)?带着[^，。]*(?:头纱|面纱|面具|眼罩|帽子)|(?:她的|他的)?(?:脸颊|脸上|手腕|手臂|额头|脖子|眼角|左手|右手)[^，。]{0,18}(?:疤痕|伤疤|胎记|刺青))/u.test(clause))appearance.push(clause);
      else rest.push(clause);
    }
    if(!appearance.length)return {text,summary:''};
    const remaining=rest.filter(Boolean).join('，');
    return {text:(remaining?remaining+end:'')+text.slice(sentence.length).trimStart(),summary:appearance.join('，')};
  }
  function suggest(text,project,card,{isNew=false}={}){
    const source=text.replace(/\r\n?/gu,'\n').trim();
    if(source.length>MAX_LENGTH)throw Error('角色设定最多 60,000 个字符。');
    const {found,prose:rawProse}=headings(source),changes=[],warnings=[];
    const {id:headerId,text:prose}=profileHeader(rawProse);
    const warning=(code,detail)=>warnings.push({code,detail});
    const add=(field,value,key)=>{
      const previous=key===undefined?card[field]:Object.hasOwn(card[field],key)?card[field][key]:undefined;
      if(JSON.stringify(value)===JSON.stringify(previous))return;
      const additive=field==='tags'||(field==='inventory'&&previous===0);
      const replace=!additive&&(key===undefined?Boolean(previous):previous!==undefined)&&!(isNew&&(
        field==='name'||
        (field==='skills'&&previous===0)||
        (field==='attributes'&&previous===20)
      ));
      changes.push({field,key,value,previous,replace});
    };
    const name=unquote(found.get('displayName')||proseName(prose));
    const id=unquote(found.get('name')||headerId);
    if(isNew&&(id||name))add('name',id||name);
    if(!isNew&&id&&id!==card.name)warning('id',id);
    if(name&&(!isNew||name!==(id||name)))add('displayName',name);
    const sentence=prose.split(/(?<=[。！？!?])|(?<=\.)\s+|\n/u)[0]?.trim()||'';
    const appearance=found.get('summary')?.trim()?{text:prose,summary:''}:separateAppearance(prose);
    const summary=found.get('summary')?.trim()||appearance.summary||(!card.summary&&sentence.length<=140?sentence:'');
    const details=found.get('details')?.trim()||appearance.text;
    if(summary)add('summary',summary);
    if(details)add('details',details);
    const tags=splitList(found.get('tags')||'');
    if(tags.length)add('tags',[...new Set([...card.tags,...tags])]);
    if(found.get('groupId')?.trim()){
      const value=unquote(found.get('groupId'));
      const matches=ST.groupsOf(project,'character').filter(group=>sameName(group.name,value));
      if(matches.length===1)add('groupId',matches[0].id);
      else warning('group',value);
    }

    for(const [field,max] of [['skills',10],['attributes',100]]){
      const values=new Map();
      const score=(key,value,total,entry)=>{
        if(!isKey(key)||!/^\d+$/u.test(value)||Number(value)>max||(total&&Number(total)!==max)){
          warning(field,entry);return;
        }
        const known=Object.keys(card[field]).find(name=>sameName(name,key));
        values.set(known||key,Number(value));
      };
      for(const entry of splitList(found.get(field)||'')){
        const match=/^(.+?)(?:\s*[:：=＝]\s*|\s+)(-?\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(?:点|级)?$/u.exec(entry);
        if(match)score(match[1].trim(),match[2],match[3],entry);
        else warning(field,entry);
      }
      for(const key of Object.keys(card[field])){
        if(values.has(key))continue;
        const name=key.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
        const match=new RegExp('(?<![\\p{Script=Latin}\\d])'+name+
          '\\s*(?:[:：=＝]|为|是|\\bis\\b)\\s*(-?\\d+(?:\\.\\d+)?)(?:\\s*/\\s*(\\d+))?(?![\\d./])','iu').exec(prose);
        if(match)score(key,match[1],match[2],match[0]);
      }
      for(const [key,value] of values)add(field,value,key);
    }

    const inventory=new Map();
    const sets=project.itemSets||[],selectedSets=new Map();
    const namedSet=name=>sets.find(set=>sameName(set.name,unquote(name)));
    for(const entry of splitList(found.get('itemSets')||'')){
      const set=namedSet(entry);
      if(set)selectedSets.set(set.id,true);
      else warning('itemSet',entry);
    }
    const explicitItems=found.has('inventory');
    const itemText=found.get('inventory')||/(?:随身携带|携带着|携带|持有|带着|\b(?:carries|carrying)\b)\s*([^。！？.!?；;\n]+)/iu.exec(appearance.text)?.[1]||'';
    for(const entry of splitList(itemText)){
      const direct=project.items.filter(item=>sameName(item.name,unquote(entry)));
      const count=/^(.+?)\s*(?:[×xX*=:：]\s*|\s+)(-?\d+)$/u.exec(entry);
      const prefix=/^(-?\d+)\s*(?:[个把件瓶张枚份本支颗条]|\s)\s*(.+)$/u.exec(entry);
      const itemName=unquote(count?.[1]||prefix?.[2]||entry);
      const matches=direct.length?direct:project.items.filter(item=>sameName(item.name,itemName));
      const quantity=direct.length?1:Number(count?.[2]||prefix?.[1]||1);
      if(matches.length!==1||quantity<0||quantity>999999){
        const set=!matches.length&&explicitItems&&namedSet(entry);
        if(set)selectedSets.set(set.id,true);
        else if(explicitItems)warning('inventory',entry);
      }else if(explicitItems||quantity>0){
        inventory.set(matches[0].id,quantity);
      }
    }
    for(const [key,value] of inventory)add('inventory',value,key);
    const stock=prose.split(/[。！？!?\n]+/u).filter(sentence=>/买到|买来|有售|出售|售卖|货架|商品|存货|库存|携带|持有|\b(?:stocks|sells|carries|available to buy)\b/iu.test(sentence));
    for(const set of sets){
      if(selectedSets.has(set.id))continue;
      const key=set.name.toLowerCase();
      if(stock.some(sentence=>sentence.toLowerCase().includes(key)))selectedSets.set(set.id,false);
    }
    for(const [key,explicit] of selectedSets)changes.push({field:'itemSet',key,value:true,selected:explicit});
    return {changes,warnings};
  }
  return {MAX_LENGTH,suggest};
});
