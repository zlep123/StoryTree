'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const ST=require('../core.js');
const Script=require('../script-import.js');

const sample=fs.readFileSync(path.join(__dirname,'../examples/Mist-Harbor-Script.txt'),'utf8');

test('Chinese scenes, dialogue with directions, prose and undecided dates',()=>{
  const draft=Script.parse(sample,'sample.txt',ST.demoProject().characters);
  assert.equal(draft.nodeCount,7);
  assert.deepEqual(draft.scenes.map(scene=>scene.nodes.map(node=>[node.type,node.date])),[
    [['monologue','1024.04.16'],['dialogue','1024.04.16'],['monologue','1024.04.16']],
    [['monologue',''],['dialogue',''],['monologue','']],
    [['monologue','1024.04.19']]
  ]);
  assert.equal(draft.scenes[0].nodes[1].lines[1].text,'（压低声音）\n等第三声钟响。\n别让守桥人看见这封信。');
  assert.match(draft.scenes[1].nodes[0].text,/^次日/);
  assert.deepEqual(draft.scenes[0].nodes[1].firstLine,6);
});

test('English screenplay cues, indented dialogue, Markdown headings and prose',()=>{
  const input=[
    'Written by: M. Green','',
    'INT. CABIN - NIGHT','[2032-02-29]','',
    '  RAVEN (V.O.)','    (whispering)','    Keep the lamp lit.','',
    '  NPC 1','    I can see the road.','',
    'CUT TO:','',
    'EXT. ROAD - DAWN','A cart rolls down the hill.'
  ].join('\n');
  const draft=Script.parse(input,'My Script.txt');
  assert.deepEqual(draft.scenes.map(scene=>scene.name),['My Script','INT. CABIN - NIGHT','EXT. ROAD - DAWN']);
  assert.deepEqual(draft.speakers.map(speaker=>speaker.name),['RAVEN','NPC 1']);
  const dialogue=draft.scenes[1].nodes[0];
  assert.equal(dialogue.date,'2032.02.29');
  assert.match(dialogue.lines[0].text,/^\(V\.O\.\)\n\(whispering\)/);
  assert.equal(draft.scenes[1].nodes[1].text,'CUT TO:');
  assert.equal(draft.scenes[2].nodes[0].date,'');
  assert.equal(Script.parse('## Part One\n\nPlain text.','other.txt').scenes[0].name,'Part One');
});

test('plain paragraphs, invalid dates, and relative times preserve prose',()=>{
  const draft=Script.parse(
    '第一段很短。\n换行接续。\n\n她说：“这是叙述。”\n如果玩家拿到钥匙：记录他的反应。\n\n日期：1234.2.30\n剧情继续。\n\n@date 1234-03-10\n大门打开。\n次日，风声更大。',
    '随笔.txt'
  );
  assert.equal(draft.scenes[0].name,'随笔');
  assert.equal(draft.speakers.length,0);
  assert.equal(draft.warnings[0].line,7);
  const nodes=draft.scenes[0].nodes;
  assert.equal(nodes[0].text,'第一段很短。\n换行接续。');
  assert.match(nodes[1].text,/她说.*\n如果玩家/u);
  assert.equal(nodes[2].text,'日期：1234.2.30\n剧情继续。');
  assert.equal(nodes[3].date,'1234.03.10');
  assert.equal(nodes[4].date,'');
});

test('UTF-8, BOM-marked UTF-16 and GB18030 decode strictly',()=>{
  assert.deepEqual(Script.decode(Buffer.from('\ufeff你好','utf8')),{text:'你好',encoding:'utf-8'});
  assert.deepEqual(Script.decode(Buffer.from('\ufeff你好','utf16le')),{text:'你好',encoding:'utf-16le'});
  assert.deepEqual(Script.decode(Buffer.from('feff4f60597d','hex')),{text:'你好',encoding:'utf-16be'});
  assert.deepEqual(Script.decode(Buffer.from('c4e3bac3','hex')),{text:'你好',encoding:'gb18030'});
  assert.throws(()=>Script.decode(Buffer.from([0x50,0x4b,0x03,0x04,0x00])),/编码/);
  assert.throws(()=>Script.decode(Buffer.alloc(Script.FILE_LIMIT+1)),/1 MB/);
});

