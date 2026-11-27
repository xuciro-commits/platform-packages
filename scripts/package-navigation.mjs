import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=m=>{throw Error(m)};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verify(contract,raw,artifact){
 const entries=contract.entries;
 if(!Array.isArray(entries)||!same(entries.map(x=>[x.reference,x.kind]),raw.map(x=>[x.label,x.type==='Section Break'?'group':'page'])))fail('source navigation omitted or reordered: '+contract.module);
 for(let i=0;i<raw.length;i++){const x=raw[i],e=entries[i];if(e.kind==='page'&&(Object.hasOwn(x,'link_type')&&x.link_type!==e.sourceType||Object.hasOwn(x,'link_to')&&x.link_to!==e.sourceTarget))fail('source page identity mismatch: '+e.reference);if(e.kind==='group'&&Object.hasOwn(x,'collapsible')&&!!x.collapsible!==e.foldable)fail('source foldable flag mismatch: '+e.reference)}
 const namespace=contract.namespace??contract.package;
 if(!/^[a-z][a-z0-9_]*$/.test(namespace))fail('invalid namespace');
 const assets=artifact.blueprint.assets,app=assets.find(a=>a.ref.kind==='app'&&a.ref.name===namespace)?.body;
 if(!app)fail('missing application');
 const supplemental=contract.supplemental??[];
 if(!Array.isArray(supplemental)||supplemental.some(e=>e.kind!=='page'||!e.group||!e.target||e.implementation==='dashboard'))fail('invalid supplemental page');
 const groups=[{title:'Overview',pages:[]}];let group=groups[0];
 for(const e of entries){if(e.kind==='group'){group={title:contract.groupTitles?.[e.reference]??e.reference,pages:[]};groups.push(group)}else if(e.implementation!=='dashboard')group.pages.push(e.target)}
 for(const e of supplemental){const g=groups.find(g=>g.title===e.group);if(!g)fail('unknown supplemental group');g.pages.push(e.target)}
 const extra=contract.additionalGroups??[{title:'Additional operations',pages:contract.additional}];
 if(!same(extra.flatMap(g=>g.pages),contract.additional))fail('additional groups mismatch');
 for(const g of groups){const roles=contract.groupRoles?.[g.title];if(roles)g.roles=roles}
 groups.push(...extra);
 const expected=groups.flatMap(g=>g.pages);
 if(new Set(expected).size!==expected.length||!same(app.pages,expected))fail('application pages differ from source contract');
 const canon=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 if(canon(groups)!==canon(app.groups)||canon(groups)!==canon(contract.groups))fail('group membership, order or child omitted');
 const marker=namespace+'.navpending';
 const marked=assets.find(a=>a.ref.kind==='object'&&a.ref.name===marker)?.body;
 if([...entries,...supplemental].some(x=>x.implementation==='pending')){
  if(!marked||!Array.isArray(marked.access)||!marked.access.length||marked.access.some(a=>Object.keys(a).some(k=>!['role','read'].includes(k)))||marked.actions?.length||marked.createTransaction)fail('placeholder exposes writes');
  if(assets.some(a=>a.ref.kind==='action'&&a.ref.name.startsWith(marker+'.')))fail('placeholder action exposed');
 }
 let placeholders=0,links=0;
 for(const e of [...entries,...supplemental]){
  if(e.kind!=='page')continue;if(!supplemental.includes(e))links++;
  if(e.implementation==='dashboard'){if(e.target!=='dashboard'||!app.dashboard?.length)fail('dashboard absent');continue}
  const p=assets.find(a=>a.ref.kind==='page'&&a.ref.name===e.target)?.body;
  if(!p)fail('missing page '+e.target);
  if(e.implementation==='pending'){placeholders++;if(p.object?.name!==marker||!p.title.startsWith('[Pending] ')||!p.description?.startsWith('Not implemented: ')||p.actionTriggers?.length)fail('misleading placeholder '+e.target)}
  else if(p.object?.name===marker||p.title.startsWith('[Pending] '))fail('placeholder credited as implemented');
 }
 for(const n of contract.additional)if(!assets.some(a=>a.ref.kind==='page'&&a.ref.name===n))fail('missing additional page '+n);
 return {module:contract.module,links,groups:entries.filter(x=>x.kind==='group').length,placeholders,additional:contract.additional.length,...(supplemental.length?{supplemental:supplemental.length}:{}),browserVerified:false};
}
export function run(contractPath,pkg=process.env.PACKAGE_LOOP_PKG||path.join(os.homedir(),'bin/pkg')){
 const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
 if(!/^[a-z][a-z0-9-]*$/.test(contract.package)||!/^[0-9a-f]{40}$/.test(contract.source.commit)||!/^erpnext\/[a-z_]+\/sidebar\/[a-z_]+\/[a-z_]+\.json$/.test(contract.source.path))fail('invalid contract identity');
 const raw=JSON.parse(execFileSync('git',['-C',path.resolve(root,'../Frappe/erpnext'),'show',contract.source.commit+':'+contract.source.path],{encoding:'utf8',timeout:10000})).items;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'package-navigation-'));
 try{
 const file=path.join(tmp,'artifact.json');
 execFileSync(pkg,['build','-o',file,'packages/'+contract.package],{cwd:root,encoding:'utf8',timeout:30000});
 return verify(contract,raw,JSON.parse(fs.readFileSync(file,'utf8')));
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
}

export function checkNavigationIndex(indexPath,contractPaths){
 const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
 if(index.version!==1||!Array.isArray(index.sidebars)||!/^[0-9a-f]{40}$/.test(index.commit))fail('invalid navigation index');
 const repo=path.resolve(root,'../Frappe/erpnext');
 const sourcePaths=execFileSync('git',['-C',repo,'ls-tree','-r','--name-only',index.commit],{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024}).split('\n').filter(p=>/^erpnext\/[^/]+\/sidebar\/[^/]+\/[^/]+\.json$/.test(p)).sort();
 if(!same(sourcePaths,index.sidebars.map(x=>x.path).sort()))fail('source sidebar omitted from index');
 const byPath=new Map(contractPaths.map(p=>{const c=JSON.parse(fs.readFileSync(p,'utf8'));return [c.source.path,{c,p}]}));
 let links=0,groups=0;
 for(const x of index.sidebars){
  const raw=JSON.parse(execFileSync('git',['-C',repo,'show',index.commit+':'+x.path],{encoding:'utf8',timeout:10000})).items;
  const projected=raw.map(e=>({label:e.label,type:e.type,target:e.link_to??null,linkType:e.link_type??null,foldable:!!e.collapsible,child:!!e.child,indent:e.indent??0}));
  if(!same(projected,x.entries))fail('source entries differ from index '+x.path);
  links+=raw.filter(e=>e.type==='Link').length;groups+=raw.filter(e=>e.type==='Section Break').length;
  if(!raw.length){if(x.contract||byPath.has(x.path))fail('unexpected contract for empty source');continue}
  const entry=byPath.get(x.path);if(!entry||entry.c.source.commit!==index.commit||path.basename(entry.p)!==x.contract||!same(entry.c.entries.map(e=>[e.reference,e.kind]),raw.map(e=>[e.label,e.type==='Section Break'?'group':'page'])))fail('missing or incomplete contract '+x.path);
  byPath.delete(x.path);
 }
 if(byPath.size)fail('unindexed navigation contract');
 return {sidebars:index.sidebars.length,links,groups};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)fail('usage: node scripts/package-navigation.mjs <contract.json>');
 console.log(JSON.stringify(run(process.argv[2]),null,2));
}
