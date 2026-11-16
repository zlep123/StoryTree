'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {_electron:electron}=require('playwright-core');
const ST=require('../core.js');

const packageDir=path.resolve(process.argv[2]||path.join(__dirname,'../dist/StoryTree-'+require('../package.json').version+'-win-x64'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'storytree-location-card-'));
const file=path.join(directory,'story.storytree.json');
const project=ST.emptyProject('Location card regression');
const sceneId=project.currentSceneId;
const area=(locationId,x)=>({locationId,x,y:90,width:230,height:130});
project.locations=[
  {id:'town',name:'试验城镇',notes:''},{id:'lane',name:'试验街道',notes:'',parentId:'town'},
  {id:'inn',name:'试验旅店',notes:'',parentId:'lane'},{id:'port',name:'试验港口',notes:'',parentId:'town'}
];
const seed=ST.execute(project,[
  {type:'node.create',args:{type:'monologue',sceneId,data:{id:'test-node',locationId:'lane',text:'这句正文要保留。'}}},
  {type:'outline.create',args:{title:'Test outline',text:'Outline stays',locationId:'lane'}},
  {type:'scene.map.update',args:{sceneId,locationId:'town',patch:{
    areas:[area('lane',100),area('port',470)],routes:[{from:'lane',to:'port',name:'Harbor route'}]
  }}},
  {type:'scene.map.update',args:{sceneId,locationId:'lane',patch:{areas:[area('inn',75)]}}}
]).project;
fs.writeFileSync(file,JSON.stringify(seed));

let app,page;
const errors=[];
const read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
const action=name=>page.locator('[data-action="'+name+'"]').first();
const card=id=>page.locator('[data-library-location="'+id+'"]');
const dialog=()=>page.locator('#entity-deletion[open]');
const removal=scope=>scope.getByRole('button',{name:'删除地点',exact:true});

async function launch(){
  app=await electron.launch({executablePath:path.join(packageDir,'StoryTree.exe'),args:['--data',directory],timeout:25000});
  page=await app.firstWindow();
  page.setDefaultTimeout(7000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.locator('.scene-tab.active').waitFor();
}
async function close(){
  const closed=page.waitForEvent('close');
  await app.evaluate(({BrowserWindow})=>setTimeout(()=>BrowserWindow.getAllWindows().forEach(window=>window.close()),50));
  await closed;
  app=null;
}
async function confirm(){
  await dialog().getByRole('button',{name:'确认删除',exact:true}).click();
  await dialog().waitFor({state:'hidden'});
}
async function main(){
  await launch();
  await page.locator('[data-tab="locations"]').click();
  await card('town').dblclick();
  assert.equal(await removal(card('lane')).count(),1,'Location library cards must expose deletion directly');
  await removal(card('lane')).click();
  await dialog().getByText('试验街道',{exact:true}).waitFor();
  await dialog().getByText('将子地点移至上一级',{exact:true}).waitFor();
  await dialog().getByText('移除相关地图路线',{exact:true}).waitFor();
  await dialog().getByRole('button',{name:'取消',exact:true}).click();
  await dialog().waitFor({state:'hidden'});
  assert.equal(read().revision,seed.revision);

  await card('lane').dblclick();
  await card('inn').waitFor();
  await removal(page.locator('.location-library-path')).click();
  await confirm();
  assert.equal(await card('lane').count(),0);
  await card('inn').waitFor();
  await card('port').waitFor();
  const deleted=read();
  assert.equal(deleted.locations.find(location=>location.id==='inn').parentId,'town');
  assert.equal(deleted.nodes.find(node=>node.id==='test-node').text,'这句正文要保留。');
  assert.equal(deleted.nodes.find(node=>node.id==='test-node').locationId,'');
  assert.equal(deleted.outline[0].locationId,'');
  assert.deepEqual(deleted.scenes[0].maps,[{locationId:'town',backgroundArtId:'',areas:[area('port',470)],routes:[]}]);

  await action('undo').click();
  await card('lane').waitFor();
  assert.deepEqual(read().scenes[0].maps,seed.scenes[0].maps);
  await action('scene-map').click();
  await page.locator('#scene-map-scope').selectOption('town');
  const mapCard=page.locator('[data-map-place="lane"]');
  await mapCard.getByRole('button',{name:'编辑地点',exact:true}).click();
  assert.equal(await page.locator('#location-name').inputValue(),'试验街道');
  await page.locator('.location-editor .modal-footer [data-action="modal-close"]').click();
  await page.locator('[data-map-area="lane"]').click();
  await action('map-remove').click();
  await page.locator('[data-map-area="lane"]').waitFor({state:'hidden'});
  assert(read().locations.some(location=>location.id==='lane'));
  await action('undo').click();
  await page.locator('[data-map-area="lane"]').waitFor();
  await removal(mapCard).click();
  await confirm();
  await mapCard.waitFor({state:'hidden'});
  assert(!read().locations.some(location=>location.id==='lane'));
  await close();

  await launch();
  await page.locator('[data-tab="locations"]').click();
  await card('town').dblclick();
  await card('inn').waitFor();
  assert.equal(await card('lane').count(),0);
  assert.deepEqual(errors,[]);
  await close();
  console.log('PASS location library and map card deletion, cancel, references, undo, and restart');
}

main().catch(async error=>{
  console.error(error,directory,errors);
  if(page&&!page.isClosed())await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});
  process.exitCode=1;
}).finally(()=>{
  if(app)app.process().kill();
  try{
    const service=JSON.parse(fs.readFileSync(path.join(directory,'.service.json'),'utf8'));
    if(path.resolve(service.directory)===directory)process.kill(service.pid);
  }catch{}
});
