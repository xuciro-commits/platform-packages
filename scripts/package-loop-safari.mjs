#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const hash=s=>createHash("sha256").update(s).digest("hex");
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const now=()=>new Date().toISOString();
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,j)=>{const t=p+".tmp-"+randomUUID();fs.writeFileSync(t,JSON.stringify(j,null,2)+"\n",{mode:0o600});fs.renameSync(t,p)};
export function targetURL(value){
 const u=new URL(value);
 if(u.origin!=="https://chatgpt.com"||!/^\/c\/[0-9a-f-]{36}$/i.test(u.pathname)||u.search||u.hash||u.username||u.password)throw Error("Require exact HTTPS ChatGPT conversation URL");
 return u.href;
}
export function createEvent({project,target,task=null,fingerprint=null,kind="task.ready",handoff=false}){
 if(!idPattern.test(project)||!["task.ready","bridge.test"].includes(kind))throw Error("Invalid event");
 target=targetURL(target);
 if(kind==="task.ready"&&(!idPattern.test(task||"")||typeof fingerprint!=="string"||!fingerprint))throw Error("Missing task identity or semantic progress fingerprint");
 const id="PL-"+hash(JSON.stringify([project,target,kind,task,fingerprint])).slice(0,16);
 const command="node ../platform-packages/scripts/package-loop-safari.mjs ack --project "+project+" --event "+id;
 const finish="node ../platform-packages/scripts/package-loop-handoff.mjs finish --project "+project+" --event "+id;
 const message=kind==="bridge.test"
   ?"PackageLoop Safari 单次桥接测试 "+id+"。请通过 platform-shell 执行 "+command+"，仅记录回执；随后回复「收到 "+id+"」，不要执行其他任务。"
   :"PackageLoop 任务反馈 "+id+"（"+project+" / "+task+"）。请先通过 platform-shell 执行 "+command+" 记录回执，再读取该项目 .package-loop/"+project+"/next-task.md，仅处理当前有界任务并执行独立验收。不要调用其他智能体。"+(handoff?"完成本轮（包括阻塞）后，最后一次工具调用执行 "+finish+"，随后立即输出简洁结果；不要自己操作浏览器或发送下一条消息。":"不要自行触发下一条消息。");
 return {version:1,id,project,target,kind,task,fingerprint,message,status:"prepared",createdAt:now()};
}
export function prepare(store,event){
 const existing=store.events[event.id];
 if(existing)return existing;
 if(Object.values(store.events).some(e=>["prepared","drafting","drafted","uncertain"].includes(e.status)))throw Error("An unresolved event already exists; acknowledge or cancel explicitly");
 store.events[event.id]=event;return event;
}
export function acknowledge(event){
 if(event.status==="acknowledged")return event;
 if(event.status!=="drafted")throw Error("Only a confirmed draft may be acknowledged");
 event.status="acknowledged";event.acknowledgedAt=now();return event;
}
export function draftJS(target,message){
 // Only inspect and write the composer. Never inspect model output, credentials, storage or network.
 return "(()=>{const expected="+JSON.stringify(target)+";const message="+JSON.stringify(message)+";if(location.href!==expected)return 'wrong_page';const matches=[...document.querySelectorAll('[role=\"textbox\"][aria-label=\"Ask ChatGPT\"],#prompt-textarea')].filter(e=>e.isContentEditable&&e.getClientRects().length);if(matches.length!==1)return 'editor_unavailable';const e=matches[0];if(e.textContent.trim()===message)return 'already_drafted';if(e.textContent.trim())return 'editor_occupied';e.focus();document.execCommand('insertText',false,message);return e.textContent.trim()===message?'drafted':'uncertain'})()";
}
const appleString=s=>JSON.stringify(s); // strings here are URL / JSON-escaped single-line JS
function runApple(script){return execFileSync("/usr/bin/osascript",["-e",script],{encoding:"utf8",timeout:10000}).trim()}
export function validatePinnedTarget(config,target){
 target=targetURL(target);
 if(!config||!Number.isSafeInteger(config.windowId)||config.windowId<1||!Number.isSafeInteger(config.tabIndex)||config.tabIndex<1||config.url!==target)throw Error("Require saved exact Safari window and tab; do not select by URL alone");
 return {windowId:config.windowId,tabIndex:config.tabIndex,url:target};
}
function pinned(target){return validatePinnedTarget(read(path.join(root,".package-loop","safari-chat-target.json")),target)}
function pinnedApple(t,body){
 return ['tell application "Safari"','if not (exists window id '+t.windowId+') then return "wrong_page"','set w to window id '+t.windowId,'if (count of tabs of w) < '+t.tabIndex+' then return "wrong_page"','set t to tab '+t.tabIndex+' of w','if URL of t is not '+appleString(t.url)+' then return "wrong_page"',...body,'end tell'].join("\n");
}
export function openConversation(target){
 const t=pinned(target);
 const result=runApple(pinnedApple(t,['set current tab of w to t','set index of w to 1','activate','return "opened"']));
 if(result!=="opened")throw Error("Pinned Safari tab moved or unavailable; refusing other matching tabs");
 return result;
}
export function safariDraft(event){
 const t=pinned(event.target),js=draftJS(t.url,event.message);
 return runApple(pinnedApple(t,['return do JavaScript '+appleString(js)+' in t']));
}
function main(){
 const args=process.argv.slice(2),mode=args[0]||"status";
 const opt=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
 const project=opt("--project");if(!project||!idPattern.test(project))throw Error("Specify --project <id>");
 if(!["status","prepare","test","draft","ack","cancel"].includes(mode))throw Error("Use status|prepare|test|draft|ack|cancel; there is intentionally no send mode");
 const dir=path.join(root,".package-loop",project),p=path.join(dir,"safari-bridge.json"),lock=p+".lock";
 if(!fs.existsSync(path.join(root,"loop/projects",project+".json")))throw Error("Unknown project");
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 let fd;
 try{fd=fs.openSync(lock,"wx",0o600)}catch{throw Error("Bridge locked; inspect lock before recovery")}
 try{
  fs.writeSync(fd,JSON.stringify({pid:process.pid,at:now()}));fs.closeSync(fd);fd=null;
  const store=fs.existsSync(p)?read(p):{version:1,events:{}};
  if(store.version!==1||!store.events)throw Error("Invalid bridge store");
  if(mode==="status"){console.log(JSON.stringify(store,null,2));return}
  if(mode==="prepare"||mode==="test"){
   const target=targetURL(opt("--target"));
   if(fs.existsSync(path.join(root,".package-loop","lock")))throw Error("Loop is running; wait for stable state");
   let task=null,fingerprint=null;
   if(mode==="test"&&opt("--nonce"))fingerprint="handoff:"+opt("--nonce");
   if(mode==="prepare"){
    const state=read(path.join(dir,"state.json"));
    if(state.status!=="awaiting_work"||!state.current||!state.lastRepair?.fingerprint)throw Error("No stable work item");
    task=state.current;fingerprint=state.lastRepair.fingerprint;
   }
   const e=prepare(store,createEvent({project,target,task,fingerprint,kind:mode==="test"?"bridge.test":"task.ready",handoff:args.includes("--handoff")}));
   save(p,store);console.log(JSON.stringify(e,null,2));return;
  }
  const id=opt("--event"),e=store.events[id];
  if(!e)throw Error("Unknown event");
  if(mode==="ack"){acknowledge(e);save(p,store);console.log(JSON.stringify({id:e.id,status:e.status,acknowledgedAt:e.acknowledgedAt}));return}
  if(mode==="cancel"){
   if(!["prepared","drafted","uncertain","drafting"].includes(e.status))throw Error("Cannot cancel this event");
   e.status="cancelled";e.cancelledAt=now();save(p,store);console.log(JSON.stringify({id:e.id,status:e.status,note:"Existing browser draft is not removed automatically"}));return;
  }
  if(e.status==="drafted"||e.status==="acknowledged"){console.log(JSON.stringify({id:e.id,status:e.status,note:"No duplicate draft"}));return}
  if(e.status!=="prepared")throw Error("Uncertain or cancelled event; inspect manually, no retry");
  if(fs.existsSync(path.join(root,".package-loop","lock")))throw Error("Loop running");
  if(e.kind==="task.ready"){
   const state=read(path.join(dir,"state.json"));
   if(state.status!=="awaiting_work"||state.current!==e.task||state.lastRepair?.fingerprint!==e.fingerprint)throw Error("Stale task event");
  }
  e.status="drafting";e.draftStartedAt=now();save(p,store);
  try{
   openConversation(e.target);
   // Bounded readiness retry; no clicking send, no polling after this command.
   let result="editor_unavailable";
   for(let i=0;i<6;i++){
    result=safariDraft(e);
    if(!["editor_unavailable","wrong_page"].includes(result))break;
    if(i<5)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,450);
   }
   e.draftResult=result;
   e.status=["drafted","already_drafted"].includes(result)?"drafted":result==="uncertain"?"uncertain":"prepared";
   if(e.status==="drafted")e.draftedAt=now();
   save(p,store);console.log(JSON.stringify({id:e.id,status:e.status,result,manualSendRequired:true}));
   if(e.status!=="drafted")process.exitCode=1;
  }catch(err){e.status="uncertain";e.error=String(err.message).slice(0,300);save(p,store);throw err}
 }finally{if(fd!==null&&fd!==undefined)fs.closeSync(fd);fs.unlinkSync(lock)}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{main()}catch(e){console.error(e.message);process.exitCode=1}
