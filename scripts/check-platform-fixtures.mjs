import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(fileURLToPath(new URL("../fixtures/platform/",import.meta.url)));
const manifest=JSON.parse(readFileSync(join(root,"manifest.json"),"utf8"));
if(manifest.version!==1||!/^[0-9a-f]{40}$/.test(manifest.source?.commit)||!Array.isArray(manifest.files))throw Error("Invalid fixture manifest");
const expected=new Map();
for(const entry of manifest.files){
 if(typeof entry.path!=="string"||! /^(packages|test-packages|frontend-fixtures)\/[a-zA-Z0-9_.\/-]+$/.test(entry.path)||entry.path.split("/").some(x=>!x||x==="."||x==="..")||expected.has(entry.path)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||!/^[0-9a-f]{64}$/.test(entry.sha256))throw Error("Invalid fixture entry "+entry.path);
 expected.set(entry.path,entry);
}
let bytes=0,artifacts=0;
function walk(dir){
 for(const name of readdirSync(dir)){
  const p=join(dir,name),st=lstatSync(p),rel=relative(root,p).split(sep).join("/");
  if(st.isSymbolicLink())throw Error("Unexpected symlink "+rel);
  if(st.isDirectory()){walk(p);continue}
  if(!st.isFile())throw Error("Unexpected file "+rel);
  if(rel==="README.md"||rel==="manifest.json")continue;
  const e=expected.get(rel);
  if(!e)throw Error("Unindexed fixture "+rel);
  const data=readFileSync(p);
  if(data.length!==e.bytes||createHash("sha256").update(data).digest("hex")!==e.sha256)throw Error("Fixture digest mismatch "+rel);
  if(rel.endsWith(".json")&&!rel.endsWith("package.lock.json")){
   const j=JSON.parse(data);
   if(!j.id||!j.version||!j.blueprint)throw Error("Invalid package artifact "+rel);
   artifacts++;
  }
  bytes+=data.length;expected.delete(rel);
 }
}
walk(root);
if(expected.size)throw Error("Missing fixtures: "+[...expected.keys()].join(", "));
console.log(JSON.stringify({files:manifest.files.length,bytes,artifacts,source:manifest.source}));
