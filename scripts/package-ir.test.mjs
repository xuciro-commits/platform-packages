import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile} from './package-ir.mjs';
const ir=JSON.parse(fs.readFileSync(new URL('../docs/erpnext/ir/purchase-requisition.json',import.meta.url)));
test('deterministic preview preserves guard and permissions',()=>{
 const r=compile(ir);assert.deepEqual(r,compile(ir));assert.equal(Object.keys(r.files).length,4);
 const o=JSON.parse(r.files['objects/requisition/object.yaml']);assert.equal(o.constraints[0].expr,'quantity > 0');
 const a=JSON.parse(r.files['objects/requisition/actions/approve.yaml']);assert.deepEqual(a.roles,['manager']);assert.equal(a.transaction.guard,"material.state = 'active'");assert.equal(a.transaction.steps[0].set.state,"'approved'");assert.ok(r.unresolved.length);
});
test('reject unsupported fields, predicates, roles and states',()=>{
 for(const mutate of [x=>x.entity.fields.quantity.unknown=true,x=>x.entity.rules[0].predicate.op='eval',x=>x.entity.transitions[0].to='bad',x=>x.entity.transitions[0].roles=['admin'],x=>x.entity.rules[1].id='orphan']){const x=structuredClone(ir);mutate(x);assert.throws(()=>compile(x))}
});
