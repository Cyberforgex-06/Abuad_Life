require('dotenv').config();
const express=require('express');
const cors=require('cors');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {neon}=require('@neondatabase/serverless');
const {WebSocketServer}=require('ws');
const http=require('http');
const crypto=require('crypto');
const path=require('path');

const PORT=process.env.PORT||3000;
const DATABASE_URL=process.env.DATABASE_URL;
const JWT_SECRET=process.env.JWT_SECRET || (process.env.NODE_ENV==='production' ? '' : crypto.randomBytes(48).toString('hex'));
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured');
if(!DATABASE_URL){console.warn('DATABASE_URL is not set; API will fail database calls.');}
const sql=DATABASE_URL?neon(DATABASE_URL):async()=>{throw new Error('DATABASE_URL missing')};
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
const allowedOrigins=(process.env.ALLOWED_ORIGINS||'http://localhost:3000,https://abuad-life.onrender.com').split(',');
app.use(cors({origin(origin,cb){cb(null,!origin||allowedOrigins.includes(origin))}}));
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');next()});
const attempts=new Map();
app.use('/api', (req,res,next)=>{const key=req.ip+':'+(req.path.startsWith('/auth')?'auth':'api');const now=Date.now();let r=attempts.get(key);if(!r||r.until<now){r={count:0,until:now+60000};attempts.set(key,r)}if(++r.count>(req.path.startsWith('/auth')?20:180))return res.status(429).json({error:'Too many requests. Try again in a minute.'});next()});
setInterval(()=>{for(const [k,v] of attempts)if(v.until<Date.now())attempts.delete(k)},60000).unref();
app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'dist')));

