import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkDocument} from './package-field-audit.mjs';
const src={fields:[{fieldname:'qty',fieldtype:'Float',reqd:1}],permissions:[{role:'Buyer'}]};
const d={source:'fixture',fields:[{ordinal:1,name:'qty',type:'Float',required:true,readOnly:false,hidden:false,status:'partial',target:'order.qty',semanticVerified:false,browserVerified:false}],permissions:[{ordinal:1,role:'Buyer'}]};
test('reject omitted fields, lost permissions and unsupported acceptance claim',()=>{assert.equal(checkDocument(d,src),1);for(const m of [x=>x.fields.pop(),x=>x.permissions.pop(),x=>x.fields[0].semanticVerified=true,x=>x.fields[0].target=null]){const x=structuredClone(d);m(x);assert.throws(()=>checkDocument(x,src));}});

test('reviewed fields require exact source traits, dispositions and permission grants',()=>{const x=structuredClone(d);x.reviewed=true;x.fields[0].note='partial';x.fields[0].sourceTraits={options:null,default:null,unique:false,dependsOn:null,allowOnSubmit:false};x.permissions[0].note='partial';x.permissions[0].status='reviewed_partial';x.permissions[0].sourcePermLevel=0;x.permissions[0].sourceGrants={};x.operations=[];assert.equal(checkDocument(x,src),1);for(const mutate of [v=>delete v.fields[0].note,v=>v.fields[0].sourceTraits.unique=true,v=>v.permissions[0].sourcePermLevel=1,v=>v.operations.push({status:'unreviewed'})]){const y=structuredClone(x);mutate(y);assert.throws(()=>checkDocument(y,src))}});
