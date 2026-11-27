import {createHash} from "node:crypto";
export const LIMITS=Object.freeze({rules:10,ruleBytes:2600,promptBytes:12000,studyBatch:2,history:4,findings:4,issues:24});
const size=x=>Buffer.byteLength(typeof x==="string"?x:JSON.stringify(x),"utf8");
const clip=(v,n)=>{let s=String(v??"");while(size(s)>n)s=s.slice(0,Math.max(0,Math.floor(s.length*.8)));return s};
const digest=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function validateRules(doc,previous=null){
 if(doc.version!==1||!Array.isArray(doc.rules)||!doc.rules.length||doc.rules.length>LIMITS.rules||size(doc.rules)>LIMITS.ruleBytes)throw Error("Rule capacity exceeded");
 const keys=new Set(),texts=new Set();
 for(const r of doc.rules){if(!/^[a-z][a-z0-9-]*$/.test(r.id)||typeof r.text!=="string"||!r.text.trim()||keys.has(r.id))throw Error("Invalid or duplicate rule");const t=r.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");if(!t||texts.has(t))throw Error("Duplicate rule text");keys.add(r.id);texts.add(t)}
 if(previous&&(doc.rules.length>previous.rules.length||size(doc.rules)>size(previous.rules)))throw Error("Rule ratchet: consolidate or replace before growing");
 return doc;
}
export function observe(report,{task,phase,reason,changed,usage,bytes,log}){
 report.version=1;report.issues??={};report.recent??=[];report.totals??={turns:0,inputTokens:0,cachedTokens:0,outputTokens:0};
 const u=usage||{};if(phase==="agent"){report.totals.turns++;report.totals.inputTokens+=u.input_tokens||0;report.totals.cachedTokens+=u.cached_input_tokens||0;report.totals.outputTokens+=u.output_tokens||0}
 const codes=[];
 if(["command_timeout","stopped","run_budget","output_budget"].includes(reason))codes.push(reason);
 if(phase==="repair"&&changed===false)codes.push("no_progress");
 if((u.input_tokens||0)>1000000||bytes>500000)codes.push("context_pressure");
 if(phase==="gate"&&reason==="failed")codes.push("gate_failed");
 if(phase==="gate"&&reason==="regression_failed")codes.push("regression_failed");
 for(const code of codes){
   const key=code;const e=report.issues[key]??{count:0,examples:[]};e.count++;e.lastTask=task;
   if(log&&!e.examples.includes(log))e.examples=[...e.examples,log].slice(-3);
   report.issues[key]=e;
 }
 report.recent=[...report.recent,{task,phase,reason,changed,log,usage,bytes}].slice(-LIMITS.history);
 report.adaptive={studyBatch:report.issues.context_pressure||report.issues.no_progress?.count>=2?1:LIMITS.studyBatch,gateTailBytes:report.issues.context_pressure?1200:2400};
 const proposals={context_pressure:["batch-and-budget","Reduce study batch and log tail; compare accepted findings per input token."],no_progress:["semantic-progress","Compare accepted evidence or executable gate results instead of file churn."],regression_failed:["regression-isolation","Identify first failing historical gate and add a minimal reproduction."],command_timeout:["checkpoint-granularity","Use smaller independently saved units; keep timeout separate from semantic failure."],output_budget:["bounded-tool-output","Read targeted source ranges and persist intermediate findings."]};
 report.proposals=Object.entries(report.issues).filter(([k,v])=>proposals[k]&&(v.count>=2||k==="context_pressure")).map(([k,v])=>({id:proposals[k][0],trigger:k,observations:v.count,examples:v.examples,proposal:proposals[k][1],status:"candidate"})).slice(0,LIMITS.issues);
 return report;
}
export function brief({id,cfg,task,initial,ruleDoc,report,features=[],findings=[],schema=""}){
 validateRules(ruleDoc);
 const study=task.kind==="study";
 const core={project:id,task:{id:task.id,title:task.title,intent:task.intent,packages:task.packages,probe:task.probe,study:task.study},sources:features,paths:{protocol:cfg.protocol,plan:cfg.plan,checkpoint:cfg.checkpoint,evidence:cfg.quality?.evidence,feedback:cfg.feedbackDir},rules:ruleDoc.rules};
 const header="Execute ONE bounded task. Read only relevant ranges using the paths below; do not load entire plans, coverage, checkpoint or logs. Persist each finished finding immediately. Do not self-approve.\n"+JSON.stringify(core)+"\n"+schema;
 const tail="\nIndependent gate failure: "+clip(initial.tail,report?.adaptive?.gateTailBytes||2400)+"\nRelevant findings (bounded): "+JSON.stringify(findings.slice(0,LIMITS.findings).map(x=>({feature:x.feature,observation:clip(x.observation,480),unknowns:(x.unknowns||[]).filter(u=>u.status==="open").slice(0,2).map(u=>({question:clip(u.question,240),probe:clip(u.probe,240)}))})))+"\nRecent related outcomes: "+JSON.stringify((report?.recent||[]).filter(x=>x.task===task.id).slice(-LIMITS.history).map(({phase,reason,log})=>({phase,reason,log})));
 if(size(header)>LIMITS.promptBytes)throw Error("Task brief exceeds context budget; split task");
 return header+clip(tail,LIMITS.promptBytes-size(header));
}
export function readUsage(line){try{const x=JSON.parse(line);if(x.type==="turn.completed"&&x.usage)return x.usage}catch{}return null}
export const ruleDigest=digest;
