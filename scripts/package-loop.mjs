#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {createHash,randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {loadQuality,validateSourceScope,validateProbeRefusals,checkProbeRefusals} from "./package-loop-quality.mjs";
import {LIMITS,validateRules,observe,brief} from "./package-loop-reflect.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2),mode=args[0]||"status";
const opt=(n,d)=>{const i=args.indexOf(n);if(i<0)return d;if(!args[i+1]||args[i+1].startsWith("--"))throw Error("Missing "+n);return args[i+1]};
const id=opt("--project",process.env.PACKAGE_LOOP_PROJECT);
const safeId=x=>typeof x==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(x)&&x!==".."&&x!==".";
if(!safeId(id))throw Error("Specify --project <id> (configuration: loop/projects/<id>.json)");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,v)=>{const t=p+".tmp-"+randomUUID();fs.writeFileSync(t,JSON.stringify(v,null,2)+"\n",{mode:0o600});fs.renameSync(t,p)};
const hash=p=>createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const local=p=>{if(typeof p!=="string"||path.isAbsolute(p))throw Error("Expected repository-relative path");const x=path.resolve(root,p);if(!x.startsWith(root+path.sep))throw Error("Path outside repository: "+p);return x};
const configFile=local("loop/projects/"+id+".json"), cfg=read(configFile);
if(cfg.version!==1||cfg.id!==id)throw Error("Invalid project configuration");
for(const k of ["queue","protocol","plan","checkpoint","evidenceDir"])local(cfg[k]);
const navigationContracts=(cfg.navigationContracts??[]).map(p=>({path:p,package:read(local(p)).package}));if(navigationContracts.some(x=>!safeId(x.package))||new Set(navigationContracts.map(x=>x.package)).size!==navigationContracts.length)throw Error("Invalid navigation contracts");
const taskFile=local(cfg.queue), queue=read(taskFile);
if(queue.version!==1||!Array.isArray(queue.tasks))throw Error("Invalid queue");
const ids=new Set();
for(const t of queue.tasks){if(!safeId(t.id)||ids.has(t.id)||!Array.isArray(t.packages)||!t.packages.length||!t.packages.every(safeId)||typeof t.intent!=="string")throw Error("Invalid task "+t.id);ids.add(t.id);if(t.probe)local(t.probe);if(t.probeRefusals!==undefined&&!t.probe)throw Error("Refusal assertions require a probe: "+t.id);validateProbeRefusals(t.probeRefusals)}
const deferred=queue.tasks.filter(t=>t.defer).map(t=>{const d=t.defer;if(!d||typeof d.reason!=="string"||!d.reason.trim()||!/^IB-[A-Z]+-[0-9]{4}$/.test(d.feedback)||typeof cfg.feedbackDir!=="string")throw Error("Invalid deferred task "+t.id);const file=path.resolve(root,cfg.feedbackDir,d.feedback+".json");const g=read(file);if(g.id!==d.feedback||!["reported","accepted","planned","implementing","verified","closed"].includes(g.status))throw Error("Invalid feedback for "+t.id);return {task:t.id,reason:d.reason,feedback:d.feedback,feedbackStatus:g.status}});
const deferredIds=new Set(deferred.map(d=>d.task));
const budget=(name,key,def,min,max)=>{const n=Number(opt(name,cfg.budgets?.[key]??def));if(!Number.isInteger(n)||n<min||n>max)throw Error("Invalid "+name);return n};
const maxMs=budget("--max-minutes","maxMinutes",240,1,720)*60000,gateMs=budget("--gate-seconds","gateSeconds",120,5,900)*1000,maxSteps=budget("--max-steps","maxTurns",20,1,1000),maxAttempts=budget("--max-attempts","maxAttempts",6,1,100),maxStalls=budget("--max-stalls","maxStalls",2,1,100);

