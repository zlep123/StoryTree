'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');

const nameOperation={
  kind:'characterField',characterId:'char_mira',key:'displayName',mode:'set',direct:true,
  value:'无名旅人',input:{id:'player_name',prompt:'你叫什么名字？'}
};
const patchNode=(id,patch)=>({type:'node.update',args:{id,patch}});

test('player naming pauses atomically, resumes, and rolls back the display name on the false branch',()=>{
  const base=ST.demoProject(),event=base.nodes.find(n=>n.id==='node_trade');
  const {project}=ST.execute(base,[patchNode(event.id,{operations:[...event.operations,nameOperation]})]);
  const paused=ST.trace(project,{waitForInput:true});
  assert.equal(paused.status,'input');
  assert.deepEqual(paused.pendingInput,{...nameOperation.input,nodeId:event.id,characterId:'char_mira',defaultValue:'无名旅人'});
  assert.equal(paused.states[event.sceneId].char_mira.inventory.item_letter,1);
  assert.equal(ST.trace(project).history[1].after.char_mira.displayName,'无名旅人');
  const options={waitForInput:true,inputs:{player_name:'  星河  '}};
  const yes=ST.trace(project,{...options,choices:{node_condition:0}});
  const no=ST.trace(project,{...options,choices:{node_condition:1}});
  assert.equal(yes.history.at(-1).after.char_mira.displayName,'星河');
  assert.equal(yes.history.at(-1).after.char_mira.name,'米拉卡');
  assert.equal(ST.characterDisplayName(no.history.at(-1).after.char_mira),'米拉卡');
  const blank=ST.trace(project,{...options,inputs:{player_name:''}});
  assert.equal(blank.history[1].after.char_mira.displayName,'无名旅人');
  assert.equal(project.characters[0].displayName,undefined);
});

test('copied nodes get independent player prompts and preserve location references',()=>{
  const base=ST.demoProject(),event=base.nodes.find(n=>n.id==='node_trade');
  const {project,results}=ST.execute(base,[{type:'location.create',args:{name:'雾港',notes:'旧码头'}}]);
  const locationId=results[0].id;
  const copy=ST.execute(project,[
    patchNode(event.id,{operations:[nameOperation]}),
    {type:'location.assign',args:{nodeIds:[event.id,'node_arrival'],locationId}},
    {type:'node.transfer',args:{ids:[event.id],sceneId:event.sceneId,copy:true}}
  ]);
  const cloned=ST.find(copy.project,'nodes',copy.results[2].ids[0]);
  assert.notEqual(cloned.operations[0].input.id,nameOperation.input.id);
  assert.equal(cloned.locationId,locationId);
  assert.equal(ST.find(copy.project,'nodes','node_arrival').locationId,locationId);
  assert.throws(()=>ST.execute(copy.project,[{type:'location.assign',args:{nodeIds:[event.id],locationId:'missing'}}]),/找不到/);
  const cleared=ST.execute(copy.project,[{type:'location.assign',args:{nodeIds:[event.id],locationId:''}}]).project;
  assert.equal(ST.find(cleared,'nodes',event.id).locationId,'');
});

test('the same attribute token resolves against each route snapshot and survives JSON export',()=>{
  const base=ST.demoProject();
  const reference=ST.attributeToken('char_mira','生命'),line='生命为 '+reference;
  const {project}=ST.execute(base,[
    patchNode('node_trade',{text:line,operations:[{kind:'attribute',characterId:'char_mira',key:'生命',mode:'set',value:9}]}),
    patchNode('node_wait',{text:line})
  ]);
  const restored=ST.validateProject(JSON.parse(JSON.stringify(project)));
  const run=ST.trace(restored,{choices:{node_condition:1}});
  assert.equal(ST.resolveAttributeText(line,run.history[1].after),'生命为 9');
  assert.equal(ST.resolveAttributeText(line,run.history.at(-1).after),'生命为 80');
  const later=ST.find(restored,'nodes','node_wait');
  assert.deepEqual(ST.nodeAttributeReferences(later),[{token:reference,characterId:'char_mira',key:'生命'}]);
  assert.ok(later.refs.some(ref=>ref.id==='char_mira'));
  const special=ST.attributeToken('char_mira','值:%}');
  assert.equal(ST.resolveAttributeText(special,{char_mira:{attributes:{'值:%}':0}}}),'0');
});
