const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {validSave}=require('../save-validation');
const save={version:1,name:'Test',course:'Law',day:1,hour:8,friends:[],logs:[],actions:[],daily:{},money:1,energy:1,hunger:1,mood:1,social:1,knowledge:1,skills:1};
assert(validSave(save));assert(!validSave({...save,money:-1}));assert(!validSave({...save,day:29}));assert(!validSave({...save,logs:'bad'}));
const child=spawn(process.execPath,['-e',`
process.env.PORT='3219';process.env.JWT_SECRET='runtime-test-secret';process.env.DATABASE_URL='https://example.invalid';
const neon=require('@neondatabase/serverless');let saved=null;
require.cache[require.resolve('@neondatabase/serverless')].exports={neon:()=>async(strings,...values)=>{const q=strings.join('?');
if(q.startsWith('select state,revision'))return saved?[saved]:[];
if(q.startsWith('insert into game_saves')){if(saved)return [];saved={state:JSON.parse(values[1]),revision:1};return [{revision:1}]}
if(q.startsWith('update game_saves')){if(!saved||saved.revision!==values[2])return [];saved={state:JSON.parse(values[0]),revision:saved.revision+1};return [{revision:saved.revision}]}
return []}};require('./server');
`],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
let err='';child.stderr.on('data',d=>err+=d);
(async()=>{try{
await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(d.toString().includes('social API'))resolve()});child.on('exit',()=>reject(Error(err)));setTimeout(()=>reject(Error('Startup timeout '+err)),5000).unref()});
const token=require('jsonwebtoken').sign({id:'11111111-1111-4111-8111-111111111111'},'runtime-test-secret');
const request=(path,opt={})=>fetch('http://localhost:3219'+path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...opt.headers}});
assert.equal((await request('/')).status,200);
assert.equal((await request('/api/save',{headers:{Authorization:''}})).status,401);
assert.deepEqual(await (await request('/api/save')).json(),{save:null});
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:{},revision:0})})).status,400);
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:save,revision:0})})).status,200);
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:save,revision:0})})).status,409);
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:save,revision:1})})).status,200);
assert.equal((await (await request('/api/save')).json()).save.revision,2);
assert.equal((await request('/api/missing')).status,404);
const cors=await request('/api/health',{headers:{Origin:'https://evil.example'}});assert.equal(cors.headers.get('access-control-allow-origin'),null);
console.log('Passed: real HTTP startup, auth gate, cloud validation, save/load, stale revision rejection, API 404 and CORS. Database adapter mocked.');
}catch(e){console.error(e);process.exitCode=1}finally{child.kill()}})();
