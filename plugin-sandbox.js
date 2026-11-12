'use strict';

// This code runs in an opaque-origin frame. The package runs only in its Worker.
const workerBootstrap = String.raw`
'use strict';
const StoryTree=(()=>{
  let handlers;
  const send=self.postMessage.bind(self);
  const serialize=JSON.stringify.bind(JSON);
  self.addEventListener('message',async ({data})=>{
    try{
      const handler=handlers&&Object.hasOwn(handlers,data.action)&&handlers[data.action];
      if(typeof handler!=='function')throw Error('插件未注册此操作。');
      const result=serialize(await handler(data.context));
      if(typeof result!=='string')throw Error('插件返回了无效结果。');
      send({ok:true,result});
    }catch(error){
      send({ok:false,error:String(error?.message||error).slice(0,500)});
    }
  },{once:true});
  return Object.freeze({register(actions){handlers=actions;}});
})();
`;

let started=false;
window.addEventListener('message',event=>{
  if(started||event.source!==parent||event.origin!==location.origin)return;
  const {id,source,action,context}=event.data||{};
  if(typeof id!=='string'||typeof source!=='string'||typeof action!=='string')return;
  started=true;
  let worker,url,timer,finished=false;
  function finish(reply){
    if(finished)return;
    finished=true;
    clearTimeout(timer);
    worker?.terminate();
    if(url)URL.revokeObjectURL(url);
    parent.postMessage({id,...reply},location.origin);
  }
  try{
    url=URL.createObjectURL(new Blob([workerBootstrap,'\n',source],{type:'text/javascript'}));
    worker=new Worker(url);
    timer=setTimeout(()=>finish({error:'插件运行超时。'}),5000);
    worker.onmessage=({data})=>{
      if(data?.ok===true&&typeof data.result==='string'&&data.result.length<=524288){
        finish({result:data.result});
      }else{
        const error=typeof data?.error==='string'?data.error.slice(0,500):'插件结果过大或无效。';
        finish({error});
      }
    };
    worker.onerror=event=>{
      event.preventDefault();
      finish({error:(event.message||'插件代码无法运行。').slice(0,500)});
    };
    worker.onmessageerror=()=>finish({error:'插件返回了无效结果。'});
    worker.postMessage({action,context});
  }catch(error){finish({error:String(error?.message||error).slice(0,500)});}
});
