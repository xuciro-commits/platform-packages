import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const nonempty=x=>typeof x==="string"&&x.trim().length>0;
const unique=(xs,k)=>{const m=new Map();for(const x of xs){if(!nonempty(x[k])||m.has(x[k]))throw Error("Duplicate or missing "+k);m.set(x[k],x)}return m};
export function validateSourceScope(root,cfg){
 if(!cfg.quality)return {features:0};
 const scope=JSON.parse(fs.readFileSync(path.resolve(root,cfg.quality.coverage),"utf8"));
 const trees=new Map();
 for(const [key,repo] of Object.entries(scope.sources)){
  if(!nonempty(repo.root)||!/^[a-f0-9]{40}$/.test(repo.commit))throw Error("Invalid source repo "+key);
  trees.set(key,new Set(execFileSync("git",["-C",path.resolve(root,repo.root),"ls-tree","-r","--name-only","-z",repo.commit],{encoding:"utf8",timeout:10000,maxBuffer:32*1024*1024}).split("\0")));
 }
 const missing=scope.features.flatMap(f=>[f.source,...(f.requiredAnchors||[])].filter(ref=>!trees.get(ref.repo)?.has(ref.path)).map(source=>({id:f.id,source})));
 if(missing.length)throw Error("Unresolvable frozen source paths: "+missing.slice(0,10).map(f=>f.id+"="+f.source.path).join(", "));
 const indexed=new Set(scope.features.map(f=>f.source.repo+":"+f.source.path));
 for(const d of scope.discovery||[]){
  if(!nonempty(d.id)||!Array.isArray(d.repos)||!d.repos.length||!nonempty(d.pathPattern)||!d.pathPattern.startsWith("^")||!d.pathPattern.endsWith("$"))throw Error("Invalid discovery coverage rule");
  const re=new RegExp(d.pathPattern),unindexed=[];
  for(const repo of d.repos){if(!trees.has(repo))throw Error("Unknown discovery repo "+repo);for(const p of trees.get(repo))if(re.test(p)&&!indexed.has(repo+":"+p))unindexed.push(repo+":"+p)}
  if(unindexed.length)throw Error("Unindexed frozen source paths ("+d.id+"): "+unindexed.slice(0,10).join(", "));
 }

 return {features:scope.features.length};
}
export function loadQuality(root,cfg,queue,completed=[]){
 if(!cfg.quality)return null;
 const q=cfg.quality;
 const read=k=>JSON.parse(fs.readFileSync(path.resolve(root,q[k]),"utf8"));
 const scope=read("coverage"), evidence=read("evidence"), product=read("productGates"), blockers=read("blockers"), caps=read("capabilities");
 for(const x of [scope,evidence,product,blockers,caps])if(x.version!==1)throw Error("Unsupported quality version");
 const features=unique(scope.features,"id"), findings=unique(evidence.findings,"feature"), gates=unique(product.gates,"id"), tasks=unique(queue.tasks,"id");
 unique(blockers.blockers,"id");unique(caps.capabilities,"id");
 if(!features.size||!gates.size)throw Error("Empty product scope");
 for(const [id] of findings)if(!features.has(id))throw Error("Evidence for unknown feature "+id);
 for(const g of gates.values())if(!Array.isArray(g.tasks)||g.tasks.some(id=>!tasks.has(id)))throw Error("Invalid product gate task "+g.id);
 for(const b of blockers.blockers)if(!gates.has(b.gate))throw Error("Unknown blocker gate "+b.gate);
 const sourceCache=new Map();
 function sourceLines(ref){
   const repo=scope.sources[ref.repo];if(!repo||!nonempty(repo.root)||!/^[a-f0-9]{40}$/.test(repo.commit)||!nonempty(ref.path)||path.isAbsolute(ref.path)||ref.path.split("/").includes(".."))throw Error("Invalid source anchor");
   const key=ref.repo+":"+ref.path;
   if(!sourceCache.has(key))sourceCache.set(key,execFileSync("git",["-C",path.resolve(root,repo.root),"show",repo.commit+":"+ref.path],{encoding:"utf8",maxBuffer:16*1024*1024,timeout:5000}).split("\n"));
   return sourceCache.get(key);
 }
 function study(id){
   const feature=features.get(id), e=findings.get(id);
   if(!feature)throw Error("Unknown study feature "+id);
   if(!e)return {id,status:"unreviewed"};
   const errors=[];
   for(const k of ["intent","observation","design","counterexample"])if(!nonempty(e[k]))errors.push("Missing "+k);
   if(!Array.isArray(e.anchors)||!e.anchors.length||!e.anchors.some(a=>a.repo===feature.source.repo&&a.path===feature.source.path))errors.push("Missing primary source anchor");
   for(const ref of feature.requiredAnchors||[])if(!Array.isArray(e.anchors)||!e.anchors.some(a=>a.repo===ref.repo&&a.path===ref.path))errors.push("Missing required implementation anchor: "+ref.repo+":"+ref.path);
   const validateAnchor=a=>{try{const lines=sourceLines(a);if(!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<1||a.end<a.start||a.end>lines.length||!nonempty(a.symbol)||!lines.slice(a.start-1,a.end).join("\n").includes(a.symbol))throw Error("Invalid source range or symbol not present");}catch(err){errors.push(err.message.slice(0,300))}};
   for(const a of Array.isArray(e.anchors)?e.anchors:[])validateAnchor(a);
   if(!Array.isArray(e.unknowns))errors.push("Unknowns must be explicit");
   else for(const u of e.unknowns)if(!nonempty(u.question)||!nonempty(u.probe)||!["critical","high","normal"].includes(u.severity)||!["open","resolved"].includes(u.status)||u.status==="resolved"&&(!nonempty(u.resolution)||!Array.isArray(u.anchors)||!u.anchors.length))errors.push("Invalid unknown");else if(u.status==="resolved")for(const a of u.anchors)validateAnchor(a);
   if(errors.length)return {id,status:"invalid",errors};
   return {id,status:"evidence_recorded",criticalUnknowns:e.unknowns.filter(u=>u.severity==="critical"&&u.status==="open").length};
 }
 const studies=[...features.values()].filter(f=>f.required!==false).map(f=>study(f.id));
 const gateResults=[...gates.values()].filter(g=>g.required!==false).map(g=>{
   const blocked=blockers.blockers.filter(b=>b.gate===g.id&&b.status!=="verified");
   const valid=g.tasks.length>0&&g.tasks.every(id=>tasks.get(id).probe&&tasks.get(id).kind!=="study"&&completed.includes(id));
   return {id:g.id,status:blocked.length?"blocked_by_platform_or_unknown":valid?"verified":"unverified",blockers:blocked.map(b=>b.innerBox||b.id)};
 });
 const studyCount=studies.filter(s=>s.status==="evidence_recorded").length;
 const openCritical=studies.reduce((n,s)=>n+(s.criticalUnknowns||0),0);
 const productReady=studies.length===studyCount&&openCritical===0&&gateResults.every(g=>g.status==="verified");
 return {study,summary:{scope:studies.length,evidenceRecorded:studyCount,invalid:studies.filter(s=>s.status==="invalid").length,criticalUnknowns:openCritical,requiredGates:gateResults.length,verifiedGates:gateResults.filter(g=>g.status==="verified").length,blockedGates:gateResults.filter(g=>g.status==="blocked_by_platform_or_unknown").length,productReady},studies,gateResults};
}
