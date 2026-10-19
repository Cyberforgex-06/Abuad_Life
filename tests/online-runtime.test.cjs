const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const {validSave}=require('../save-validation');
const save={version:1,name:'Test',course:'Law',day:1,hour:8,friends:[],logs:[],actions:[],daily:{},money:1,energy:1,hunger:1,mood:1,social:1,knowledge:1,skills:1};
assert(validSave(save));assert(!validSave({...save,money:-1}));assert(!validSave({...save,day:29}));
const child=spawn(process.execPath,['-e',`
process.env.PORT='3219';process.env.NODE_ENV='production';process.env.DATABASE_URL='https://example.invalid';process.env.APP_ORIGIN='http://localhost:3219';
require('@neondatabase/serverless');let saved=null;const sessions=new Map();
require.cache[require.resolve('@neondatabase/serverless')].exports={neon:()=>async(strings,...values)=>{const q=strings.join('?');
if(q.startsWith('insert into player_sessions')){sessions.set(values[0],{id:values[1],token_hash:values[0],expires_at:new Date(Date.now()+100000)});return []}
if(q.startsWith('select s.token_hash'))return sessions.has(values[0])?[sessions.get(values[0])]:[];
if(q.startsWith('delete from player_sessions where token_hash')){sessions.delete(values[0]);return []}
if(q.startsWith('insert into players('))return [{id:'11111111-1111-4111-8111-111111111111',username:values[0]}];
if(q.startsWith('select id,username'))return [{id:values[0],username:'runtime_test'}];
if(q.startsWith('select state,revision'))return saved?[saved]:[];
if(q.startsWith('insert into game_saves')){if(saved)return [];saved={state:JSON.parse(values[1]),revision:1};return [{revision:1}]}
if(q.startsWith('update game_saves')){if(!saved||saved.revision!==values[2])return [];saved={state:JSON.parse(values[0]),revision:saved.revision+1};return [{revision:saved.revision}]}
return []}};require('./server');
`],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
let err='';child.stderr.on('data',d=>err+=d);
(async()=>{try{
await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(d.toString().includes('social API'))resolve()});child.on('exit',()=>reject(Error(err)));setTimeout(()=>reject(Error('Startup timeout '+err)),5000).unref()});
let cookie='';const request=(path,opt={})=>fetch('http://localhost:3219'+path,{...opt,headers:{'Content-Type':'application/json','X-Abuad-Request':'1',Cookie:cookie,...opt.headers}});
assert.equal((await request('/api/save')).status,401);
const reg=await request('/api/auth/register',{method:'POST',body:JSON.stringify({username:'runtime_test',email:'test@example.invalid',password:'Secure-test-password'})});assert.equal(reg.status,200);assert.equal((await reg.json()).token,undefined);
const setCookie=reg.headers.get('set-cookie');for(const flag of ['__Host-abuad_session','HttpOnly','Secure','SameSite=Lax','Path=/'])assert(setCookie.includes(flag));assert(!setCookie.includes('Domain='));cookie=setCookie.split(';')[0];
assert.equal((await request('/api/me')).status,200);
assert.equal((await request('/api/save',{headers:{Cookie:'',Authorization:'Bearer oldtoken'}})).status,401);
assert.equal((await request('/api/save',{method:'PUT',headers:{Origin:'https://evil.example'},body:JSON.stringify({state:save,revision:0})})).status,403);
assert.equal((await request('/api/save',{method:'PUT',headers:{'X-Abuad-Request':''},body:JSON.stringify({state:save,revision:0})})).status,403);
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:save,revision:0})})).status,200);
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:save,revision:0})})).status,409);
assert.equal((await request('/api/save',{method:'PUT',body:JSON.stringify({state:save,revision:1})})).status,200);
assert.equal((await(await request('/api/save')).json()).save.revision,2);
assert.equal((await request('/api/auth/logout',{method:'POST'})).status,200);
assert.equal((await request('/api/me')).status,401);
console.log('Passed: HttpOnly/Secure/host-only cookie, no JSON token, cookie authentication, CSRF rejection, cloud save conflicts, logout revocation. Database mocked.');
}catch(e){console.error(e);process.exitCode=1}finally{child.kill()}})();
