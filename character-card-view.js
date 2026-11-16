'use strict';

function createCharacterCardView({state,ST,t,esc,html,staticHtml,button,icon,showModal,deleteEntryButton,avatar,charName,itemName,itemSetName,entityChip,renderCharacterReferenceTray,renderCharacterItemSets}){
  const characterImportLabels={
    name:'角色ID',displayName:'角色名称',summary:'简介',details:'详情',tags:'标签',groupId:'角色分组',
    skills:'技能',attributes:'属性',inventory:'物品',itemSet:'物品组合'
  };
  const characterImportWarnings={
    id:'已有角色的 ID 保持原值',group:'分组未找到或存在同名',
    skills:'技能需填写 0–10 的整数',attributes:'属性需填写 0–100 的整数',
    inventory:'物品需匹配唯一的现有物品卡，数量须为非负整数',
    itemSet:'找不到同名物品组合'
  };
  function characterImportPreview(result){
    if(!result)return '';
    const {changes,warnings}=result;
    const totals=changes.some(change=>change.field==='itemSet')?ST.itemSetTotals(state.p):null;
    const valueText=(field,value)=>field==='tags'?value.join('、'):
      field==='groupId'?state.p.groups.find(group=>group.id===value)?.name||value:value;
    return html`
      ${warnings.map(({code,detail})=>`<div class="warning">${esc(t(characterImportWarnings[code]))} · ${esc(detail)}</div>`).join('')}
      ${changes.length?html`<p class="hint">勾选要填入卡片草稿的内容。替换现有值的建议默认不勾选。</p>`:html`<p class="hint">未找到可填入的字段，或识别值与当前卡片相同。</p>`}
      ${changes.length?`<div class="character-import-fields">${changes.map(({field,key,value,previous,replace,selected},index)=>{
        const isSet=field==='itemSet';
        const label=t(characterImportLabels[field])+(key?' · '+(isSet?itemSetName(key):field==='inventory'?itemName(key):key):'');
        const display=isSet?[...totals.get(key)].map(([id,count])=>itemName(id)+' × '+count).join(' · ')||t('空组合'):valueText(field,value);
        return `<label class="character-import-change">
          <input type="checkbox" data-character-import-choice="${index}" ${replace||selected===false?'':'checked'}>
          <span><strong>${esc(label)}</strong>
            ${replace?`<small>${esc(t('当前值'))} · ${esc(valueText(field,previous))}</small>`:''}
            ${isSet?`<small>${esc(t(selected?'按预设数量追加':'从描述匹配的组合，请核对后勾选'))}</small>`:''}
            <span class="character-import-value">${esc(display)}</span>
          </span>
        </label>`;
      }).join('')}</div>${button('character-import-apply',t('填入已选字段'),'small primary')}`:''}
    `;
  }
  function renderCharacterImport(modal){
    if(modal.mode!=='library')return '';
    const draft=modal.characterImport;
    return html`<div class="character-import tool-card">
      <div class="row between"><h3>从长文生成角色卡</h3>
        ${button('character-import-toggle',t(draft?.open?'收起':'从长文填卡'),'small ghost')}</div>
      ${draft?.open?html`<label for="character-import-source">粘贴人物设定或背景故事</label>
        <textarea id="character-import-source" data-focus="character-import" maxlength="${CharacterImport.MAX_LENGTH}" rows="6"
          placeholder="她叫林夏，是一名地图绘师。&#10;技能：观察 6；属性：生命 75；标签：港城、向导">${esc(draft.source)}</textarea>
        <p class="hint">本机离线识别。自然段可以作为简介或详情。写明姓名、技能、属性、标签或物品可提高识别准确率。</p>
        ${button('character-import-scan',t('识别并预览'),'small')}
        <div id="character-import-preview" aria-live="polite">${characterImportPreview(draft.result)}</div>`:''}
    </div>`;
  }

  function characterProfile(modal,project){
    const c=modal.draft;
    const groupOptions=ST.groupsOf(project,'character').map(group=>
      `<option value="${esc(group.id)}" ${group.id===c.groupId?'selected':''}>${esc(group.name)}</option>`).join('');
    return html`
      <div class="profile-head">${avatar(c,0,true)}<div class="flex">
        <label for="character-id" style="margin-top:0">角色ID</label>
        <input id="character-id" ${modal.id?'readonly':'data-character-field="name"'} value="${esc(modal.id?charName(modal.id):c.name)}" data-focus="char-name">
        <label for="character-display-name">角色名称</label>
        <input id="character-display-name" data-character-field="displayName" value="${esc(c.displayName??'')}" placeholder="${esc(c.name)}" data-focus="char-display-name">
        <p class="hint">留空时，游戏内名称沿用角色ID。</p>
        <label for="character-image">形象图片 · 最大 8MB</label>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" id="character-image">
        ${c.image?button('remove-character-image',t('移除形象'),'small ghost'):''}
      </div></div>
      <label for="character-summary">简介 · 悬停卡片时显示</label>
      <textarea id="character-summary" rows="2" data-character-field="summary" data-focus="char-summary" placeholder="用一句话介绍这个角色…">${'\n'+esc(c.summary)}</textarea>
      <label for="character-details">详情</label>
      <textarea id="character-details" rows="5" data-character-field="details" data-focus="char-details" placeholder="经历、动机、关系与秘密…">${'\n'+esc(c.details)}</textarea>
      <div class="form-row"><div>
        <label for="character-group">角色分组</label>
        <select id="character-group" data-character-field="groupId" data-focus="char-group"><option value="">未分组</option>${groupOptions}</select>
      </div><div>
        <label for="character-tags">标签 · 逗号分隔</label>
        <input id="character-tags" value="${esc(c.tags.join(', '))}" data-focus="char-tags">
      </div></div>`;
  }
  function characterInventory(modal,items){
    const c=modal.draft;
    const rows=Object.entries(c.inventory).filter(([,quantity])=>quantity>0).map(([id,quantity])=>html`
      <div class="inventory-row" draggable="true" data-drag-kind="item" data-drag-id="${esc(id)}"
        data-from-character="${esc(c.id)}" data-qty="${quantity}" data-drag-node="${esc(modal.nodeId||'')}">
        ${icon('items',14)}<strong data-inventory-item-attrs="${esc(id)}" style="cursor:pointer" title="双击编辑携带物品的属性">${esc(itemName(id))}</strong>
        <span class="qty" data-inventory-qty="${esc(id)}" title="双击修改数量">× ${quantity}</span>
        <button class="ghost small" data-inventory-remove="${esc(id)}">×</button>
      </div>`).join('');
    const carried=modal.itemEditor?html`<div class="tool-card">
      <div class="row between"><h3>${esc(itemName(modal.itemEditor))} · 携带属性</h3>
        <button class="ghost small" data-action="close-item-editor">×</button></div>
      ${Object.entries(c.itemAttributes[modal.itemEditor]).map(([key,value])=>`<div class="row" style="margin-top:8px">
        <span class="flex tiny">${esc(key)}</span><input type="number" class="number-inline" min="0" max="100" value="${value}" data-carried-attribute="${esc(key)}">
      </div>`).join('')}
    </div>`:'';
    return html`
      <div class="section-title">物品栏 <span class="tiny muted">双击数量 / 名称可编辑</span></div>${carried}
      <div data-inventory-drop="character-modal">${rows}<div class="empty-drop">将下方物品卡拖入此处，或选择物品后点 ＋</div></div>
      <div class="row" style="margin-top:10px">
        <select id="inventory-add-item">${items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select>
        ${button('inventory-add','＋','small')}
      </div>
      <div class="peek-chars" style="margin-top:12px">${items.map(item=>entityChip({kind:'item',id:item.id},'data-modal-tray="true"')).join('')}</div>
      ${renderCharacterItemSets()}`;
  }
  function characterScores(modal){
    const meters=(field,max)=>Object.entries(modal.draft[field]).map(([key,value])=>html`
      <div class="meter-row">
        <span class="meter-label" title="${esc(key)}">${esc(key)}</span>
        <input type="range" min="0" max="${max}" step="1" value="${value}" data-meter="${field}" data-key="${esc(key)}" aria-label="${esc(key)}滑块">
        <input type="number" min="0" max="${max}" value="${value}" data-meter="${field}" data-key="${esc(key)}" aria-label="${esc(key)}数值">
      </div>`).join('');
    return html`
      <div class="section-title" style="margin-top:0;border:0;padding-top:0">技能栏 ${button('skills-zero',t('一键归 0'),'small ghost')}</div>
      ${meters('skills',10)}
      <div class="skill-legend"><span>0 未习得</span><span>6 人类极限</span><span>7–10 超越人类</span></div>
      <div class="row" style="margin-top:12px"><input id="new-skill-name" placeholder="新技能名称" data-focus="new-skill">${button('add-skill',t('添加'),'small')}</div>
      <div class="section-title">属性栏 <span class="tiny muted">0–100 · 默认 20</span></div>
      ${meters('attributes',100)}
      <div class="row" style="margin-top:12px"><input id="new-attribute-name" placeholder="新属性名称" data-focus="new-attr">${button('add-attribute',t('添加'),'small')}</div>
      ${modal.mode==='pending'?html`<div class="tool-card" style="margin-top:20px"><h3>物品转移</h3><p>使用事件角色面板，将物品从原主人拖给接收者，自动记录一增一减。</p></div>`:''}`;
  }
  function renderCharacterModal(){
    const modal=state.modal,{mode,id}=modal;
    const title=mode==='pending'?'节点中的角色 · 待变化':mode==='current'?'角色当前状态 · 即时编辑':id?'编辑角色卡':'创建角色卡';
    showModal(t(title),html`
      ${mode!=='library'?`<div class="inline-note">${esc(modal.note)}${mode==='pending'?staticHtml('<br>保存会写入节点的待变化记录；剧情推演及条件回溯会决定它是否发生。'):''}</div>`:''}
      ${id?renderCharacterReferenceTray(modal.draft):''}
      <div id="character-import-panel">${renderCharacterImport(modal)}</div>
      <div class="modal-grid"><div>${characterProfile(modal,state.p)}${characterInventory(modal,state.p.items)}</div>
      <div>${characterScores(modal)}</div></div>`,
      (mode==='library'&&id?deleteEntryButton('character')+button('open-current',t('编辑场景当前状态'),'ghost small'):'')+
      button('modal-close',t('取消'))+button('character-save',t(mode==='pending'?'保存待变化':'保存角色卡'),'primary'),'wide');
  }

  return {renderCharacterImport,characterImportPreview,renderCharacterModal};
}
