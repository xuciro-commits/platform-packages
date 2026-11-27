import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync,execFileSync} from "node:child_process";
import {loadQuality,validateSourceScope} from "./package-loop-quality.mjs";
import {LIMITS,validateRules,observe,brief} from "./package-loop-reflect.mjs";
import {fileURLToPath} from "node:url";
import {test} from "node:test";
const runner=fileURLToPath(new URL("./package-loop.mjs",import.meta.url));
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"package-loop-test-"));
 const write=(n,s,mode=0o600)=>{const p=path.join(root,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s,{mode})};
 const json=(n,j)=>write(n,JSON.stringify(j));
 write("scripts/package-loop.mjs",fs.readFileSync(runner));
 write("scripts/package-loop-quality.mjs",fs.readFileSync(new URL("./package-loop-quality.mjs",import.meta.url)));
 write("scripts/package-loop-reflect.mjs",fs.readFileSync(new URL("./package-loop-reflect.mjs",import.meta.url)));
 write("loop/rules.json",JSON.stringify({version:1,rules:[{id:"scope",text:"Preserve the gate."}]}));
 const cfg={version:1,id:"demo",queue:"docs/queue.json",protocol:"docs/protocol.md",plan:"docs/plan.md",checkpoint:"docs/checkpoint.json",evidenceDir:"docs",budgets:{maxTurns:3,maxAttempts:2,maxStalls:2}};
 json("loop/projects/demo.json",cfg);
 json("docs/queue.json",{version:1,tasks:[{id:"A",intent:"A",packages:["demo"],probe:"docs/a.yaml"},{id:"B",intent:"B",packages:["demo"],probe:"docs/b.yaml"},{id:"C",intent:"C",packages:["demo"],probe:null}]});
 for(const n of ["docs/protocol.md","docs/plan.md","docs/checkpoint.json","docs/a.yaml","docs/b.yaml","packages/demo/try.yaml"])write(n,"fixture\n");
 write("packages/demo/model.yaml","initial");
 write("fake-pkg", "#!"+process.execPath+"\n"+'const f=require("fs");const a=process.argv.slice(2);if(a[0]==="check")process.exit(0);const n=a[2].includes("a.yaml")?"A":"B";process.exit(f.existsSync("packages/demo/"+n)?0:1);\n',0o700);
 write("fake-agent", "#!"+process.execPath+"\n"+'const f=require("fs");f.mkdirSync("packages/demo",{recursive:true});if(process.env.FAKE_NO_CHANGE)process.exit(0);if(!f.existsSync("packages/demo/A"))f.writeFileSync("packages/demo/A","ok");else {f.writeFileSync("packages/demo/B","ok");if(process.env.FAKE_REGRESSION)f.unlinkSync("packages/demo/A")}\n',0o700);
 const env={...process.env,PACKAGE_LOOP_DIR:path.join(root,"runtime"),PACKAGE_LOOP_PKG:path.join(root,"fake-pkg"),PACKAGE_LOOP_CODEX:path.join(root,"fake-agent")};
 const run=(mode,extra=[],e={})=>spawnSync(process.execPath,[path.join(root,"scripts/package-loop.mjs"),mode,"--project","demo",...extra],{cwd:root,env:{...env,...e},encoding:"utf8",timeout:15000});
 const state=()=>JSON.parse(fs.readFileSync(path.join(root,"runtime/demo/state.json"),"utf8"));
 return {root,write,run,state,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test("no automatic agent; explicit work resumes and advances",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);assert.equal(x.run("run").status,0);
 assert.equal(x.state().status,"awaiting_work");assert.deepEqual(x.state().completed,[]);
 assert.equal(fs.existsSync(path.join(x.root,"packages/demo/A")),false);
 x.write("packages/demo/A","ok");assert.equal(x.run("run").status,0);assert.deepEqual(x.state().completed,["A"]);
 x.write("packages/demo/B","ok");assert.equal(x.run("run").status,0);assert.deepEqual(x.state().completed,["A","B"]);assert.equal(x.state().reason,"missing_gate");
}finally{x.close()}});
test("freeze detects modified gate and resets acceptance only explicitly",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);x.write("packages/demo/A","ok");assert.equal(x.run("run").status,0);
 x.write("docs/a.yaml","changed");assert.notEqual(x.run("run").status,0);assert.notEqual(x.run("freeze").status,0);
 assert.equal(x.run("freeze",["--accept-changes"]).status,0);assert.deepEqual(x.state().completed,[]);
}finally{x.close()}});
test("historical gate regression blocks progress",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);x.write("packages/demo/A","ok");assert.equal(x.run("run").status,0);
 fs.unlinkSync(path.join(x.root,"packages/demo/A"));x.write("packages/demo/B","ok");
 assert.equal(x.run("run").status,1);assert.equal(x.state().reason,"regression_failed");assert.deepEqual(x.state().completed,["A"]);
}finally{x.close()}});
test("unchanged work creates one clustered reflection instead of appending rules",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);for(let i=0;i<4;i++)assert.equal(x.run("run").status,0);
 const report=JSON.parse(fs.readFileSync(path.join(x.root,"runtime/demo/reflection.json")));
 assert.equal(report.issues.no_progress.count,2);assert.equal(report.proposals.filter(p=>p.trigger==="no_progress").length,1);assert.equal(report.adaptive.studyBatch,1);
}finally{x.close()}});
test("lock and stop retained",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);x.write("runtime/lock",'{"pid":1}');assert.notEqual(x.run("run").status,0);fs.unlinkSync(path.join(x.root,"runtime/lock"));
 assert.equal(x.run("stop").status,0);assert.notEqual(x.run("run").status,0);assert.equal(x.run("run",["--resume"]).status,0);
 assert.equal(x.state().status,"awaiting_work");
}finally{x.close()}});
test("missing package can enter work state without external agent",()=>{const x=fixture();try{
 fs.rmSync(path.join(x.root,"packages/demo"),{recursive:true});assert.equal(x.run("freeze").status,0);assert.equal(x.run("run").status,0);assert.equal(x.state().status,"awaiting_work");
}finally{x.close()}});
test("rule ratchet rejects duplicate and growing rule sets",()=>{const a={version:1,rules:[{id:"a",text:"Keep gates fixed."}]};
 assert.throws(()=>validateRules({version:1,rules:[...a.rules,{id:"b",text:"Keep gates fixed!"}]}));
 assert.throws(()=>validateRules({version:1,rules:[...a.rules,{id:"b",text:"New rule."}]},a));
 assert.doesNotThrow(()=>validateRules({version:1,rules:[{id:"a",text:"Keep gates."}]},a));
});
test("brief remains bounded with huge history and findings",()=>{const ruleDoc={version:1,rules:[{id:"a",text:"Keep gates."}]};
 const s=brief({id:"x",cfg:{},task:{id:"a",intent:"test",packages:["x"]},initial:{tail:"x".repeat(100000)},ruleDoc,report:{recent:Array.from({length:1000},()=>({task:"a",reason:"failed",log:"log"}))},findings:Array.from({length:100},()=>({observation:"证据".repeat(10000)}))});
 assert.ok(Buffer.byteLength(s)<=LIMITS.promptBytes);
});
test("historical token pressure shrinks batch and deduplicates proposals",()=>{let r={};for(let i=0;i<10;i++)observe(r,{task:"A",phase:"agent",reason:"passed",usage:{input_tokens:2100000,cached_input_tokens:2000000},bytes:600000,log:"log"+i});
 assert.equal(r.issues.context_pressure.count,10);assert.equal(r.proposals.length,1);assert.equal(r.adaptive.studyBatch,1);assert.equal(r.recent.length,4);
});
test("learning requires anchored evidence and product cannot pass on a narrow queue",()=>{const x=fixture();try{
 const repo=path.join(x.root,"source");fs.mkdirSync(repo);execFileSync("git",["init","-q",repo]);fs.writeFileSync(path.join(repo,"report.txt"),"report definition\nfilter rules\n");
 execFileSync("git",["-C",repo,"add","report.txt"]);execFileSync("git",["-C",repo,"-c","user.name=Test","-c","user.email=test@example.invalid","commit","-qm","fixture"]);
 const sha=execFileSync("git",["-C",repo,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
 const cfg={quality:{coverage:"docs/coverage.json",evidence:"docs/evidence.json",productGates:"docs/product.json",blockers:"docs/blockers.json",capabilities:"docs/caps.json"}};
 const put=(n,v)=>x.write("docs/"+n+".json",JSON.stringify({version:1,...v}));
 const queue={tasks:[{id:"A",probe:"docs/a.yaml"}]};
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[{id:"report",source:{repo:"src",path:"report.txt"},required:true}]});
 assert.deepEqual(validateSourceScope(x.root,cfg),{features:1});
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[],discovery:[{id:"report-files",repos:["src"],pathPattern:"^report[.]txt$"}]});
 assert.throws(()=>validateSourceScope(x.root,cfg),/Unindexed frozen source paths/);
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[{id:"report",source:{repo:"src",path:"report.txt"},required:true}],discovery:[{id:"report-files",repos:["src"],pathPattern:"^report[.]txt$"}]});
 assert.deepEqual(validateSourceScope(x.root,cfg),{features:1});
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[{id:"report",source:{repo:"src",path:"missing.txt"},required:true}]});
 assert.throws(()=>validateSourceScope(x.root,cfg),/Unresolvable frozen source paths/);
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[{id:"report",source:{repo:"src",path:"report.txt"},required:true}]});
 put("product",{gates:[{id:"report-gate",required:true,tasks:["A"]},{id:"print-gate",required:true,tasks:[]}]});
 put("blockers",{blockers:[{id:"print",gate:"print-gate",status:"open",innerBox:"IB-1"}]});put("caps",{capabilities:[]});
 put("evidence",{findings:[]});
 assert.equal(loadQuality(x.root,cfg,queue,["A"]).summary.evidenceRecorded,0);
 const e={feature:"report",intent:"period totals",observation:"filters",design:"typed query",counterexample:"wrong period",anchors:[{repo:"src",path:"report.txt",start:1,end:99,symbol:"report"}],unknowns:[]};
 put("evidence",{findings:[e]});assert.equal(loadQuality(x.root,cfg,queue,["A"]).summary.invalid,1);
 e.anchors[0].end=2;e.unknowns=[{question:"permission",probe:"deny unauthorized",severity:"critical",status:"open"}];put("evidence",{findings:[e]});
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[{id:"report",source:{repo:"src",path:"report.txt"},required:true,requiredAnchors:[{repo:"src",path:"missing.py"}]}]});
 assert.throws(()=>validateSourceScope(x.root,cfg),/Unresolvable frozen source paths/);
 assert.equal(loadQuality(x.root,cfg,queue,["A"]).summary.invalid,1);
 put("coverage",{sources:{src:{root:"source",commit:sha}},features:[{id:"report",source:{repo:"src",path:"report.txt"},required:true,requiredAnchors:[{repo:"src",path:"report.txt"}]}]});
 const q=loadQuality(x.root,cfg,queue,["A"]);assert.equal(q.summary.evidenceRecorded,1);assert.equal(q.summary.criticalUnknowns,1);assert.equal(q.summary.verifiedGates,1);assert.equal(q.summary.blockedGates,1);assert.equal(q.summary.productReady,false);
 }finally{x.close()}});

