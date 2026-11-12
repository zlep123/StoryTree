'use strict';

function createPluginView({state,ST,$,esc,html,t,button,showModal,closeModal,toast,run,updateSave,flushDrafts,focusNode,selectedNode}){
  const api=globalThis.StoryTreePlugins;
  const exampleId='storytree.scene-review';
  const permissionNames={'project.read':'读取当前项目','project.write':'提议修改项目'};
  const contexts={project:'项目',scene:'当前场景',node:'所选节点'};
  const available=action=>action.context!=='node'||!!selectedNode();
  const errorText=error=>t(String(error?.message||error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/u,''));

  function managerBody(modal){
    if(modal.busy&&!modal.plugins.length)return html`<p class="hint">正在读取插件…</p>`;
    return html`
      <div class="plugin-toolbar">
        ${button('plugin-install',t('安装或更新插件'),'small primary')}
        ${!modal.plugins.some(plugin=>plugin.id===exampleId)?button('plugin-install-example',t('安装示例插件'),'small ghost'):''}
      </div>
      ${modal.error?`<p class="error" role="alert">${esc(modal.error)}</p>`:''}
      ${modal.notice?`<p class="hint" role="status">${esc(modal.notice)}</p>`:''}
      <div class="plugin-list">
        ${modal.plugins.map(plugin=>html`<section class="plugin-card" data-plugin-id="${esc(plugin.id)}">
          <div class="row between">
            <h3>${esc(plugin.name)}</h3><span class="muted smalltext">v${esc(plugin.version)} · ${t(plugin.enabled?'已启用':'已停用')}</span>
          </div>
          ${plugin.description?`<p class="plugin-description">${esc(plugin.description)}</p>`:''}
          <div class="plugin-permissions">${plugin.permissions.map(key=>`<span class="pill">${t(permissionNames[key])}</span>`).join('')||
            `<span class="muted smalltext">${t('无需项目权限')}</span>`}</div>
          <div class="plugin-controls">
            ${button('plugin-toggle',t(plugin.enabled?'停用':'启用'),'small')}
            ${button('plugin-remove',t('卸载'),'small ghost danger')}
          </div>
          ${plugin.enabled?html`<div class="plugin-actions">
            ${plugin.actions.map(action=>`<button type="button" class="small ghost" data-action="plugin-open-action"
              data-plugin-action="${esc(action.id)}" ${available(action)?'':'disabled'} title="${esc(available(action)?action.description:t('先选择一个节点'))}">
              ${esc(action.title)} <span class="muted">${t(contexts[action.context])}</span></button>`).join('')}
          </div>`:''}
        </section>`).join('')||html`<p class="hint">还没有安装插件。</p>`}
      </div>
    `;
  }
  function renderManager(modal){
    showModal(t('插件'),`<fieldset class="plugin-fieldset" ${modal.busy?'disabled':''}>${managerBody(modal)}</fieldset>`,
      button('modal-close',t('关闭'),'primary'));
  }
  async function open(){
    state.modal?.abort?.abort();
    const modal={kind:'plugins',plugins:[],busy:true};
    state.modal=modal;
    renderManager(modal);
    try{modal.plugins=await desktop.listPlugins();}
    catch(error){modal.error=errorText(error);}
    finally{
      modal.busy=false;
      if(state.modal===modal)renderManager(modal);
    }
  }
  async function changeManager(modal,action,id){
    if(modal.busy)return;
    modal.busy=true;
    modal.error='';
    modal.notice='';
    renderManager(modal);
    try{
      if(action==='plugin-install'||action==='plugin-install-example'){
        const added=await (action==='plugin-install'?desktop.installPlugin():desktop.installExamplePlugin());
        if(!added)return;
        modal.notice=t(added.enabled?'插件已更新。':'插件已安装，请查看权限后启用。');
      }else if(action==='plugin-toggle'){
        const plugin=modal.plugins.find(entry=>entry.id===id);
        if(plugin)await desktop.enablePlugin(id,!plugin.enabled);
      }else if(action==='plugin-remove'){
        await desktop.removePlugin(id);
      }
      modal.plugins=await desktop.listPlugins();
    }catch(error){modal.error=errorText(error);}
    finally{
      modal.busy=false;
      if(state.modal===modal)renderManager(modal);
    }
  }
  function fieldMarkup(field,value){
    const id='plugin-input-'+field.id,label=`<label for="${id}">${esc(field.label)}</label>`;
    const attr=`id="${id}" data-plugin-input="${field.id}" data-focus="${id}" ${field.required?'required':''}`;
    if(field.type==='boolean')return `<label class="row plugin-checkbox"><input type="checkbox" ${attr} ${value?'checked':''}>${esc(field.label)}</label>`;
    if(field.type==='multiline')return label+`<textarea ${attr} rows="4" maxlength="20000">${'\n'+esc(value??'')}</textarea>`;
    if(field.type==='select'){
      return label+`<select ${attr}><option value="">${t('请选择')}</option>${field.choices.map(choice=>
        `<option value="${esc(choice.value)}" ${value===choice.value?'selected':''}>${esc(choice.label)}</option>`).join('')}</select>`;
    }
    return label+`<input type="${field.type}" ${attr} value="${esc(value??'')}" ${field.type==='number'?'step="any"':'maxlength="2000"'}>`;
  }
  function renderResult(modal){
    const result=modal.result;
    if(!result)return '';
    return html`<section class="plugin-result">
      ${result.message?`<pre class="plugin-report">${esc(result.message)}</pre>`:''}
      ${result.links.length?`<div class="plugin-actions">${result.links.filter(link=>state.p.nodes.some(node=>node.id===link.nodeId)).map(link=>
        `<button type="button" class="small ghost" data-action="plugin-focus-node" data-plugin-node="${esc(link.nodeId)}">${esc(link.label)} ↗</button>`).join('')}</div>`:''}
      ${result.commands.length&&!modal.applied?html`
        <details class="plugin-changes" open>
          <summary>待确认的项目修改 · ${result.commands.length}</summary>
          <pre class="code-block">${esc(JSON.stringify(result.commands,null,2))}</pre>
        </details>`:''}
      ${modal.applied?html`<p class="hint" role="status">修改已保存，可用撤销恢复。</p>`:''}
    </section>`;
  }
  function renderAction(modal){
    const {plugin,action}=modal;
    showModal(action.title,html`
      <div class="plugin-action-meta">${esc(plugin.name)} · v${esc(plugin.version)} · ${t(contexts[action.context])}</div>
      ${action.description?`<p class="plugin-description">${esc(action.description)}</p>`:''}
      <form id="plugin-action-form"><fieldset class="plugin-fieldset" ${modal.busy?'disabled':''}>
        ${action.fields.map(field=>fieldMarkup(field,modal.inputs[field.id])).join('')}
      </fieldset></form>
      ${modal.busy?html`<p class="hint" role="status">正在运行插件…</p>`:''}
      ${modal.error?`<p class="error" role="alert">${esc(modal.error)}</p>`:''}
      ${renderResult(modal)}
    `,button('plugins',t('返回插件列表'),'ghost left')+
      button('modal-close',t('关闭'),'ghost')+
      (modal.busy?'':button('plugin-run',t('运行插件'),modal.result?.commands.length&&!modal.applied?'':'primary'))+
      (modal.result?.commands.length&&!modal.applied&&!modal.busy?button('plugin-apply',t('应用修改'),'primary'):''));
  }
  function openAction(plugin,action){
    if(!plugin?.enabled||!action||!available(action))return;
    const modal={kind:'plugin-action',plugin,action,inputs:Object.create(null),busy:false};
    state.modal=modal;
    renderAction(modal);
  }
  function captureInputs(modal){
    const form=$('#plugin-action-form');
    if(!form.reportValidity())return false;
    for(const element of form.querySelectorAll('[data-plugin-input]')){
      modal.inputs[element.dataset.pluginInput]=element.type==='checkbox'?element.checked:
        element.type==='number'?(element.value===''?null:element.valueAsNumber):element.value;
    }
    return true;
  }
  function sandboxRun(source,action,context,signal){
    return new Promise((resolve,reject)=>{
      const id=crypto.randomUUID(),frame=document.createElement('iframe');
      frame.hidden=true;
      frame.setAttribute('sandbox','allow-scripts');
      frame.src=new URL('plugin-sandbox.html',location.href).href;
      const abort=()=>finish(Error(t('已取消运行插件。')));
      const timer=setTimeout(()=>finish(Error(t('插件运行超时。'))),7500);
      function finish(error,result){
        clearTimeout(timer);
        window.removeEventListener('message',receive);
        signal.removeEventListener('abort',abort);
        frame.remove();
        if(error)reject(error);
        else resolve(result);
      }
      function receive(event){
        if(event.source!==frame.contentWindow||event.origin!=='null'||event.data?.id!==id)return;
        if(typeof event.data.error==='string'){finish(Error(t(event.data.error)));return;}
        const result=event.data.result;
        try{
          if(typeof result!=='string'||result.length>api.RESULT_LIMIT)throw Error(t('插件结果过大或无效。'));
          finish(null,JSON.parse(result));
        }catch(error){finish(error);}
      }
      if(signal.aborted){abort();return;}
      signal.addEventListener('abort',abort,{once:true});
      window.addEventListener('message',receive);
      frame.addEventListener('load',()=>{
        frame.contentWindow.postMessage({id,source,action,context},'*');
      },{once:true});
      document.body.append(frame);
    });
  }
  async function runAction(modal){
    if(modal.busy||!captureInputs(modal))return;
    modal.busy=true;
    modal.error='';
    modal.result=null;
    modal.applied=false;
    modal.abort=new AbortController();
    renderAction(modal);
    try{
      if(!await flushDrafts())throw Error(t('请先保存项目草稿。'));
      if(state.modal!==modal)return;
      if(!available(modal.action))throw Error(t('先选择一个节点'));
      const entry=await desktop.pluginAction(modal.plugin.id,modal.action.id,modal.plugin.version);
      if(state.modal!==modal)return;
      const project=state.p;
      modal.base={id:project.id,revision:project.revision};
      const context={apiVersion:api.API_VERSION,language:state.language,inputs:modal.inputs,
        sceneId:project.currentSceneId,nodeId:selectedNode()?.id??null};
      if(entry.manifest.permissions.includes('project.read'))context.project=project;
      const output=await sandboxRun(entry.source,entry.action.id,context,modal.abort.signal);
      const result=api.validateResult(output,entry.manifest.permissions);
      if(result.commands.length)ST.execute(project,result.commands);
      modal.result=result;
    }catch(error){modal.error=errorText(error);}
    finally{
      modal.busy=false;
      modal.abort=null;
      if(state.modal===modal)renderAction(modal);
    }
  }
  async function apply(modal){
    if(modal.busy||modal.applied||!modal.result?.commands.length)return;
    modal.busy=true;
    modal.error='';
    renderAction(modal);
    try{
      const entry=await desktop.pluginAction(modal.plugin.id,modal.action.id,modal.plugin.version);
      if(state.modal!==modal)return;
      if(!entry.manifest.permissions.includes('project.write'))throw Error(t('此插件没有提议修改项目的权限。'));
      const result=await run(()=>{
        if(state.modal!==modal)return [];
        if(state.p.id!==modal.base.id||state.p.revision!==modal.base.revision)throw Error(t('项目已变化，请重新运行插件生成预览。'));
        return modal.result.commands;
      },t('插件修改已保存'));
      modal.applied=!!result;
    }catch(error){
      delete modal.failedSave;
      updateSave();
      modal.error=errorText(error);
    }finally{
      modal.busy=false;
      if(state.modal===modal)renderAction(modal);
    }
  }
  async function handle(action,event){
    const modal=state.modal;
    if(modal?.kind==='plugins'){
      const id=event.target.closest('[data-plugin-id]')?.dataset.pluginId;
      if(action==='plugin-open-action'){
        const plugin=modal.plugins.find(entry=>entry.id===id);
        const actionId=event.target.closest('[data-plugin-action]')?.dataset.pluginAction;
        openAction(plugin,plugin?.actions.find(entry=>entry.id===actionId));
      }else if(['plugin-install','plugin-install-example','plugin-toggle','plugin-remove'].includes(action)){
        await changeManager(modal,action,id);
      }
    }else if(modal?.kind==='plugin-action'){
      if(action==='plugin-run')await runAction(modal);
      if(action==='plugin-apply')await apply(modal);
      if(action==='plugin-focus-node'){
        const id=event.target.closest('[data-plugin-node]')?.dataset.pluginNode;
        if(id){closeModal();await focusNode(id);}
      }
    }
  }
  document.addEventListener('submit',event=>{
    if(event.target.id!=='plugin-action-form')return;
    event.preventDefault();
    handle('plugin-run',event).catch(error=>toast(errorText(error)));
  });
  return {open,handle};
}
