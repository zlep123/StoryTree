'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Store}=require('./store.cjs'), {callTool,tools}=require('./mcp.cjs'), ST=require('./core.js');
async function startServer(directory,port=0) {
  const store=await Store.open(directory);
  const token=crypto.randomBytes(32).toString('hex');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  const readBytes=(req,limit,error)=>new Promise((resolve,reject)=>{
    const chunks=[];let size=0;
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>limit){reject(error);return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{if(size<=limit)resolve(Buffer.concat(chunks,size));});
    req.on('error',reject);
  });
  let lastAccess=Date.now();const server=http.createServer(async(req,res)=>{
    lastAccess=Date.now();
    const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      if(req.headers.host!==`127.0.0.1:${server.address().port}`){json({error:'Invalid host'},403);return;}
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/health'){json({name:'storytree',version:require('./package.json').version});return;}
      if(url.pathname==='/plugin-sandbox.html'&&req.method==='GET'){
        const script=fs.readFileSync(path.join(__dirname,'plugin-sandbox.js'),'utf8').replace(/\r\n?/gu,'\n');
        const hash=crypto.createHash('sha256').update(script).digest('base64');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
          'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'sha256-"+hash+"'; worker-src blob:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"});
        res.end('<!doctype html><meta charset="utf-8"><title>StoryTree Plugin</title><script>'+script+'</script>');
        return;
      }
      if(url.pathname.startsWith('/api/')) {
        if(req.headers['x-storytree-token']!==token){json({error:'请通过桌面客户端访问'},401);return;}
        const origin=req.headers.origin;if(origin && origin!==`http://127.0.0.1:${server.address().port}`){json({error:'Invalid origin'},403);return;}
        if(req.method==='GET' && url.pathname==='/api/project'){
          if(url.searchParams.get('revision')===String(store.project.revision)){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
          json({project:store.project,directory,undo:store.undoStack.length,redo:store.redoStack.length,tools:tools.map(t=>({name:t.name,description:t.description}))});return;
        }
        if(req.method!=='POST'){json({error:'Method not allowed'},405);return;}
        if(url.pathname==='/api/excel'){
          const bytes=await readBytes(req,5*1024*1024,Error('Excel 文件最大为 5 MB'));
          const {parseWorkbook}=require('./excel-import.cjs');
          try {json(await parseWorkbook(bytes,url.searchParams.get('kind')));}
          catch(error) {
            if(error.message==='每次最多导入 2,000 张卡片') throw error;
            throw Error('无法读取 Excel 文件，请选择有效的 .xlsx 工作簿');
          }
          return;
        }
        const bytes=await readBytes(req,40e6,Error('项目超过40MB'));
        let a;
        try {a=JSON.parse(bytes.length ? bytes.toString('utf8') : '{}');}
        catch {throw Error('JSON 格式错误');}
        if(url.pathname==='/api/commands'){json(await store.execute(a.commands,a.revision));return;}
        if(url.pathname==='/api/import'){json(await store.replace(a.project,a.revision));return;}
        if(url.pathname==='/api/history'){json(await store.history(a.action,a.revision));return;}
        if(url.pathname==='/api/mcp'){json({result:await callTool(store,a.name,a.arguments)});return;}
        if(url.pathname==='/api/simulate'){json(ST.trace(store.project,a));return;}
        json({error:'Not found'},404);return;
      }
      const allowed={'/':'index.html','/index.html':'index.html','/ui.js':'ui.js','/core.js':'core.js','/script-import.js':'script-import.js','/character-import.js':'character-import.js','/story-tree-view.js':'story-tree-view.js','/character-card-view.js':'character-card-view.js','/scene-map-view.js':'scene-map-view.js','/text-find-replace.js':'text-find-replace.js','/plugin-api.js':'plugin-api.js','/plugin-view.js':'plugin-view.js','/style.css':'style.css','/logo.svg':'logo.svg','/excel-import-template.xlsx':'examples/Excel-Import-Template.xlsx','/script-example.txt':'examples/Mist-Harbor-Script.txt'};
      const file=allowed[url.pathname];if(!file){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(fs.readFileSync(path.join(__dirname,file)));
    }catch(e){
      if(['EACCES','EPERM','EBUSY','ENOSPC','EROFS','EISDIR','EMFILE'].includes(e.code))console.warn('StoryTree storage error:',e.code);
      json({error:e.message},e.status||400);
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const info={port:server.address().port,token,pid:process.pid,directory};
  fs.writeFileSync(path.join(directory,'.service.json'),JSON.stringify(info));
  server.on('close',()=>{try{const f=path.join(directory,'.service.json');if(JSON.parse(fs.readFileSync(f)).pid===process.pid)fs.unlinkSync(f);}catch{}});
  return {server,store,...info,lastAccess:()=>lastAccess};
}
module.exports={startServer};
if(require.main===module)startServer(process.argv[2]||path.join(__dirname,'data'),Number(process.env.STORYTREE_PORT)||0).then(info=>process.stdout.write(JSON.stringify({port:info.port,directory:info.directory})+'\n')).catch(e=>{process.stderr.write(e.stack+'\n');process.exit(1);});
