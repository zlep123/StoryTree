'use strict';

const {default: readWorkbook} = require('read-excel-file/node');
const ST = require('./core.js');

const columns = new Map([
  ['name','name'], ['名称','name'], ['角色名称','name'], ['物品名称','name'],
  ['group','group'], ['分组','group'],
  ['summary','summary'], ['简介','summary'],
  ['details','details'], ['详情','details'],
  ['tags','tags'], ['标签','tags'],
  ['category','category'], ['类别','category'], ['分类','category'],
  ['type','type'], ['类型','type'], ['grade','grade'], ['品级','grade']
]);
const sheetKinds = new Map([
  ['角色','character'], ['characters','character'],
  ['物品','item'], ['items','item']
]);
const itemChoices = {
  category:[ST.ITEM_A, ['Instance item','Single-player item','Special item','Quest item']],
  type:[ST.ITEM_B, ['Equipment','Utility item','Material','Unknown']],
  grade:[ST.ITEM_C, ['Unknown','Common','Fine','Rare','Otherworldly','Legendary']]
};
const text = value => String(value ?? '').trim();
const normalized = value => text(value).toLowerCase();
function issue(code, detail) {
  throw Object.assign(Error(code), {detail});
}

function parseHeader(value, kind) {
  const header = text(value);
  const metric = /^(skill|技能|attribute|属性)\s*[:：]\s*(.*)$/iu.exec(header);
  if (metric) {
    const skill = ['skill','技能'].includes(normalized(metric[1]));
    const key = text(metric[2]);
    if (!key || key.length>=100 || ['__proto__','constructor','prototype'].includes(key)) {
      issue('字段名称无效',header);
    }
    return skill && kind==='item' ? null : {field:skill?'skills':'attributes', key};
  }
  const field = columns.get(normalized(header));
  if (!field || (kind==='character' && Object.hasOwn(itemChoices,field))) return null;
  return {field};
}

function parseRow(row, headers, kind) {
  const card = {};
  for (const [index, header] of headers.entries()) {
    const value = text(row[index]);
    if (!header || !value) continue;
    const {field,key} = header;
    if (key) {
      const number = Number(value);
      const limit = field==='skills' ? 10 : 100;
      if (!Number.isFinite(number) || number<0 || number>limit) {
        issue('数值超出范围',key+' · 0–'+limit);
      }
      (card[field] ||= {})[key] = number;
    } else if (Object.hasOwn(itemChoices,field)) {
      const [values, aliases] = itemChoices[field];
      const canonical = values.find((label,i)=>label===value || normalized(aliases[i])===normalized(value));
      if (!canonical) issue('分类、类型或品级无效',value);
      card[field] = canonical;
    } else {
      card[field] = field==='tags' ? [...new Set(value.split(/[,，、\n]+/u).map(text).filter(Boolean))] : value;
    }
  }
  if (!card.name) issue('名称不能为空');
  if (kind==='item' && card.grade && !card.type) issue('品级需要先选择 B 组类型');
  return card;
}

async function parseWorkbook(buffer, fallbackKind) {
  const sheets = await readWorkbook(buffer);
  const namedSheets = sheets.filter(sheet=>sheetKinds.has(normalized(sheet.sheet)));
  const selected = namedSheets.length ? namedSheets : sheets.slice(0,1);
  const result = {characters:[],items:[],errors:[],errorCount:0};
  const recordError = (sheet,row,error) => {
    result.errorCount++;
    if (result.errors.length<20) result.errors.push({sheet,row,message:error.message,detail:error.detail});
  };
  for (const {sheet,data} of selected) {
    const kind = sheetKinds.get(normalized(sheet)) || fallbackKind;
    const cards = kind==='item' ? result.items : result.characters;
    if (!data.some(row=>row.some(value=>text(value)))) continue;
    let headers;
    try {
      headers = data[0].map(value=>parseHeader(value,kind));
      if (!headers.some(header=>header?.field==='name')) issue('缺少名称列');
      const keys = headers.filter(Boolean).map(({field,key})=>key ? field+':'+key : field);
      if (new Set(keys).size!==keys.length) issue('重复的列标题');
    } catch (error) {
      recordError(sheet,1,error);
      continue;
    }
    for (const [index,row] of data.entries()) {
      if (index===0 || !row.some(value=>text(value))) continue;
      if (result.characters.length+result.items.length>=2000) throw Error('每次最多导入 2,000 张卡片');
      try { cards.push(parseRow(row,headers,kind)); }
      catch (error) { recordError(sheet,index+1,error); }
    }
  }
  return result;
}

module.exports = {parseWorkbook};
