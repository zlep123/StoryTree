'use strict';

function createTextFindReplace({ST,t,html,getModal,getProjectId,editorNodeId,focusEditor}){
  let panel,target,lastEditor,cursor=-1,changing=false;
  const field=selector=>panel.querySelector(selector);
  const isOutline=editor=>editor.hasAttribute('data-outline-editor');
  function editable(editor){
    return editor instanceof HTMLElement&&!editor.readOnly&&!editor.disabled&&
      !editor.closest('#text-find,.variable-details')&&
      (isOutline(editor)||editor.tagName==='TEXTAREA'||editor.tagName==='INPUT'&&editor.type==='text'&&
        !editor.id.endsWith('-search')&&!editor.id.startsWith('project-replace-')&&!editor.dataset.storyDate&&!editor.dataset.datePart);
  }
  function remember(editor){
    return {editor,modal:getModal(),projectId:getProjectId(),node:editorNodeId(editor),key:editor.dataset.focus,id:editor.id};
  }
  function resolve(record){
    if(!record||record.modal!==getModal()||record.projectId!==getProjectId())return null;
    if(record.editor.isConnected)return editable(record.editor)?record.editor:null;
    if(isOutline(record.editor))return null;
    const candidates=record.key?document.querySelectorAll('[data-focus]'):
      record.id?[document.getElementById(record.id)]:[];
    return [...candidates].find(el=>editable(el)&&editorNodeId(el)===record.node&&
      (record.key?el.dataset.focus===record.key:el.id===record.id))||null;
  }
  function outlineRuns(editor){
    const runs=[];
    let run={text:'',spans:[]};
    function finish(){
      if(run.text)runs.push(run);
      run={text:'',spans:[]};
    }
    function visit(node){
      if(node.nodeType===Node.TEXT_NODE){
        const mark=node.parentElement.closest('[data-outline-caret-slot]')?node.data.indexOf('\u200b'):-1;
        const text=mark<0?node.data:node.data.slice(0,mark)+node.data.slice(mark+1);
        if(!text)return;
        const start=run.text.length;
        run.text+=text;
        run.spans.push({node,mark,start,end:run.text.length});
        return;
      }
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      if(node.matches('br,[contenteditable=false]')){finish();return;}
      const block=node!==editor&&node.matches('div,p,li,section');
      if(block)finish();
      node.childNodes.forEach(visit);
      if(block)finish();
    }
    visit(editor);
    finish();
    return runs;
  }
  function matches(editor,query,sensitive){
    if(!editor||!query)return [];
    const pattern=ST.literalTextPattern(query,sensitive);
    const hits=(text,make)=>Array.from(text.matchAll(pattern),match=>make(match.index,match.index+match[0].length));
    if(isOutline(editor))return outlineRuns(editor).flatMap(run=>hits(run.text,(start,end)=>({start,end,run})));
    return ST.textMatches(editor.value,pattern);
  }
  function current(){
    return {editor:resolve(target),query:field('#text-find-query').value,sensitive:field('#text-find-case').checked};
  }
  function result(){
    const {editor,query,sensitive}=current();
    return {editor,query,hits:matches(editor,query,sensitive)};
  }
  function refresh(reset=false,message=''){
    if(!panel)return;
    if(reset)cursor=-1;
    const {editor,query,hits}=result();
    if(cursor>=hits.length)cursor=-1;
    field('.text-find-status').textContent=message||(!editor?t('请选择一个文字编辑框'):
      !query?t('在当前编辑框内查找'):
      !hits.length?t('没有匹配文字'):
      cursor<0?t('找到 {count} 处').replace('{count}',hits.length):
      t('第 {index} 处，共 {count} 处').replace('{index}',cursor+1).replace('{count}',hits.length));
    for(const button of panel.querySelectorAll('button[data-requires-match]')){
      button.disabled=!hits.length;
    }
  }
  function rangeFor(hit){
    const first=hit.run.spans.find(span=>span.end>hit.start);
    const last=hit.run.spans.find(span=>span.end>=hit.end);
    const from=hit.start-first.start,to=hit.end-last.start;
    const range=document.createRange();
    range.setStart(first.node,from+(first.mark>=0&&from>=first.mark?1:0));
    range.setEnd(last.node,to+(last.mark>=0&&to>last.mark?1:0));
    return range;
  }
  function reveal(editor,index){
    if(editor.tagName!=='TEXTAREA'||editor.scrollHeight<=editor.clientHeight)return;
    const style=getComputedStyle(editor),mirror=document.createElement('div'),marker=document.createElement('span');
    mirror.className='text-find-mirror';
    for(const property of ['font','letterSpacing','lineHeight','padding','tabSize','textIndent','whiteSpace','wordBreak']){
      mirror.style[property]=style[property];
    }
    mirror.style.width=editor.clientWidth+'px';
    const end=index+String.fromCodePoint(editor.value.codePointAt(index)).length;
    marker.textContent=editor.value.slice(index,end);
    mirror.append(editor.value.slice(0,index),marker,editor.value.slice(end));
    document.body.append(mirror);
    const top=marker.getBoundingClientRect().top-mirror.getBoundingClientRect().top;
    const line=Number.parseFloat(style.lineHeight)||Number.parseFloat(style.fontSize);
    mirror.remove();
    if(top<editor.scrollTop||top+line>editor.scrollTop+editor.clientHeight)editor.scrollTop=top-line;
  }
  function select(editor,hit){
    focusEditor(editor,{preventScroll:true});
    if(!hit.run){
      editor.setSelectionRange(hit.start,hit.end);
      reveal(editor,hit.start);
      return;
    }
    const range=rangeFor(hit),selection=getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    range.startContainer.parentElement.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function navigate(step){
    const {editor,hits}=result();
    if(!hits.length)return;
    cursor=cursor<0?(step>0?0:hits.length-1):(cursor+step+hits.length)%hits.length;
    select(editor,hits[cursor]);
    refresh();
  }
  function notifyInput(editor,text){
    editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:text}));
  }
  function replacePlain(editor,hits,text,all){
    const source=editor.value;
    let value=text,start=hits[0].start,end=hits[0].end;
    if(all){
      value=ST.replaceTextRanges(source,hits,text);
      start=0;
      end=source.length;
    }
    focusEditor(editor,{preventScroll:true});
    editor.setSelectionRange(start,end);
    if(value?document.execCommand('insertText',false,value):document.execCommand('delete'))return;
    editor.setRangeText(value,start,end,'end');
    notifyInput(editor,text);
  }
  function replaceOutline(editor,hits,text,all){
    focusEditor(editor,{preventScroll:true});
    if(!all){
      select(editor,hits[0]);
      if(text?document.execCommand('insertText',false,text):document.execCommand('delete'))return;
    }
    const clone=all?editor.cloneNode(true):null;
    const {query,sensitive}=current();
    const ranges=(clone?matches(clone,query,sensitive):hits).map(rangeFor).reverse();
    for(const range of ranges){
      range.deleteContents();
      if(text)range.insertNode(document.createTextNode(text));
    }
    if(!all){
      notifyInput(editor,text);
      return;
    }
    const selection=getSelection();
    const contents=document.createRange();
    contents.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(contents);
    const markup=clone.innerHTML;
    if(markup?document.execCommand('insertHTML',false,markup):document.execCommand('delete'))return;
    editor.replaceChildren(...clone.childNodes);
    notifyInput(editor,text);
  }
  function replace(all){
    const {editor,hits}=result();
    if(!hits.length)return;
    const index=Math.max(0,cursor),affected=all?hits:[hits[index]];
    const text=field('#text-find-replacement').value;
    changing=true;
    try{
      if(isOutline(editor))replaceOutline(editor,affected,text,all);
      else replacePlain(editor,affected,text,all);
    }finally{changing=false;}
    cursor=-1;
    if(!all){
      const remaining=result().hits;
      if(remaining.length){
        const {query,sensitive}=current();
        const inserted=ST.textMatches(text,ST.literalTextPattern(query,sensitive)).length;
        cursor=(index+inserted)%remaining.length;
        select(editor,remaining[cursor]);
      }
    }
    refresh(false,t('已替换 {count} 处').replace('{count}',affected.length));
  }
  function close(restore=false){
    if(!panel)return;
    const editor=resolve(target);
    panel.remove();
    panel=null;
    target=null;
    if(restore&&editor)focusEditor(editor,{preventScroll:true});
  }
  function showReplacement(on){
    field('[data-replacement-row]').hidden=!on;
    field('[data-text-find-command=show-replace]').hidden=on;
    panel.setAttribute('aria-label',t(on?'查找替换':'查找'));
    field('.text-find-title').textContent=t(on?'查找替换':'查找');
  }
  function open(editor,replacing){
    if(!editable(editor))return false;
    target=remember(editor);
    if(!panel){
      panel=document.createElement('section');
      panel.id='text-find';
      panel.setAttribute('role','dialog');
      panel.innerHTML=html`
        <div class="row between"><strong class="text-find-title flex"></strong><button type="button" class="small ghost" data-text-find-command="show-replace">替换</button><button type="button" class="small ghost" data-text-find-command="close" aria-label="关闭">×</button></div>
        <div class="row">
          <input id="text-find-query" aria-label="查找文字" placeholder="查找文字" autocomplete="off">
          <button type="button" class="small" data-requires-match data-text-find-command="previous" aria-label="上一个匹配">↑</button>
          <button type="button" class="small" data-requires-match data-text-find-command="next" aria-label="下一个匹配">↓</button>
        </div>
        <div class="row" data-replacement-row>
          <input id="text-find-replacement" aria-label="替换为" placeholder="替换为" autocomplete="off">
          <button type="button" class="small" data-requires-match data-text-find-command="replace">替换</button>
          <button type="button" class="small" data-requires-match data-text-find-command="all">全部替换</button>
        </div>
        <div class="row between">
          <label><input type="checkbox" id="text-find-case">区分大小写</label>
          <span class="text-find-status" role="status"></span>
        </div>`;
      document.body.append(panel);
      panel.addEventListener('click',event=>{
        const command=event.target.closest('[data-text-find-command]')?.dataset.textFindCommand;
        if(command==='close')close(true);
        if(command==='show-replace'){showReplacement(true);field('#text-find-replacement').focus();}
        if(command==='previous'||command==='next')navigate(command==='previous'?-1:1);
        if(command==='replace'||command==='all')replace(command==='all');
      });
      panel.addEventListener('change',event=>{if(event.target.id==='text-find-case')refresh(true);});
    }
    showReplacement(replacing);
    const query=field('#text-find-query');
    const selection=getSelection();
    const selected=isOutline(editor)?editor.contains(selection?.anchorNode)?selection.toString():'':
      editor.value.slice(editor.selectionStart,editor.selectionEnd);
    if(selected&&!/[\r\n]/u.test(selected))query.value=selected;
    refresh(true);
    query.focus();
    query.select();
    return true;
  }
  function openFrom(control,replacing){
    const scope=control.closest('.modal,.inspector-content');
    const remembered=resolve(lastEditor);
    const editor=remembered&&scope?.contains(remembered)?remembered:
      [...(scope?.querySelectorAll('[data-outline-editor],textarea,input')||[])].find(el=>editable(el)&&
        el.matches('textarea,[data-outline-editor]'));
    return open(editor,replacing);
  }
  function sync(){
    if(!panel)return;
    if(!resolve(target))close();
    else refresh();
  }
  function bind(){
    document.addEventListener('focusin',event=>{
      if(!editable(event.target))return;
      lastEditor=remember(event.target);
      if(panel&&resolve(target)!==event.target){
        target=lastEditor;
        refresh(true);
      }
    });
    document.addEventListener('input',event=>{
      if(!panel||changing||event.isComposing)return;
      if(event.target.id==='text-find-query'||event.target===resolve(target))refresh(true);
    });
    document.addEventListener('compositionend',event=>{
      if(panel&&(event.target.id==='text-find-query'||event.target===resolve(target)))refresh(true);
    });
    document.addEventListener('keydown',event=>{
      if(event.isComposing||event.keyCode===229)return;
      const key=event.key.toLowerCase(),fromPanel=panel?.contains(event.target);
      const command=event.ctrlKey||event.metaKey;
      let handled=false;
      if(command&&(key==='f'||key==='h')){
        const editor=fromPanel?resolve(target):editable(event.target)?event.target:key==='h'?resolve(lastEditor):null;
        handled=open(editor,key==='h');
      }else if(panel&&(key==='f3'||command&&key==='g')){
        navigate(event.shiftKey?-1:1);
        handled=true;
      }else if(fromPanel&&key==='enter'&&event.target.tagName==='INPUT'&&event.target.type==='text'){
        if(event.target.id==='text-find-replacement')replace(false);
        else navigate(event.shiftKey?-1:1);
        handled=true;
      }else if(panel&&key==='escape'){
        close(true);
        handled=true;
      }
      if(handled){event.preventDefault();event.stopPropagation();}
    },true);
  }
  return {bind,openFrom,sync};
}
