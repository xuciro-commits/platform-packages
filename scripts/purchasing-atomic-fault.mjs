// Isolated fault injection for the purchasing conversion. Never changes canonical sources.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const pkg=process.argv[2]??process.env.PACKAGE_LOOP_PKG;
if(!pkg||!path.isAbsolute(pkg))throw Error("usage: node scripts/purchasing-atomic-fault.mjs /absolute/path/to/locked/pkg");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"purchasing-atomic-fault-"));
try{
 const names=["geo","party","uom","item-master","purchasing"];
 for(const name of names)fs.cpSync(path.join(root,"packages",name),path.join(tmp,name),{recursive:true});
 const target=path.join(tmp,"purchasing/objects/quotation/actions/makeorder.yaml");
 const v=fs.readFileSync(target,"utf8");
 const anchor="    - target: $subject\n      set: {draftorder: step.po, draftorderline: step.line}";
 const i=v.indexOf("    - name: line\n"),j=v.indexOf(anchor);
 if(i<0||j<i)throw Error("conversion action changed; review fault injection");
 const duplicate=v.slice(i,j).replace("    - name: line\n","    - name: faultline\n").replace("      target: purchasing.orderline\n","      target: purchasing.orderline\n      when: input.title = 'Rollback probe'\n").replace("        quantity: input.quantity\n","        quantity: \"1\"\n");
 fs.writeFileSync(target,v.replace(anchor,duplicate+anchor));
 execFileSync(pkg,["lock",path.join(tmp,"purchasing")],{cwd:root,stdio:"inherit",timeout:20000});
 const probe=fs.readFileSync(path.join(root,"docs/erpnext/probes/purchasing-atomic-order.yaml"),"utf8");
 const needle="  - {do: purchasing.quotation.makeorder, on: purchasing.quotation/Q1, as: buyer, with: {title: Generated PO";
 const idx=probe.indexOf(needle);
 if(idx<0)throw Error("probe changed");
 const test=path.join(tmp,"rollback.yaml");
 fs.writeFileSync(test,probe.slice(0,idx)+'  - {do: purchasing.quotation.makeorder, on: purchasing.quotation/Q1, as: buyer, with: {title: Rollback probe, quantity: 8, expectedon: "2026-12-15"}, refused: true}\n'+probe.slice(idx));
 const out=execFileSync(pkg,["try","-script",test,...names.map(n=>path.join(tmp,n))],{cwd:root,encoding:"utf8",timeout:180000,maxBuffer:16*1024*1024});
 process.stdout.write(out);
 if(!out.includes("31 steps passed")||!/22\. purchasing\.quotation\.makeorder[^\n]*\n\s*refused as expected:[^\n]*Constraint sourceidentity: This quotation already has an order line\./.test(out))throw Error("expected fault and successful retry not proven");
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