test("append-only queue and unrelated future probe keep accepted prefix and reuse exact receipts",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);x.write("packages/demo/A","ok");assert.equal(x.run("run",["--max-steps","1"]).status,0);
 assert.deepEqual(x.state().completed,["A"]);assert.equal(x.state().reason,"step_budget");
 const status=()=>JSON.parse(x.run("status").stdout);
 assert.deepEqual(status().acceptance.verified,["A"]);
 const before=JSON.parse(fs.readFileSync(path.join(x.root,"runtime/demo/gate-receipts.json"))).entries["A:probe"];
 x.write("docs/b.yaml","new future probe");assert.equal(x.run("freeze",["--accept-changes"]).status,0);assert.deepEqual(x.state().completed,["A"]);
 assert.equal(x.run("run").status,0);
 const after=JSON.parse(fs.readFileSync(path.join(x.root,"runtime/demo/gate-receipts.json"))).entries["A:probe"];
 assert.deepEqual(after,before);
 x.write("packages/demo/model.yaml","changed");assert.deepEqual(status().acceptance.verified,[]);assert.deepEqual(status().acceptance.stale,["A"]);
 assert.equal(x.run("run").status,0);assert.deepEqual(status().acceptance.verified,["A"]);
 const changed=JSON.parse(fs.readFileSync(path.join(x.root,"runtime/demo/gate-receipts.json"))).entries["A:probe"];assert.notEqual(changed.key,before.key);
 }finally{x.close()}});
