'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');

const commands=(p,...commands)=>ST.execute(p,commands);
const addSet=(p,name,entries=[])=>commands(p,{type:'itemSet.create',args:{name,entries}});
const item=(id,quantity)=>({kind:'item',id,quantity});
const set=(id,quantity)=>({kind:'set',id,quantity});
const update=(id,patch)=>({type:'itemSet.update',args:{id,patch}});
function fixture(){
  const p=ST.emptyProject();
  p.groups.push({id:'material',name:'材料',kind:'item'});
  p.items.push(ST.item({id:'twig',name:'枯枝',groupId:'material'}),ST.item({id:'stone',name:'碎石'}));
  return p;
}

test('reuses catalog cards with independent quantities, nested presets and additive snapshots',()=>{
  const p=fixture();
  const {project:withStock,results:[stock]}=addSet(p,'杂物',[item('twig',3),item('stone',2)]);
  const {project,results:[camp]}=addSet(withStock,'野营包',[item('twig',1),set(stock.id,2)]);
  assert.deepEqual(ST.inventoryWithItemSets(project,{twig:5},[camp.id]),{twig:12,stone:4});
  assert.deepEqual(ST.inventoryWithItemSets(project,{},[stock.id,camp.id]),{twig:10,stone:6});
  const applied=ST.inventoryWithItemSets(project,{},[stock.id]);
  const changed=commands(project,{type:'itemSet.addEntry',args:{id:stock.id,entry:item('twig',2)}}).project;
  assert.deepEqual(applied,{twig:3,stone:2});
  assert.deepEqual(ST.inventoryWithItemSets(changed,{},[camp.id]),{twig:11,stone:4});
  assert.equal(changed.items.length,2);
  assert.equal(changed.items[0].groupId,'material');
  assert.deepEqual(ST.validateProject(JSON.parse(JSON.stringify(changed))).itemSets,changed.itemSets);
  assert.ok(ST.outlineLinkToken('itemset',camp.id).includes(camp.id));
});

test('invalid, duplicate or cyclic presets fail atomically, as does inventory overflow',()=>{
  const p=fixture();
  const {project:withStock,results:[stock]}=addSet(p,'Stock',[item('twig',2)]);
  const {project,results:[camp]}=addSet(withStock,'Camp',[set(stock.id,2)]);
  const data=JSON.stringify(project);
  assert.throws(()=>commands(project,update(stock.id,{entries:[set(camp.id,1)]})),/循环/);
  assert.throws(()=>commands(project,update(camp.id,{name:' stock '})),/重复/);
  assert.throws(()=>commands(project,update(stock.id,{entries:[item('twig',1.5)]})),/整数/);
  assert.throws(()=>commands(project,update(stock.id,{entries:[item('twig',1),item('twig',2)]})),/重复/);
  assert.throws(()=>commands(project,update(stock.id,{entries:[item('missing',1)]})),/物品不存在/);
  assert.throws(()=>commands(project,update(camp.id,{entries:[set(stock.id,ST.INVENTORY_LIMIT)]})),/数量上限/);
  assert.throws(()=>commands(project,{type:'itemSet.delete',args:{id:stock.id}}),/正在被/);
  const inventory={twig:ST.INVENTORY_LIMIT-1};
  assert.throws(()=>ST.inventoryWithItemSets(project,inventory,[stock.id]),/角色的物品数量上限/);
  assert.equal(inventory.twig,ST.INVENTORY_LIMIT-1);
  assert.equal(JSON.stringify(project),data);
  assert.equal(ST.displaySettings({treeMode:'dates'}).treeMode,'branches');
  assert.equal(ST.displaySettings({treeMode:'locations'}).treeMode,'branches');
});
