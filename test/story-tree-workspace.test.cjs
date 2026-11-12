'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const ST=require('../core.js');
const MCP=require('../mcp.cjs');

test('story route uses real branches, cross-scene jumps and safe cycle boundaries',async()=>{
  const base=ST.demoProject(),sceneId=base.currentSceneId;
  const {project}=ST.execute(base,[
    {type:'scene.create',args:{id:'scene_other',name:'彼岸'}},
    {type:'node.create',args:{sceneId:'scene_other',type:'monologue',data:{id:'node_other'}}},
    {type:'node.create',args:{sceneId,type:'jump',data:{id:'jump_other',targetNodeId:'node_other'}}},
    {type:'edge.create',args:{from:'node_city',to:'jump_other'}},
    {type:'edge.create',args:{from:'node_wait',to:'node_arrival'}},
    {type:'scene.activate',args:{id:sceneId}}
  ]);
  const root='node_arrival',condition='node_condition';
  const initial=ST.storyRoute(project,{startNodeId:root});
  assert.equal(initial.status,'choice');
  assert.deepEqual(initial.steps.map(step=>step.nodeId),[root,'node_trade',condition]);
  const [yes,no]=initial.steps.at(-1).options;
  assert.equal(yes.targetNodeId,'node_city');
  assert.equal(no.targetNodeId,'node_wait');
  const route=await MCP.callTool({project},'storytree_get_story_route',{startNodeId:root,choices:{[condition]:yes.id}});
  assert.equal(route.status,'end');
  assert.deepEqual(route.steps.slice(-3).map(step=>step.nodeId),['node_city','jump_other','node_other']);
  assert.equal(route.steps.at(-2).options[0].jump,true);
  assert.equal(ST.storyRoute(project,{startNodeId:root,choices:{[condition]:no.id}}).status,'cycle');
  assert.equal(ST.storyRoute(project,{startNodeId:root,maxSteps:1}).status,'limit');
});

test('outline date ranges include their boundaries and live parent location coverage',()=>{
  const base=ST.demoProject();
  delete base.outline;
  ST.validateProject(base);
  const {project:parentProject,results:[parent]}=ST.execute(base,[{type:'location.create',args:{name:'城市'}}]);
  const {project:childProject,results:[child]}=ST.execute(parentProject,[{type:'location.create',args:{name:'码头',parentId:parent.id}}]);
  const {project,results}=ST.execute(childProject,[
    {type:'node.update',args:{id:'node_arrival',patch:{locationId:parent.id,date:'1024.04.16'}}},
    {type:'node.update',args:{id:'node_trade',patch:{locationId:child.id,date:'1024.04.18'}}},
    {type:'node.update',args:{id:'node_condition',patch:{locationId:child.id,date:''}}},
    {type:'outline.create',args:{title:' 抵达港口 ',text:'进入城市。',startDate:'1024.4.16',endDate:'1024.4.18',locationId:parent.id}}
  ]);
  const entry=results.at(-1);
  assert.deepEqual(entry,{id:entry.id,title:'抵达港口',text:'进入城市。',startDate:'1024.04.16',endDate:'1024.04.18',locationId:parent.id});
  assert.deepEqual(project.nodes.filter(ST.storyScope(project,entry).node).map(node=>node.id),['node_arrival','node_trade']);
  assert.ok(ST.storyScope(project,{locationId:child.id,startDate:'1024.04.17'}).outline(entry));
  assert.ok(!ST.storyScope(project,{endDate:'1024.04.15'}).outline(entry));
  const updated=ST.execute(project,[
    {type:'location.assign',args:{locationId:'',nodeIds:['node_trade']}},
    {type:'outline.update',args:{id:entry.id,patch:{endDate:''}}}
  ]).project;
  assert.deepEqual(updated.nodes.filter(ST.storyScope(updated,updated.outline[0]).node).map(node=>node.id),['node_arrival']);
  assert.throws(()=>ST.execute(project,[{type:'outline.update',args:{id:entry.id,patch:{endDate:'1024.04.15'}}}]),/结束日期/);
  const copy=ST.validateProject(JSON.parse(JSON.stringify(updated)));
  const removed=ST.execute(copy,[{type:'outline.delete',args:{id:entry.id}}]).project;
  assert.equal(removed.outline.length,0);
  assert.deepEqual(removed.nodes,updated.nodes);
});

test('outline links preserve text, stable targets, and nested variable identifiers',()=>{
  const variable=ST.characterToken('char_mira','itemAttributes','item_letter','磨损:%}');
  const tokens=[
    ST.outlineLinkToken('node','node_arrival'),
    ST.outlineLinkToken('location','地点:外港'),
    ST.outlineLinkToken('variable',variable)
  ];
  const text='第一幕 '+tokens[0]+'\n\n转到 '+tokens[1]+'，使用 '+tokens[2]+'。';
  const parts=ST.outlineTextParts(text);
  assert.deepEqual(parts.filter(part=>typeof part!=='string').map(({kind,id})=>[kind,id]),[
    ['node','node_arrival'],['location','地点:外港'],['variable',variable]
  ]);
  assert.equal(parts.map(part=>typeof part==='string'?part:part.token).join(''),text);
  const invalid='保留 {{link:unknown:id}} 和 {{link:node:%ZZ}}';
  assert.deepEqual(ST.outlineTextParts(invalid),[invalid]);
  assert.throws(()=>ST.outlineLinkToken('unknown','id'),/链接无效/);
  const {project}=ST.execute(ST.demoProject(),[
    {type:'outline.create',args:{title:'大纲',text}},
    {type:'node.delete',args:{ids:['node_arrival']}}
  ]);
  assert.equal(ST.validateProject(JSON.parse(JSON.stringify(project))).outline[0].text,text);
});

test('outline sections round-trip links and respect older text-only edits',()=>{
  const text='旧版原文\n'+ST.outlineLinkToken('node','node_arrival');
  const base=ST.execute(ST.demoProject(),[{type:'outline.create',args:{title:'大纲',text}}]).project;
  const {id}=base.outline[0];
  assert.deepEqual(ST.outlineSections(base.outline[0]),[{title:'',text}]);
  const sections=[{title:'第一段',text},{title:'结尾',text:ST.outlineLinkToken('character','char_mira')}];
  const update=(project,patch)=>ST.execute(project,[{type:'outline.update',args:{id,patch}}]).project;
  const changed=update(base,{sections});
  const serialized=ST.validateProject(JSON.parse(JSON.stringify(changed)));
  assert.deepEqual(ST.outlineSections(serialized.outline[0]),sections);
  assert.equal(serialized.outline[0].text,'第一段\n'+text+'\n\n结尾\n'+sections[1].text);
  assert.deepEqual(update(serialized,{title:'更新大纲'}).outline[0].sections,sections);
  assert.throws(()=>update(changed,{sections:[{title:'a'}]}),/大纲分段资料无效/);
  assert.deepEqual(ST.outlineSections(update(changed,{text:'命令覆盖'}).outline[0]),[{title:'',text:'命令覆盖'}]);
  serialized.outline[0].text='旧版程序编辑';
  assert.deepEqual(ST.outlineSections(serialized.outline[0]),[{title:'',text:'旧版程序编辑'}]);
  assert.equal(update(serialized,{title:'改标题'}).outline[0].text,'旧版程序编辑');
});
