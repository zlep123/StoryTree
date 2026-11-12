'use strict';
const readline=require('node:readline');
const ST=require('./core.js');
const str={type:'string'}, ids={type:'array',items:str}, obj={type:'object'}, number={type:'number'};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const tools=[
  ['storytree_get_project','读取完整故事项目，包括角色、物品、场景、节点和连线。',{},[],'read'],
  ['storytree_get_scene','读取一个场景、节点和独立角色快照。',{sceneId:str},['sceneId'],'read'],
  ['storytree_create_scene','建立空白场景。',{name:str,summary:str},['name']],
  ['storytree_create_character','创建角色卡，skills 0–10，attributes 0–100，inventory 为物品ID到数量的映射。',{name:str,summary:str,details:str,tags:ids,groupId:str,skills:obj,attributes:obj,inventory:obj},['name']],
  ['storytree_update_character','更新角色库的当前角色设定；历史场景快照保持独立。',{id:str,patch:obj},['id','patch']],
  ['storytree_set_present_character','在所有已推演节点之后叠加即时修改，同时更新角色库。',{sceneId:str,characterId:str,patch:obj},['sceneId','characterId','patch']],
  ['storytree_create_item','创建物品。category 必须是副本物品/单机物品/特殊物品/任务物品，type 可选装备/道具/材料/未知，grade 可选未知/普通/优质/稀世/异世/传说。',{name:str,summary:str,details:str,category:str,type:str,grade:str,tags:ids,attributes:obj},['name','category']],
  ['storytree_update_item','更新物品卡。特殊物品无属性。',{id:str,patch:obj},['id','patch']],
  ['storytree_add_characters','把角色快照加入场景。可从另一场景的当前状态复制，互不影响。',{sceneId:str,characterIds:ids,sourceSceneId:str},['sceneId','characterIds']],
  ['storytree_create_node','创建六类节点之一。type=dialogue/monologue/condition/jump/event/label。data 结构见 storytree://schema。',{type:{type:'string',enum:Object.keys(ST.TYPES)},sceneId:str,data:obj},['type','sceneId']],
  ['storytree_update_node','更新节点的标题、日期、对白、引用、事件操作或条件规则。',{id:str,patch:obj},['id','patch']],
  ['storytree_connect','连接同场景两个节点，output 从0开始。条件0真1假。跨场景使用跳转节点 targetNodeId。',{from:str,to:str,output:{type:'integer',minimum:0}},['from','to']],
  ['storytree_add_output','给对话/独白/事件增加输出点。',{id:str,label:str},['id']],
  ['storytree_delete_nodes','删除节点及相关连线，可用撤销恢复。',{ids},['ids'],'delete'],
  ['storytree_delete_edge','移除一条连线。',{id:str},['id'],'delete'],
  ['storytree_transfer_nodes','复制或移动所选节点到另一个场景，保留内部连线及角色快照。',{ids,sceneId:str,copy:{type:'boolean'}},['ids','sceneId']],
  ['storytree_create_group','创建角色分组。',{name:str},['name']],
  ['storytree_apply_group','批量更新分组内角色或添加标签。',{groupId:str,tags:ids,patch:obj},['groupId']],
  ['storytree_simulate','沿明确路径推演。choices 为 节点ID:输出序号或连线ID；条件0真1假。waitForInput 开启后在玩家命名处返回 pendingInput，inputs 为 输入ID:玩家回答。',{startNodeId:str,choices:obj,inputs:obj,waitForInput:{type:'boolean'},maxSteps:{type:'integer',minimum:1,maximum:2000},includeOverrides:{type:'boolean'}},[],'read'],
  ['storytree_get_timeline','按 年.月.日 排序读取跨场景故事树，包含当前默认路径的状态变化；未经过分支无已执行状态。',{},[],'read'],
  ['storytree_get_story_route','沿实际连线和跨场景跳转读取剧情路线。choices 为节点 ID 到连线 ID 的映射；未选择的分支处会停下。',{startNodeId:str,choices:obj,maxSteps:{type:'integer',minimum:1,maximum:2000}},[],'read'],
  ['storytree_get_present','读取某场景当前状态，包含末端即时编辑。',{sceneId:str},['sceneId'],'read'],
  ['storytree_batch','原子执行多个命令；任意失败则全部不落盘。commands:[{type,args}]，支持 scene.*,character.*,item.*,itemSet.*,location.*,outline.*,node.*,edge.*,group.*,definitions.update。',{commands:{type:'array',items:{type:'object',properties:{type:str,args:obj},required:['type','args']},minItems:1,maxItems:200},expectedRevision:{type:'integer'}},['commands']],
  ['storytree_undo','撤销最近一项编辑。',{},[]],
  ['storytree_redo','重做最近撤销的编辑。',{},[]]
].map(([name,description,properties,required,kind])=>({name,description,inputSchema:schema(properties,required),annotations:{readOnlyHint:kind==='read',destructiveHint:kind==='delete',idempotentHint:kind==='read',openWorldHint:false}}));
const typeMap={create_scene:'scene.create',create_character:'character.create',update_character:'character.update',set_present_character:'character.current',create_item:'item.create',update_item:'item.update',add_characters:'scene.addCharacters',create_node:'node.create',update_node:'node.update',connect:'edge.create',add_output:'node.addOutput',delete_nodes:'node.delete',delete_edge:'edge.delete',transfer_nodes:'node.transfer',create_group:'group.create',apply_group:'group.apply'};
const help=`StoryTree 数据说明\n事件 operations: [{kind:'attribute'|'skill',characterId,key,mode:'set'|'add',value}, {kind:'item',characterId,itemId,mode:'set'|'add',value}, {kind:'itemAttribute',characterId,itemId,key,mode:'set'|'add',value}, {kind:'transfer',characterId,toCharacterId,itemId,value}, {kind:'tag',characterId,key,mode:'add'|'remove'}]。同一事件原子执行。\n条件 condition: {mode:'manual'|'rules',value:true,description:'自然语言',sourceEventId:'可空，默认最近事件',rollback:'all'|'selected'|'none',rollbackWhen:'false'|'true',evaluateAt:'current'|'beforeEvent',excludedCharacters:[],logic:'all'|'any',rules:[{characterId,kind:'attribute'|'skill'|'item'|'tag',key,op:'eq'|'ne'|'gt'|'gte'|'lt'|'lte',value}]}。假分支回滚；selected 撤销指定角色涉及的变化，转移任一方被豁免时整笔转移不发生。自然语言不自动执行。\n节点 refs:[{kind:'character'|'item',id}]，lines:[{characterId,text}]，speakerId,text,eventType:'战斗'|'交易'|'自定义',factions:{A:[],B:[]},targetNodeId,labelQuery:{entity:'character',tags:[]}。标签节点把 operations 的对象扩展为匹配全部标签的场景角色；labelQuery.entity='item' 时匹配携带物品的自定义标签、A组类别、类型:装备、品级:传说等，支持 item/itemAttribute/transfer 操作。\n每个场景的 characters 是独立快照；overrides 是节点推演后即时编辑。节点日期为 0001.01.01–9999.12.31，也可以是空字符串，表示未定日期。导入的剧本节点可通过 scriptSource 查看文件名和行号。不同分支不叠加，跨场景通过跳转切换各自状态。MCP 编辑共享本地服务，界面自动刷新。\n`;
const extendedHelp=help+`节点命名操作 {kind:'characterField',key:'displayName',characterId,mode:'set',direct:true,value:'默认名称',input:{id:'唯一输入ID',prompt:'显示给玩家的提示'}}。省略 input 即固定命名，value 为空时沿用角色ID。waitForInput=true 会在缺少答案时暂停，inputs[input.id] 传入玩家文本或空字符串以使用默认值。
角色变量 {{char:角色内部ID:字段[:子项[:属性键]]}} 可插入节点文字，使用推演的 after 快照解析。字段包括 id、name、summary、details、image、group、tags（可选标签名）、attributes（属性名）、skills（技能名）、item（物品ID）、inventory（物品ID，对应数量）、itemAttributes（物品ID和属性名）。分隔字符用 URI 百分号编码，旧的 {{attr:角色内部ID:属性键}} 继续有效。
地点记录在 project.locations，每个节点以 locationId 引用。地点可带 parentId 和 #RRGGBB 格式的 color，父地点包含所有下级地点。storytree_batch 支持 location.create({name,notes,parentId,color})、location.update({id,name,notes,parentId,color})、location.assign({nodeIds,locationId})，locationId 为空时解除分配。
场景地图存于 scenes[].maps。用 scene.map.update({sceneId,locationId,patch:{backgroundArtId?,areas?,routes?,elements?}}) 修改，其中 locationId 为空表示场景总图。areas 成员为 {locationId,x,y,width,height}，整数坐标须位于 1600×1000 的地图内，最小范围 76×50。routes 成员为 {from,to,name}，端点是该地图上已布置的地点 ID。elements 成员为 {id,kind:"character",characterId,x,y,width,height}、{id,kind:"shape",shape,name,color,x,y,width,height} 或 {id,kind:"image",artId,name,x,y,width,height}。shape 可为 rectangle、ellipse 或 triangle，color 为 #RRGGBB，artId 引用概念图，元素最小范围 30×30。同一张地图内每个角色只能放置一次。backgroundArtId 引用概念图，空字符串表示无底图。传入的数组替换对应数组，未传入的字段保留。
大纲存于 project.outline。通过 outline.create({title,text,startDate,endDate,locationId,sections?})、outline.update({id,patch})、outline.delete({id}) 编辑。sections 是按顺序排列的 {title,text} 段落数组，段落标题可留空；存在 sections 时 text 自动汇总，仅更新 text 则替换为旧版单段。单侧空日期表示开放边界，日期范围包含首尾。地点包含下级地点，空地点表示不限地点。大纲正文可嵌入 {{link:类型:URL编码的ID}}，类型可用 node、scene、character、item、itemset、location、art、group、outline 或 variable。variable 使用 URL 编码后的完整角色变量标记。
定量物品组合存于 project.itemSets。用 itemSet.create({name,entries})、itemSet.update({id,patch})、itemSet.addEntry({id,entry})、itemSet.delete({id}) 操作。每个成员为 {kind:"item"|"set",id,quantity}。组合支持无环嵌套，展开后同一物品的数量相加。\n`;
function validateArgs(t,a) {if(!a||typeof a!=='object'||Array.isArray(a))throw Error('arguments 必须是对象');for(const k of t.inputSchema.required||[])if(a[k]===undefined)throw Error('缺少参数 '+k);for(const[k,v]of Object.entries(a)){const s=t.inputSchema.properties[k];if(!s)throw Error('未知参数 '+k);if(s.type==='string'&&typeof v!=='string'||s.type==='array'&&!Array.isArray(v)||s.type==='object'&&(!v||typeof v!=='object'||Array.isArray(v))||s.type==='boolean'&&typeof v!=='boolean'||s.type==='integer'&&!Number.isInteger(v))throw Error('参数类型错误 '+k);if(s.enum&&!s.enum.includes(v))throw Error('参数值错误 '+k);}}
async function callTool(store,name,args={}) {
  const t=tools.find(x=>x.name===name);if(!t)throw Error('未知工具 '+name);validateArgs(t,args);const key=name.replace('storytree_','');
  if(key==='get_project')return store.project;
  if(key==='get_scene'){const s=ST.sceneOf(store.project,args.sceneId);return {...s,nodes:store.project.nodes.filter(n=>n.sceneId===s.id),edges:store.project.edges.filter(e=>store.project.nodes.find(n=>n.id===e.from)?.sceneId===s.id)};}
  if(key==='simulate')return ST.trace(store.project,args);
  if(key==='get_timeline')return ST.timeline(store.project);
  if(key==='get_story_route')return ST.storyRoute(store.project,args);
  if(key==='get_present')return ST.present(store.project,args.sceneId);
  if(key==='undo'||key==='redo')return store.history(key);
  if(key==='batch')return store.execute(args.commands,args.expectedRevision,'MCP');
  return store.execute([{type:typeMap[key],args}],undefined,'MCP');
}
function serveStdio(remote) {
  const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let queue=Promise.resolve();
  const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
  input.on('line',line=>{queue=queue.then(async()=>{
    let m;try{m=JSON.parse(line);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
    if(m.id===undefined)return;
    try {
      let result;
      if(m.jsonrpc!=='2.0')throw Error('Invalid JSON-RPC version');
      if(m.method==='initialize')result={protocolVersion:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'].includes(m.params?.protocolVersion)?m.params.protocolVersion:'2025-11-25',capabilities:{tools:{},resources:{}},serverInfo:{name:'storytree',version:require('./package.json').version},instructions:'先读取 storytree://schema。事件变化只在路径推演时发生，条件假分支可回滚。'};
      else if(m.method==='ping')result={};
      else if(m.method==='tools/list')result={tools};
      else if(m.method==='resources/list')result={resources:[{uri:'storytree://schema',name:'StoryTree 数据规则',mimeType:'text/plain'},{uri:'storytree://project',name:'当前故事项目',mimeType:'application/json'}]};
      else if(m.method==='resources/read'){const uri=m.params?.uri;if(!['storytree://schema','storytree://project'].includes(uri))throw Error('未知资源');result={contents:[{uri,mimeType:uri.endsWith('schema')?'text/plain':'application/json',text:uri.endsWith('schema')?extendedHelp:JSON.stringify(await remote('storytree_get_project',{}))}]};}
      else if(m.method==='tools/call') {
        try{const data=await remote(m.params?.name,m.params?.arguments||{});result={content:[{type:'text',text:JSON.stringify(data)}]};}
        catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}
      }else {send({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Method not found'}});return;}
      send({jsonrpc:'2.0',id:m.id,result});
    }catch(e){send({jsonrpc:'2.0',id:m.id,error:{code:-32602,message:e.message}});}
  }).catch(e=>process.stderr.write(e.message+'\n'));});
  input.on('close',()=>{queue.finally(()=>process.exit(0));});
}
module.exports={tools,callTool,serveStdio,help:extendedHelp};
