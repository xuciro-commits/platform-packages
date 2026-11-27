import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verify} from './package-navigation.mjs';
const fixture=()=>({
 c:{package:'demo',module:'demo',entries:[{reference:'Dashboard',kind:'page',implementation:'dashboard',target:'dashboard'},{reference:'Reports',kind:'group'},{reference:'Missing',kind:'page',implementation:'pending',target:'demo.missing'}],additional:[],groups:[{title:'Overview',pages:[]},{title:'Reports',pages:['demo.missing']},{title:'Additional operations',pages:[]}]},
 raw:[{label:'Dashboard',type:'Link'},{label:'Reports',type:'Section Break'},{label:'Missing',type:'Link'}],
 a:{blueprint:{assets:[{ref:{kind:'app',name:'demo'},body:{pages:['demo.missing'],groups:[{title:'Overview',pages:[]},{title:'Reports',pages:['demo.missing']},{title:'Additional operations',pages:[]}],dashboard:[{}]}},{ref:{kind:'object',name:'demo.navpending'},body:{access:[{role:'user',read:'all'}]}},{ref:{kind:'page',name:'demo.missing'},body:{title:'[Pending] Missing',description:'Not implemented: missing',object:{name:'demo.navpending'},actionTriggers:[]}}]}}
});
test('source links, folded groups and explicit placeholders counted separately',()=>{const {c,raw,a}=fixture();assert.deepEqual(verify(c,raw,a),{module:'demo',links:2,groups:1,placeholders:1,additional:0,browserVerified:false})});
test('reject dropped links, lost group members, writable placeholder and false completion',()=>{for(const m of [x=>x.raw.push({label:'Extra',type:'Link'}),x=>x.a.blueprint.assets[0].body.groups[1].pages.pop(),x=>x.a.blueprint.assets[1].body.access[0].create=true,x=>x.a.blueprint.assets[2].body.title='Missing',x=>x.c.entries[2].implementation='partial']){const x=fixture();m(x);assert.throws(()=>verify(x.c,x.raw,x.a))}});

test('supplemental screenshot entries cannot disappear',()=>{const {c,raw,a}=fixture();c.supplemental=[{reference:'Extra',kind:'page',group:'Reports',target:'demo.extra',implementation:'pending'}];c.groups[1].pages.push('demo.extra');a.blueprint.assets[0].body.groups[1].pages.push('demo.extra');a.blueprint.assets[0].body.pages.push('demo.extra');a.blueprint.assets.push({ref:{kind:'page',name:'demo.extra'},body:{title:'[Pending] Extra',description:'Not implemented: extra',object:{name:'demo.navpending'},actionTriggers:[]}});assert.equal(verify(c,raw,a).supplemental,1);a.blueprint.assets.pop();assert.throws(()=>verify(c,raw,a));});