test('import plan preserves prior scenes, uses role cards, connects jumps, and retains source lines',()=>{
  const before=ST.demoProject();
  const draft=Script.parse(sample,'sample.txt',before.characters);
  const planned=Script.plan(before,draft,{connectScenes:true,createCharacters:true});
  const {project}=ST.execute(before,planned.commands);
  assert.equal(project.scenes.length,before.scenes.length+3);
  assert.deepEqual(project.scenes[0],before.scenes[0]);
  assert.deepEqual(project.nodes.slice(0,before.nodes.length),before.nodes);
  assert.equal(project.characters.length,before.characters.length+1);
  assert.equal(project.characters.at(-1).name,'驿站守卫');
  assert.equal(project.currentSceneId,planned.sceneId);
  const trail=ST.trace(project).history;
  assert.equal(trail.length,9);
  assert.deepEqual(trail.filter(h=>h.type==='jump').map(h=>h.date),['1024.04.16','']);
  const dialogue=project.nodes.find(n=>n.id===trail[1].nodeId);
  assert.equal(dialogue.lines[0].characterId,'char_mira');
  assert.deepEqual(dialogue.scriptSource,{file:'sample.txt',firstLine:6,lastLine:8});
  assert.equal(project.scenes[1].characters.char_mira.id,'char_mira');
  assert.equal(ST.timeline(project).at(-1).date,'');
  assert.deepEqual(ST.validateProject(ST.clone(project)),project);
});

test('optional jump and character creation, plus same-name ambiguity',()=>{
  const original=ST.demoProject();
  const {project:duplicate}=ST.execute(original,[{type:'character.create',args:{name:'米拉卡'}}]);
  const draft=Script.parse(sample,'sample.txt',duplicate.characters);
  const withCards=Script.plan(duplicate,draft,{createCharacters:true});
  const {project}=ST.execute(duplicate,withCards.commands);
  assert.equal(withCards.jumps,0);
  assert.equal(project.characters.length,duplicate.characters.length+1);
  const first=project.nodes.filter(n=>n.sceneId===withCards.sceneId && n.type==='dialogue')[0];
  assert.deepEqual(first.lines[0],{characterId:'',text:'米拉卡：这条船今晚还开吗？'});
  const noCards=Script.plan(original,draft,{createCharacters:false,connectScenes:false});
  assert.equal(noCards.characters,0);
  assert.equal(ST.execute(original,noCards.commands).project.characters.length,original.characters.length);
});

test('undated nodes can acquire and clear a date, and continue a scene without inventing dates',()=>{
  const p=ST.emptyProject();
  const first=ST.makeNode(p,'monologue',p.currentSceneId,{date:''});
  p.nodes.push(first);
  const second=ST.makeNode(p,'monologue',p.currentSceneId);
  assert.equal(second.date,'');
  const {project:dated}=ST.execute(p,[{type:'node.update',args:{id:first.id,patch:{date:'8.2.29'}}}]);
  assert.equal(dated.nodes[0].date,'0008.02.29');
  const {project:cleared}=ST.execute(dated,[{type:'node.update',args:{id:first.id,patch:{date:''}}}]);
  assert.equal(cleared.nodes[0].date,'');
  assert.throws(()=>ST.execute(p,[{type:'node.update',args:{id:first.id,patch:{date:'9.2.29'}}}]),/日期/);
});

test('oversized and empty imports fail before making commands',()=>{
  assert.throws(()=>Script.parse(Array.from({length:61},(_,i)=>'# Scene '+i).join('\n'),'x.txt'),/60 个场景/);
  assert.throws(()=>Script.parse('Passage.\n\n'.repeat(501),'x.txt'),/500 个节点/);
  assert.throws(()=>Script.plan(ST.emptyProject(),Script.parse('# Scene 1\n\n','x.txt')),/剧本正文/);
});
