'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Store}=require('./store.cjs'), {callTool,tools}=require('./mcp.cjs'), ST=require('./core.js');
async function startServer(directory,port=0) {
  fs.mkdirSync(directory,{recursive:true});const store=new Store(directory);
  const token=crypto.randomBytes(32).toString('hex');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
  const readBody=req=>new Promise((resolve,reject)=>{let b='',size=0;req.on('data',c=>{size+=c.length;if(size>40e6){reject(Error('项目超过40MB'));req.destroy();return;}b+=c;});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'));}catch{reject(Error('JSON 格式错误'));}});req.on('error',reject);});
  let lastAccess=Date.now();const server=http.createServer(async(req,res)=>{
    lastAccess=Date.now();
    const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      if(req.headers.host!==`127.0.0.1:${server.address().port}`){json({error:'Invalid host'},403);return;}
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/health'){json({name:'storytree',version:'1.0.0'});return;}
      if(url.pathname.startsWith('/api/')) {
        if(req.headers['x-storytree-token']!==token){json({error:'请通过桌面客户端访问'},401);return;}
        const origin=req.headers.origin;if(origin && origin!==`http://127.0.0.1:${server.address().port}`){json({error:'Invalid origin'},403);return;}
        if(req.method==='GET' && url.pathname==='/api/project'){json({project:store.project,directory,undo:store.undoStack.length,redo:store.redoStack.length,tools:tools.map(t=>({name:t.name,description:t.description}))});return;}
        if(req.method!=='POST'){json({error:'Method not allowed'},405);return;}
        const a=await readBody(req);
        if(url.pathname==='/api/commands'){json(store.execute(a.commands,a.revision));return;}
        if(url.pathname==='/api/import'){json(store.replace(a.project,a.revision));return;}
        if(url.pathname==='/api/history'){json(store.history(a.action,a.revision));return;}
        if(url.pathname==='/api/mcp'){json({result:await callTool(store,a.name,a.arguments)});return;}
        if(url.pathname==='/api/simulate'){json(ST.trace(store.project,a));return;}
        json({error:'Not found'},404);return;
      }
      const allowed={'/':'index.html','/index.html':'index.html','/ui.js':'ui.js','/core.js':'core.js','/style.css':'style.css','/logo.svg':'logo.svg'};
      const file=allowed[url.pathname];if(!file){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(fs.readFileSync(path.join(__dirname,file)));
    }catch(e){json({error:e.message},e.status||400);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const info={port:server.address().port,token,pid:process.pid,directory};
  fs.writeFileSync(path.join(directory,'.service.json'),JSON.stringify(info));
  server.on('close',()=>{try{const f=path.join(directory,'.service.json');if(JSON.parse(fs.readFileSync(f)).pid===process.pid)fs.unlinkSync(f);}catch{}});
  return {server,store,...info,lastAccess:()=>lastAccess};
}
module.exports={startServer};
if(require.main===module)startServer(process.argv[2]||path.join(__dirname,'data'),Number(process.env.STORYTREE_PORT)||0).then(info=>process.stdout.write(JSON.stringify({port:info.port,directory:info.directory})+'\n')).catch(e=>{process.stderr.write(e.stack+'\n');process.exit(1);});
