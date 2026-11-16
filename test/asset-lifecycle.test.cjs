'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const ST=require('../core.js');

const command=(type,args)=>({type,args});
const apply=(project,...commands)=>ST.execute(project,commands).project;
const remove=(project,kind,id)=>apply(project,command(kind+'.delete',{id}));

test('scene deletion preserves other scenes and library assets, clearing incoming references',()=>{
  const seed=ST.demoProject(),main=seed.currentSceneId;
  const project=apply(seed,
    command('scene.create',{id:'later',name:'后续场景'}),
    command('node.create',{sceneId:'later',type:'jump',data:{id:'return',targetNodeId:'node_arrival'}}),
    command('node.create',{sceneId:'later',type:'condition',data:{id:'rollback'}}),
    command('edge.create',{from:'return',to:'rollback',output:0})
  );
  project.nodes.at(-1).condition.sourceEventId='node_trade';
  project.scenes[0].maps=[{locationId:'',backgroundArtId:'',areas:[],routes:[],elements:[
    {id:'crate',kind:'shape',shape:'rectangle',name:'箱子',color:'#a5beff',x:20,y:20,width:100,height:100}
  ]}];
  const impact=ST.deletionImpact(project,'scene',main);
  assert.deepEqual(impact.effects,{sceneNodes:5,sceneEdges:4,externalNodes:2,sceneCharacters:2,maps:1});
  const deleted=remove(project,'scene',main);
  assert.equal(deleted.currentSceneId,'later');
  assert.equal(deleted.nodes[0].targetNodeId,'');
  assert.equal(deleted.nodes[1].condition.sourceEventId,'');
  assert.equal(deleted.edges.length,1);
  assert.deepEqual(deleted.characters,project.characters);
  assert.deepEqual(deleted.items,project.items);
  assert.equal(project.scenes.length,2);
  assert.throws(()=>remove(deleted,'scene','later'),/至少需要保留一个场景/u);
  assert.throws(()=>remove(project,'scene',undefined),/找不到 scenes/u);
  const active=apply(project,command('scene.activate',{id:main}));
  assert.equal(remove(active,'scene',main).currentSceneId,'later');
  assert.equal(remove(active,'scene','later').currentSceneId,main);
});

test('location removal reparents children and clears only affected map and story associations',()=>{
  const seed=ST.demoProject(),sceneId=seed.currentSceneId;
  seed.locations=[
    {id:'town',name:'镇',notes:''},{id:'street',name:'街道',notes:'',parentId:'town'},
    {id:'inn',name:'旅店',notes:'',parentId:'street'},{id:'port',name:'港口',notes:'',parentId:'town'}
  ];
  const area=(locationId,x)=>({locationId,x,y:30,width:200,height:200});
  const project=apply(seed,
    command('location.assign',{nodeIds:['node_arrival'],locationId:'street'}),
    command('outline.create',{title:'旅程',locationId:'street',text:ST.outlineLinkToken('location','street')}),
    command('scene.map.update',{sceneId,locationId:'town',patch:{areas:[area('street',20),area('port',300)],routes:[{from:'street',to:'port',name:'港口路'}]}}),
    command('scene.map.update',{sceneId,locationId:'street',patch:{areas:[area('inn',35)]}})
  );
  const {effects}=ST.deletionImpact(project,'location','street');
  assert.deepEqual(effects,{children:1,nodes:1,outlines:1,maps:1,mapAreas:1,mapRoutes:1});
  const deleted=remove(project,'location','street');
  assert.equal(ST.find(deleted,'locations','inn').parentId,'town');
  assert.equal(deleted.nodes[0].locationId,'');
  assert.equal(deleted.outline[0].locationId,'');
  assert.equal(deleted.outline[0].text,project.outline[0].text);
  assert.deepEqual(deleted.scenes[0].maps,[{locationId:'town',backgroundArtId:'',areas:[area('port',300)],routes:[]}]);
});

test('group removal keeps members and clears snapshot membership, while used assets stay protected',()=>{
  const seed=ST.demoProject(),sceneId=seed.currentSceneId;
  const project=apply(seed,
    command('character.current',{characterId:'char_mira',sceneId,patch:{displayName:'旅人'}}),
    command('item.create',{id:'spare',name:'备用物品'}),
    command('itemSet.create',{name:'信件组合',entries:[{kind:'item',id:'item_letter',quantity:1}]})
  );
  assert.throws(()=>remove(project,'character','char_mira'),/角色仍有剧情或场景引用/u);
  assert.throws(()=>remove(project,'item','item_letter'),/物品仍在使用/u);
  assert.equal(remove(project,'item','spare').items.length,seed.items.length);
  const deleted=remove(project,'group','group_main');
  assert.equal(deleted.characters.length,project.characters.length);
  assert.equal(deleted.scenes[0].characters.char_mira.groupId,'');
  assert.equal(deleted.scenes[0].currentMetadata.char_mira.groupId,'');
  assert.equal(deleted.scenes[0].currentMetadata.char_mira.displayName,'旅人');
  const referenced=apply(project,command('node.update',{id:'node_trade',patch:{operations:[
    {kind:'characterField',key:'groupId',value:'group_main',mode:'set',characterId:'char_mira'}
  ]}}));
  assert.throws(()=>remove(referenced,'group','group_main'),/分组仍被剧情变化引用/u);
});