test("completed work revalidates even with missing next gate and rejects corrupted logs",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);x.write("packages/demo/A","ok");x.write("packages/demo/B","ok");assert.equal(x.run("run").status,0);
 const store=JSON.parse(fs.readFileSync(path.join(x.root,"runtime/demo/gate-receipts.json")));
 x.write("runtime/demo/"+store.entries["A:probe"].log,"corrupt");
 assert.deepEqual(JSON.parse(x.run("status").stdout).acceptance.verified,[]);
 assert.equal(x.run("run").status,0);
 fs.unlinkSync(path.join(x.root,"packages/demo/A"));assert.equal(x.run("run").status,1);
 assert.equal(x.state().failedGate,"A");assert.deepEqual(JSON.parse(x.run("status").stdout).acceptance.verified,[]);
 }finally{x.close()}});
test("review limit stops repeat polling; changed work or explicit review override can resume",()=>{const x=fixture();try{
 assert.equal(x.run("freeze").status,0);for(let i=0;i<3;i++)assert.equal(x.run("run").status,0);
 assert.equal(x.state().reason,"review_required");const old=x.state().history.filter(e=>e.kind==="repair_requested").length;
 assert.equal(x.run("run").status,0);assert.equal(x.state().history.filter(e=>e.kind==="repair_requested").length,old);
 x.write("packages/demo/A","ok");assert.equal(x.run("run").status,0);assert.deepEqual(x.state().completed,["A"]);
 }finally{x.close()}});
