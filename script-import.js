(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory(require('./core.js'));
  else root.StoryScript=factory(root.ST);
})(globalThis,function(ST){
  'use strict';

  const FILE_LIMIT=1024*1024;
  const MAX_NODES=500;
  const MAX_SCENES=60;
  const MAX_TURNS=5;
  const reserved=new Set([
    '旁白','叙述','动作','舞台指示','镜头','音效','音乐','转场','地点','时间','日期','提示','注释','说明','备注',
    '角色','标题','剧本','作者','背景','舞台','场景','字幕','分支','选项','条件','结局',
    'narrator','narration','action','camera','sfx','music','sound','note','notes','time','date','location',
    'transition','cut to','fade in','fade out','fade to black','cut to black','black screen','the end',
    'title','author','written by','scene','character','choice','condition','prologue','epilogue','montage','http','https'
  ]);
  const nameKey=name=>name.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
  const clip=(value,length)=>{
    const letters=Array.from(value.replace(/\s+/gu,' ').trim());
    return letters.length>length?letters.slice(0,length-1).join('')+'…':letters.join('');
  };

  function decode(bytes){
    if(bytes.byteLength>FILE_LIMIT)throw Error('TXT 文件最大为 1 MB');
    const data=new Uint8Array(bytes);
    let encoding='utf-8',text;
    const decoder=label=>new TextDecoder(label,{fatal:true}).decode(data);
    try{
      if(data[0]===0xff && data[1]===0xfe)encoding='utf-16le';
      else if(data[0]===0xfe && data[1]===0xff)encoding='utf-16be';
      try{text=decoder(encoding);}
      catch(error){
        if(encoding!=='utf-8' || (data[0]===0xef && data[1]===0xbb && data[2]===0xbf))throw error;
        encoding='gb18030';
        text=decoder(encoding);
      }
    }catch{throw Error('无法读取文本编码，请用 UTF-8 重新保存 TXT');}
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]/u.test(text))throw Error('无法读取文本编码，请用 UTF-8 重新保存 TXT');
    return {text,encoding};
  }

  function calendarDate(value){
    const raw=value.normalize('NFKC').trim();
    const parts=/^(\d{1,4})([./-])(\d{1,2})\2(\d{1,2})$/u.exec(raw);
    const chinese=/^(\d{1,4})年\s*(\d{1,2})月\s*(\d{1,2})日$/u.exec(raw);
    const date=parts?[parts[1],parts[3],parts[4]]:chinese?.slice(1);
    if(!date)return '';
    try{return ST.dateText(date.join('.'));}catch{return '';}
  }

  function sceneHeading(line){
    if(line.length>180)return null;
    const plain=line.replace(/^【(.*)】$/u,'$1');
    const explicit=/^(?:#{1,3}\s+|(?:场景|场次|scene)\s*[：:]\s*)(\S.*)$/iu.exec(plain);
    const numbered=/^(?:第[零〇一二三四五六七八九十百千\d]+[幕场章节]|(?:场景|场次)\s*\d+|(?:scene|act)\s+\d+)(?:$|[\s：:·—-].*)$/iu;
    const screenplay=/^(?:(?:INT|EXT)\.\s*(?:\/\s*(?:INT|EXT)\.\s*)?|(?:INT\/EXT|I\/E)\.\s*)\S/iu;
    if(!explicit && !numbered.test(plain) && !screenplay.test(plain))return null;
    const name=explicit?.[1]||plain;
    const stamp=/[\[【(（]([^\]】)）]+)[\]】)）]\s*$/u.exec(name);
    return {name,date:stamp?calendarDate(stamp[1]):''};
  }

  function dateMarker(line){
    const normalized=line.normalize('NFKC');
    const named=/^(?:日期|时间|date|time)\s*:\s*(.*)$|^@date\s+(.+)$/iu.exec(normalized);
    const unwrapped=/^\[(.+)\]$/u.exec(normalized)?.[1] || normalized;
    const candidate=named ? (named[1] ?? named[2]) : unwrapped;
    const date=calendarDate(candidate);
    if(date)return {date};
    if(named || /^\d{1,4}(?:[./-]\d{1,2}[./-]\d{1,2}|年\s*\d{1,2}月\s*\d{1,2}日)$/u.test(candidate)){
      return {date:'',invalid:/^\d{1,4}(?:[./-]|年)/u.test(candidate)};
    }
    return null;
  }

  function speakerLabel(label,known){
    const part=/^(.+?)(?:\s*([（(][^()（）]{1,45}[）)]))?$/u.exec(label.trim());
    if(!part)return null;
    const name=part[1].trim(),key=nameKey(name);
    const shortName=/^[\p{L}][\p{L}\p{M}\p{N}.'’· -]{0,39}$/u.test(name) &&
      name.split(/\s+/u).length<=5 && (!/\p{Script=Han}/u.test(name) || name.length<=12);
    const clause=/^(?:如果|假如|若是|否则|随后|这时|当.+时|(?:if|when|unless|then|after|before|option|branch)\b)|(?:说道|问道|喊道|写道|说|问|喊)$/iu.test(name);
    if(reserved.has(key) || (!known.has(key) && (!shortName || clause)))return null;
    return {name,key,direction:part[2]||''};
  }

  function cue(line,next,known){
    const colon=/^([^:：]{1,90})[:：][ \t]*(.*)$/u.exec(line);
    if(colon){
      const label=speakerLabel(colon[1],known);
      if(label)return {...label,text:colon[2],continued:!colon[2]};
    }
    if(!next || !next.trim() || sceneHeading(next.trim()) || dateMarker(next.trim()))return null;
    const label=speakerLabel(line,known);
    if(!label)return null;
    const uppercase=/^[A-Z][A-Z0-9.'’ -]{1,35}$/u.test(label.name);
    if(uppercase || (known.has(label.key) && /^\s/u.test(next)) || (label.direction && /^\s/u.test(next))){
      return {...label,text:'',continued:true};
    }
    return null;
  }

  function parse(text,file,characters=[]){
    const rows=text.replace(/\r\n?/gu,'\n').split('\n');
    const known=new Set(characters.map(c=>nameKey(c.name)));
    const scenes=[],warnings=[],speakers=new Map();
    const fallback=file.replace(/\.[^.]+$/u,'').trim()||'Script';
    let scene,date='',prose=[],turns=[],turn=null,nodeCount=0;

    function newScene(name,line,day=''){
      if(scenes.length===MAX_SCENES)throw Error('每次最多导入 60 个场景');
      scene={name,line,nodes:[]};
      scenes.push(scene);
      date=day;
    }
    function push(node){
      if(++nodeCount>MAX_NODES)throw Error('每次最多导入 500 个节点（含跳转）');
      if(!scene)newScene(fallback,node.firstLine);
      scene.nodes.push({...node,date});
    }
    function flushProse(){
      if(!prose.length)return;
      const text=prose.map(row=>row.raw).join('\n');
      push({type:'monologue',title:clip(prose[0].raw,38),text,firstLine:prose[0].line,lastLine:prose.at(-1).line});
      prose=[];
    }
    function flushDialogue(){
      if(!turns.length)return;
      push({type:'dialogue',title:clip(turns[0].name+' · '+turns[0].text,38),lines:turns,firstLine:turns[0].line,lastLine:turns.at(-1).lastLine});
      turns=[];
    }
    function finishTurn(){
      if(!turn)return;
      const current=turn;
      turn=null;
      if(!current.lines.length){
        flushDialogue();
        prose.push({raw:current.raw,line:current.line});
        return;
      }
      const text=[current.direction,...current.lines].filter(Boolean).join(current.direction && current.lines.length===1?' ':'\n');
      turns.push({key:current.key,name:current.name,text,line:current.line,lastLine:current.lastLine});
      if(!speakers.has(current.key))speakers.set(current.key,current.name);
      if(turns.length===MAX_TURNS)flushDialogue();
    }
    function boundary(){
      finishTurn();
      flushDialogue();
      flushProse();
    }

    for(const [index,raw] of rows.entries()){
      const line=index+1,body=raw.trim();
      if(!body){
        finishTurn();
        flushProse();
        continue;
      }
      const heading=sceneHeading(body);
      if(heading){
        boundary();
        newScene(heading.name,line,heading.date);
        continue;
      }
      const stamp=dateMarker(body);
      if(stamp){
        boundary();
        if(!scene)newScene(fallback,line);
        date=stamp.date;
        if(stamp.date)continue;
        if(stamp.invalid)warnings.push({line,text:body});
        prose.push({raw,line});
        continue;
      }
      const nextCue=cue(body,rows[index+1],known);
      const indented=/^[\t \u3000]/u.test(raw);
      if(turn && !nextCue && (indented || turn.continued)){
        turn.lines.push(raw.trim());
        turn.lastLine=line;
        continue;
      }
      finishTurn();
      if(nextCue){
        flushProse();
        turn={...nextCue,raw,line,lastLine:line,lines:nextCue.text?[nextCue.text]:[]};
        continue;
      }
      flushDialogue();
      if(/^(?:次日|翌日|第二天|[零〇一二三四五六七八九十百\d]+(?:天|日|周|个月|月|年|小时)后|the next day|later that day)(?:$|[\s，,。.!！…：:])/iu.test(body)){
        flushProse();
        date='';
      }
      prose.push({raw,line});
    }
    boundary();
    return {file,scenes,speakers:[...speakers].map(([key,name])=>({key,name})),warnings,nodeCount};
  }

  function resolveSpeakers(project,preview){
    const byName=new Map();
    for(const character of project.characters){
      const key=nameKey(character.name);
      if(!byName.has(key))byName.set(key,[]);
      byName.get(key).push(character);
    }
    return preview.speakers.map(speaker=>{
      const matches=byName.get(speaker.key)||[];
      return {...speaker,id:matches.length===1?matches[0].id:'',ambiguous:matches.length>1};
    });
  }

  function plan(project,preview,options={}){
    if(!preview.nodeCount)throw Error('没有找到可以导入的剧本正文');
    const commands=[],speakerIds=new Map();
    let characters=0,undated=0,jumps=0;
    for(const speaker of resolveSpeakers(project,preview)){
      let id=speaker.id;
      if(!id && !speaker.ambiguous && options.createCharacters){
        id=ST.uid('char');
        commands.push({type:'character.create',args:{id,name:speaker.name}});
        characters++;
      }
      if(id)speakerIds.set(speaker.key,id);
    }
    const scenes=preview.scenes.map(scene=>({
      ...scene,id:ST.uid('scene'),nodes:scene.nodes.map(node=>({...node,id:ST.uid('node')}))
    }));
    const playable=scenes.filter(scene=>scene.nodes.length);
    const nextScenes=new Map(playable.slice(0,-1).map((scene,i)=>[scene.id,playable[i+1]]));
    const onward=options.continueLabel||'继续';
    for(const scene of scenes){
      commands.push({type:'scene.create',args:{id:scene.id,name:scene.name}});
      let previous='';
      const next=nextScenes.get(scene.id);
      const nodes=[...scene.nodes];
      if(next && options.connectScenes){
        jumps++;
        nodes.push({type:'jump',id:ST.uid('node'),date:nodes.at(-1).date,
          title:(options.jumpLabel||'前往')+' '+clip(next.name,30),targetNodeId:next.nodes[0].id});
      }
      for(const [index,node] of nodes.entries()){
        const data={id:node.id,title:node.title,date:node.date,x:100+(index%3)*385,y:100+Math.floor(index/3)*320,outputs:[onward]};
        if(!node.date)undated++;
        if(node.firstLine)data.scriptSource={file:preview.file,firstLine:node.firstLine,lastLine:node.lastLine};
        if(node.type==='dialogue')data.lines=node.lines.map(line=>{
          const characterId=speakerIds.get(line.key)||'';
          return {characterId,text:characterId?line.text:line.name+'：'+line.text};
        });
        else if(node.type==='monologue')data.text=node.text;
        else data.targetNodeId=node.targetNodeId;
        commands.push({type:'node.create',args:{type:node.type,sceneId:scene.id,data}});
        if(previous)commands.push({type:'edge.create',args:{from:previous,to:node.id}});
        previous=node.id;
      }
    }
    if(preview.nodeCount+jumps>MAX_NODES)throw Error('每次最多导入 500 个节点（含跳转）');
    commands.push({type:'scene.activate',args:{id:playable[0].id}});
    return {commands,sceneId:playable[0].id,firstNodeId:playable[0].nodes[0].id,nodes:preview.nodeCount+jumps,jumps,undated,characters};
  }

  return {FILE_LIMIT,MAX_NODES,decode,parse,resolveSpeakers,plan};
});
