'use strict';

const repository='zlep123/StoryTree';
const releasesApi='https://api.github.com/repos/'+repository+'/releases';
const releasesPage='https://github.com/'+repository+'/releases/tag/';
const versionPattern=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const numeric=/^\d+$/u;

function parseVersion(tag){
  if(typeof tag!=='string'||tag.length>120)return null;
  const match=versionPattern.exec(tag);
  if(!match)return null;
  const pre=match[4]?.split('.')||[];
  if(pre.some(part=>/^0\d+$/u.test(part)))return null;
  return {base:match.slice(1,4).map(BigInt),pre};
}
const compare=(a,b)=>a===b?0:a>b?1:-1;

function compareVersions(a,b){
  for(let i=0;i<3;i++){
    const order=compare(a.base[i],b.base[i]);
    if(order)return order;
  }
  if(!a.pre.length||!b.pre.length)return compare(!a.pre.length,!b.pre.length);
  for(let i=0;i<Math.min(a.pre.length,b.pre.length);i++){
    const left=a.pre[i],right=b.pre[i];
    if(left===right)continue;
    const leftNumber=numeric.test(left),rightNumber=numeric.test(right);
    if(leftNumber&&rightNumber)return compare(BigInt(left),BigInt(right));
    if(leftNumber!==rightNumber)return leftNumber?-1:1;
    return compare(left,right);
  }
  return compare(a.pre.length,b.pre.length);
}

function findUpdate(currentVersion,releases){
  const current=parseVersion(currentVersion);
  if(!current||!Array.isArray(releases))throw Error('Invalid release information');
  let latest=null,best=current;
  for(const release of releases){
    if(!release||release.draft||!release.published_at)continue;
    const version=parseVersion(release.tag_name);
    if(!version||compareVersions(version,best)<=0)continue;
    latest={version:release.tag_name.replace(/^v/u,''),url:releasesPage+encodeURIComponent(release.tag_name)};
    best=version;
  }
  return latest;
}

async function checkUpdate(currentVersion,request=fetch){
  const signal=AbortSignal.timeout(10000);
  let latest=null;
  for(let page=1;;page++){
    const response=await request(releasesApi+'?per_page=100&page='+page,{
      signal,redirect:'error',headers:{Accept:'application/vnd.github+json','User-Agent':'StoryTree/'+currentVersion}
    });
    if(!response.ok)throw Error('GitHub '+response.status);
    latest=findUpdate(latest?.version||currentVersion,await response.json())||latest;
    if(!response.headers.get('link')?.includes('rel="next"'))return latest;
  }
}

module.exports={findUpdate,checkUpdate};