const base=path.resolve(process.env.PACKAGE_LOOP_DIR||path.join(root,".package-loop")),dir=path.join(base,id),stateFile=path.join(dir,"state.json"),manifestFile=path.join(dir,"gates.json"),stopFile=path.join(dir,"STOP"),lock=path.join(base,"lock");
const pkg=process.env.PACKAGE_LOOP_PKG||path.join(os.homedir(),"bin/pkg");
fs.mkdirSync(dir,{recursive:true,mode:0o700});
let state=fs.existsSync(stateFile)?read(stateFile):{version:1,completed:[],attempts:{},stalls:{},history:[],status:"idle"};
if(state.version!==1||!Array.isArray(state.completed)||!Array.isArray(state.history))throw Error("Invalid state");
const next=()=>queue.tasks.find(t=>!deferredIds.has(t.id)&&!state.completed.includes(t.id));
const digest=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const envFingerprint=()=>digest([root,process.platform,process.arch,process.version,Object.entries(process.env).sort(([a],[b])=>a.localeCompare(b))]);
const rulesFile=local("loop/rules.json"),ruleDoc=validateRules(read(rulesFile));
const reflectionFile=path.join(dir,"reflection.json"),rulesBaseline=path.join(dir,"rules-baseline.json");
let reflection=fs.existsSync(reflectionFile)?read(reflectionFile):{version:1};
if(mode==="reflect"){console.log(JSON.stringify(reflection,null,2));process.exit(0)}
const quality=(completed=state.completed)=>loadQuality(root,cfg,queue,completed);
if(mode==="audit"){const acceptance=freshAcceptance();const q=quality(acceptance.verified);if(!q)throw Error("Project has no product scope");console.log(JSON.stringify({acceptance,deferred,summary:{...q.summary,productReady:q.summary.productReady&&!deferred.length},unverifiedGates:q.gateResults.filter(g=>g.status!=="verified"),recorded:q.studies.filter(s=>s.status!=="unreviewed")},null,2));process.exit(0)}
const lockInfo=()=>fs.existsSync(lock)?read(lock):null;
if(mode==="status"){const acceptance=freshAcceptance(),summary=quality(acceptance.verified)?.summary;console.log(JSON.stringify({...state,history:args.includes("--verbose")?state.history:state.history.slice(-4),project:id,stopRequested:fs.existsSync(stopFile),lock:lockInfo(),next:next()?.id,deferred,acceptance,quality:summary?{...summary,productReady:summary.productReady&&!deferred.length}:null},null,2));process.exit(0)}
if(mode==="stop"){fs.writeFileSync(stopFile,"stop\n",{mode:0o600});console.log("Stop requested: "+id);process.exit(0)}
if(mode==="recover"){
 const recovery=lock+".recovery";const fd=fs.openSync(recovery,"wx",0o600);
 try{const owner=lockInfo();if(!owner)console.log("No stale lock");
 else{
  const alive=(pid,group=false)=>{if(!Number.isSafeInteger(pid)||pid<1)throw Error("Invalid owner PID; manual inspection required");try{process.kill(group&&process.platform!=="win32"?-pid:pid,0);return true}catch(e){if(e.code==="ESRCH")return false;if(e.code==="EPERM")return true;throw e}};
  if(alive(owner.pid)||owner.childPid&&alive(owner.childPid,true))throw Error("Lock owner or verifier process is still alive");
  if(owner.project!==id)throw Error("Use recover on the owning project");
  fs.renameSync(lock,path.join(dir,"recovered-lock-"+Date.now()+".json"));console.log("Stale lock archived; run --resume to revalidate")
 }}finally{fs.closeSync(fd);fs.unlinkSync(recovery)}
 process.exit(0)
}
if(!["run","verify","freeze"].includes(mode))throw Error("Usage: package-loop.mjs run|status|stop|verify|freeze|reflect --project <id>");
let fd;try{fd=fs.openSync(lock,"wx",0o600)}catch(e){throw Error("Repository loop locked; inspect PID before recovery: "+lock+" ("+e.code+")")}
const token=randomUUID(),owner={pid:process.pid,project:id,token,started:new Date().toISOString()};fs.writeFileSync(fd,JSON.stringify(owner));fs.closeSync(fd);
function trackChild(pid){if(lockInfo()?.token!==token)throw Error("Lost repository lock");owner.childPid=pid??null;save(lock,owner)}
// State must be read under the repository lock.
if(fs.existsSync(stateFile))state=read(stateFile);
if(fs.existsSync(reflectionFile))reflection=read(reflectionFile);
let child=null,stopping=false,returnFromRun=false;
function kill(signal){if(child?.pid){try{if(process.platform==="win32")child.kill(signal);else process.kill(-child.pid,signal)}catch(e){if(e.code!=="ESRCH")throw e}}}
function onStop(){stopping=true;kill("SIGTERM")}
process.on("SIGINT",onStop);process.on("SIGTERM",onStop);
const started=Date.now(),stopReason=()=>stopping||fs.existsSync(stopFile)?"stopped":Date.now()-started>=maxMs?"run_budget":null;
function persist(status,extra={}){if(["idle","running","checking","queue_complete"].includes(status)){state.failedGate=null;state.brief=null}Object.assign(state,{status,project:id,updatedAt:new Date().toISOString(),...extra});save(stateFile,state)}
const eventsFile=path.join(dir,"events.ndjson");
if(!fs.existsSync(eventsFile))fs.writeFileSync(eventsFile,state.history.map(e=>JSON.stringify(e)).join("\n")+(state.history.length?"\n":""),{mode:0o600});
state.history=state.history.slice(-32);
function event(v){const e={...v,at:new Date().toISOString()};fs.appendFileSync(eventsFile,JSON.stringify(e)+"\n");state.history=[...state.history,e].slice(-32)}
function reflect(v){observe(reflection,v);save(reflectionFile,reflection)}
function requiredGates(){return [...(cfg.deliveryLayout?[local("scripts/packages.mjs"),local("platform.lock"),local(".github/workflows/check.yml"),local(".github/workflows/release.yml")]:[]),...(cfg.batchArtifacts??[]).map(p=>local(p)),...((cfg.fieldAudits??[]).length?[local("scripts/package-field-audit.mjs"),...cfg.fieldAudits.map(p=>local(p))]:[]),fileURLToPath(import.meta.url),local("scripts/package-loop-quality.mjs"),configFile,taskFile,local(cfg.protocol),rulesFile,local("scripts/package-loop-reflect.mjs"),...queue.tasks.filter(t=>t.probe).map(t=>local(t.probe)),...(navigationContracts.length?[local("scripts/package-navigation.mjs"),...navigationContracts.map(x=>local(x.path)),...(cfg.navigationIndex?[local(cfg.navigationIndex)]:[])]:[]),...(cfg.quality?[local(cfg.quality.coverage),local(cfg.quality.productGates),local(cfg.quality.blockers),local(cfg.quality.capabilities)]:[])]}
function gatePaths(){return [...requiredGates(),...new Set(queue.tasks.flatMap(t=>t.packages).map(p=>local("packages/"+p+"/try.yaml")).filter(p=>fs.existsSync(p)))]}
function snapshot(){return Object.fromEntries([...new Set(gatePaths())].sort().map(p=>[path.relative(root,p),hash(p)]))}
function taskSignatures(files){
 const excluded=new Set([path.relative(root,taskFile),...queue.tasks.filter(t=>t.probe).map(t=>t.probe),...queue.tasks.flatMap(t=>t.packages.map(p=>"packages/"+p+"/try.yaml"))]);
 const globals=Object.entries(files).filter(([p])=>!excluded.has(p));
 // Descriptive batch artifacts and source audit inventories are separately frozen and checked at freeze.
 // They do not alter the runtime command, executable probe, navigation gate or package.
 const researchOnly=new Set([...(cfg.batchArtifacts??[]),...(cfg.fieldAudits??[])]);
 return Object.fromEntries(queue.tasks.map(t=>[t.id,digest([t.kind==="study"?globals:globals.filter(([p])=>!researchOnly.has(p)),t,t.probe?files[t.probe]:null,t.packages.map(p=>[p,files["packages/"+p+"/try.yaml"]??null])])]));
}
let frozen,controllerHash=hash(fileURLToPath(import.meta.url)),toolHash;
function verifyFrozen(){if(requiredGates().some(p=>!Object.hasOwn(frozen,path.relative(root,p)))||Object.entries(frozen).some(([p,h])=>!fs.existsSync(local(p))||hash(local(p))!==h))throw Error("Frozen gates changed; maintainer review and explicit freeze required");if(hash(fileURLToPath(import.meta.url))!==controllerHash)throw Error("Controller modified during run");if(toolHash&&hash(pkg)!==toolHash)throw Error("Verifier binary changed during run")}
function fingerprint(task){if(task.kind==="study")return hash(local(cfg.quality.evidence));return packageFingerprint(task)}
function packageFingerprint(task){const h=createHash("sha256");function walk(p){if(!fs.existsSync(p)){h.update("missing:"+path.relative(root,p));return}for(const n of fs.readdirSync(p).sort()){const x=path.join(p,n),s=fs.lstatSync(x);if(s.isSymbolicLink())continue;if(s.isDirectory())walk(x);else if(!/^(try\.yaml|package\.lock\.json|CHANGELOG\.md|README\.md|DESIGN\.md)$/.test(n)&&!n.endsWith(".log")){h.update(path.relative(root,x));h.update(fs.readFileSync(x))}}}for(const p of task.packages)walk(local("packages/"+p));return h.digest("hex")}
function command(bin,argv,label,limit,stdin=""){
  return new Promise(resolve=>{
    const name=Date.now()+"-"+randomUUID().slice(0,8)+"-"+label+".log",log=path.join(dir,name);
    const logfd=fs.openSync(log,"wx",0o600);
    let tail="",why=stopReason(),stopAt=0,err=null,settled=false,timer;
    const finish=(code,signal)=>{if(settled)return;settled=true;clearInterval(timer);child=null;trackChild(null);fs.closeSync(logfd);resolve({code,signal,reason:why|| (err?"spawn_error":signal?"signal":code===0?"passed":"failed"),error:err,log:name,tail})};
    if(why){finish(null,null);return}
    try{child=spawn(bin,argv,{cwd:root,detached:process.platform!=="win32",stdio:["pipe","pipe","pipe"],env:process.env})}catch(e){err=e.message;finish(null,null);return}
    trackChild(child.pid??null);child.stdin.on("error",()=>{});child.stdin.end(stdin);
    for(const s of [child.stdout,child.stderr])s.on("data",b=>{fs.writeSync(logfd,b);tail=(tail+b.toString()).slice(-6000)});
    const began=Date.now();
    timer=setInterval(()=>{const now=Date.now();if(!stopAt){why=stopReason()||(now-began>=limit?"command_timeout":null);if(why){stopAt=now;kill("SIGTERM")}}else if(now-stopAt>3000)kill("SIGKILL")},200);
    child.once("error",e=>{err=e.message});
    child.once("close",(code,signal)=>{why=why||stopReason();finish(code,signal)});
  });
}
const pass=r=>r.reason==="passed"&&r.code===0;
const runGateCache=new Map();
const receiptsFile=path.join(dir,"gate-receipts.json");
let receipts=fs.existsSync(receiptsFile)?read(receiptsFile):{version:1,entries:{}};
if(receipts.version!==1||!receipts.entries||typeof receipts.entries!=="object")throw Error("Invalid gate receipt store");
const environmentHash=envFingerprint();
function gateContent(task){
 const h=createHash("sha256");
 function walk(p){if(!fs.existsSync(p)){h.update("missing:"+p);return}
  for(const n of fs.readdirSync(p).sort()){const x=path.join(p,n),s=fs.lstatSync(x);if(s.isSymbolicLink())throw Error("Unexpected symlink in package: "+x);if(s.isDirectory())walk(x);else if(s.isFile()){h.update(JSON.stringify([path.relative(root,x),s.size,hash(x)]))}else throw Error("Unexpected package file: "+x)}
 }
 // pkg may resolve sibling dependencies and released snapshots. Fingerprint the complete local package tree conservatively.
 walk(local("packages"));const pinned=local("platform.lock");if(fs.existsSync(pinned))h.update(hash(pinned));return h.digest("hex")
}
function receiptKey(t,argv,content){return digest([taskSignatures(frozen)[t.id],argv,content,toolHash,environmentHash])}
function receiptSlot(t,label){return t.id+":"+label}
function cacheReceipt(slot,key,r){receipts.entries[slot]={key,log:r.log,logHash:hash(path.join(dir,r.log)),at:new Date().toISOString()};save(receiptsFile,receipts)}
function receiptValid(r,key){return !!(r&&r.key===key&&typeof r.log==="string"&&path.basename(r.log)===r.log&&fs.existsSync(path.join(dir,r.log))&&r.logHash===hash(path.join(dir,r.log)))}
function verifiedReceipt(slot,key){const r=receipts.entries[slot];if(!receiptValid(r,key))return null;return {code:0,reason:"passed",log:r.log,tail:"Exact successful receipt reused",cached:true}}
function gateCommands(t){const pk=t.packages.map(p=>"packages/"+p);return [...(cfg.deliveryLayout?[["layout",process.execPath,["scripts/packages.mjs","layout",...t.packages]]]:[]),...navigationContracts.filter(n=>t.packages.includes(n.package)).map(n=>["nav-"+n.package,process.execPath,["scripts/package-navigation.mjs",n.path]]),["check",pkg,["check",...pk]],["probe",pkg,["try","-script",t.probe,...pk]]]}
function freshAcceptance(){
 const previous=[...state.completed],verified=[];
 try{
  if(!fs.existsSync(manifestFile))return {verified,stale:previous,reason:"not_frozen"};
  const manifest=read(manifestFile);if(JSON.stringify(manifest.files)!==JSON.stringify(snapshot()))return {verified,stale:previous,reason:"frozen_inputs_changed"};
  const store=path.join(dir,"gate-receipts.json"),entries=fs.existsSync(store)?read(store).entries:{},tool=hash(pkg),env=envFingerprint(),content=gateContent(),signatures=taskSignatures(manifest.files),q=quality([]);
  for(const t of queue.tasks){
   if(deferredIds.has(t.id))continue;
   if(!previous.includes(t.id))break;
   if(t.kind==="study"){if(!t.study.every(id=>q.study(id).status==="evidence_recorded"))break}
   else{if(!t.probe)break;if(!gateCommands(t).every(([label,bin,argv])=>receiptValid(entries[t.id+":"+label],digest([signatures[t.id],argv,content,tool,env]))))break}
   verified.push(t.id)
  }
  return {verified,stale:previous.filter(x=>!verified.includes(x))}
 }catch(e){return {verified:[],stale:previous,reason:String(e.message).slice(0,200)}}
}

