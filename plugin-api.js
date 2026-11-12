(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StoryTreePlugins=factory();
})(globalThis,function(){
  'use strict';
  const API_VERSION=1;
  const PACKAGE_LIMIT=256*1024;
  const RESULT_LIMIT=512*1024;
  const PERMISSIONS=new Set(['project.read','project.write']);
  const CONTEXTS=new Set(['project','scene','node']);
  const TYPES=new Set(['text','multiline','number','boolean','select']);
  const PLUGIN_ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
  const FIELD_ID=/^[a-z][a-zA-Z0-9-]{0,47}$/u;
  const VERSION=/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/u;
  const COMMANDS=new Set([
    'project.rename','scene.create','scene.update','scene.map.update','scene.addCharacters',
    'node.create','node.update','node.delete','node.transfer','node.addOutput','node.dialogueRule','node.dialogueContinue',
    'edge.create','edge.delete','character.create','character.update','character.current','character.delete',
    'item.create','item.update','itemSet.create','itemSet.update','itemSet.addEntry','itemSet.delete',
    'location.create','location.update','location.assign','outline.create','outline.update','outline.delete',
    'group.create','group.rename','group.apply','definitions.update'
  ]);
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const validKey=id=>typeof id==='string'&&FIELD_ID.test(id)&&!['constructor','prototype'].includes(id);

  function string(value,max,required=false){
    check(typeof value==='string'&&value.length<=max&&(!required||value.trim()),'插件文字字段无效或过长。');
    return value.trim();
  }
  function compareVersions(a,b){
    const lhs=a.split('.').map(Number),rhs=b.split('.').map(Number);
    for(let i=0;i<3;i++)if(lhs[i]!==rhs[i])return lhs[i]-rhs[i];
    return 0;
  }
  function validateField(field){
    check(plain(field)&&validKey(field.id)&&TYPES.has(field.type),'插件输入字段无效。');
    const {id,type}=field,label=string(field.label,100,true),required=field.required===true;
    check(field.required===undefined||typeof field.required==='boolean','插件输入字段无效。');
    const result={id,type,label,required};
    if(type==='select'){
      check(Array.isArray(field.choices)&&field.choices.length>0&&field.choices.length<=30,'插件选项无效。');
      result.choices=field.choices.map(choice=>{
        check(plain(choice),'插件选项无效。');
        return {value:string(choice.value,200,true),label:string(choice.label,100,true)};
      });
      check(new Set(result.choices.map(choice=>choice.value)).size===result.choices.length,'插件选项重复。');
    }
    return result;
  }
  function validatePackage(data){
    check(plain(data)&&data.apiVersion===API_VERSION,'插件 API 版本不兼容。');
    check(typeof data.id==='string'&&data.id.length<=72&&PLUGIN_ID.test(data.id),'插件标识无效。');
    check(typeof data.version==='string'&&VERSION.test(data.version),'插件版本号须为三个数字，如 1.0.0。');
    const permissions=data.permissions??[];
    check(Array.isArray(permissions)&&permissions.every(permission=>PERMISSIONS.has(permission))&&
      new Set(permissions).size===permissions.length,'插件权限无效。');
    check(Array.isArray(data.actions)&&data.actions.length>0&&data.actions.length<=16,'插件需提供 1–16 个操作。');
    const actions=data.actions.map(action=>{
      check(plain(action)&&validKey(action.id),'插件操作标识无效。');
      const context=action.context??'project',fields=action.fields??[];
      check(CONTEXTS.has(context)&&Array.isArray(fields)&&fields.length<=12,'插件操作或输入字段无效。');
      const normalized=fields.map(validateField);
      check(new Set(normalized.map(field=>field.id)).size===normalized.length,'插件输入字段重复。');
      return {id:action.id,title:string(action.title,100,true),description:string(action.description??'',600),
        context,fields:normalized};
    });
    check(new Set(actions.map(action=>action.id)).size===actions.length,'插件操作标识重复。');
    check(typeof data.source==='string'&&data.source.length<=160000&&data.source.trim(),'插件代码缺失或过长。');
    return {apiVersion:API_VERSION,id:data.id,version:data.version,name:string(data.name,100,true),
      description:string(data.description??'',800),permissions:[...permissions],actions,source:data.source};
  }
  function validateResult(data,permissions){
    check(plain(data),'插件返回了无效结果。');
    const message=string(data.message??'',100000),commands=data.commands??[],links=data.links??[];
    check(Array.isArray(commands)&&commands.length<=100,'插件最多可提议 100 项修改。');
    check(!commands.length||permissions.includes('project.write'),'此插件没有提议修改项目的权限。');
    check(commands.every(command=>plain(command)&&COMMANDS.has(command.type)&&plain(command.args)),'插件提议了不受支持的项目命令。');
    const nested=commands.map(command=>command.args);
    while(nested.length){
      for(const [key,value] of Object.entries(nested.pop())){
        check(!['__proto__','prototype','constructor'].includes(key),'插件命令含有无效字段。');
        if(value!==null&&typeof value==='object')nested.push(value);
      }
    }
    check(Array.isArray(links)&&links.length<=100,'插件返回的节点链接无效。');
    const nodeLinks=links.map(link=>{
      check(plain(link),'插件返回的节点链接无效。');
      return {nodeId:string(link.nodeId,100,true),label:string(link.label,200,true)};
    });
    return {message,commands,links:nodeLinks};
  }
  return {API_VERSION,PACKAGE_LIMIT,RESULT_LIMIT,compareVersions,validatePackage,validateResult};
});
