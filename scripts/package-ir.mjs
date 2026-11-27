// Experimental IR -> DSL preview. JSON is a YAML subset; never overwrite packages.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const fail=m=>{throw Error(m)};
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_]*$/.test(x);
const txt=x=>typeof x==='string'&&x.trim()!=='';
function keys(x,allowed){if(!x||typeof x!=='object'||Array.isArray(x))fail('expected object');for(const k of Object.keys(x))if(!allowed.includes(k))fail('unsupported key: '+k)}
function predicate(x,fields){
 keys(x,['field','literal','op','args']);
 if(Object.keys(x).length===1&&typeof x.field==='string'&&/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(x.field)&&fields.has(x.field.split('.')[0]))return x.field;
 if(Object.keys(x).length===1&&Object.hasOwn(x,'literal')){if(typeof x.literal==='number'&&Number.isFinite(x.literal))return String(x.literal);if(typeof x.literal==='string'&&/^[a-zA-Z0-9_-]+$/.test(x.literal))return "'"+x.literal+"'"}
 const ops={eq:'=',gt:'>',ge:'>=',lt:'<',le:'<=',ne:'!='};
 if(Object.keys(x).length!==2||!Object.hasOwn(ops,x.op)||!Array.isArray(x.args)||x.args.length!==2||x.args.some(v=>Object.hasOwn(v,'op')))fail('unsupported predicate');
 return x.args.map(v=>predicate(v,fields)).join(' '+ops[x.op]+' ');
}
export function compile(ir){
 keys(ir,['version','entity','evidence','unresolved']);
 if(ir.version!==1||!Array.isArray(ir.evidence)||!ir.evidence.length||!ir.evidence.every(txt)||!Array.isArray(ir.unresolved)||!ir.unresolved.every(txt))fail('evidence/unresolved required');
 const e=ir.entity;keys(e,['namespace','id','label','plural','icon','numbering','display','fields','states','permissions','rules','transitions','list']);
 if(!id(e.namespace)||!id(e.id)||![e.label,e.plural,e.icon,e.numbering].every(txt))fail('invalid identity');
 const types={identifier:'text',reference:'reference',quantity:'decimal',date:'date',narrative:'longtext'};
 const fields=new Set(Object.keys(e.fields));
 const fspec=Object.entries(e.fields).map(([name,v])=>{
 keys(v,['kind','label','target','required','search','section']);
 if(!id(name)||!Object.hasOwn(types,v.kind)||!txt(v.label))fail('invalid field');
 if(v.kind==='reference'?typeof v.target!=='string'||!v.target.match(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/):Object.hasOwn(v,'target'))fail('bad target');
 for(const k of ['required','search'])if(Object.hasOwn(v,k)&&typeof v[k]!=='boolean')fail('bad '+k);
 if(Object.hasOwn(v,'section')&&!txt(v.section))fail('bad section');
 return {name,title:v.label,type:types[v.kind],...(v.target?{ref:v.target}:{}),...(v.required?{required:true}:{}),...(v.search?{search:true}:{}),...(v.section?{group:v.section}:{})};
 });
 if(!fields.has(e.display))fail('bad display');
 const states=e.states.map(v=>{keys(v,['id','label','tone']);if(!id(v.id)||!txt(v.label)||!['neutral','info','success','danger','warning'].includes(v.tone))fail('bad state');return {name:v.id,title:v.label,tone:v.tone}});
 const sn=new Set(states.map(s=>s.name));if(!sn.size||sn.size!==states.length)fail('invalid states');
 const roles=new Set();
 const access=e.permissions.map(v=>{keys(v,['role','read','create']);if(!id(v.role)||roles.has(v.role)||v.read!=='all'||typeof v.create!=='boolean')fail('unsupported permission');roles.add(v.role);return {role:v.role,read:v.read,...(v.create?{create:true}:{})}});
 if(!roles.size)fail('permissions required');
 const rules=new Map();
 for(const v of e.rules){keys(v,['id','enforce','fields','predicate','message']);if(!id(v.id)||rules.has(v.id)||!['record','transition'].includes(v.enforce)||!txt(v.message)||!Array.isArray(v.fields)||!v.fields.every(n=>fields.has(n)))fail('bad rule');rules.set(v.id,{...v,expression:predicate(v.predicate,fields)})}
 const output={},base='objects/'+e.id+'/',actions=[],used=new Set();
 for(const t of e.transitions){keys(t,['id','label','from','to','roles','rule']);if(!id(t.id)||actions.includes(t.id)||!txt(t.label)||!Array.isArray(t.from)||!t.from.length||!t.from.every(x=>sn.has(x))||!sn.has(t.to)||!Array.isArray(t.roles)||!t.roles.length||!t.roles.every(x=>roles.has(x)))fail('bad transition');const g=t.rule?rules.get(t.rule):null;if(t.rule&&(!g||g.enforce!=='transition'))fail('bad transition rule');if(g)used.add(g.id);actions.push(t.id);output[base+'actions/'+t.id+'.yaml']={title:t.label,from:t.from,roles:t.roles,transaction:{...(g?{guard:g.expression,message:g.message}:{}),steps:[{target:'$subject',set:{state:"'"+t.to+"'"}}]}}}
 const constraints=[];for(const v of rules.values()){if(v.enforce==='record')constraints.push({name:v.id,kind:'expression',fields:v.fields,expr:v.expression,message:v.message});else if(!used.has(v.id))fail('unbound transition rule')}
 const l=e.list;keys(l,['columns','sort','group']);const valid=n=>fields.has(n)||n==='state';
 if(!Array.isArray(l.columns)||!l.columns.every(valid)||!['none',...fields,'state'].includes(l.group))fail('bad list');
 const sort=l.sort.map(v=>{keys(v,['field','direction']);if(!valid(v.field)||!['ascending','descending'].includes(v.direction))fail('bad sort');return {sortKey:v.field,direction:v.direction}});
 output[base+'object.yaml']={name:e.id,namespace:e.namespace,title:e.label,plural:e.plural,icon:e.icon,display:e.display,naming:e.numbering,fields:fspec,states,actions,constraints,access,view:{version:1,layout:'table',columns:l.columns,sort,group:l.group,lanes:'',filters:[],search:''}};
 return {files:Object.fromEntries(Object.entries(output).sort(([a],[b])=>a.localeCompare(b)).map(([p,v])=>[p,JSON.stringify(v,null,2)+'\n'])),evidence:[...ir.evidence],unresolved:[...ir.unresolved]};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)fail('usage: node scripts/package-ir.mjs <ir.json>');
 const r=compile(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.package-loop');
 fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'ir-preview-'));
 for(const [p,v] of Object.entries(r.files)){const out=path.join(dir,p);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,v,{flag:'wx'})}
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({files:Object.keys(r.files),evidence:r.evidence,unresolved:r.unresolved},null,2)+'\n',{flag:'wx'});console.log(dir);
}
