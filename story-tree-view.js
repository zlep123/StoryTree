'use strict';

function createStoryTreeView({state,$,ST,t,esc,html,message,button,icon,nodeType,dateLabel,locationName,locationById,DEFAULT_LOCATION_COLOR,nodePreview,changeText,locationOptions,speakerName,formatReferenceValue,previewCharacterText,renderOutlineText,outlineLinkLabel,getTimelineEntries,getSearchEntries,searchSnippet,searchLimit}){
  function storyLinkLabel(node,link){
    if(link.jump)return t('跳转');
    const label=node.outputs[link.output];
    return node.type==='condition'?t(label):label;
  }
  function storyForest(nodes) {
    const entries = new Map(nodes.map(node => [node.id,node]));
    const links = new Map(nodes.map(node => [node.id,[]]));
    const incoming = new Set();
    for(const [id,options] of ST.storyLinks(state.p)){
      const from=entries.get(id);
      if(!from)continue;
      for(const option of options){
        const to=entries.get(option.targetNodeId);
        if(!to)continue;
        links.get(id).push({node:to,label:option.jump||from.outputs.length>1?storyLinkLabel(from,option):''});
        incoming.add(to.id);
      }
    }

    const connected = nodes.filter(node => incoming.has(node.id) || links.get(node.id).length);
    const starts = connected.filter(node => !incoming.has(node.id));
    const seen = new Set();
    const charts = [];
    // Display each node once. Extra incoming edges and cycles end at a clickable reference.
    for (const node of [...starts,...connected]) {
      if (seen.has(node.id)) continue;
      const root = {node, depth:0, children:[]};
      const chart = [root];
      seen.add(node.id);
      for (let i=0; i<chart.length; i++) {
        const parent = chart[i];
        if (parent.reference) continue;
        for (const link of links.get(parent.node.id)) {
          const child = {
            node:link.node, label:link.label, depth:parent.depth+1,
            parentId:parent.node.id, reference:seen.has(link.node.id), children:[]
          };
          seen.add(link.node.id);
          parent.children.push(child);
          chart.push(child);
        }
      }
      charts.push(chart);
    }
    return {charts, loose:nodes.filter(node => !seen.has(node.id))};
  }

  function renderStoryCard(node, branch = {}, placement = '') {
    const result = node.result;
    const summary = [
      node.title, [node.sceneName,nodeType(node.type),dateLabel(node.date)].join(' · '),
      locationName(node.locationId),
      nodePreview(node),
      result?.error,
      ...((result?.changes || []).slice(0,4).map(changeText)),
      result?.rolledBack?.length ? t('已回溯事件变化') : ''
    ].filter(Boolean).join('\n');
    const selected = state.selected.has(node.id) ? 'selected' : '';
    return `<button type="button" class="story-card ${selected} ${branch.reference?'story-reference':''}"
      data-focus-node="${esc(node.id)}" data-tree-node="${esc(node.id)}" draggable="true" data-drag-kind="node" data-drag-id="${esc(node.id)}"
      ${branch.parentId?`data-tree-parent="${esc(branch.parentId)}"`:''}
      ${branch.reference?'data-tree-reference':''} title="${esc(summary)}" ${placement}>
        <span class="story-card-title">${branch.reference?'↗ ':''}${esc(node.title)}</span>
    </button>`;
  }

  // Fuse adjacent rows only if the expanded rectangle can avoid all other regions.
  function storyRanges(branches,key,width){
    const rows=new Map(),ranges=[];
    for(const branch of branches){
      if(!rows.has(branch.depth))rows.set(branch.depth,[]);
      const row=rows.get(branch.depth),last=row.at(-1),id=key(branch.node);
      const left=branch.center-width/2,right=branch.center+width/2;
      if(last?.id===id){last.right=right;last.branches.push(branch);}
      else row.push({id,left,right,start:branch.depth,end:branch.depth,branches:[branch]});
    }
    const overlaps=(a,b)=>a.left<b.right&&b.left<a.right;
    const occupied=new Map();
    for(const [depth,row] of rows){
      occupied.set(depth,row.slice());
      for(const current of row){
        const previous=(occupied.get(depth-1)||[]).find(range=>range.id===current.id&&range.end===depth-1&&overlaps(range,current));
        const bounds=previous&&{left:Math.min(current.left,previous.left),right:Math.max(current.right,previous.right)};
        let fits=!!previous;
        const unchanged=previous&&bounds.left===previous.left&&bounds.right===previous.right;
        for(let y=unchanged?depth:previous?.start;fits&&y<=depth;y++){
          fits=!occupied.get(y).some(range=>range!==previous&&range!==current&&overlaps(range,bounds));
        }
        if(!fits){ranges.push(current);continue;}
        Object.assign(previous,bounds,{end:depth});
        previous.branches.push(...current.branches);
        const occupiedRow=occupied.get(depth);
        occupiedRow[occupiedRow.indexOf(current)]=previous;
      }
    }
    return ranges;
  }
  function storyFrame(type,id,placement,content=''){
    const date=type==='date',location=date?null:locationById(id);
    const label=date?dateLabel(id):locationName(id)||t('未指定地点');
    const color=date?'#9f9aee':location?.color||(id?DEFAULT_LOCATION_COLOR:'#788ca6');
    return `<section class="story-frame story-frame-${type}" data-story-${type}-range="${esc(id)}" style="--range-color:${color};${placement}">
      <div class="story-frame-label" title="${esc(label)}">${icon(date?'clock':'scenes',11)}<span>${esc(label)}</span></div>
      ${content}
    </section>`;
  }
  function renderStoryChart(chart) {
    const scale = Math.max(1,state.uiFont/100);
    const width = Math.round(166*scale), height = Math.round(46*scale);
    const column=width+42,heading=Math.round(21*scale);
    const inset=heading*2+10,placeInset=heading+6,edgeSpace=Math.round(23*scale);
    for (let i=chart.length-1; i>=0; i--) {
      const branch = chart[i];
      branch.columns = branch.children.reduce((sum,child) => sum+child.columns,0) || 1;
    }
    chart[0].start = 0;
    for (const branch of chart) {
      branch.center = column*(branch.start+branch.columns/2);
      let start = branch.start;
      for (const child of branch.children) {
        child.start = start;
        start += child.columns;
      }
    }
    const dates=storyRanges(chart,node=>node.date||'',width);
    const headings=[],edgeLabels=new Set();
    for(const date of dates){
      date.places=storyRanges(date.branches,node=>node.locationId||'',width);
      for(const place of date.places)headings[place.start]=Math.max(headings[place.start]||0,placeInset);
      headings[date.start]=inset;
    }
    for(const branch of chart)if(branch.label)edgeLabels.add(branch.depth);
    const rows=[inset];
    for(let depth=1;depth<=chart.at(-1).depth;depth++){
      rows[depth]=rows[depth-1]+height+23+(headings[depth]||0)+(edgeLabels.has(depth)?edgeSpace:0);
    }
    for(const branch of chart)branch.top=rows[branch.depth];
    const chartWidth = chart[0].columns*column;
    const chartHeight = chart.at(-1).top+height+17;
    const frames=dates.map(date=>{
      const dateTop=date.branches[0].top-inset+2;
      const dateLeft=date.left-16;
      const places=date.places.map(place=>{
        const top=place.branches[0].top-placeInset;
        const bottom=place.branches.at(-1).top+height+8;
        return storyFrame('location',place.id,`left:${place.left-8-dateLeft}px;top:${top-dateTop}px;width:${place.right-place.left+16}px;height:${bottom-top}px`);
      });
      const bottom=date.branches.at(-1).top+height+15;
      return storyFrame('date',date.id,`left:${dateLeft}px;top:${dateTop}px;width:${date.right-date.left+32}px;height:${bottom-dateTop}px`,places.join(''));
    });
    const paths = chart.flatMap(branch => {
      const children = branch.children;
      if (!children.length) return [];
      const split = branch.top+height+13;
      return [
        `M${branch.center} ${branch.top+height}V${split}`,
        `M${children[0].center} ${split}H${children.at(-1).center}`,
        ...children.map(child => `M${child.center} ${split}V${child.top}`)
      ];
    });
    const cards = chart.map(branch => {
      const left = branch.center-width/2;
      const style = `style="left:${left}px;top:${branch.top}px;width:${width}px;height:${height}px"`;
      const label=branch.label?`<span class="story-edge-label" title="${esc(branch.label)}"
        style="left:${branch.center}px;top:${branch.top-(headings[branch.depth]||0)-edgeSpace+2}px;max-width:${width}px">${esc(branch.label)}</span>`:'';
      return label+renderStoryCard(branch.node,branch,style);
    });
    return `<div class="story-chart" style="width:${chartWidth}px;height:${chartHeight}px">
      ${frames.join('')}
      <svg class="story-connectors" width="${chartWidth}" height="${chartHeight}" aria-hidden="true"><path d="${paths.join(' ')}"/></svg>
      ${cards.join('')}
    </div>`;
  }

  function renderLooseStoryRanges(nodes){
    const dates=new Map();
    for(const node of nodes){
      const date=node.date||'',place=node.locationId||'';
      if(!dates.has(date))dates.set(date,new Map());
      const places=dates.get(date);
      if(!places.has(place))places.set(place,[]);
      places.get(place).push(node);
    }
    return [...dates].map(([date,places])=>storyFrame('date',date,'',
      [...places].map(([place,nodes])=>storyFrame('location',place,'',
        `<div class="story-loose-cards">${nodes.map(node=>renderStoryCard(node)).join('')}</div>`)).join('')
    )).join('');
  }

  let treeProjectId;
  function syncTreeProject(){
    if(treeProjectId===state.p.id)return;
    treeProjectId=state.p.id;
    state.treeScope={};
    state.treeRouteStart='';
    state.treeRouteChoices={};
    state.treeQuery='';
  }
  function scopeFields(prefix,scope,locationLabel){
    const id=field=>prefix+'-'+field;
    return html`<div class="story-scope-fields">
      <div><label for="${id('from')}">开始日期</label>
        <input id="${id('from')}" placeholder="YYYY.MM.DD" value="${esc(scope.startDate||'')}" autocomplete="off"></div>
      <div><label for="${id('to')}">结束日期</label>
        <input id="${id('to')}" placeholder="YYYY.MM.DD" value="${esc(scope.endDate||'')}" autocomplete="off"></div>
      <div class="story-scope-place"><label for="${id('location')}">地点范围</label>
        <select id="${id('location')}">${locationOptions(scope.locationId,locationLabel)}</select></div>
    </div>`;
  }
  function readStoryScope(prefix){
    const normalize=value=>value.trim()?ST.dateText(value.trim()):'';
    const startDate=normalize($('#'+prefix+'-from').value),endDate=normalize($('#'+prefix+'-to').value);
    const scope={startDate,endDate,locationId:$('#'+prefix+'-location').value};
    ST.storyScope(state.p,scope);
    return scope;
  }
  function formatStoryRange({startDate,endDate}){
    if(startDate&&endDate)return startDate===endDate?startDate:startDate+' — '+endDate;
    if(startDate)return message`自 ${startDate} 起`;
    if(endDate)return message`截至 ${endDate}`;
    return t('未定日期');
  }
  function renderStoryFilters(){
    const scope=state.treeScope,active=Object.values(scope).some(Boolean);
    return html`<details class="story-filters" ${state.treeFiltersOpen?'open':''}>
      <summary data-tree-filter-toggle>日期与地点筛选 ${active?`<span class="pill">${t('已应用')}</span>`:''}</summary>
      ${scopeFields('tree-scope',scope,t('全部地点'))}
      <div class="story-filter-actions">
        ${button('tree-filter-reset',t('清除筛选'),'small ghost')}
        ${button('tree-filter-apply',t('应用筛选'),'small primary')}
      </div>
    </details>`;
  }
  function storySynopsis(node,characters){
    const name=id=>(id&&characters&&ST.characterDisplayName(characters[id]))||speakerName(id,node);
    const lines=ST.hasDialogue(node)?node.lines.filter(line=>line.text?.trim()).slice(0,3)
      .map(line=>name(line.characterId)+'：'+line.text):[];
    const source=[node.summary,node.text,node.condition?.description,...lines].map(value=>value?.trim()).filter(Boolean).join('\n');
    const text=characters?ST.resolveCharacterText(source,characters,state.p,formatReferenceValue):previewCharacterText(source,node);
    const limit=240;
    return text.length>limit?text.slice(0,limit-1)+'…':text;
  }
  function renderStoryListNode(node,options={}){
    const summary=storySynopsis(node,options.characters);
    const meta=[node.sceneName||ST.sceneOf(state.p,node.sceneId).name,
      options.hideDate?'':dateLabel(node.date),locationName(node.locationId)||t('未指定地点')].filter(Boolean).join(' · ');
    return html`<article class="story-list-node ${options.outside?'story-outside':''}" data-story-step="${esc(node.id)}">
      <div class="story-list-meta">${esc(meta)}${options.outside?' · '+t('范围外'):''}</div>
      <button type="button" class="story-node-title ${state.selected.has(node.id)?'selected':''}"
        draggable="true" data-drag-kind="node" data-drag-id="${esc(node.id)}" data-tree-node="${esc(node.id)}" data-focus-node="${esc(node.id)}" title="在画布定位">${icon(node.type,14)} ${esc(node.title)}</button>
      <div class="story-excerpt">${esc(summary||t('此节点还没有填写剧情内容。'))}</div>
      ${options.branches||''}
    </article>`;
  }
  function renderStoryRoute(entries,scope){
    const nodes=new Map(entries.map(node=>[node.id,node]));
    const startNodeId=nodes.has(state.treeRouteStart)?state.treeRouteStart:undefined;
    const route=ST.storyRoute(state.p,{startNodeId,choices:state.treeRouteChoices});
    if(!route.steps.length)return html`<p class="hint">先在画布新建节点，就可以沿连线阅读剧情。</p>`;
    const selected=route.steps[0].nodeId;
    const choices=Object.fromEntries(route.steps.filter(step=>step.selectedId).map(step=>[step.nodeId,step.selectedId]));
    const preview=ST.trace(state.p,{startNodeId:selected,choices,maxSteps:route.steps.length});
    const snapshots=new Map(preview.history.map(step=>[step.nodeId,step]));
    const startOptions=state.p.scenes.map(scene=>{
      const list=entries.filter(node=>node.sceneId===scene.id);
      return list.length?`<optgroup label="${esc(scene.name)}">${list.map(node=>
        `<option value="${esc(node.id)}" ${node.id===selected?'selected':''}>${esc(node.title)}</option>`).join('')}</optgroup>`:'';
    }).join('');
    const cards=route.steps.map(step=>{
      const node=nodes.get(step.nodeId);
      const branches=step.options.length>1?html`<div class="story-route-choices">
        <div class="tiny muted">选择接下来的分支</div>
        ${step.options.map(link=>`<button type="button" class="small ${link.id===step.selectedId?'active':''}"
          aria-pressed="${link.id===step.selectedId}" data-story-route-source="${esc(node.id)}" data-story-route-choice="${esc(link.id)}">
          ${esc([storyLinkLabel(node,link),nodes.get(link.targetNodeId).title].filter(Boolean).join(' → '))}
        </button>`).join('')}
      </div>`:'';
      const snapshot=snapshots.get(node.id);
      const characters=node.type==='condition'&&!step.selectedId?snapshot?.before:snapshot?.after;
      return renderStoryListNode(node,{outside:!scope.node(node),branches,characters});
    }).join('');
    const status={choice:'选一条分支继续读。',cycle:'连线回到了已读节点。',limit:'已到达本次概要的节点上限。',end:'这条路线到此结束。'};
    return html`<div class="story-route story-reading">
      <label for="story-route-start">从这个节点开始读</label>
      <select id="story-route-start" data-focus="story-route-start">${startOptions}</select>
      <div class="story-route-steps">${cards}</div>
      <p class="hint">${t(status[route.status])}</p>
    </div>`;
  }
  function renderOutlineCard(entry,entries){
    const scope=ST.storyScope(state.p,entry);
    const matches=entries.filter(scope.node);
    return html`<article class="story-outline-card" data-outline-card="${esc(entry.id)}">
      <div class="row between"><h3 draggable="true" data-drag-kind="outline" data-drag-id="${esc(entry.id)}">${esc(entry.title)}</h3>
        <button type="button" class="small ghost" data-outline-edit="${esc(entry.id)}">编辑</button></div>
      <div class="story-list-meta">${esc(formatStoryRange(entry))} · ${esc(locationName(entry.locationId)||t('不限地点'))}</div>
      ${ST.outlineSections(entry).map((section,index)=>section.title||section.text?`
        <section class="story-outline-section" data-outline-section="${index}">
          ${section.title?`<h4>${esc(section.title)}</h4>`:''}
          ${section.text?`<div class="story-excerpt">${renderOutlineText(section.text)}</div>`:''}
        </section>`:'').join('')}
      <details class="story-outline-members"><summary>${matches.length} 个范围内节点</summary>
        ${matches.map(node=>`<button type="button" class="small ghost" data-tree-node="${esc(node.id)}"
          draggable="true" data-drag-kind="node" data-drag-id="${esc(node.id)}"
          data-focus-node="${esc(node.id)}" title="${esc(node.title)}">${esc(dateLabel(node.date)+' · '+node.title)}</button>`).join('')
          ||html`<p class="hint">范围内还没有节点，可以先写下计划。</p>`}
      </details>
    </article>`;
  }
  function renderTreeSearchResults(){
    const terms=state.treeQuery.trim().toLowerCase().split(/\s+/u);
    const scope=ST.storyScope(state.p,state.treeScope);
    const nodeIds=new Set(state.p.nodes.filter(scope.node).map(node=>node.id));
    const entries=getSearchEntries().filter(entry=>entry.kind==='node'&&nodeIds.has(entry.id));
    for(const entry of (state.p.outline||[]).filter(scope.outline)){
      const meta=[formatStoryRange(entry),locationName(entry.locationId)].filter(Boolean).join(' · ');
      const sections=ST.outlineSections(entry);
      const fields=[entry.title,meta,t('大纲'),...sections.flatMap(section=>[section.title,
        ST.outlineTextParts(section.text).map(part=>typeof part==='string'?part:outlineLinkLabel(part)||'').join(' ')
      ])];
      entries.push({kind:'outline',id:entry.id,title:entry.title,meta,fields,haystack:fields.join('\n').toLowerCase()});
    }
    const query=terms.join(' ');
    const rank=entry=>entry.title.toLowerCase()===query?0:entry.title.toLowerCase().includes(query)?1:2;
    const matches=entries.filter(entry=>terms.every(term=>entry.haystack.includes(term))).sort((a,b)=>rank(a)-rank(b));
    const count=matches.length;
    const caption=count>searchLimit?message`共 ${count} 条 · 显示前 ${searchLimit} 条`:message`${count} 条匹配`;
    return html`<div class="story-reading tree-search-results">
      <p class="hint" role="status">${caption}${Object.values(state.treeScope).some(Boolean)?' · '+t('已应用日期和地点筛选'):''}</p>
      ${matches.slice(0,searchLimit).map(entry=>{
        const snippet=searchSnippet(entry,terms);
        return `<button class="tree-search-hit" type="button"
        ${entry.kind==='node'?`data-focus-node="${esc(entry.id)}"`:`data-tree-search-outline="${esc(entry.id)}"`}>
        <span class="search-kind">${t(entry.kind==='node'?'节点':'大纲')}</span>
        <span class="search-result-body"><strong>${esc(entry.title)}</strong>
          <span class="search-result-meta">${esc(entry.meta)}</span>
          ${snippet?`<span class="search-snippet">${snippet}</span>`:''}
        </span>
      </button>`;
      }).join('')||html`<p class="hint">没有匹配的节点或大纲。</p>`}
    </div>`;
  }
  function renderTreeContents(entries) {
    const scope=ST.storyScope(state.p,state.treeScope);
    if(state.treeMode==='route')return renderStoryRoute(entries,scope);
    const nodes=entries.filter(scope.node);
    const outline=(state.p.outline||[]).filter(scope.outline);
    if(state.treeMode==='outline')return `<div class="story-reading story-outline-list">
      ${outline.map(entry=>renderOutlineCard(entry,entries)).join('')||html`<p class="hint">还没有符合筛选条件的大纲。可以从一条计划开始写。</p>`}
    </div>`;
    if(!nodes.length)return html`<p class="hint">${t(entries.length?'范围内没有节点。':'连接画布上的节点，故事树就会在这里生长。')}</p>`;
    const {charts,loose} = storyForest(nodes);
    const scoped=Object.values(state.treeScope).some(Boolean);
    const singles = loose.length
      ? html`<div class="story-loose"><div class="section-label">${t(scoped?'范围内无直接连线的节点':'未连接的节点')}</div>${renderLooseStoryRanges(loose)}</div>`
      : '';
    return `<div class="story-forest">${charts.map(renderStoryChart).join('')}</div>${singles}`;
  }

  function renderTree() {
    const tabs=[['branches','分支'],['route','剧情概要'],['outline','大纲']];
    return html`<aside class="tree ${state.treeExpanded?'tree-expanded':''}">
      <div class="panel-heading"><h3>${icon('tree',14)} 故事树</h3><div class="tree-heading-actions">
        ${button('tree-expand',t(state.treeExpanded?'返回画布':'展开'),'small ghost')}
        ${state.treeExpanded?'':button('tree',icon('chevron',14),'icon ghost',t('收起故事树'))}
      </div></div>
      <div class="tree-toolbar">
        ${tabs.map(([id,label])=>button('tree-'+id,t(label),state.treeMode===id?'small active':'small ghost')).join('')}
        ${button('outline-create',t('＋ 新建大纲'),'small primary')}
      </div>
      <div class="tree-search">
        ${icon('search',14)}
        <input type="search" id="tree-search" data-focus="tree-search" aria-label="搜索节点和大纲"
          placeholder="搜索节点和大纲…" autocomplete="off" value="${esc(state.treeQuery)}">
      </div>
      ${renderStoryFilters()}
      <div class="tree-content">${state.treeQuery.trim()?renderTreeSearchResults():renderTreeContents(getTimelineEntries())}</div>
    </aside>`;
  }

  return {renderTree,renderTreeContents,renderTreeSearchResults,syncTreeProject,scopeFields,readStoryScope};
}
