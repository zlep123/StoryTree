'use strict';

function createSceneMapView({state,ST,$,esc,html,t,button,icon,currentScene,locationsInOrder,locationById,
  locationName,locationOptions,defaultColor,run,render,toast,openLocation,openCharacter,openMapObject,focusMapArea,renderLocationCard,locationCardActions,saveDisplaySettings}){
  const {width,height,minWidth,minHeight}=ST.MAP_SIZE;
  const canvasScale=3;
  const sessions=new Map();
  let projectId,gesture,clipboard,contextPoint,skipClick=false,routeClickId='';
  const clamp=(value,low,high)=>Math.round(Math.min(high,Math.max(low,value)));
  const center=area=>({x:area.x+area.width/2,y:area.y+area.height/2});
  const locationColor=id=>locationById(id)?.color||defaultColor;
  const mapElements=map=>map.elements||[];
  const shapeNames={rectangle:'矩形',ellipse:'椭圆',triangle:'三角形'};
  const shapePaths={rectangle:'M0 0H100V100H0Z',ellipse:'M0 50a50 50 0 1 0 100 0a50 50 0 1 0 -100 0Z',triangle:'M50 0L100 100H0Z'};
  const characterById=id=>state.p.characters.find(c=>c.id===id);
  const artById=id=>state.p.conceptArt?.find(art=>art.id===id);
  const elementName=entry=>entry.kind==='character'?ST.characterDisplayName(characterById(entry.characterId)):
    entry.name||(entry.kind==='image'?artById(entry.artId)?.name||t('图片物体'):t(shapeNames[entry.shape]));
  const mapEntries=map=>[...map.areas,...mapElements(map)];
  const layerLabels={background:'底图',locations:'地点和路线',characters:'角色',objects:'物体'};
  const entryLayer=entry=>entry.kind==='character'?'characters':entry.kind?'objects':'locations';
  const visible=layer=>!state.mapLayers[layer].hidden;
  const editable=layer=>visible(layer)&&!state.mapLayers[layer].locked;
  const selectable=entry=>editable(entryLayer(entry));
  const areaKey=id=>'area:'+id;
  const elementKey=id=>'element:'+id;
  const entryKey=entry=>entry.kind?elementKey(entry.id):areaKey(entry.locationId);
  const controlKey=el=>el.dataset.mapElement?elementKey(el.dataset.mapElement):areaKey(el.dataset.mapArea||el.dataset.mapPlace);
  const selectedEntries=map=>mapEntries(map).filter(entry=>selectable(entry)&&session().selection.has(entryKey(entry)));
  const copyable=entries=>entries.filter(e=>e.kind==='shape'||e.kind==='image');
  const canPaste=()=>editable('objects')&&!!clipboard?.length&&clipboard.every(e=>e.kind!=='image'||artById(e.artId));
  const boundsOf=entries=>({
    left:Math.min(...entries.map(e=>e.x)),top:Math.min(...entries.map(e=>e.y)),
    right:Math.max(...entries.map(e=>e.x+e.width)),bottom:Math.max(...entries.map(e=>e.y+e.height))
  });
  function closeContext(){
    $('.map-context')?.remove();
    contextPoint=null;
  }

  function session(){
    if(projectId!==state.p.id){
      if(projectId!==undefined)state.mapOpen=false;
      projectId=state.p.id;
      sessions.clear();
      clipboard=null;
    }
    const sceneId=currentScene().id;
    if(!sessions.has(sceneId))sessions.set(sceneId,{scope:'',selection:new Set(),routeFrom:'',guide:false,history:[]});
    const view=sessions.get(sceneId);
    if(view.scope&&!locationById(view.scope))Object.assign(view,{scope:'',selection:new Set(),routeFrom:'',guide:false,history:[]});
    return view;
  }
  const target=()=>({projectId:state.p.id,sceneId:currentScene().id,locationId:session().scope});
  const mapFor=({sceneId,locationId})=>ST.sceneMap(ST.sceneOf(state.p,sceneId),locationId);
  const currentMap=()=>mapFor(target());
  const directPlaces=scope=>[...locationsInOrder().values()].filter(({location})=>(location.parentId||'')===scope);
  const available=map=>directPlaces(map.locationId).filter(({location})=>!map.areas.some(area=>area.locationId===location.id));
  const routePair=(route,a,b)=>route.from===a&&route.to===b||route.from===b&&route.to===a;
  const routeTitle=route=>[locationById(route.from)?.name,locationById(route.to)?.name].join(' — ');
  function persist({projectId,sceneId,locationId},patch,message,commands=[]){
    return run(()=>{
      if(state.p.id!==projectId)throw Error(t('项目已切换，请重新编辑地图。'));
      const update=patch(mapFor({sceneId,locationId}));
      return update?[...commands,{type:'scene.map.update',args:{sceneId,locationId,patch:update}}]:[];
    },message,redraw);
  }
  function findPlacement(areas,id){
    const gap=9;
    for(const [w,h] of [[192,116],[136,84],[92,56]]){
      for(let y=18;y+h<=height-12;y+=h+14){
        for(let x=18;x+w<=width-12;x+=w+14){
          const occupied=areas.some(area=>x<area.x+area.width+gap&&x+w+gap>area.x&&y<area.y+area.height+gap&&y+h+gap>area.y);
          if(!occupied)return {locationId:id,x,y,width:w,height:h};
        }
      }
    }
    throw Error(t('地图空位不足，请先缩小或移动已布置的范围。'));
  }
  function addAreas(ids,point){
    if(!editable('locations'))return;
    const destination=target();
    ids=ids.filter(id=>id!==destination.locationId&&locationById(id));
    if(!ids.length)return;
    const view=session();
    view.selection=new Set(ids.length===1?[areaKey(ids[0])]:[]);
    return persist(destination,map=>{
      const areas=map.areas.slice();
      for(const id of ids){
        if(!id||id===map.locationId||!locationById(id))continue;
        const index=areas.findIndex(area=>area.locationId===id);
        if(point){
          const previous=areas[index]||{locationId:id,width:192,height:116};
          const next={...previous,x:clamp(point.x-previous.width/2,0,width-previous.width),
            y:clamp(point.y-previous.height/2,0,height-previous.height)};
          if(index<0)areas.push(next);
          else areas[index]=next;
        }else if(index<0)areas.push(findPlacement(areas,id));
      }
      return {areas};
    },t('地点已布置'));
  }
  function placeElement(entry,point,destination=target(),commands=[]){
    if(!selectable(entry))return;
    const view=session();
    return persist(destination,map=>{
      const elements=mapElements(map);
      const previous=entry.kind==='character'&&elements.find(e=>e.kind==='character'&&e.characterId===entry.characterId);
      let next=previous||entry;
      if(point){
        next={...next,x:clamp(point.x-next.width/2,0,width-next.width),
          y:clamp(point.y-next.height/2,0,height-next.height)};
      }else if(!previous){
        const mapCenter={x:width/2,y:height/2},candidates=[];
        if(Number.isInteger(entry.x)&&Number.isInteger(entry.y)){
          const original=center(entry);
          candidates.push(original,{x:original.x+entry.width+18,y:original.y},{x:original.x,y:original.y+entry.height+18});
        }
        candidates.push(mapCenter);
        for(let y=24;y+entry.height<=height;y+=entry.height+18){
          for(let x=24;x+entry.width<=width;x+=entry.width+18)candidates.push({x:x+entry.width/2,y:y+entry.height/2});
        }
        const occupied=[...map.areas,...elements];
        const open=candidates.find(({x,y})=>x>=entry.width/2&&y>=entry.height/2&&x+entry.width/2<=width&&y+entry.height/2<=height&&
          !occupied.some(e=>
          Math.abs(x-e.x-e.width/2)<(entry.width+e.width)/2+9&&
          Math.abs(y-e.y-e.height/2)<(entry.height+e.height)/2+9))||mapCenter;
        next={...entry,x:Math.round(open.x-entry.width/2),y:Math.round(open.y-entry.height/2)};
      }
      if(view.scope===destination.locationId&&currentScene().id===destination.sceneId){
        Object.assign(view,{selection:new Set([elementKey(next.id)]),routeFrom:''});
      }
      if(next===previous){updateSelection();return null;}
      return {elements:previous?elements.map(e=>e.id===next.id?next:e):[...elements,next]};
    },'',commands);
  }
  function addCharacter(characterId,point){
    if(characterById(characterId))return placeElement({id:ST.uid('map'),kind:'character',characterId,width:150,height:58},point);
  }
  function updateElement(id,patch){
    return persist(target(),map=>({elements:mapElements(map).map(e=>e.id===id?{...e,...patch}:e)}));
  }
  function addImage(destination,{artId,name,file},point){
    const commands=file?[{type:'art.create',args:{id:artId,category:'other',...file}}]:[];
    return placeElement({id:ST.uid('map'),kind:'image',artId,name,width:160,height:120},point,destination,commands);
  }
  function copyElements(entries){
    if(!entries.length)return;
    clipboard=ST.clone(entries);
    $('#scene-map [data-action="map-paste-element"]').disabled=false;
    toast(t('已复制地图物体'));
  }
  function pasteElements(entries,point){
    if(!editable('objects')||!entries.length)return;
    if(entries.some(e=>e.kind==='image'&&!artById(e.artId)))throw Error(t('找不到地图物体的图片'));
    if(entries.length===1)return placeElement({...entries[0],id:ST.uid('map')},point);
    const {left,top,right,bottom}=boundsOf(entries);
    const offsetX=point?point.x-(left+right)/2:right+24<=width?24:-24;
    const offsetY=point?point.y-(top+bottom)/2:bottom+24<=height?24:-24;
    const dx=clamp(offsetX,-left,width-right),dy=clamp(offsetY,-top,height-bottom);
    const copies=entries.map(e=>({...e,id:ST.uid('map'),x:e.x+dx,y:e.y+dy}));
    const view=session(),destination=target();
    return persist(destination,map=>{
      if(view.scope===destination.locationId&&currentScene().id===destination.sceneId){
        Object.assign(view,{selection:new Set(copies.map(entryKey)),routeFrom:''});
      }
      return {elements:[...mapElements(map),...copies]};
    });
  }
  function removeSelection(entries){
    if(!entries.length)return;
    const areas=new Set(entries.filter(e=>!e.kind).map(e=>e.locationId));
    const elements=new Set(entries.filter(e=>e.kind).map(e=>e.id));
    Object.assign(session(),{selection:new Set(),routeFrom:''});
    return persist(target(),map=>({
      ...(areas.size?{areas:map.areas.filter(e=>!areas.has(e.locationId)),
        routes:map.routes.filter(r=>!areas.has(r.from)&&!areas.has(r.to))}:{}),
      ...(elements.size?{elements:mapElements(map).filter(e=>!elements.has(e.id))}:{})
    }),t('已删除，可用 Ctrl+Z 撤销'));
  }

  function renderRoutes(map){
    const positions=new Map(map.areas.map(area=>[area.locationId,center(area)]));
    return map.routes.map(route=>{
      const from=positions.get(route.from),to=positions.get(route.to);
      return `<g class="map-route">
        <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>
        ${route.name?`<text x="${(from.x+to.x)/2}" y="${(from.y+to.y)/2-9}" text-anchor="middle">${esc(route.name)}</text>`:''}
      </g>`;
    }).join('');
  }
  function previewRoutes(map,moved){
    const positions=new Map(map.areas.map(area=>[area.locationId,center(moved.get(entryKey(area))||area)]));
    const controls=$('#scene-map-routes').children;
    map.routes.forEach((route,index)=>{
      if(!moved.has(areaKey(route.from))&&!moved.has(areaKey(route.to)))return;
      const from=positions.get(route.from),to=positions.get(route.to);
      const line=controls[index].firstElementChild,label=line.nextElementSibling;
      line.setAttribute('x1',from.x);
      line.setAttribute('y1',from.y);
      line.setAttribute('x2',to.x);
      line.setAttribute('y2',to.y);
      if(label){
        label.setAttribute('x',(from.x+to.x)/2);
        label.setAttribute('y',(from.y+to.y)/2-9);
      }
    });
  }
  function renderArea(area,view,index,guide=false){
    const location=locationById(area.locationId);
    const chosen=view.selection.has(areaKey(area.locationId));
    const locked=!guide&&!editable('locations');
    return `<g class="map-area ${chosen&&!guide?'selected':''} ${view.routeFrom===area.locationId&&!guide?'route-start':''} ${locked?'map-layer-locked':''}"
      transform="translate(${area.x} ${area.y})" style="--map-place:${locationColor(area.locationId)}"
      ${guide?`data-map-guide-area="${esc(area.locationId)}"`:
        `data-map-area="${esc(area.locationId)}" role="button" tabindex="${locked?-1:0}" aria-disabled="${locked}" aria-label="${esc(locationName(area.locationId))}" aria-pressed="${chosen}"`}>
      <title>${esc(locationName(area.locationId))}${guide?'':' · '+esc(t('双击查看子地点'))}</title>
      <rect class="map-area-box" width="${area.width}" height="${area.height}" rx="13"/>
      <clipPath id="${guide?'guide':'map'}-label-${index}"><rect x="10" width="${area.width-20}" height="45"/></clipPath>
      <text x="12" y="${guide?21:33}" clip-path="url(#${guide?'guide':'map'}-label-${index})">${esc(location.name)}</text>
      ${guide||locked?'':`<path data-map-resize class="map-resize" transform="translate(${area.width} ${area.height})" d="M-26 0H0V-26Z"><title>${esc(t('拖动调整地点范围'))}</title></path>`}
    </g>`;
  }
  function renderElement(entry,view,index,guide){
    const name=elementName(entry),chosen=view.selection.has(elementKey(entry.id))&&!guide;
    const isCharacter=entry.kind==='character',isImage=entry.kind==='image',clip=`${guide?'guide':'map'}-element-label-${index}`;
    const color=isCharacter?'#e5bd78':isImage?'#83afc2':entry.color;
    const path=shapePaths[isImage||isCharacter?'rectangle':entry.shape];
    const locked=!guide&&!selectable(entry);
    return `<g class="map-element ${isCharacter?'map-character':'map-shape'} ${chosen?'selected':''} ${locked?'map-layer-locked':''}"
      transform="translate(${entry.x} ${entry.y})" style="--map-element-color:${color}"
      ${guide?'':`data-map-element="${esc(entry.id)}" tabindex="${locked?-1:0}" role="button" aria-disabled="${locked}" aria-pressed="${chosen}" aria-label="${esc(name)}"`}>
      <title>${esc(name)}</title>
      <svg class="map-element-frame" width="${entry.width}" height="${entry.height}" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path class="map-element-body" d="${path}" vector-effect="non-scaling-stroke"/>
        ${isImage?`<image class="map-object-image" href="${esc(artById(entry.artId)?.image)}" width="100" height="100"/>`:''}
      </svg>
      <clipPath id="${clip}"><rect x="4" width="${entry.width-8}" height="${entry.height}"/></clipPath>
      <text clip-path="url(#${clip})" x="${entry.width/2}" y="${entry.height*(entry.shape==='triangle'?.71:.53)}" text-anchor="middle" dominant-baseline="central">${esc(name)}</text>
      ${guide||locked?'':`<path data-map-resize class="map-resize" transform="translate(${entry.width} ${entry.height})" d="M-17 0H0V-17Z"><title>${esc(t('拖动调整大小'))}</title></path>`}
    </g>`;
  }
  function renderMapElements(map,view,guide=false){
    return mapElements(map).filter(entry=>visible(entryLayer(entry))).map((entry,index)=>renderElement(entry,view,index,guide)).join('');
  }
  const layerButton=(action,label,layer)=>`<button type="button" class="small" data-action="${action}" ${editable(layer)?'':'disabled'}>${esc(t(label))}</button>`;
  function renderElementTools(map,view){
    const elements=mapElements(map).filter(selectable);
    return html`<section class="map-element-tools">
      <div class="row">
        <select id="map-character-picker" data-focus="map-character-picker" aria-label="选择地图角色" ${editable('characters')?'':'disabled'}>
          <option value="">选择角色</option>
          ${state.p.characters.map(c=>{
            const name=ST.characterDisplayName(c);
            return `<option value="${esc(c.id)}">${esc(name===c.name?name:name+' · '+c.name)}</option>`;
          }).join('')}
        </select>
        ${layerButton('map-add-character','放置角色','characters')}
      </div>
      <div class="map-tools">
        ${ST.MAP_SHAPES.map(shape=>layerButton('map-add-'+shape,shapeNames[shape],'objects')).join('')}
        ${layerButton('map-custom-object','自定义物体','objects')}
        <button type="button" class="small" data-action="map-paste-element" ${canPaste()?'':'disabled'}>粘贴物体</button>
      </div>
      ${elements.length?html`<select id="map-element-picker" data-focus="map-element-picker" aria-label="选择地图元素">
        <option value="">选择地图元素</option>
        ${elements.map(e=>`<option value="${esc(e.id)}" ${view.selection.size===1&&view.selection.has(elementKey(e.id))?'selected':''}>${esc(elementName(e))}</option>`).join('')}
      </select>`:''}
    </section>`;
  }
  function renderPlaceCards(map){
    const placed=new Set(map.areas.map(area=>area.locationId));
    const entries=directPlaces(map.locationId);
    const children=new Set(entries.map(({location})=>location.id));
    const index=locationsInOrder();
    for(const id of placed)if(!children.has(id))entries.push(index.get(id));
    return entries.map(entry=>{
      const locationId=entry.location.id,id=esc(locationId);
      const detail=placed.has(locationId)?t('已布置'):t('未布置');
      const add=placed.has(locationId)||!editable('locations')?'':`<button type="button" class="small ghost" data-map-add-place="${id}"
        title="${esc(t('布置地点'))}" aria-label="${esc(t('布置地点'))}">＋</button>`;
      const open=`<button type="button" class="small ghost" data-map-open-place="${id}"
        title="${esc(t('查看子地点'))}" aria-label="${esc(t('查看子地点'))}">${icon('chevron',13)}</button>`;
      return renderLocationCard(entry,`data-map-place="${id}"`,detail,add+open);
    }).join('')||html`<p class="hint">这里还没有子地点。</p>`;
  }
  function renderDetails(map){
    const view=session();
    const selection=selectedEntries(map);
    if(selection.length>1)return html`<section class="map-selection">
      <h3>${esc(t('已选 {count} 个地图单位').replace('{count}',selection.length))}</h3>
      <div class="map-tools">
        ${copyable(selection).length?button('map-copy-element',t('复制物体'),'small')+
          button('map-duplicate-element',t('创建物体副本'),'small'):''}
        ${button('map-remove-element',t('删除选中'),'small ghost danger')}
        ${button('map-clear-selection',t('取消选择'),'small ghost')}
      </div>
    </section>`;
    const entry=selection[0]?.kind?selection[0]:null;
    if(entry){
      const name=elementName(entry);
      return html`<section class="map-selection map-element-details">
        <h3>${esc(name)}</h3>
        ${entry.kind==='character'?button('map-open-character',t('打开角色卡'),'small'):
          html`<label for="map-shape-name">物体名称</label>
          <input id="map-shape-name" data-focus="map-shape-name" maxlength="80" value="${esc(entry.name)}">
          ${entry.kind==='shape'?html`<label class="row between" for="map-shape-color">物体颜色
            <input type="color" id="map-shape-color" data-focus="map-shape-color" value="${esc(entry.color)}">
          </label>`:''}`}
        <div class="map-tools">
          ${entry.kind!=='character'?button('map-copy-element',t('复制'),'small ghost',t('复制 · Ctrl+C'))+
            button('map-duplicate-element',t('创建副本'),'small ghost',t('创建副本 · Ctrl+D')):''}
          ${button('map-remove-element',t('删除'),'small ghost danger',t('删除 · Delete'))}
        </div>
      </section>`;
    }
    const area=selection[0];
    if(!area)return html`<p class="hint">选中一个已布置的地点，可查看路线和剧情节点。</p>`;
    const name=locationName(area.locationId);
    const notes=locationById(area.locationId)?.notes;
    const nodes=state.p.nodes.filter(node=>node.sceneId===currentScene().id&&
      locationsInOrder().get(node.locationId)?.path.some(location=>location.id===area.locationId));
    const routes=map.routes.map((route,index)=>({route,index})).filter(({route})=>route.from===area.locationId||route.to===area.locationId);
    return html`<section class="map-selection">
      <h3 title="${esc(name)}">${esc(name)}</h3>
      ${notes?`<p class="map-notes">${esc(notes)}</p>`:''}
      <div class="map-tools">
        ${button('map-child',t('查看子地图'),'small')}
        ${button('map-connect',t(view.routeFrom?'取消连线':'连接路线'),view.routeFrom?'small active':'small')}
        ${button('map-focus',t('在画布定位'),'small')}
        ${button('map-new-node',t('在此新建节点'),'small')}
        <button type="button" class="small ghost" data-edit-location="${esc(area.locationId)}">编辑地点</button>
        ${button('map-remove',t('从地图移除'),'small ghost danger')}
      </div>
      ${view.routeFrom?html`<p class="inline-note">请选择地图上的另一个地点。</p>`:''}
      ${routes.length?html`<h4>路线</h4>
        ${routes.map(({route,index})=>html`<div class="map-route-row">
          <span>${esc(routeTitle(route))}</span>
          <div class="row">
            <input data-map-route-name="${index}" maxlength="80" aria-label="路线名称" placeholder="路线名称（可选）" value="${esc(route.name)}">
            <button class="small ghost" data-map-remove-route="${index}" title="移除路线" aria-label="移除路线">×</button>
          </div>
        </div>`).join('')}`:''}
      <h4>此地点的剧情节点</h4>
      <div class="map-node-list">${nodes.map(node=>`<button type="button" class="small ghost" data-focus-node="${esc(node.id)}">${icon(node.type,12)} ${esc(node.title)}</button>`).join('')||
        html`<p class="hint">此场景还没有分配到这里的节点。</p>`}</div>
    </section>`;
  }
  function renderMap(){
    const map=currentMap(),view=session(),places=available(map);
    view.selection=new Set(selectedEntries(map).map(entryKey));
    if(!editable('locations')||(view.routeFrom&&!map.areas.some(area=>area.locationId===view.routeFrom)))view.routeFrom='';
    const arts=state.p.conceptArt||[];
    const image=arts.find(art=>art.id===map.backgroundArtId)?.image;
    return html`<section id="scene-map" class="scene-map">
      <div class="map-toolbar">
        ${map.locationId?button('map-parent',t('↑ 上一级'),'small ghost'):''}
        <label for="scene-map-scope">地图范围</label>
        <select id="scene-map-scope" data-focus="scene-map-scope">${locationOptions(map.locationId,t('全场景'))}</select>
        ${map.locationId?`<div class="location-card-controls">${locationCardActions(map.locationId)}</div>`:''}
        <label for="scene-map-background">底图</label>
        <select id="scene-map-background" data-focus="scene-map-background" ${editable('background')?'':'disabled'}>
          <option value="">无底图</option>
          ${arts.map(art=>`<option value="${esc(art.id)}" ${art.id===map.backgroundArtId?'selected':''}>${esc(art.name)}</option>`).join('')}
        </select>
      </div>
      <div class="map-layout">
        <div class="map-sheet" data-map-board>
          <svg id="scene-map-board" viewBox="0 0 ${width} ${height}" aria-label="地图画布" tabindex="0">
            <defs><pattern id="map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="#7f99ad" stroke-opacity=".23" stroke-width="1.5"/>
            </pattern></defs>
            <rect width="${width}" height="${height}" class="map-paper"/>
            ${image&&visible('background')?`<image href="${esc(image)}" width="${width}" height="${height}" class="map-reference"/>`:''}
            <rect width="${width}" height="${height}" fill="url(#map-grid)"/>
            <g id="scene-map-routes">${visible('locations')?renderRoutes(map):''}</g>
            <g id="scene-map-areas">${visible('locations')?map.areas.map((area,index)=>renderArea(area,view,index)).join(''):''}</g>
            <g id="scene-map-elements">${renderMapElements(map,view)}</g>
          </svg>
          ${!map.areas.length&&!mapElements(map).length?html`<div class="map-empty">拖入地点卡或角色卡，也可从右侧添加。</div>`:''}
          <div class="map-selection-hint">拖动空白处框选 · Shift 追加</div>
        </div>
        <aside class="map-sidebar">
          ${renderLayers(view)}
          ${renderElementTools(map,view)}
          <div id="scene-map-details">${renderDetails(map)}</div>
          <section class="map-available">
            <div class="row between"><h3>地点卡片</h3>${places.length&&editable('locations')?button('map-add-all',t('布置全部'),'small ghost'):''}</div>
            <div class="map-place-list">${renderPlaceCards(map)}</div>
            ${button('map-new-place',t(map.locationId?'新建子地点':'新建地点'),'small ghost')}
          </section>
        </aside>
      </div>
    </section>`;
  }
  function renderLayers(view){
    return html`<details id="map-layers" ${view.layersOpen?'open':''}>
      <summary>地图图层</summary>
      <div class="map-layer-grid">${ST.MAP_LAYERS.map(key=>{
        const name=t(layerLabels[key]),layer=state.mapLayers[key];
        return html`<span>${esc(name)}</span>
          <label><input type="checkbox" data-map-layer="${key}" data-layer-option="hidden" data-focus="map-layer-${key}-hidden"
            aria-label="${esc(name+' · '+t('隐藏'))}" ${layer.hidden?'checked':''}>隐藏</label>
          <label><input type="checkbox" data-map-layer="${key}" data-layer-option="locked" data-focus="map-layer-${key}-locked"
            aria-label="${esc(name+' · '+t('锁定'))}" ${layer.locked?'checked':''}>锁定</label>`;
      }).join('')}</div>
    </details>`;
  }
  function redraw(preserveScroll=true){
    closeContext();
    const panel=$('#scene-map');
    if(!panel)return;
    const sidebar=panel.querySelector('.map-sidebar');
    session().layersOpen=panel.querySelector('#map-layers').open;
    const scroll=sidebar.scrollTop,cardScroll=panel.querySelector('.map-place-list').scrollTop;
    const focus=panel.contains(document.activeElement)?document.activeElement.dataset.focus:'';
    panel.outerHTML=renderMap();
    if(preserveScroll){
      $('.map-sidebar').scrollTop=scroll;
      $('.map-place-list').scrollTop=cardScroll;
    }
    if(focus)[...document.querySelectorAll('#scene-map [data-focus]')].find(el=>el.dataset.focus===focus)?.focus({preventScroll:true});
  }
  function displayScope(scope,selection=new Set()){
    Object.assign(session(),{scope,selection,routeFrom:''});
    routeClickId='';
    redraw(false);
  }
  function setScope(scope){
    session().history=[];
    displayScope(scope);
  }
  function openSubmap(scope){
    const view=session();
    if(!locationById(scope)||scope===view.scope)return;
    view.history.push({scope:view.scope,selection:new Set(view.selection)});
    displayScope(scope);
  }
  function openParent(){
    const view=session(),previous=view.history.pop();
    if(previous)displayScope(previous.scope,previous.selection);
    else displayScope(locationById(view.scope)?.parentId||'');
  }
  function cancelRoute(){
    const view=session();
    if(!view.routeFrom)return false;
    view.routeFrom='';
    if($('#scene-map'))updateSelection();
    return true;
  }
  function selectArea(id,add=false){
    if(!editable('locations'))return;
    const view=session(),map=currentMap();
    if(!map.areas.some(area=>area.locationId===id))return;
    if(view.routeFrom&&view.routeFrom!==id){
      const from=view.routeFrom;
      view.routeFrom='';
      view.selection=new Set([areaKey(id)]);
      if(map.routes.some(route=>routePair(route,from,id))){
        updateSelection();
        toast(t('两个地点之间已有路线'));
        return;
      }
      return persist(target(),latest=>latest.routes.some(route=>routePair(route,from,id))?null:
        {routes:[...latest.routes,{from,to:id,name:''}]},t('路线已连接'));
    }
    selectKey(areaKey(id),add);
  }
  function selectKey(key,add=false){
    const view=session();
    const selection=add?new Set(view.selection):new Set();
    if(key){
      if(selection.has(key))selection.delete(key);
      else selection.add(key);
    }
    view.selection=selection;
    updateSelection();
  }
  function selectElement(id,add=false){
    if(id&&!mapElements(currentMap()).some(entry=>entry.id===id&&selectable(entry)))return;
    session().routeFrom='';
    selectKey(id?elementKey(id):'',add);
  }
  function updateSelection(details=true){
    const view=session(),map=currentMap();
    for(const el of document.querySelectorAll('#scene-map [data-map-area]')){
      const selected=view.selection.has(controlKey(el));
      el.classList.toggle('selected',selected);
      el.classList.toggle('route-start',el.dataset.mapArea===view.routeFrom);
      if(el.getAttribute('aria-pressed')!==String(selected))el.setAttribute('aria-pressed',String(selected));
    }
    for(const el of document.querySelectorAll('#scene-map [data-map-element]')){
      const selected=view.selection.has(controlKey(el));
      el.classList.toggle('selected',selected);
      if(el.getAttribute('aria-pressed')!==String(selected))el.setAttribute('aria-pressed',String(selected));
    }
    if(!details)return;
    const picker=$('#map-element-picker'),selection=selectedEntries(map);
    if(picker)picker.value=selection.length===1&&selection[0].kind?selection[0].id:'';
    $('#scene-map-details').innerHTML=renderDetails(map);
  }
  function boardPoint(event){
    const transform=$('#scene-map-board')?.getScreenCTM();
    if(!transform)return null;
    return new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());
  }
  function dragging(){
    if(gesture&&!gesture.el.isConnected)gesture=null;
    return !!gesture;
  }
  function beginGesture(event){
    const board=event.target.closest?.('#scene-map-board');
    if(!board||event.button!==0||state.modal||session().routeFrom||state.saves||dragging())return;
    const point=boardPoint(event);
    if(!onSheet(point))return;
    const el=event.target.closest('#scene-map [data-map-area],#scene-map [data-map-element]');
    const view=session(),destination=target(),map=mapFor(destination),selection=new Set(view.selection);
    const resize=!!event.target.closest('[data-map-resize]');
    const base={el:board,id:event.pointerId,start:point,destination,selection};
    if(!el||event.shiftKey&&!resize){
      gesture={...base,box:true,blank:!el,add:event.shiftKey,entries:mapEntries(map).filter(selectable)};
      return;
    }
    const key=controlKey(el),entry=mapEntries(map).find(e=>entryKey(e)===key);
    if(!entry||!selectable(entry))return;
    const entries=resize||!selection.has(key)?[entry]:selectedEntries(map);
    const controls=new Map([...board.querySelectorAll('[data-map-area],[data-map-element]')].map(control=>[controlKey(control),control]));
    gesture={...base,entry,entries,controls,resize,bounds:boundsOf(entries)};
  }
  function previewBox(current,point){
    const {start,entries,add,selection,el}=current;
    const x=Math.min(start.x,point.x),y=Math.min(start.y,point.y);
    const right=Math.max(start.x,point.x),bottom=Math.max(start.y,point.y);
    let rect=current.preview;
    if(!rect){
      rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
      rect.setAttribute('class','map-selection-box');
      el.append(rect);
      current.preview=rect;
    }
    for(const [key,value] of Object.entries({x,y,width:right-x,height:bottom-y}))rect.setAttribute(key,value);
    const selected=new Set(add?selection:[]);
    for(const entry of entries){
      if(entry.x<=right&&entry.y<=bottom&&entry.x+entry.width>=x&&entry.y+entry.height>=y)selected.add(entryKey(entry));
    }
    session().selection=selected;
    updateSelection(false);
  }
  function moveGesture(event){
    if(!gesture||gesture.id!==event.pointerId||!gesture.el.isConnected)return;
    const point=boardPoint(event);
    if(!point)return;
    const {start,entry,entries,controls,el,resize,bounds}=gesture;
    const dx=point.x-start.x,dy=point.y-start.y;
    if(!gesture.preview&&Math.hypot(dx,dy)<6)return;
    if(!gesture.preview)el.setPointerCapture(event.pointerId);
    if(gesture.box){previewBox(gesture,point);return;}
    const offsetX=clamp(dx,-bounds.left,width-bounds.right),offsetY=clamp(dy,-bounds.top,height-bounds.bottom);
    const isElement=!!entry.kind;
    const moved=resize?[{...entry,width:clamp(entry.width+dx,isElement?ST.MAP_ELEMENT_MIN:minWidth,width-entry.x),
      height:clamp(entry.height+dy,isElement?ST.MAP_ELEMENT_MIN:minHeight,height-entry.y)}]:
      entries.map(e=>({...e,x:e.x+offsetX,y:e.y+offsetY}));
    if(!gesture.preview){
      session().selection=new Set(entries.map(entryKey));
      updateSelection(false);
    }
    gesture.preview=new Map(moved.map(e=>[entryKey(e),e]));
    for(const next of moved)controls.get(entryKey(next)).setAttribute('transform',`translate(${next.x} ${next.y})`);
    if(resize){
      const next=moved[0],control=controls.get(entryKey(entry));
      const frame=control.querySelector(isElement?'.map-element-frame':'.map-area-box');
      frame.setAttribute('width',next.width);
      frame.setAttribute('height',next.height);
      const clip=control.querySelector('clipPath rect');
      clip.setAttribute('width',next.width-(isElement?8:20));
      if(isElement){
        clip.setAttribute('height',next.height);
        control.querySelector('text').setAttribute('x',next.width/2);
        control.querySelector('text').setAttribute('y',next.height*(entry.shape==='triangle'?.71:.53));
      }
      control.querySelector('[data-map-resize]').setAttribute('transform',`translate(${next.width} ${next.height})`);
    }
    if(entries.some(e=>!e.kind)){
      previewRoutes(mapFor(gesture.destination),gesture.preview);
    }
  }
  function endGesture(event){
    if(!gesture||gesture.id!==event.pointerId)return;
    const {el,preview,destination,selection,box,blank,add,entries}=gesture;
    gesture=null;
    if(!el.isConnected)return;
    if(!preview){
      if(blank&&!add&&event.type==='pointerup')selectKey('');
      return;
    }
    if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);
    skipClick=true;
    setTimeout(()=>{skipClick=false;},0);
    if(event.type==='pointercancel'||event.type==='lostpointercapture'){
      session().selection=selection;
      redraw();
      return;
    }
    if(box){
      preview.remove();
      updateSelection();
      el.focus({preventScroll:true});
      return;
    }
    if(entries.every(entry=>{
      const next=preview.get(entryKey(entry));
      return next.x===entry.x&&next.y===entry.y&&next.width===entry.width&&next.height===entry.height;
    })){
      updateSelection();
      return;
    }
    const update=e=>{
      const next=preview.get(entryKey(e));
      if(!next)return e;
      const {x,y,width,height}=next;
      return {...e,x,y,width,height};
    };
    persist(destination,map=>({
      ...(entries.some(e=>!e.kind)?{areas:map.areas.map(update)}:{}),
      ...(entries.some(e=>e.kind)?{elements:mapElements(map).map(update)}:{})
    })).catch(()=>redraw());
  }
  function handleClick(event){
    const place=event.target.closest('[data-map-add-place]');
    const open=event.target.closest('[data-map-open-place]');
    const area=event.target.closest('#scene-map [data-map-area],[data-map-place]');
    const element=event.target.closest('#scene-map [data-map-element]');
    const remove=event.target.closest('[data-map-remove-route]');
    if(place)return addAreas([place.dataset.mapAddPlace]);
    if(open)return openSubmap(open.dataset.mapOpenPlace);
    if(element&&!skipClick&&!event.target.closest('[data-map-resize]')){
      element.focus({preventScroll:true});
      return selectElement(element.dataset.mapElement,event.shiftKey);
    }
    if(area&&!skipClick&&!event.target.closest('[data-map-resize]')){
      if(event.detail<=1)routeClickId='';
      const id=area.dataset.mapArea||area.dataset.mapPlace;
      if(session().routeFrom&&session().routeFrom!==id)routeClickId=id;
      return selectArea(id,event.shiftKey);
    }
    if(remove){
      if(!editable('locations'))return;
      const index=Number(remove.dataset.mapRemoveRoute),route=currentMap().routes[index];
      if(route)return persist(target(),map=>({routes:map.routes.filter(entry=>!routePair(entry,route.from,route.to))}));
    }
  }
  function handleDoubleClick(event){
    const card=event.target.closest('#scene-map [data-map-area],#scene-map [data-map-place],#scene-map [data-map-element]');
    if(!card||skipClick||event.shiftKey||event.target.closest('button,[data-map-resize]'))return;
    if(card.dataset.mapElement){
      const entry=mapElements(currentMap()).find(e=>e.id===card.dataset.mapElement);
      if(entry?.kind==='character')openCharacter(entry.characterId);
      return;
    }
    const id=card.dataset.mapArea||card.dataset.mapPlace;
    if(!session().routeFrom&&routeClickId!==id)openSubmap(id);
  }
  function handleChange(element){
    if(element.hasAttribute('data-map-layer')){
      const layer=element.dataset.mapLayer,option=element.dataset.layerOption;
      if(!ST.MAP_LAYERS.includes(layer)||!['hidden','locked'].includes(option))return;
      state.mapLayers[layer][option]=element.checked;
      redraw();
      return saveDisplaySettings();
    }
    if(element.id==='scene-map-scope'){setScope(element.value);$('#scene-map-scope').focus();return;}
    if(element.id==='scene-map-background'&&editable('background'))return persist(target(),()=>({backgroundArtId:element.value})).catch(error=>{redraw();throw error;});
    if(element.id==='map-element-picker')return selectElement(element.value);
    if(element.id==='map-shape-name'||element.id==='map-shape-color'){
      const selection=selectedEntries(currentMap());
      const entry=selection.length===1?selection[0]:null;
      const key=element.id==='map-shape-name'?'name':'color',value=element.value.trim();
      if(entry&&entry.kind!=='character'&&entry[key]!==value)return updateElement(entry.id,{[key]:value});
    }
    if(element.matches('[data-map-route-name]')){
      if(!editable('locations'))return;
      const route=currentMap().routes[Number(element.dataset.mapRouteName)];
      const name=element.value.trim();
      if(route&&name!==route.name)return persist(target(),map=>({routes:map.routes.map(entry=>
        routePair(entry,route.from,route.to)?{...entry,name}:entry)}));
    }
  }
  function handleAction(action){
    if(!state.mapOpen)return;
    const view=session(),map=currentMap(),selection=selectedEntries(map);
    const single=selection.length===1?selection[0]:null;
    const area=single?.locationId?single:null;
    const point=contextPoint;
    closeContext();
    const shape=action.slice('map-add-'.length);
    if(action.startsWith('map-add-')&&ST.MAP_SHAPES.includes(shape)){
      return placeElement({id:ST.uid('map'),kind:'shape',shape,name:'',color:'#70bdcf',width:142,height:98});
    }
    switch(action){
      case 'map-custom-object':if(editable('objects'))return openMapObject(target(),point);break;
      case 'map-copy-element':return copyElements(copyable(selection));
      case 'map-paste-element':if(canPaste())return pasteElements(clipboard,point);break;
      case 'map-duplicate-element':return pasteElements(copyable(selection));
      case 'map-clear-selection':view.routeFrom='';selectKey('');break;
      case 'map-add-character':return addCharacter($('#map-character-picker').value);
      case 'map-open-character':if(single?.kind==='character')openCharacter(single.characterId);break;
      case 'map-remove-element':return removeSelection(selection);
      case 'map-parent':openParent();break;
      case 'map-child':if(area)openSubmap(area.locationId);break;
      case 'map-new-place':openLocation(undefined,view.scope);break;
      case 'map-add-all':return addAreas(available(map).map(({location})=>location.id));
      case 'map-connect':
        if(area){view.routeFrom=view.routeFrom?'':area.locationId;updateSelection();}
        break;
      case 'map-focus':case 'map-new-node':
        if(area){view.guide=true;focusMapArea(canvasArea(area),action==='map-new-node');}
        break;
      case 'map-remove':
        if(area)return removeSelection([area]);
        break;
    }
  }
  function drop(event,data){
    const point=boardPoint(event);
    if(!canDrop(event,data.kind))return;
    if(data.kind==='location'){
      if(data.id===session().scope){toast(t('当前地点已作为地图范围。'));return;}
      return addAreas([data.id],point);
    }
    if(data.kind==='art')return persist(target(),()=>({backgroundArtId:data.id}));
    if(data.kind==='character')return addCharacter(data.id,point);
  }
  const onSheet=point=>point&&point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height;
  const dropLayers=new Map([['location','locations'],['art','background'],['character','characters']]);
  const canDrop=(event,kind)=>dropLayers.has(kind)&&editable(dropLayers.get(kind))&&onSheet(boardPoint(event));
  const canvasArea=area=>({...area,x:area.x*canvasScale,y:area.y*canvasScale,width:area.width*canvasScale,height:area.height*canvasScale});
  const guideAvailable=()=>{
    const map=currentMap();
    return !!(visible('locations')&&map.areas.length||mapElements(map).some(entry=>visible(entryLayer(entry))));
  };
  const guideActive=()=>session().guide&&guideAvailable();
  function toggleGuide(){
    session().guide=!session().guide;
    render();
  }
  function guideMarkup(){
    if(!guideActive())return '';
    const map=currentMap(),view=session();
    return `<svg class="scene-map-guide" width="${width*canvasScale}" height="${height*canvasScale}"
      viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${visible('locations')?renderRoutes(map)+map.areas.map((area,index)=>renderArea(area,view,index,true)).join(''):''}${renderMapElements(map,view,true)}
    </svg>`;
  }
  function guideLocationAt(x,y){
    if(!guideActive()||!visible('locations'))return '';
    const areas=currentMap().areas.map(canvasArea).filter(area=>x>=area.x&&x<=area.x+area.width&&y>=area.y&&y<=area.y+area.height);
    areas.sort((a,b)=>a.width*a.height-b.width*b.height);
    return areas[0]?.locationId||'';
  }
  function openContext(event){
    if(state.modal||!event.target.closest?.('[data-map-board]'))return;
    event.preventDefault();
    closeContext();
    const point=boardPoint(event);
    if(!onSheet(point))return;
    const element=event.target.closest('[data-map-area],[data-map-element]');
    if(element&&!session().selection.has(controlKey(element))){
      session().routeFrom='';
      selectKey(controlKey(element));
    }
    const selection=element?selectedEntries(currentMap()):[];
    const group=selection.length>1;
    contextPoint=point;
    const menu=document.createElement('div');
    menu.className='dropdown map-context';
    menu.innerHTML=(copyable(selection).length?button('map-copy-element',t(group?'复制物体':'复制'))+
      button('map-duplicate-element',t(group?'创建物体副本':'创建副本')):'')+
      (canPaste()?button('map-paste-element',t('粘贴物体')):'')+
      (selection.length?button('map-remove-element',t(group?'删除选中':'删除'),'danger'):editable('objects')?button('map-custom-object',t('自定义物体')):'');
    if(!menu.innerHTML)return;
    document.body.append(menu);
    menu.style.left=Math.max(0,Math.min(event.clientX,innerWidth-menu.offsetWidth-8))+'px';
    menu.style.top=Math.max(0,Math.min(event.clientY,innerHeight-menu.offsetHeight-8))+'px';
  }
  function bind(){
    document.addEventListener('pointerdown',beginGesture);
    document.addEventListener('pointermove',moveGesture);
    document.addEventListener('pointerup',endGesture);
    document.addEventListener('pointercancel',endGesture);
    document.addEventListener('lostpointercapture',event=>{
      if(gesture?.el===event.target)endGesture(event);
    });
    document.addEventListener('dblclick',handleDoubleClick);
    document.addEventListener('contextmenu',openContext);
    document.addEventListener('pointerdown',event=>{
      if(!event.target.closest?.('.map-context'))closeContext();
    },true);
    document.addEventListener('keydown',event=>{
      if(!state.mapOpen||state.modal||event.isComposing||event.keyCode===229||!(event.target instanceof Element))return;
      if(event.key==='Escape'){
        closeContext();
        if(dragging()){
          endGesture({pointerId:gesture.id,type:'pointercancel'});
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if(event.key==='Enter'&&event.target.matches('[data-map-route-name],#map-shape-name')){
        event.preventDefault();
        event.target.blur();
        return;
      }
      if(!event.target.closest('input,textarea,[contenteditable]')&&
        (event.target===document.body||event.target.closest('#scene-map,.map-context'))){
        const key=event.key.toLowerCase(),selection=selectedEntries(currentMap()),command=event.ctrlKey||event.metaKey;
        const objects=copyable(selection).length;
        const action=command?{c:objects&&'map-copy-element',v:canPaste()&&'map-paste-element',d:objects&&'map-duplicate-element'}[key]:
          selection.length&&key==='delete'?'map-remove-element':null;
        if(action){
          event.preventDefault();
          event.stopPropagation();
          if(!event.repeat)Promise.resolve().then(()=>handleAction(action)).catch(error=>toast(error.message));
          return;
        }
      }
      const area=event.target.closest('#scene-map [data-map-area],#scene-map [data-map-element]');
      if(!area||area.getAttribute('aria-disabled')==='true'||!['Enter',' '].includes(event.key))return;
      event.preventDefault();
      event.stopPropagation();
      if(area.dataset.mapElement)selectElement(area.dataset.mapElement,event.shiftKey);
      else if(event.key==='Enter'&&!session().routeFrom)openSubmap(area.dataset.mapArea);
      else Promise.resolve(selectArea(area.dataset.mapArea,event.shiftKey)).catch(error=>toast(error.message));
    },true);
  }
  return {session,setScope,cancelRoute,renderMap,handleClick,handleChange,handleAction,addImage,drop,canDrop,guideMarkup,guideAvailable,guideActive,toggleGuide,guideLocationAt,
    dragging,bind};
}
