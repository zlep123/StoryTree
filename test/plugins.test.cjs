'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {test}=require('node:test');
const {PluginStore}=require('../plugin-store.cjs');
const {validatePackage,validateResult,PACKAGE_LIMIT}=require('../plugin-api.js');

const original={
  apiVersion:1,id:'test.audit',version:'1.0.0',name:'Audit',permissions:['project.read'],
  actions:[{id:'review',title:'Review',context:'scene'}],
  source:'StoryTree.register({review(){return {message:"ok"};}});'
};
const command={type:'project.rename',args:{title:'changed'}};

test('validates plugin API, permission declarations and results independently',()=>{
  assert.equal(validatePackage(original).actions[0].context,'scene');
  assert.equal(validatePackage(require('../examples/scene-review.storytree-plugin.json')).actions.length,2);
  assert.throws(()=>validatePackage({...original,apiVersion:2}),/不兼容/);
  assert.throws(()=>validatePackage({...original,id:'../outside'}),/标识无效/);
  assert.throws(()=>validatePackage({...original,permissions:['filesystem']}),/权限无效/);
  assert.throws(()=>validateResult({commands:[command]},['project.read']),/没有提议修改/);
  assert.throws(()=>validateResult({commands:[{type:'project.keepRecoveryEdit',args:{}}]},['project.write']),/不受支持/);
  const poisoned=JSON.parse('{"commands":[{"type":"node.update","args":{"patch":{"__proto__":{"title":"wrong"}}}}]}');
  assert.throws(()=>validateResult(poisoned,['project.write']),/无效字段/);
  assert.deepEqual(validateResult({commands:[command]},['project.write']).commands,[command]);
});

test('installs disabled, keeps enabled across compatible updates, and gates permission expansion',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'storytree-plugins-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const store=new PluginStore(directory),candidate=path.join(directory,'test.storytree-plugin.json');
  const save=async value=>{await fs.writeFile(candidate,JSON.stringify(value),'utf8');return store.install(candidate);};
  const installed=await save(original);
  assert.equal(installed.enabled,false);
  assert.equal(installed.source,undefined);
  await assert.rejects(store.action(original.id,'review'),/尚未启用/);
  await store.setEnabled(original.id,true);
  assert.equal((await store.action(original.id,'review','1.0.0')).source,original.source);
  await assert.rejects(save(original),/相同或更高/);
  assert.equal((await save({...original,version:'1.1.0'})).enabled,true);
  await assert.rejects(store.action(original.id,'review','1.0.0'),/已更新/);
  assert.equal((await save({...original,version:'1.2.0',permissions:['project.read','project.write']})).enabled,false);
  assert.equal((await new PluginStore(directory).list())[0].version,'1.2.0');
  await fs.writeFile(candidate,' '.repeat(PACKAGE_LIMIT+1),'utf8');
  await assert.rejects(store.install(candidate),/过大/);
  assert.equal((await store.list())[0].version,'1.2.0');
  await store.remove(original.id);
  assert.deepEqual(await store.list(),[]);
});
