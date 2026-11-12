'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');
const {findUpdate,checkUpdate}=require('../update.cjs');

test('character variables resolve against route snapshots, including player names and earlier attribute tokens',()=>{
  const base=ST.demoProject(),sceneId=base.currentSceneId;
  const ref=(field,...keys)=>ST.characterToken('char_mira',field,...keys);
  const name=ref('name'),oldAttribute=ST.attributeToken('char_mira','生命');
  const text=[name,ref('id'),ref('summary'),oldAttribute,ref('skills','观察'),ref('item','item_letter'),
    ref('inventory','item_letter'),ref('tags'),ref('tags','主角'),ref('group'),ref('details')].join(' / ');
  const event=base.nodes.find(node=>node.id==='node_trade');
  const {project}=ST.execute(base,[
    {type:'node.update',args:{id:event.id,patch:{operations:[...event.operations,
      {kind:'characterField',characterId:'char_mira',key:'displayName',value:'旅人',input:{id:'name_1',prompt:'你的名字？'}},
      {kind:'characterField',characterId:'char_mira',key:'summary',value:'新简介'}
    ]}}},
    {type:'node.update',args:{id:'node_city',patch:{text}}}
  ]);
  const city=ST.find(project,'nodes','node_city');
  assert.equal(ST.nodeCharacterReferences(city).length,11);
  assert.ok(city.refs.some(entry=>entry.id==='char_mira'));
  const route=ST.trace(project,{choices:{node_condition:0},inputs:{name_1:'星河'}}).states[sceneId];
  const words=ST.resolveCharacterText(text,route,project).split(' / ');
  assert.deepEqual(words.slice(0,7),['星河','米拉卡','新简介','80','7','','0']);
  assert.equal(words[8],'主角');
  assert.equal(words[9],base.groups[0].name);
  const reverted=ST.trace(project,{choices:{node_condition:1},inputs:{name_1:'星河'}}).states[sceneId];
  assert.equal(ST.resolveCharacterText(name,reverted,project),'米拉卡');
  assert.equal(ST.resolveCharacterText(ref('inventory','item_letter'),reverted,project),'1');
  const c={...reverted.char_mira,image:'data:image/png;base64,iVBORw0KGgo=',itemAttributes:{item_letter:{'磨损:值}':0}}};
  const state={char_mira:c};
  assert.equal(ST.resolveCharacterText(ref('image'),state,project),'[image]');
  assert.equal(ST.resolveCharacterText(ref('itemAttributes','item_letter','磨损:值}'),state,project),'0');
  assert.equal(ST.resolveCharacterText('{{attr:char_mira:name:unexpected}}',state,project),'{{attr:char_mira:name:unexpected}}');
});

test('locations preserve nested parent and color data and reject invalid parent graphs',()=>{
  const base=ST.demoProject();
  const create=(project,args)=>ST.execute(project,[{type:'location.create',args}]);
  const {project,results:[parent]}=create(base,{name:'港城',color:'#675bff'});
  const {project:withChild,results:[child]}=create(project,{name:'码头',parentId:parent.id,color:'#48bcad'});
  const {project:assigned}=ST.execute(withChild,[{type:'location.assign',args:{locationId:child.id,nodeIds:['node_trade']}}]);
  assert.equal(ST.find(ST.validateProject(JSON.parse(JSON.stringify(assigned))),'locations',child.id).parentId,parent.id);
  assert.equal(ST.trace(assigned).history.find(h=>h.nodeId==='node_trade').locationId,child.id);
  assert.throws(()=>ST.execute(withChild,[{type:'location.update',args:{id:parent.id,name:'港城',parentId:child.id}}]),/自己的上级/);
  assert.throws(()=>create(withChild,{name:'无效',parentId:'bad'}),/找不到上级/);
  assert.throws(()=>create(withChild,{name:'无效',color:'red'}),/颜色无效/);
});

const release=(tag_name,extra={})=>({tag_name,published_at:'2026-11-09T00:00:00Z',...extra});
test('update checking compares published versions numerically, including prereleases',async()=>{
  const current='1.1.6-beta.2';
  const pages=[
    [release('v1.0.0'),release('v1.1.6-beta.10',{prerelease:true}),release('v4.0.0',{draft:true})],
    [release('v1.1.6'),release('nightly'),release('v1.1.6-beta.2+repack')]
  ];
  assert.equal(findUpdate(current,pages[0]).version,'1.1.6-beta.10');
  assert.equal(findUpdate('1.1.6',pages.flat()),null);
  let page=0;
  const found=await checkUpdate(current,async url=>{
    assert.match(url,/^https:\/\/api\.github\.com\/repos\/zlep123\/StoryTree\/releases\?/u);
    const rows=pages[page++];
    return new Response(JSON.stringify(rows),{headers:page===1?{link:'<ignored>; rel="next"'}:{}});
  });
  assert.deepEqual(found,{version:'1.1.6',url:'https://github.com/zlep123/StoryTree/releases/tag/v1.1.6'});
  await assert.rejects(checkUpdate(current,async()=>new Response('',{status:403})),/GitHub 403/);
});