test("recover refuses live owner and archives dead lock",()=>{const x=fixture();try{
 x.write("runtime/lock",JSON.stringify({pid:process.pid,project:"demo"}));assert.notEqual(x.run("recover").status,0);
 x.write("runtime/lock",JSON.stringify({pid:2147483647,project:"demo"}));assert.equal(x.run("recover").status,0);
 assert.equal(fs.existsSync(path.join(x.root,"runtime/lock")),false);
 assert.equal(x.run("freeze").status,0);assert.equal(x.run("run").status,0);
 }finally{x.close()}});

test("explicit external deferral permits independent work but never completes or releases the deferred task",()=>{const x=fixture();try{
 const cfg=JSON.parse(fs.readFileSync(path.join(x.root,"loop/projects/demo.json")));cfg.feedbackDir="feedback";x.write("loop/projects/demo.json",JSON.stringify(cfg));
 const q=JSON.parse(fs.readFileSync(path.join(x.root,"docs/queue.json")));q.tasks[0].defer={reason:"external capability",feedback:"IB-DEMO-0001"};q.tasks[2].defer={reason:"same missing capability",feedback:"IB-DEMO-0001"};x.write("docs/queue.json",JSON.stringify(q));
 assert.notEqual(x.run("freeze").status,0);
 x.write("feedback/IB-DEMO-0001.json",JSON.stringify({id:"IB-DEMO-0001",status:"reported"}));
 assert.equal(x.run("freeze").status,0);x.write("packages/demo/B","ok");
 assert.equal(x.run("run").status,0);assert.deepEqual(x.state().completed,["B"]);assert.equal(x.state().reason,"deferred_tasks");assert.equal(x.state().productReady,false);
 const status=JSON.parse(x.run("status").stdout);assert.deepEqual(status.acceptance.verified,["B"]);assert.deepEqual(status.deferred.map(x=>x.task),["A","C"]);
 assert.equal(x.run("verify",["--task","A"]).status,1);assert.deepEqual(x.state().completed,["B"]);
 delete q.tasks[0].defer;x.write("docs/queue.json",JSON.stringify(q));assert.equal(x.run("freeze",["--accept-changes"]).status,0);assert.equal(x.run("run").status,0);assert.equal(x.state().current,"A");assert.equal(x.state().status,"awaiting_work");
 }finally{x.close()}});

test("descriptive batch notes require explicit freeze but retain runtime receipts",()=>{const x=fixture();try{
 const cfg=JSON.parse(fs.readFileSync(path.join(x.root,"loop/projects/demo.json")));cfg.batchArtifacts=["docs/batch.json"];x.write("loop/projects/demo.json",JSON.stringify(cfg));x.write("docs/batch.json",'{"status":"draft"}');
 assert.equal(x.run("freeze").status,0);x.write("packages/demo/A","ok");assert.equal(x.run("run",["--max-steps","1"]).status,0);
 const file=path.join(x.root,"runtime/demo/gate-receipts.json");const before=JSON.parse(fs.readFileSync(file)).entries["A:probe"];
 x.write("docs/batch.json",'{"status":"reviewed"}');assert.notEqual(x.run("run").status,0);assert.notEqual(x.run("freeze").status,0);
 assert.equal(x.run("freeze",["--accept-changes"]).status,0);assert.deepEqual(x.state().completed,["A"]);
 assert.equal(x.run("run").status,0);assert.deepEqual(JSON.parse(fs.readFileSync(file)).entries["A:probe"],before);
 x.write("packages/demo/model.yaml","changed");assert.deepEqual(JSON.parse(x.run("status").stdout).acceptance.verified,[]);
 assert.equal(x.run("run").status,0);assert.notEqual(JSON.parse(fs.readFileSync(file)).entries["A:probe"].key,before.key);
 }finally{x.close()}});
