import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=m=>{throw Error(m)};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function checkDocument(doc,source){
 if(!same(doc.fields.map(f=>[f.ordinal,f.name,f.type,f.required,f.readOnly,f.hidden]),source.fields.map((f,i)=>[i+1,f.fieldname??null,f.fieldtype,!!f.reqd,!!f.read_only,!!f.hidden])))fail('source field omitted or changed: '+doc.source);
 if(!same(doc.permissions.map(p=>[p.ordinal,p.role]),(source.permissions??[]).map((p,i)=>[i+1,p.role])))fail('source permission omitted: '+doc.source);
 for(const f of doc.fields){
  if(!['candidate','shared','partial','unmapped','layout_pending'].includes(f.status))fail('invalid field status');
  if(['candidate','shared','partial'].includes(f.status)?!f.target:!!f.target)fail('invalid mapping: '+f.name);
  if(f.semanticVerified!==false||f.browserVerified!==false)fail('v1 matrix is inventory only; verified evidence requires separate gate');
 }
 if(doc.reviewed===true){
  for(const f of doc.fields){const raw=source.fields[f.ordinal-1];const traits={options:raw.options??null,default:raw.default??null,unique:!!raw.unique,dependsOn:raw.depends_on??null,allowOnSubmit:!!raw.allow_on_submit};if(!f.note?.trim()||!same(f.sourceTraits,traits))fail("reviewed batch has unresolved disposition: "+f.name)}
  for(const p of doc.permissions){const raw=source.permissions[p.ordinal-1];const grants=Object.fromEntries(Object.entries(raw).filter(([k,v])=>!["role","permlevel"].includes(k)&&v===1));if(!p.note?.trim()||p.status!=="reviewed_partial"||p.sourcePermLevel!==(raw.permlevel??0)||!same(p.sourceGrants,grants))fail("reviewed batch permission mismatch: "+p.role)}
  if(doc.operations.some(o=>o.status==="unreviewed"||!o.note?.trim()))fail("reviewed batch operation disposition missing");
 }
 return doc.fields.length;
}
export function run(file){
 const m=JSON.parse(fs.readFileSync(file,'utf8'));
 if(m.version!==1||!/^[0-9a-f]{40}$/.test(m.commit)||!Array.isArray(m.documents)||!m.documents.length)fail('invalid field matrix');
 const sourceRepo=path.resolve(root,'../Frappe/erpnext'),seen=new Set();
 const get=p=>{if(!/^erpnext\/[a-z_]+\/doctype\/[a-z_]+\/[a-z_]+\.(json|js|py)$/.test(p))fail('invalid source path');return execFileSync('git',['-C',sourceRepo,'show',m.commit+':'+p],{encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']})};
 let fields=0,operations=0,permissions=0;
 for(const d of m.documents){
  if(seen.has(d.source))fail('duplicate source '+d.source);seen.add(d.source);
  const source=JSON.parse(get(d.source));fields+=checkDocument(d,source);permissions+=d.permissions.length;
  const expectedOps=[];
  for(const ext of ['.js','.py']){
   const sourcePath=d.source.replace(/\.json$/,ext);
   let raw;try{raw=get(sourcePath)}catch(e){if(!String(e.stderr??'').includes('does not exist')&&!String(e.stderr??'').includes('exists on disk'))throw e;continue}
   const lines=raw.split('\n');
   for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(ext==='.js'&&/add_custom_button|add_menu_item|add_inner_button/.test(l))expectedOps.push([sourcePath,i+1,'client_action']);
    if(ext==='.py'){const m=l.match(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\(/);if(m&&(/^(validate|before_|on_|make_|update_|set_status|check_)/.test(m[1])||lines.slice(Math.max(0,i-4),i).some(s=>/@frappe.whitelist/.test(s))))expectedOps.push([sourcePath,i+1,'server_rule_or_action']);}
   }
  }
  for(const [i,f] of source.fields.entries())if(f.fieldtype==='Button')expectedOps.push([d.source,i+1,'metadata_button']);
  if(!same(expectedOps,d.operations.map(o=>[o.path,o.line??o.ordinal,o.kind])))fail('direct operation candidate omitted: '+d.source);
  const localFiles=new Map();
  for(const o of d.operations){
   if(o.path.replace(/\.(js|py)$/ ,'.json')!==d.source)fail('operation outside source document');
   if(!['unreviewed','reviewed_missing','partial'].includes(o.status))fail('invalid operation status');
   if(o.kind==='metadata_button'){if(source.fields[o.ordinal-1]?.fieldtype!=='Button'||source.fields[o.ordinal-1]?.fieldname!==o.symbol)fail('missing metadata button');}
   else{
    if(!localFiles.has(o.path))localFiles.set(o.path,get(o.path).split('\n'));
    const line=localFiles.get(o.path)[o.line-1];
    if(!line||(o.kind==='client_action'?!/add_custom_button|add_menu_item|add_inner_button/.test(line):o.kind==='server_rule_or_action'?!line.includes('def '+o.symbol+'('):true))fail('bad operation anchor');
   }
   operations++;
  }
 }
 return {documents:seen.size,fields,operations,permissions,semanticVerified:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.length!==3)fail('usage: package-field-audit.mjs matrix.json');console.log(JSON.stringify(run(process.argv[2]),null,2));}
