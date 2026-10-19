const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let remote=null,current=null,fail=false;const items=new Map(),events={};const status={textContent:''};
 const source=fs.readFileSync('dist/social.js','utf8').replace('const ready=()=>','window.TestCloud={initializeCloud,flushCloud,setProfile:p=>social.profile=p};const ready=()=>');
 const window={addEventListener:(k,fn)=>events[k]=fn,AbuadLifeGame:{snapshot:()=>current,restore:s=>current=JSON.parse(JSON.stringify(s)),startProfile:p=>current={name:p.username,day:1}}};
 const context={window,location:{origin:'http://test'},localStorage:{getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)},document:{readyState:'loading',addEventListener(){},querySelector:s=>s==='#saveStatus'?status:null},setTimeout:()=>1,clearTimeout(){},console,fetch:async(url,opt)=>{
  if(fail)throw Error('offline');let data;if(opt.method==='PUT'){const b=JSON.parse(opt.body);if(b.revision!==(remote?.revision||0))return {ok:false,status:409,json:async()=>({error:'Conflict'})};remote={state:b.state,revision:b.revision+1};data={revision:remote.revision}}else data={save:remote};return {ok:true,json:async()=>data};
 }};
 vm.runInNewContext(source,context);window.TestCloud.setProfile({id:'p1',username:'Student'});
 await window.TestCloud.initializeCloud();assert.equal(remote.revision,1);assert.equal(remote.state.name,'Student');assert(status.textContent.includes('Saved to your account'));
 current={name:'Student',day:2};events['abuad:save']();await window.TestCloud.flushCloud();assert.equal(remote.state.day,2);assert.equal(items.has('abuad-cloud-pending'),false);
 fail=true;current={name:'Student',day:3};events['abuad:save']();await window.TestCloud.flushCloud();assert.equal(remote.state.day,2);assert(items.has('abuad-cloud-pending'));assert(status.textContent.includes('pending'));
 fail=false;await window.TestCloud.initializeCloud();assert.equal(remote.state.day,3);assert.equal(items.has('abuad-cloud-pending'),false);
 remote.revision++;current={name:'Student',day:4};events['abuad:save']();await window.TestCloud.flushCloud();assert.equal(remote.state.day,3);assert.equal(current.day,4);assert(status.textContent.includes('conflict'));
 console.log('Passed: initial cloud save, autosave, offline pending state, recovery and concurrent-device conflict preservation.');
})().catch(e=>{console.error(e);process.exitCode=1});
