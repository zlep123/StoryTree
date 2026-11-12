'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ST = require('../core.js');
const {parseWorkbook} = require('../excel-import.cjs');

test('Excel template imports both types, groups, and numeric fields', async () => {
  const source = fs.readFileSync(path.join(__dirname,'../examples/Excel-Import-Template.xlsx'));
  const preview = await parseWorkbook(source,'item');
  assert.deepEqual(preview.errors,[]);
  const original = ST.demoProject();
  const {project,results} = ST.execute(original,[{type:'library.import',args:preview}]);
  assert.deepEqual(results[0],{characters:1,items:1});
  const character = project.characters.at(-1);
  const item = project.items.at(-1);
  assert.equal(character.skills['观察'],6);
  assert.equal(character.attributes['生命'],85);
  assert.equal(character.skills['战斗'],0);
  assert.equal(item.attributes['耐久'],65);
  assert.equal(item.grade,'优质');
  assert.ok(ST.groupsOf(project,'character').some(g=>g.id===character.groupId && g.name==='港口向导'));
  assert.ok(ST.groupsOf(project,'item').some(g=>g.id===item.groupId && g.name==='航海用品'));
  assert.equal(original.characters.length+1,project.characters.length);
  assert.equal(original.items.length+1,project.items.length);
});

test('item and character groups stay separate and invalid imports are atomic', () => {
  const original = ST.demoProject();
  const {project} = ST.execute(original,[{type:'library.import',args:{
    characters:[{name:'Player',group:'Shared'}],items:[{name:'Light',group:'Shared'}]
  }}]);
  const item = project.items.at(-1);
  const character = project.characters.at(-1);
  assert.notEqual(item.groupId,character.groupId);
  assert.throws(()=>ST.execute(project,[{type:'item.update',args:{id:item.id,patch:{groupId:character.groupId}}}]),/找不到物品分组/);
  const saved = ST.clone(project);
  assert.throws(()=>ST.execute(project,[{type:'library.import',args:{
    items:[{name:'Valid',group:'Temporary'},{name:'Bad',grade:'传说'}]
  }}]),/品级/);
  assert.deepEqual(project,saved);
});

test('concept art survives a legacy project round-trip and obeys size and format limits', () => {
  const legacy = ST.demoProject();
  delete legacy.conceptArt;
  ST.validateProject(legacy);
  const args = {name:'Map',category:'map',image:'data:image/png;base64,iVBORw0KGgo='};
  const {project,results} = ST.execute(legacy,[{type:'art.create',args}]);
  const id = results[0].id;
  const edited = ST.execute(project,[{type:'art.update',args:{id,name:'City',category:'location',notes:'Keep the east gate.'}}]).project;
  const reloaded = ST.validateProject(ST.clone(edited));
  assert.deepEqual(reloaded.conceptArt[0],{id,name:'City',category:'location',notes:'Keep the east gate.',image:args.image});
  assert.deepEqual(ST.execute(reloaded,[{type:'art.delete',args:{id}}]).project.conceptArt,[]);
  assert.throws(()=>ST.execute(legacy,[{type:'art.create',args:{...args,image:'data:image/svg+xml;base64,AAAA'}}]),/仅支持/);
  const bigImage = 'data:image/png;base64,'+Buffer.alloc(ST.ART_FILE_LIMIT+1).toString('base64');
  assert.throws(()=>ST.execute(legacy,[{type:'art.create',args:{...args,image:bigImage}}]),/4 MB/);
});
