'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');

test('event dialogue can use per-line rules without replacing event operations',()=>{
  const base=ST.demoProject(),event=base.nodes.find(n=>n.type==='event');
  const {project}=ST.execute(base,[
    {type:'node.dialogueRule',args:{id:event.id,rule:{mode:'round',participants:['char_mira','char_ferryman']}}},
    {type:'node.dialogueContinue',args:{id:event.id,index:0}}
  ]);
  const changed=project.nodes.find(n=>n.id===event.id);
  assert.deepEqual(changed.operations,event.operations);
  assert.deepEqual(changed.lines.map(line=>line.characterId),['char_mira','char_ferryman']);
  assert.equal(ST.dialogueRuleAt(changed,1).mode,'round');
});

test('character IDs stay fixed and profile edits follow and roll back with an event',()=>{
  const base=ST.demoProject(),mira=base.characters.find(c=>c.id==='char_mira');
  const event=base.nodes.find(n=>n.type==='event');
  const updated={...mira,displayName:'夜行客',summary:'新简介',details:'新详情',image:'data:image/png;base64,iVBORw0KGgo=',groupId:''};
  const operations=ST.profileOperations(mira,updated);
  assert.equal(ST.characterDisplayName(mira),mira.name);
  assert.throws(()=>ST.execute(base,[{type:'character.update',args:{id:mira.id,patch:{name:'替换ID'}}}]),/角色ID/);
  assert.throws(()=>ST.applyOperations(base,event.sceneId,base.scenes[0].characters,[{kind:'characterField',key:'name',characterId:mira.id,value:'替换ID'}]),/字段无效/);
  const {project}=ST.execute(base,[{type:'node.update',args:{id:event.id,patch:{operations:[...event.operations,...operations]}}}]);
  const on=ST.trace(project,{choices:{node_condition:0}});
  const off=ST.trace(project,{choices:{node_condition:1}});
  const active=on.history.find(h=>h.nodeId===event.id).after[mira.id];
  for(const key of ['name','displayName','summary','details','image','groupId'])assert.equal(active[key],updated[key]);
  assert.equal(ST.characterDisplayName(on.history.at(-1).after[mira.id]),'夜行客');
  assert.equal(ST.characterDisplayName(off.history.at(-1).after[mira.id]),mira.name);
  assert.equal(off.history.at(-1).after[mira.id].summary,mira.summary);
  assert.deepEqual(project.characters.find(c=>c.id===mira.id),mira);
});

test('explicit character fields on a label apply to one actor, and condition edits follow evaluation',()=>{
  const p=ST.demoProject(),condition=p.nodes.find(n=>n.type==='condition'),sceneId=p.currentSceneId;
  const byId={kind:'characterField',key:'displayName',value:'新称呼',characterId:'char_mira',direct:true};
  const {project}=ST.execute(p,[
    {type:'node.update',args:{id:condition.id,patch:{operations:[byId]}}},
    {type:'node.create',args:{type:'label',sceneId,data:{id:'direct_label',operations:[byId]}}}
  ]);
  const h=ST.trace(project,{choices:{node_condition:1}}).history.find(entry=>entry.nodeId===condition.id);
  assert.equal(h.after.char_mira.displayName,'新称呼');
  assert.equal(h.after.char_ferryman.displayName,undefined);
  assert.equal(ST.trace(project,{startNodeId:'direct_label'}).history[0].after.char_mira.displayName,'新称呼');
});
