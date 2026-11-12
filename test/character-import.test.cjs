'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');
const {suggest,MAX_LENGTH}=require('../character-import.js');

test('extracts a Chinese character draft from prose with labeled fields',()=>{
  const project=ST.emptyProject();
  project.items=[ST.item({id:'map',name:'航海图'})];
  project.groups=[{id:'crew',name:'船员'}];
  const draft=ST.character(project);
  const input='她叫林夏，是一名地图绘师。小时候随船远航。\n角色ID：cartographer\n分组：船员\n技能：观察 6、制图=8；属性：生命 75\n标签：港城、向导\n物品：2张航海图';
  const {changes,warnings}=suggest(input,project,draft,{isNew:true});
  assert.deepEqual(warnings,[]);
  assert.deepEqual(changes.map(({field,key,value})=>[key||field,value]),[
    ['name','cartographer'],['displayName','林夏'],['summary','她叫林夏，是一名地图绘师。'],
    ['details','她叫林夏，是一名地图绘师。小时候随船远航。'],['tags',['港城','向导']],
    ['groupId','crew'],['观察',6],['制图',8],['生命',75],['map',2]
  ]);
  assert.ok(changes.every(change=>!change.replace));
  assert.equal(draft.skills.观察,0);
});

test('proposes English profile updates without changing existing values or the character ID',()=>{
  const project=ST.emptyProject();
  project.items=[ST.item({id:'compass',name:'Compass'})];
  const draft=ST.character(project,{name:'mira',displayName:'Mira',summary:'Existing',tags:['captain'],skills:{Sailing:5},inventory:{compass:1}});
  const input='Her name is Mira Stone. She carries a journal.\nID: other\nSummary: A lighthouse keeper\nTags: sailor, captain\nSkills:\n- sailing: 7/10\n- Tracking: 3\nInventory: Compass x2, Journal, Compass x-1\nStats: Insight 25, Will 120\nGroup: Missing';
  const result=suggest(input,project,draft);
  const entry=(field,key)=>result.changes.find(change=>change.field===field&&change.key===key);
  assert.equal(entry('name'),undefined);
  assert.equal(entry('displayName').value,'Mira Stone');
  assert.ok(entry('summary').replace);
  assert.ok(entry('skills','Sailing').replace);
  assert.equal(entry('skills','Tracking').replace,false);
  assert.ok(entry('inventory','compass').replace);
  assert.deepEqual(entry('tags').value,['captain','sailor']);
  assert.deepEqual(result.warnings.map(warning=>warning.code),['id','group','attributes','inventory','inventory']);
  assert.equal(draft.inventory.compass,1);
});

test('keeps unstructured prose and extracts explicit scores without inventing ambiguous items',()=>{
  const project=ST.emptyProject();
  project.items=[ST.item({id:'map1',name:'航海图'}),ST.item({id:'map2',name:'航海图'})];
  const draft=ST.character(project);
  const result=suggest('她名叫「关雁」。生命为65，观察为5。她携带航海图。',project,draft,{isNew:true});
  assert.deepEqual(result.changes.filter(change=>change.key).map(change=>[change.key,change.value]),[['观察',5],['生命',65]]);
  assert.equal(result.changes.find(change=>change.field==='name').value,'关雁');
  assert.throws(()=>suggest('x'.repeat(MAX_LENGTH+1),project,draft),/60,000/);
});

test('extracts the merchant ID, visual description and a known stock preset from natural prose',()=>{
  const project=ST.emptyProject();
  project.items=[ST.item({id:'twig',name:'枯枝'}),ST.item({id:'veil',name:'黑色头纱'})];
  project.itemSets=[{id:'stock',name:'杂物',entries:[{kind:'item',id:'twig',quantity:3}]}];
  const opening='是一个失去了丈夫的年轻女人';
  const rest='她的丈夫是一个冒险者，在三年前进入森林后遭到了某种蜘蛛的袭击，整支队伍都受到了攻击，只有两个幸存者离开。她暗自发誓为丈夫报仇，但是进入森林后遇到蜘蛛发现那蜘蛛并非是现世的事物，她惊险逃脱后又开始想办法。玩家可以向她出售各种各样的武器，也可以出售材料和护甲，在她那里能买到的东西反而不多，大多都是一些森林中常见的杂物。';
  const text='黑市商人a：'+opening+'，带着黑色头纱，手腕上有一条疤痕。'+rest;
  const result=suggest(text,project,ST.character(project),{isNew:true});
  assert.deepEqual(result.changes.map(({field,key,value,selected})=>[field,key,value,selected]),[
    ['name',undefined,'黑市商人a',undefined],['summary',undefined,'带着黑色头纱，手腕上有一条疤痕',undefined],
    ['details',undefined,opening+'。'+rest,undefined],['itemSet','stock',true,false]
  ]);
  const noSets={...project,itemSets:[]};
  assert.ok(!suggest(text,noSets,ST.character(noSets),{isNew:true}).changes.some(change=>change.field==='itemSet'));
  assert.deepEqual(suggest('物品组合：杂物',project,ST.character(project)).changes,[{field:'itemSet',key:'stock',value:true,selected:true}]);
});
