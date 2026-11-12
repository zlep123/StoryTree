'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');

test('dialogue log round-trips speakers, blank entries, embedded colons and multi-line speech',()=>{
  const p=ST.demoProject(),node=p.nodes[0];
  const characters=[...p.characters,{id:'with:colon',name:'需要：转义'}];
  node.lines=[
    {characterId:'with:colon',text:'第一行：冒号\n\n\t第三行'},
    {characterId:'',text:''},
    {characterId:'char_mira',text:'\n有前导换行\r\n和 Windows 换行'}
  ];
  assert.deepEqual(ST.parseDialogueLog(ST.dialogueLogText(node,characters),node,characters),node.lines);
  assert.throws(()=>ST.parseDialogueLog('米拉卡：有对白\n未知角色：测试',node,characters),error=>error.line===2);
});

test('bulk dialogue edits retain per-line rules and give inserted lines the prior rule',()=>{
  const p=ST.demoProject(),node=p.nodes[0];
  const rule={mode:'same',participants:['char_mira']};
  node.lines=[
    {characterId:'char_ferryman',text:'第一句'},
    {characterId:'char_mira',text:'第二句',rule},
    {characterId:'char_ferryman',text:'第三句'}
  ];
  const log='渡鸦：第一句\n米拉卡：第二句改过\n米拉卡：新句\n渡鸦：第三句';
  const lines=ST.parseDialogueLog(log,node,p.characters);
  assert.deepEqual(lines.map(line=>line.rule),[undefined,rule,rule,undefined]);
  const moved=ST.parseDialogueLog('米拉卡：第二句\n渡鸦：第一句\n渡鸦：第三句',node,p.characters);
  assert.deepEqual(moved.map(line=>line.rule),[rule,undefined,undefined]);
  assert.equal(lines[2].text,'新句');
  const repeated=ST.parseDialogueLog('渡鸦：第一句\n渡鸦：第三句\n渡鸦：第三句',node,p.characters);
  assert.deepEqual(repeated.map(line=>line.rule),[undefined,rule,undefined]);
});

test('automatic dialogue starts with the first participant and round-robin wraps three speakers',()=>{
  const base=ST.demoProject();
  const sceneId=base.currentSceneId;
  const {project}=ST.execute(base,[
    {type:'character.create',args:{id:'third',name:'第三位'}},
    {type:'node.create',args:{type:'dialogue',sceneId,data:{id:'sample',dialogueMode:'round',refs:[
      {kind:'character',id:'char_mira'},{kind:'item',id:'item_letter'},
      {kind:'character',id:'char_ferryman'},{kind:'character',id:'third'}
    ]}}}
  ]);
  const node=project.nodes.at(-1);
  assert.deepEqual(ST.dialogueSpeakers(node),['char_mira','char_ferryman','third']);
  assert.equal(node.lines[0].characterId,'char_mira');
  for(let i=0;i<3;i++)node.lines.push({characterId:ST.nextDialogueSpeaker(node,i),text:''});
  assert.deepEqual(node.lines.map(line=>line.characterId),['char_mira','char_ferryman','third','char_mira']);
  assert.equal(base.nodes[0].dialogueMode,undefined);
});

test('same-speaker continuation follows the chosen speaker without changing earlier lines',()=>{
  const project=ST.demoProject();
  const node=project.nodes[0];
  const prior=ST.clone(node.lines);
  const result=ST.execute(project,[{type:'node.update',args:{id:node.id,patch:{dialogueMode:'same'}}}]).project.nodes[0];
  assert.deepEqual(result.lines,prior);
  assert.equal(ST.nextDialogueSpeaker(result,0),prior[0].characterId);
  assert.equal(ST.nextDialogueSpeaker(result,1),prior[1].characterId);
  assert.throws(()=>ST.execute(project,[{type:'node.update',args:{id:node.id,patch:{dialogueMode:'invalid'}}}]),/对话模式/);
});

test('preserving an orphaned draft leaves story fields and previous recovery entries intact',()=>{
  const base=ST.demoProject();
  base.recoveryEdits=[{nodeId:'legacy',field:'lines.1.text',value:'此前的草稿'}];
  const edit={id:'draft_test',nodeId:'node_city',title:'独白',field:'lines.1.text',value:'无法写到此独白的第二句'};
  const first=ST.execute(base,[{type:'project.keepRecoveryEdit',args:edit}]);
  assert.equal(first.results[0].recoveredDraftId,edit.id);
  assert.deepEqual(first.project.nodes,base.nodes);
  const repeated=ST.execute(first.project,[{type:'project.keepRecoveryEdit',args:{...edit,value:'最后一版文字'}}]).project;
  assert.equal(repeated.recoveryEdits.length,2);
  assert.deepEqual(repeated.recoveryEdits[0],base.recoveryEdits[0]);
  assert.equal(repeated.recoveryEdits[1].value,'最后一版文字');
});

test('inserting continuations preserves existing lines and copies only the source line rule',()=>{
  let project=ST.demoProject();
  const id=project.nodes[0].id;
  const original={mode:'round',participants:['char_mira','char_ferryman','']};
  const override={mode:'same',participants:['char_mira','third']};
  const advance=commands=>{project=ST.execute(project,commands).project;};
  const node=()=>project.nodes.find(n=>n.id===id);
  const rules=()=>node().lines.map((_,i)=>ST.dialogueRuleAt(node(),i));
  advance([
    {type:'character.create',args:{id:'third',name:'新角色'}},
    {type:'node.update',args:{id,patch:{lines:Array.from({length:10},(_,i)=>({characterId:original.participants[i%3],text:'原句 '+(i+1)}))}}},
    {type:'node.dialogueRule',args:{id,rule:original}}
  ]);
  // A legacy node obtains its initial rule when loaded, before the first line edit.
  for(const line of node().lines)delete line.rule;
  advance([{type:'node.dialogueRule',args:{id,index:6,rule:override}}]);
  advance([{type:'node.dialogueContinue',args:{id,index:6}},{type:'node.dialogueContinue',args:{id,index:7}}]);
  assert.deepEqual(rules(),[...Array(6).fill(original),...Array(3).fill(override),...Array(3).fill(original)]);
  assert.deepEqual(node().lines.slice(9).map(line=>line.text),['原句 8','原句 9','原句 10']);
  advance([{type:'node.dialogueContinue',args:{id,index:11}}]);
  assert.deepEqual(ST.dialogueRuleAt(node(),12),original);
  assert.equal(node().lines[12].characterId,'char_ferryman');
  assert.deepEqual(ST.defaultDialogueRule(node()),original);
  const before=rules();
  advance([{type:'node.dialogueRule',args:{id,rule:{mode:'round',participants:['','char_mira']}}}]);
  assert.deepEqual(rules(),before);
});
