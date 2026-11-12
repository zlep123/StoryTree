'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ST=require('../core.js');

test('project replacement previews literal node text by scene and protects variable tokens',()=>{
  const p=ST.demoProject(),first=p.nodes[0],token=ST.characterToken('char_mira','name');
  first.title='码头 a+b';
  first.lines[0].text='A+B '+token+' aab a+b';
  const query={query:'a+b',replacement:'$1',sceneId:p.currentSceneId};
  const preview=ST.previewNodeTextReplacements(p,query);
  assert.deepEqual(preview.map(row=>[row.path,row.count,row.after]),[
    ['title',1,'码头 $1'],['lines.0.text',2,'$1 '+token+' aab $1']
  ]);
  assert.equal(first.title,'码头 a+b');
  assert.equal(ST.previewNodeTextReplacements(p,{...query,matchCase:true})[1].count,1);
  assert.deepEqual(ST.previewNodeTextReplacements(p,{...query,sceneId:'other'}),[]);
  assert.deepEqual(ST.previewNodeTextReplacements(p,{...query,query:'char_mira'}),[]);
});

test('map layer preferences accept booleans and default to visible and unlocked',()=>{
  const {mapLayers}=ST.displaySettings({mapLayers:{objects:{hidden:true},locations:{locked:true},characters:{hidden:'true'}}});
  assert.deepEqual(mapLayers,{
    background:{hidden:false,locked:false},locations:{hidden:false,locked:true},
    characters:{hidden:false,locked:false},objects:{hidden:true,locked:false}
  });
});
