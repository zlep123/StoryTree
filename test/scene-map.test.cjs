'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ST=require('../core.js');

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';
function fixture(){
  const p=ST.demoProject();
  p.locations=[
    {id:'forest',name:'森林',notes:''},
    {id:'gate',name:'入口',notes:'',parentId:'forest'},
    {id:'lake',name:'湖泊',notes:'',parentId:'forest'}
  ];
  p.conceptArt=[{id:'ref',name:'森林底图',notes:'',category:'map',image}];
  return p;
}
const area=(locationId,x,y)=>({locationId,x,y,width:190,height:110});
const route={from:'gate',to:'lake',name:'林间小路'};
const update=(sceneId,locationId,patch)=>({type:'scene.map.update',args:{sceneId,locationId,patch}});

test('maps stay separate by scene and scope and survive portable serialization',()=>{
  const base=fixture(),scene=base.currentSceneId;
  const {project}=ST.execute(base,[
    update(scene,'',{areas:[area('forest',50,40)]}),
    update(scene,'forest',{areas:[area('gate',40,100),area('lake',400,300)],routes:[route],backgroundArtId:'ref'}),
    {type:'scene.create',args:{id:'other',name:'另一幕'}},
    update('other','forest',{areas:[area('gate',800,200)]})
  ]);
  assert.equal(base.scenes[0].maps,undefined);
  assert.equal(ST.sceneMap(ST.sceneOf(project,scene),'forest').routes[0].name,'林间小路');
  assert.equal(ST.sceneMap(ST.sceneOf(project,'other'),'forest').areas[0].x,800);
  assert.deepEqual(ST.validateProject(JSON.parse(JSON.stringify(project))).scenes,project.scenes);
  const deleted=ST.execute(project,[{type:'art.delete',args:{id:'ref'}}]).project;
  assert.equal(ST.sceneMap(ST.sceneOf(deleted,scene),'forest').backgroundArtId,'');
  assert.deepEqual(ST.sceneMap(ST.sceneOf(deleted,scene),'forest').routes,[route]);
});

test('map changes reject invalid bounds, unknown locations, and dangling or duplicate routes atomically',()=>{
  const base=fixture(),scene=base.currentSceneId;
  const {project}=ST.execute(base,[update(scene,'forest',{areas:[area('gate',40,100),area('lake',400,300)],routes:[route]})]);
  const save=patch=>ST.execute(project,[update(scene,'forest',patch)]);
  assert.throws(()=>save({areas:[area('gate',1599,0)],routes:[]}),/范围必须在地图内/u);
  assert.throws(()=>save({areas:[area('missing',0,0)],routes:[]}),/找不到地图上的地点/u);
  assert.throws(()=>save({areas:[area('gate',0,0)]}),/已布置的地点/u);
  assert.throws(()=>save({routes:[route,{from:'lake',to:'gate',name:''}]}),/已有路线/u);
  assert.throws(()=>save({backgroundArtId:'missing'}),/找不到地图底图/u);
  assert.equal(ST.sceneMap(ST.sceneOf(project,scene),'forest').areas.length,2);
  assert.equal(save({areas:[],routes:[]}).project.scenes[0].maps.length,0);
});

test('map elements are additive to old maps and separate from story character state',()=>{
  const base=fixture(),scene=base.currentSceneId;
  const marker={id:'marker',kind:'character',characterId:'map-only',x:48,y:80,width:150,height:58};
  const shape={id:'wall',kind:'shape',shape:'rectangle',name:'墙壁',color:'#63abc2',x:210,y:10,width:90,height:130};
  const old=ST.execute(base,[update(scene,'forest',{backgroundArtId:'ref'})]).project;
  assert.equal(ST.sceneMap(ST.sceneOf(old,scene),'forest').elements,undefined);
  const {project}=ST.execute(old,[
    {type:'character.create',args:{id:'map-only',name:'地图角色'}},
    update(scene,'forest',{elements:[marker,shape]}),
    update(scene,'',{elements:[{...marker,x:420}]}),
    {type:'art.delete',args:{id:'ref'}}
  ]);
  const map=ST.sceneMap(ST.sceneOf(project,scene),'forest');
  assert.equal(map.backgroundArtId,'');
  assert.deepEqual(map.elements,[marker,shape]);
  assert.equal(ST.sceneMap(ST.sceneOf(project,scene)).elements[0].x,420);
  assert.equal(ST.sceneOf(project,scene).characters['map-only'],undefined);
  assert.deepEqual(ST.validateProject(JSON.parse(JSON.stringify(project))).scenes,project.scenes);
  const changed=ST.execute(project,[update(scene,'forest',{areas:[area('gate',10,10)]})]).project;
  assert.deepEqual(ST.sceneMap(ST.sceneOf(changed,scene),'forest').elements,[marker,shape]);
  const deleted=ST.execute(project,[{type:'character.delete',args:{id:'map-only'}}]).project;
  assert.deepEqual(ST.sceneMap(ST.sceneOf(deleted,scene),'forest').elements,[shape]);
  assert.equal(ST.sceneOf(deleted,scene).maps.length,1);
});

test('map elements reject invalid coordinates, characters and shapes',()=>{
  const base=fixture(),scene=base.currentSceneId;
  const marker={id:'marker',kind:'character',characterId:'char_mira',x:48,y:80,width:150,height:58};
  const shape={id:'wall',kind:'shape',shape:'ellipse',name:'墙壁',color:'#63abc2',x:210,y:10,width:90,height:130};
  const save=elements=>ST.execute(base,[update(scene,'',{elements})]);
  assert.throws(()=>save([{...shape,width:20}]),/必须放在地图内/u);
  assert.throws(()=>save([{...shape,x:1600}]),/必须放在地图内/u);
  assert.throws(()=>save([{...marker,characterId:'missing'}]),/找不到地图上的角色/u);
  assert.throws(()=>save([marker,{...marker,id:'duplicate'}]),/只能布置一次/u);
  assert.throws(()=>save([shape,{...shape,shape:'triangle'}]),/ID 重复/u);
  assert.throws(()=>save([{...shape,color:'url(bad)'}]),/物体资料无效/u);
  assert.throws(()=>save([{...shape,shape:'unknown'}]),/物体资料无效/u);
});

test('uploaded art can be placed atomically and reused by image objects',()=>{
  const base=fixture(),scene=base.currentSceneId;
  const object={id:'sign',kind:'image',artId:'uploaded',name:'木牌',x:20,y:30,width:120,height:90};
  assert.throws(()=>ST.execute(base,[update(scene,'',{elements:[object]})]),/找不到地图物体的图片/u);
  const {project}=ST.execute(base,[
    {type:'art.create',args:{id:'uploaded',name:'木牌',image}},
    update(scene,'',{elements:[object,{...object,id:'second',x:240}]}),
    update(scene,'forest',{elements:[object]})
  ]);
  assert.deepEqual(ST.validateProject(JSON.parse(JSON.stringify(project))).scenes,project.scenes);
  assert.equal(project.conceptArt.length,2);
  const cleaned=ST.execute(project,[{type:'art.delete',args:{id:'uploaded'}}]).project;
  assert.equal(ST.sceneOf(cleaned,scene).maps.length,0);
  assert.equal(cleaned.conceptArt[0].id,'ref');
});