const online=new Map();
function clean(v,max=120){return String(v||'').replace(/[<>]/g,'').trim().slice(0,max)}
function publicProfile(p){return {id:p.id,username:p.username,avatar:p.avatar,bio:p.bio||'',department:p.department||'',level:p.level||'',created_at:p.created_at,last_seen:p.last_seen}}
function sign(user){return jwt.sign({id:user.id,username:user.username},JWT_SECRET,{expiresIn:'14d'})}
async function initDb(){
 await sql`create extension if not exists pgcrypto`;
 await sql`create table if not exists players(
  id uuid primary key default gen_random_uuid(),
  username text unique not null check(length(username) between 3 and 24),
  email text unique not null,
  password_hash text not null,
  avatar text not null default '🧑🏾‍🎓',
  bio text not null default '',
  department text not null default '',
  level text not null default '',
  last_seen timestamptz default now(),
  created_at timestamptz default now()
 )`;
 await sql`create table if not exists game_saves(player_id uuid primary key references players(id) on delete cascade, state jsonb not null, revision integer not null default 1, updated_at timestamptz not null default now())`;
 await sql`create table if not exists messages(
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references players(id) on delete cascade,
  room text not null default 'campus',
  body text not null check(length(body) between 1 and 500),
  created_at timestamptz default now()
 )`;
 await sql`create table if not exists direct_messages(
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references players(id) on delete cascade,
  receiver_id uuid not null references players(id) on delete cascade,
  body text not null check(length(body) between 1 and 500),
  created_at timestamptz default now()
 )`;
 await sql`create table if not exists blocks(blocker_id uuid references players(id) on delete cascade,blocked_id uuid references players(id) on delete cascade,created_at timestamptz default now(),primary key(blocker_id,blocked_id))`;
 await sql`create table if not exists reports(id uuid primary key default gen_random_uuid(),reporter_id uuid references players(id) on delete cascade,reported_id uuid references players(id) on delete cascade,reason text not null,created_at timestamptz default now())`;
 // User-authorized reset: fixed cutoff protects accounts created after the request.
 await sql`create table if not exists app_migrations(id text primary key, applied_at timestamptz not null default now())`;
 const reset=await sql`with applied as (insert into app_migrations(id) values('2026-10-19-reset-existing-players') on conflict do nothing returning id), removed as (delete from players where created_at <= '2026-10-19T18:52:45Z'::timestamptz and exists(select 1 from applied) returning id) select count(*)::int as count from removed`;
 console.log('Account reset migration removed '+(reset[0]?.count||0)+' previous profiles.');
 await sql`create index if not exists idx_messages_room_created on messages(room,created_at desc)`;
 await sql`create index if not exists idx_dm_pair_created on direct_messages(sender_id,receiver_id,created_at desc)`;
}
async function auth(req,res,next){const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';try{req.user=jwt.verify(token,JWT_SECRET);if(!await getMe(req.user.id))return res.status(401).json({error:'This account no longer exists. Please create an account.'});next()}catch(e){res.status(401).json({error:'Please sign in again.'})}}
async function getMe(id){const rows=await sql`select id,username,avatar,bio,department,level,created_at,last_seen from players where id=${id}`;return rows[0]}
app.get('/api/health',async(req,res)=>{try{await sql`select 1`;res.json({ok:true,online:online.size})}catch(e){res.status(500).json({ok:false,error:'Database unavailable'})}});
app.post('/api/auth/register',async(req,res)=>{try{const username=clean(req.body.username,24).replace(/\s+/g,'_');const email=String(req.body.email||'').toLowerCase().trim().slice(0,160);const password=String(req.body.password||'');const department=clean(req.body.department,60);const level=clean(req.body.level,30);const avatar=clean(req.body.avatar,12)||'🧑🏾‍🎓';if(!/^[a-zA-Z0-9_]{3,24}$/.test(username))return res.status(400).json({error:'Username should be 3–24 letters, numbers or underscores.'});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||(password.length<8||Buffer.byteLength(password,'utf8')>72))return res.status(400).json({error:'Use a valid email and a password of 8–72 UTF-8 bytes.'});const hash=await bcrypt.hash(password,10);const rows=await sql`insert into players(username,email,password_hash,avatar,department,level) values(${username},${email},${hash},${avatar},${department},${level}) returning id,username,avatar,bio,department,level,created_at,last_seen`;res.json({token:sign(rows[0]),profile:publicProfile(rows[0])})}catch(e){res.status(400).json({error:e.message&&e.message.includes('duplicate')?'Username or email already exists.':'Could not create account.'})}});
app.post('/api/auth/login',async(req,res)=>{try{const login=String(req.body.login||'').toLowerCase().trim();const password=String(req.body.password||'');const rows=await sql`select * from players where lower(email)=${login} or lower(username)=${login}`;const user=rows[0];if(!user||!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({error:'Incorrect login details.'});await sql`update players set last_seen=now() where id=${user.id}`;res.json({token:sign(user),profile:publicProfile(user)})}catch(e){res.status(500).json({error:'Login failed.'})}});
app.get('/api/me',auth,async(req,res)=>{res.json({profile:publicProfile(await getMe(req.user.id)),online:[...online.values()].map(publicProfile)})});
app.patch('/api/me',auth,async(req,res)=>{try{const avatar=clean(req.body.avatar,12)||'🧑🏾‍🎓',bio=clean(req.body.bio,180),department=clean(req.body.department,60),level=clean(req.body.level,30);const rows=await sql`update players set avatar=${avatar},bio=${bio},department=${department},level=${level},last_seen=now() where id=${req.user.id} returning id,username,avatar,bio,department,level,created_at,last_seen`;broadcast({type:'profile',profile:publicProfile(rows[0])});res.json({profile:publicProfile(rows[0])})}catch(e){res.status(400).json({error:'Could not update profile.'})}});
// Require the current password before removing the player's own account and data.
app.delete('/api/me',auth,async(req,res)=>{
 const rows=await sql`select password_hash from players where id=${req.user.id}`;
 if(!rows[0]||!await bcrypt.compare(String(req.body.password||''),rows[0].password_hash))return res.status(401).json({error:'Incorrect password.'});
 await sql`delete from players where id=${req.user.id}`;
 for(const ws of wss.clients)if(ws.userId===req.user.id)ws.close(4001,'Account deleted');
 online.delete(req.user.id);res.json({ok:true});
});
app.get('/api/players',auth,async(req,res)=>{const rows=await sql`select id,username,avatar,bio,department,level,created_at,last_seen from players order by last_seen desc limit 80`;res.json({players:rows.map(publicProfile),online:[...online.keys()]})});
app.get('/api/messages',auth,async(req,res)=>{const room=clean(req.query.room||'campus',40)||'campus';const rows=await sql`select m.id,m.body,m.room,m.created_at,p.id as sender_id,p.username,p.avatar,p.department from messages m join players p on p.id=m.sender_id where m.room=${room} and not exists(select 1 from blocks b where (b.blocker_id=${req.user.id} and b.blocked_id=m.sender_id) or (b.blocked_id=${req.user.id} and b.blocker_id=m.sender_id)) order by m.created_at desc limit 60`;res.json({messages:rows.reverse()})});
app.post('/api/messages',auth,async(req,res)=>{try{const body=clean(req.body.body,500),room=clean(req.body.room||'campus',40)||'campus';if(!body)return res.status(400).json({error:'Message cannot be empty.'});const rows=await sql`insert into messages(sender_id,room,body) values(${req.user.id},${room},${body}) returning id,room,body,created_at`;const me=await getMe(req.user.id);const msg={...rows[0],sender_id:me.id,username:me.username,avatar:me.avatar,department:me.department};await broadcastMessage({type:'message',message:msg,room},me.id);res.json({message:msg})}catch(e){res.status(400).json({error:'Could not send message.'})}});
app.get('/api/dm/:playerId',auth,async(req,res)=>{const other=req.params.playerId;const blocked=await isBlocked(req.user.id,other);if(blocked)return res.status(403).json({error:'Conversation unavailable.'});const rows=await sql`select d.id,d.body,d.sender_id,d.receiver_id,d.created_at,p.username,p.avatar from direct_messages d join players p on p.id=d.sender_id where (sender_id=${req.user.id} and receiver_id=${other}) or (sender_id=${other} and receiver_id=${req.user.id}) order by d.created_at desc limit 60`;res.json({messages:rows.reverse()})});
app.post('/api/dm/:playerId',auth,async(req,res)=>{try{const other=req.params.playerId,body=clean(req.body.body,500);if(!body)return res.status(400).json({error:'Message cannot be empty.'});if(await isBlocked(req.user.id,other))return res.status(403).json({error:'Conversation unavailable.'});const rows=await sql`insert into direct_messages(sender_id,receiver_id,body) values(${req.user.id},${other},${body}) returning id,body,sender_id,receiver_id,created_at`;const me=await getMe(req.user.id);const msg={...rows[0],username:me.username,avatar:me.avatar};sendTo(other,{type:'dm',message:msg});sendTo(req.user.id,{type:'dm',message:msg});res.json({message:msg})}catch(e){res.status(400).json({error:'Could not send DM.'})}});
app.post('/api/block/:playerId',auth,async(req,res)=>{await sql`insert into blocks(blocker_id,blocked_id) values(${req.user.id},${req.params.playerId}) on conflict do nothing`;res.json({ok:true})});
app.post('/api/report/:playerId',auth,async(req,res)=>{const reason=clean(req.body.reason,300)||'No reason supplied';await sql`insert into reports(reporter_id,reported_id,reason) values(${req.user.id},${req.params.playerId},${reason})`;res.json({ok:true})});
async function isBlocked(a,b){const r=await sql`select 1 from blocks where (blocker_id=${a} and blocked_id=${b}) or (blocker_id=${b} and blocked_id=${a}) limit 1`;return !!r[0]}
// Optimistic concurrency prevents one device silently replacing another device's save.
const {validSave}=require('./save-validation');
app.get('/api/save',auth,async(req,res)=>{const rows=await sql`select state,revision,updated_at from game_saves where player_id=${req.user.id}`;res.json({save:rows[0]||null})});
app.put('/api/save',auth,async(req,res)=>{
 const {state,revision}=req.body;
 if(!validSave(state)||!Number.isInteger(revision)||revision<0)return res.status(400).json({error:'Invalid game save.'});
 let rows;
 if(revision===0) rows=await sql`insert into game_saves(player_id,state) values(${req.user.id},${JSON.stringify(state)}::jsonb) on conflict do nothing returning revision,updated_at`;
 else rows=await sql`update game_saves set state=${JSON.stringify(state)}::jsonb,revision=revision+1,updated_at=now() where player_id=${req.user.id} and revision=${revision} returning revision,updated_at`;
 if(!rows.length)return res.status(409).json({error:'Another device saved newer progress. Load the cloud save before saving again.'});
 res.json(rows[0]);
});
app.delete('/api/block/:playerId',auth,async(req,res)=>{await sql`delete from blocks where blocker_id=${req.user.id} and blocked_id=${req.params.playerId}`;res.json({ok:true})});
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
app.use((err,req,res,next)=>{res.status(err.status===413?413:500).json({error:err.status===413?'Request too large.':'Request could not be completed.'})});
app.get('/{*splat}',(req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')));
const server=http.createServer(app);const wss=new WebSocketServer({server,path:'/ws'});
async function broadcastMessage(payload,sender){const blocks=await sql`select blocker_id,blocked_id from blocks where blocker_id=${sender} or blocked_id=${sender}`;const excluded=new Set(blocks.map(b=>b.blocker_id===sender?b.blocked_id:b.blocker_id));for(const ws of wss.clients)if(ws.userId&&!excluded.has(ws.userId)&&ws.readyState===1)ws.send(JSON.stringify(payload))}
function broadcast(payload){const msg=JSON.stringify(payload);for(const ws of wss.clients){if(ws.userId&&ws.readyState===1)ws.send(msg)}}
function sendTo(userId,payload){const msg=JSON.stringify(payload);for(const ws of wss.clients){if(ws.userId===userId&&ws.readyState===1)ws.send(msg)}}
wss.on('connection',(ws,req)=>{try{const url=new URL(req.url,'http://localhost');const token=url.searchParams.get('token');const user=jwt.verify(token,JWT_SECRET);ws.expiry=setTimeout(()=>ws.close(4001,'Session expired'),Math.max(0,user.exp*1000-Date.now()));ws.pingId=crypto.randomUUID();getMe(user.id).then(p=>{if(!p){ws.close(4001,'Account unavailable');return}if(ws.readyState===1){ws.userId=user.id;online.set(user.id,p);broadcast({type:'online',online:[...online.values()].map(publicProfile)})}}).catch(()=>ws.close());ws.on('close',()=>{clearTimeout(ws.expiry);let still=false;for(const c of wss.clients){if(c!==ws&&c.userId===ws.userId&&c.readyState===1)still=true}if(!still){online.delete(ws.userId);sql`update players set last_seen=now() where id=${ws.userId}`.catch(()=>{});broadcast({type:'online',online:[...online.values()].map(publicProfile)})}})}catch(e){ws.close()}});
initDb().then(()=>server.listen(PORT,()=>console.log('Abuad Life social API on '+PORT))).catch(e=>{console.error('Database initialization failed. Check DATABASE_URL configuration.');process.exitCode=1});