async function gate(task){
  verifyFrozen();
  const ordered=[...queue.tasks.filter(t=>!deferredIds.has(t.id)&&state.completed.includes(t.id)&&(t.probe||t.kind==="study")&&t.id!==task.id),task];
  for(const t of ordered){
    if(t.kind==="study"){
      if(!cfg.quality||!Array.isArray(t.study)||!t.study.length)throw Error("Study task requires a frozen feature list");
      const q=quality(), findings=t.study.map(id=>q.study(id));
      const ok=findings.every(e=>e.status==="evidence_recorded");
      const log=Date.now()+"-"+randomUUID().slice(0,8)+"-"+t.id+"-study.json";save(path.join(dir,log),findings);
      const result={code:ok?0:1,reason:ok?"passed":"failed",gateTask:t.id,gateKind:"study",log,tail:JSON.stringify(findings).slice(-6000)};
      if(!ok||t.id===task.id)return result;continue;
    }
    if(!t.probe)throw Error("No independent acceptance gate: "+t.id);
    for(const [label,bin,argv] of gateCommands(t)){
      const before=gateContent(t),key=receiptKey(t,argv,before),slot=receiptSlot(t,label);
      const commonKey=digest([argv,before,toolHash,environmentHash,label==="probe"?t.probeRefusals??null:null]);
      const cached=runGateCache.get(commonKey)??verifiedReceipt(slot,key);let r=cached??await command(bin,argv,t.id+"-"+label,gateMs);verifyFrozen();
      if(gateContent(t)!==before)throw Error("Package changed during verification: "+t.id);
      if(pass(r)&&label==="probe"&&t.probeRefusals){const failures=checkProbeRefusals(fs.readFileSync(path.join(dir,r.log),"utf8"),t.probeRefusals);if(failures.length)r={...r,code:1,reason:"failed",tail:"Probe refusal mismatch: "+JSON.stringify(failures).slice(0,5000)}}
      if(pass(r)){runGateCache.set(commonKey,r);if(!verifiedReceipt(slot,key))cacheReceipt(slot,key,r)}else if(receipts.entries[slot]){delete receipts.entries[slot];save(receiptsFile,receipts)}
      if(!pass(r))return {...r,gateTask:t.id,gateKind:label};
      if(t.id===task.id&&label==="probe")return {...r,gateTask:t.id,gateKind:label};
    }
  }
}
function finishFailure(r,task){const paused=["stopped","run_budget","command_timeout","spawn_error","signal"].includes(r.reason);persist(paused?"paused":"blocked",{current:task.id,reason:r.reason,lastGate:r.log,failedGate:r.gateTask??task.id});if(!paused)process.exitCode=1}
try{
  if(mode==="freeze"){
    validateSourceScope(root,cfg);
    if((cfg.fieldAudits??[]).length){const {run}=await import("./package-field-audit.mjs");for(const file of cfg.fieldAudits)run(local(file))}
    if(cfg.navigationIndex){const {checkNavigationIndex}=await import("./package-navigation.mjs");checkNavigationIndex(local(cfg.navigationIndex),navigationContracts.map(x=>local(x.path)))}
    validateRules(ruleDoc,fs.existsSync(rulesBaseline)?read(rulesBaseline):null);
    const fresh=snapshot();
    if(fs.existsSync(manifestFile)&&JSON.stringify(read(manifestFile).files)!==JSON.stringify(fresh)){
      if(!args.includes("--accept-changes"))throw Error("Gate changes require --accept-changes; affected acceptance receipts will be revalidated");
      const stamp=Date.now();fs.copyFileSync(manifestFile,path.join(dir,"gates-"+stamp+".json"));if(fs.existsSync(stateFile))fs.copyFileSync(stateFile,path.join(dir,"state-"+stamp+".json"));
      const prior=read(manifestFile),sigs=taskSignatures(fresh),previous=[...state.completed];
      // Preserve only the unchanged prefix. Older manifests without task signatures migrate conservatively.
      let retained=[];for(const t of queue.tasks){if(deferredIds.has(t.id))continue;if(!previous.includes(t.id)||prior.tasks?.[t.id]!==sigs[t.id])break;retained.push(t.id)}
      state.completed=retained;state.attempts={};state.stalls={};state.lastRepair=null;
      event({kind:"gate_rebaseline",previousCompleted:previous,retained,invalidated:previous.filter(x=>!retained.includes(x))});persist("idle",{current:next()?.id??null,reason:"gate_rebaseline",lastGate:null,failedGate:null,brief:null});
    }
    save(manifestFile,{version:1,project:id,files:fresh,tasks:taskSignatures(fresh)});save(rulesBaseline,ruleDoc);console.log("Frozen "+Object.keys(fresh).length+" gate inputs");
  }else{
    if(fs.existsSync(stopFile)){if(!args.includes("--resume"))throw Error("Stopped; use --resume");fs.unlinkSync(stopFile)}
    if(!fs.existsSync(manifestFile))throw Error("Run freeze first");
    frozen=read(manifestFile).files;toolHash=hash(pkg);verifyFrozen();
    if(mode==="verify"){
      const task=queue.tasks.find(t=>t.id===opt("--task",next()?.id));if(!task||(!task.probe&&task.kind!=="study"))throw Error("No verifiable task");
      const r=await gate(task);console.log(JSON.stringify(r));if(!pass(r))process.exitCode=1;
    }else{
      event({kind:"run_started",verifierHash:toolHash});persist("running",{current:next()?.id??null,reason:null});
      let steps=0;
      // Even when the queue ends or the next task lacks a gate, revalidate accepted work.
      const lastAccepted=queue.tasks.filter(t=>!deferredIds.has(t.id)&&state.completed.includes(t.id)).at(-1);
      if(lastAccepted){const check=await gate(lastAccepted);if(!pass(check)){reflect({task:lastAccepted.id,phase:"gate",reason:check.reason==="failed"?"regression_failed":check.reason,log:check.log});finishFailure({...check,reason:check.reason==="failed"?"regression_failed":check.reason},lastAccepted);returnFromRun=true}}
      while(!returnFromRun&&!stopReason()){
        if(steps>=maxSteps){persist("paused",{current:next()?.id??null,reason:"step_budget"});break}
        const task=next();if(!task){const q=quality(state.completed.filter(id=>!deferredIds.has(id)));const pending=deferred.length>0;persist(pending||q&&!q.summary.productReady?"blocked":"queue_complete",{current:null,reason:pending?"deferred_tasks":q&&!q.summary.productReady?"product_scope_incomplete":null,productReady:!pending&&(q?.summary.productReady??false)});break}
        if(!task.probe&&task.kind!=="study"){persist("blocked",{current:task.id,reason:"missing_gate",failedGate:task.id,brief:null});break}
        if(state.lastRepair?.task===task.id){const now=task.kind==="study"?JSON.stringify(task.study.map(id=>quality().study(id).status)):fingerprint(task);const exhausted=(state.attempts[task.id]||0)>=maxAttempts;const stalled=(state.stalls[task.id]||0)>=maxStalls&&state.lastRepair.fingerprint===now;if((exhausted||stalled)&&!args.includes("--retry-review")){persist("blocked",{current:task.id,reason:"review_required",failedGate:task.id,brief:"next-task.md"});break}if(args.includes("--retry-review")){delete state.stalls[task.id];delete state.attempts[task.id];state.lastRepair=null;event({kind:"review_override",task:task.id})}}
        persist("checking",{current:task.id,reason:null});
        const initial=await gate(task);
        if(pass(initial)){state.completed.push(task.id);state.lastRepair=null;delete state.attempts[task.id];delete state.stalls[task.id];steps++;event({kind:"gate_passed",task:task.id,log:initial.log,verifierHash:toolHash,cached:!!initial.cached});persist("running",{current:next()?.id??null,reason:null,lastGate:initial.log});continue}
        reflect({task:task.id,phase:"gate",reason:initial.gateTask!==task.id?"regression_failed":initial.reason,log:initial.log});
        if(initial.reason!=="failed"){finishFailure(initial,task);break}
        if(initial.gateTask!==task.id){persist("blocked",{current:task.id,reason:"regression_failed",failedGate:initial.gateTask,lastGate:initial.log});break}
        const study=task.kind==="study", q=study?quality():null;
        const pending=study?task.study.filter(id=>q.study(id).status!=="evidence_recorded"):[];
        const batch=study?pending.slice(0,reflection.adaptive?.studyBatch||LIMITS.studyBatch):[];
        const coverage=study?read(local(cfg.quality.coverage)):null;
        const selected=study?coverage.features.filter(f=>batch.includes(f.id)).map(f=>({...f,source:{...f.source,...coverage.sources[f.source.repo]}})):[];
        const relevant=cfg.quality?read(local(cfg.quality.evidence)).findings.filter(f=>study?task.study.includes(f.feature):(task.features||[]).includes(f.feature)):[];
        const fingerprintNow=study?JSON.stringify(task.study.map(id=>q.study(id).status)):fingerprint(task);
        const last=state.lastRepair;
        const changed=!last||last.task!==task.id||last.fingerprint!==fingerprintNow;
        if(last&&last.task===task.id){reflect({task:task.id,phase:"repair",reason:"failed",changed,log:initial.log});state.stalls[task.id]=changed?0:(state.stalls[task.id]||0)+1;if(changed)state.attempts[task.id]=(state.attempts[task.id]||0)+1}else state.attempts[task.id]=1;
        state.lastRepair={task:task.id,fingerprint:fingerprintNow};
        const nextBrief=brief({id,cfg,task:study?{...task,study:batch}:task,initial,ruleDoc,report:reflection,features:selected,findings:relevant,schema:study?"Record feature, intent, observation, design, counterexample, anchors [{repo,path,start,end,symbol}], unknowns [{question,probe,severity,status}]. Only the listed batch.":"Repair only assigned candidate packages using the failing gate."});
        fs.writeFileSync(path.join(dir,"next-task.md"),nextBrief+"\n",{mode:0o600});
        event({kind:"repair_requested",task:task.id,log:initial.log,changed});
        const review=(state.stalls[task.id]||0)>=maxStalls||(state.attempts[task.id]||0)>=maxAttempts;
        persist(review?"blocked":"awaiting_work",{current:task.id,reason:review?"review_required":"manual_repair_required",lastGate:initial.log,failedGate:task.id,brief:"next-task.md"});
        break;

      }
      if(["running","checking","executing"].includes(state.status))persist("paused",{reason:stopReason()||"run_budget"});
      console.log(JSON.stringify({...state,history:args.includes("--verbose")?state.history:state.history.slice(-4),next:next()?.id??null,deferred},null,2));
    }
  }
}catch(e){if(mode==="run")persist("blocked",{reason:e.message,failedGate:null,brief:null});console.error(e.message);process.exitCode=1}
finally{if(lockInfo()?.token===token)fs.unlinkSync(lock)}
