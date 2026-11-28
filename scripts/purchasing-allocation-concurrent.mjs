// Run a focused concurrent test against a temporary archive of the pinned Platform.
// No Platform working-tree edits and no second Package source root.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const platform=path.resolve(root,"../platform");
const pin=fs.readFileSync(path.join(root,"platform.lock"),"utf8").trim();
if(!/^[0-9a-f]{40}$/.test(pin))throw Error("requires exact Platform commit pin");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"package-alloc-race-"));
try{
 const archive=path.join(tmp,"src.tar");
 execFileSync("git",["-C",platform,"archive","--format=tar","-o",archive,pin],{stdio:"inherit",timeout:30000});
 execFileSync("tar",["-xf",archive,"-C",tmp],{stdio:"inherit",timeout:30000});
 fs.copyFileSync(path.join(root,"scripts/testdata/purchasing-allocation-concurrent.go"),path.join(tmp,"capabilities/server/cmd/pkg/zz_package_allocation_test.go"));
 execFileSync("go",["test","-count=1","-v","-run","^TestPurchasingConcurrentAllocation$","./cmd/pkg"],{cwd:path.join(tmp,"capabilities/server"),env:{...process.env,PACKAGE_PROBE_ROOT:root},stdio:"inherit",timeout:180000});
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
