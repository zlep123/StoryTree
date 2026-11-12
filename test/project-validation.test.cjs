'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ST=require('../core.js');

test('character updates and MCP batches preserve both IDs and reject unrecognized patch fields',()=>{
  const p=ST.demoProject(),id=p.characters[0].id;
  const run=(type,args)=>ST.execute(p,[{type,args}]);
  for(const patch of [{id:'renamed'},{name:'renamed'}]){
    assert.throws(()=>run('group.apply',{groupId:'group_main',patch}),/角色ID/);
    assert.throws(()=>run('character.update',{id,patch}),/角色ID/);
  }
  const untrusted=JSON.parse('{"__proto__":{"summary":"spoofed"}}');
  assert.throws(()=>run('group.apply',{groupId:'group_main',patch:untrusted}),/不能更新角色字段/);
  assert.throws(()=>run('character.update',{id,patch:{attributes:{生命:'20'}}}),/必须是数字/);
  const updated=run('group.apply',{groupId:'group_main',patch:{summary:'同行者'},tags:['队友']}).project;
  assert.ok(updated.characters.every(card=>card.summary==='同行者'&&card.tags.includes('队友')));
  assert.deepEqual(updated.characters.map(card=>[card.id,card.name]),p.characters.map(card=>[card.id,card.name]));
});

test('legacy numeric text is normalized at load boundaries and missing references are rejected',()=>{
  const p=ST.demoProject();
  const scene=p.scenes[0],role=scene.characters.char_mira;
  role.attributes.生命='20';
  p.items[0].attributes.完整度='80';
  assert.throws(()=>ST.validateProject(p),/必须是数字/);
  ST.validateProject(p,{legacyNumbers:true});
  const result=ST.applyOperations(p,scene.id,scene.characters,[{kind:'attribute',characterId:role.id,key:'生命',mode:'add',value:5}]);
  assert.equal(result.characters[role.id].attributes.生命,25);
  assert.equal(p.items[0].attributes.完整度,80);
  p.nodes[0].refs.push({kind:'character',id:'missing'});
  assert.throws(()=>ST.validateProject(p),/节点素材引用无效/);
  p.nodes[0].refs.pop();
  role.id='wrong';
  assert.throws(()=>ST.validateProject(p),/场景快照引用无效/);
});
