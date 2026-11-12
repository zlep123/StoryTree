'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const ST=require('../core.js');
const {Store}=require('../store.cjs');
const {decodeSnapshot}=require('../project-files.cjs');
const {callTool}=require('../mcp.cjs');

async function fixture(test){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'storytree-test-'));
  test.after(()=>fs.rm(dir,{recursive:true,force:true}));
  return dir;
}
const rename=title=>[{type:'project.rename',args:{title}}];
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));

test('queues saves, checks revisions inside the queue and keeps undo and redo durable',async t=>{
  const dir=await fixture(t),store=await Store.open(dir);
  const title=store.project.title;
  const [first,second]=await Promise.allSettled([store.execute(rename('测试'),0),store.execute(rename('冲突'),0)]);
  assert.equal(first.status,'fulfilled');
  assert.equal(second.reason.status,409);
  assert.equal((await json(store.file)).title,'测试');
  await store.history('undo');
  assert.equal(store.project.title,title);
  await store.history('redo');
  assert.equal(store.project.title,'测试');
  assert.equal((await Store.open(dir)).project.title,'测试');
  assert.equal((await fs.readdir(store.backups)).length,3);
});

test('a failed backup leaves the working file and history unchanged, then the queue can retry',async t=>{
  const store=await Store.open(await fixture(t));
  const before=await fs.readFile(store.file,'utf8');
  await fs.writeFile(store.backups,'obstructed');
  await assert.rejects(store.execute(rename('不可写'),0));
  assert.equal(await fs.readFile(store.file,'utf8'),before);
  assert.equal(store.project.revision,0);
  assert.equal(store.undoStack.length,0);
  assert.equal((await fs.readdir(store.directory)).filter(file=>file.endsWith('.tmp')).length,0);
  await fs.unlink(store.backups);
  await store.execute(rename('重试'),0);
  assert.equal((await json(store.file)).title,'重试');
});

test('moves duplicate portraits and artwork into one blob, recovers backups, and preserves portable JSON',async t=>{
  const dir=await fixture(t);
  const file=path.join(dir,'story.storytree.json');
  const seed=ST.demoProject();
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';
  seed.characters[0].image=image;
  seed.scenes[0].characters.char_mira.image=image;
  seed.nodes[1].operations.push({kind:'characterField',key:'image',characterId:'char_mira',mode:'set',value:image});
  seed.conceptArt=[{id:'art',name:'Test',notes:'',category:'map',image}];
  const inline=JSON.stringify(seed);
  await fs.writeFile(file,inline);
  const store=await Store.open(dir);
  assert.equal(await fs.readFile(file,'utf8'),inline);
  await store.execute(rename('compact'),0);
  const stored=await json(file);
  assert.equal(stored._storytreeStorage,1);
  assert.match(stored.conceptArt[0].image,/^storytree-media:/u);
  assert.equal(stored.nodes[1].operations.at(-1).value,stored.conceptArt[0].image);
  const blobs=await fs.readdir(store.media);
  assert.equal(blobs.length,1);
  const blob=path.join(store.media,blobs[0]),mtime=(await fs.stat(blob)).mtimeMs;
  await store.execute([{type:'art.delete',args:{id:'art'}}],1);
  assert.equal((await fs.stat(blob)).mtimeMs,mtime);
  const backups=(await fs.readdir(store.backups)).sort();
  assert.equal(await fs.readFile(path.join(store.backups,backups[0]),'utf8'),inline);
  const compactBackup=await fs.readFile(path.join(store.backups,backups[1]),'utf8');
  assert.equal((await decodeSnapshot(compactBackup,store.media)).project.conceptArt[0].image,image);
  await store.history('undo');
  assert.equal(store.project.conceptArt[0].image,image);
  await store.history('redo');
  assert.equal(store.project.conceptArt.length,0);
  const reopened=await Store.open(dir);
  assert.equal(reopened.project.characters[0].image,image);
  assert.equal(reopened.project.nodes[1].operations.at(-1).value,image);
  assert.equal((await callTool(reopened,'storytree_get_project')).characters[0].image,image);
  const portable=JSON.parse(JSON.stringify(reopened.project));
  assert.equal(portable._storytreeStorage,undefined);
  assert.equal(ST.validateProject(portable).scenes[0].characters.char_mira.image,image);
  const saved=await fs.readFile(file,'utf8');
  await fs.writeFile(blob,'wrong');
  await assert.rejects(Store.open(dir),/图片资源校验失败/);
  await fs.unlink(blob);
  await assert.rejects(Store.open(dir),/缺少图片资源/);
  assert.equal(await fs.readFile(file,'utf8'),saved);
});

test('MCP tools mutate shared store and reject bad parameters',async t=>{
  const store=await Store.open(await fixture(t));
  await callTool(store,'storytree_create_character',{name:'新角色'});
  assert.equal(store.project.characters.length,3);
  assert.equal(store.project.audit.at(-1).source,'MCP');
  await assert.rejects(callTool(store,'storytree_create_node',{type:'bogus',sceneId:store.project.currentSceneId}));
  await assert.rejects(callTool(store,'storytree_create_character',{name:15}));
  const result=await callTool(store,'storytree_simulate',{choices:{node_condition:1}});
  assert.equal(result.history.at(-1).nodeId,'node_wait');
});
