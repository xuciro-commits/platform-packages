import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync,lstatSync,mkdtempSync,readdirSync,readFileSync,rmSync} from "node:fs";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const fixtures=join(root,"fixtures/platform/packages");
const fail=m=>{throw Error(m)};
const manifestId=p=>{
 const m=readFileSync(join(p,"package.yaml"),"utf8").match(/^id:\s*([a-zA-Z0-9_.-]+)\s*$/m);
 if(!m)fail("Missing package id: "+p);
 return m[1];
};
const dirs=p=>readdirSync(p,{withFileTypes:true}).filter(e=>e.isDirectory()&&existsSync(join(p,e.name,"package.yaml"))).map(e=>join(p,e.name));
const ids=new Set(dirs(join(root,"packages")).map(manifestId));
const sources=dirs(fixtures).sort();
if(sources.length!==3)fail("Unexpected fixture source inventory");
const seen=[];
for(const p of sources){
 const id=manifestId(p);
 if(ids.has(id)||seen.includes(id))fail("Duplicate package authority: "+id);
 seen.push(id);
}
const required=["application.production-provider","connectortrial","connectortrial-contract"];
if(JSON.stringify(seen.sort())!==JSON.stringify(required))fail("Unexpected fixture identities");
function walk(p){
 for(const n of readdirSync(p)){
  const x=join(p,n),st=lstatSync(x);
  if(st.isSymbolicLink())fail("Fixture symlink: "+x);
  if(st.isDirectory())walk(x);
  else if(!st.isFile()||n.endsWith(".json")&&n!=="package.lock.json")fail("Stored package artifact forbidden: "+x);
 }
}
walk(join(root,"fixtures/platform"));
for(const p of ["test-packages","frontend-fixtures","manifest.json"])if(existsSync(join(root,"fixtures/platform",p)))fail("Obsolete fixture copy: "+p);
const arg=process.argv.find(a=>a.startsWith("--pkg="));
if(process.argv.slice(2).some(a=>!a.startsWith("--pkg=")))fail("usage: node scripts/check-platform-fixtures.mjs [--pkg=/path/to/pkg]");
const pkg=arg?.slice(6);
if(pkg){
 const tmp=mkdtempSync(join(tmpdir(),"platform-fixtures-"));
 try{
  execFileSync(pkg,["check","-install=false","-packages",fixtures],{cwd:root,stdio:"inherit",timeout:120000});
  for(const p of sources){
   const id=manifestId(p),a=join(tmp,id+".first.json"),b=join(tmp,id+".second.json");
   for(const out of [a,b])execFileSync(pkg,["build","-o",out,p],{cwd:root,stdio:"inherit",timeout:30000});
   const x=readFileSync(a),y=readFileSync(b),j=JSON.parse(x);
   if(j.id!==id||!j.version||!x.equals(y))fail("Non-reproducible fixture: "+id);
   console.log(id+"@"+j.version+" "+createHash("sha256").update(x).digest("hex"));
  }
 }finally{rmSync(tmp,{recursive:true,force:true})}
}
console.log(JSON.stringify({fixtureSources:seen,storedArtifacts:0,buildChecked:!!pkg}));
