import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {targetURL,createEvent,prepare,acknowledge,draftJS} from "./package-loop-safari.mjs";
const target="https://chatgpt.com/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
test("exact target and reject wrong origins / generic pages",()=>{assert.equal(targetURL(target),target);for(const url of ["https://example.com/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee","https://chatgpt.com/","https://chatgpt.com.evil.test/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",target+"?x=1"])assert.throws(()=>targetURL(url))});
test("semantic dedup and single unresolved event",()=>{const s={events:{}},a=createEvent({project:"demo",target,task:"A",fingerprint:"v1"});assert.equal(prepare(s,a),a);assert.equal(prepare(s,createEvent({project:"demo",target,task:"A",fingerprint:"v1"})).id,a.id);assert.throws(()=>prepare(s,createEvent({project:"demo",target,task:"A",fingerprint:"v2"})));assert.throws(()=>acknowledge(a));a.status="drafted";acknowledge(a);assert.equal(a.status,"acknowledged");assert.equal(acknowledge(a),a);assert.doesNotThrow(()=>prepare(s,createEvent({project:"demo",target,task:"A",fingerprint:"v2"})))});
test("DOM adapter fills only exact target, preserves existing draft, no submit",()=>{const event=createEvent({project:"demo",target,kind:"bridge.test"});const e={textContent:"",isContentEditable:true,getClientRects:()=>[{}],focus(){}};let inserts=0;
 const doc={querySelectorAll:()=>[e],execCommand:(cmd,_flag,text)=>{assert.equal(cmd,"insertText");e.textContent=text;inserts++}};
 const run=href=>vm.runInNewContext(draftJS(target,event.message),{location:{href},document:doc});
 assert.equal(run("https://chatgpt.com/"),"wrong_page");assert.equal(inserts,0);e.textContent="my existing text";assert.equal(run(target),"editor_occupied");assert.equal(inserts,0);
 e.textContent="";assert.equal(run(target),"drafted");assert.equal(e.textContent,event.message);assert.equal(run(target),"already_drafted");assert.equal(inserts,1);
 doc.querySelectorAll=()=>[e,e];assert.equal(run(target),"editor_unavailable");
});

test("automatic handoff uses stable task identity and a distinct test nonce",()=>{const a=createEvent({project:"demo",target,task:"A",fingerprint:"v1"}),b=createEvent({project:"demo",target,task:"A",fingerprint:"v1",handoff:true});assert.equal(a.id,b.id);assert.ok(b.message.includes("package-loop-handoff.mjs finish --project demo --event "+b.id));assert.ok(!a.message.includes("package-loop-handoff.mjs"));const t=createEvent({project:"demo",target,kind:"bridge.test"}),u=createEvent({project:"demo",target,kind:"bridge.test",fingerprint:"handoff:"+t.id});assert.notEqual(t.id,u.id);assert.ok(u.message.includes("不要执行其他任务"));assert.ok(!u.message.includes("package-loop-handoff.mjs"));});
