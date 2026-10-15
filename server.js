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
const JWT_SECRET=process.env.JWT_SECRET||'dev-only-change-me';
if(!DATABASE_URL){console.warn('DATABASE_URL is not set; API will fail database calls.');}
const sql=DATABASE_URL?neon(DATABASE_URL):async()=>{throw new Error('DATABASE_URL missing')};
const app=express();
app.use(cors({origin:true,credentials:false}));
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
 await sql`create index if not exists idx_messages_room_created on messages(room,created_at desc)`;
 await sql`create index if not exists idx_dm_pair_created on direct_messages(sender_id,receiver_id,created_at desc)`;
}
function auth(req,res,next){const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';try{req.user=jwt.verify(token,JWT_SECRET);next()}catch(e){res.status(401).json({error:'Please sign in again.'})}}
async function getMe(id){const rows=await sql`select id,username,avatar,bio,department,level,created_at,last_seen from players where id=${id}`;return rows[0]}
app.get('/api/health',async(req,res)=>{try{await sql`select 1`;res.json({ok:true,online:online.size})}catch(e){res.status(500).json({ok:false,error:'Database unavailable'})}});
app.post('/api/auth/register',async(req,res)=>{try{const username=clean(req.body.username,24).replace(/\s+/g,'_');const email=String(req.body.email||'').toLowerCase().trim().slice(0,160);const password=String(req.body.password||'');const department=clean(req.body.department,60);const level=clean(req.body.level,30);const avatar=clean(req.body.avatar,12)||'🧑🏾‍🎓';if(!/^[a-zA-Z0-9_]{3,24}$/.test(username))return res.status(400).json({error:'Username should be 3–24 letters, numbers or underscores.'});if(!email.includes('@')||password.length<8)return res.status(400).json({error:'Use a valid email and at least 8 password characters.'});const hash=await bcrypt.hash(password,10);const rows=await sql`insert into players(username,email,password_hash,avatar,department,level) values(${username},${email},${hash},${avatar},${department},${level}) returning id,username,avatar,bio,department,level,created_at,last_seen`;res.json({token:sign(rows[0]),profile:publicProfile(rows[0])})}catch(e){res.status(400).json({error:e.message&&e.message.includes('duplicate')?'Username or email already exists.':'Could not create account.'})}});
app.post('/api/auth/login',async(req,res)=>{try{const login=String(req.body.login||'').toLowerCase().trim();const password=String(req.body.password||'');const rows=await sql`select * from players where lower(email)=${login} or lower(username)=${login}`;const user=rows[0];if(!user||!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({error:'Incorrect login details.'});await sql`update players set last_seen=now() where id=${user.id}`;res.json({token:sign(user),profile:publicProfile(user)})}catch(e){res.status(500).json({error:'Login failed.'})}});
app.get('/api/me',auth,async(req,res)=>{res.json({profile:publicProfile(await getMe(req.user.id)),online:[...online.values()].map(publicProfile)})});
app.patch('/api/me',auth,async(req,res)=>{try{const avatar=clean(req.body.avatar,12)||'🧑🏾‍🎓',bio=clean(req.body.bio,180),department=clean(req.body.department,60),level=clean(req.body.level,30);const rows=await sql`update players set avatar=${avatar},bio=${bio},department=${department},level=${level},last_seen=now() where id=${req.user.id} returning id,username,avatar,bio,department,level,created_at,last_seen`;broadcast({type:'profile',profile:publicProfile(rows[0])});res.json({profile:publicProfile(rows[0])})}catch(e){res.status(400).json({error:'Could not update profile.'})}});
app.get('/api/players',auth,async(req,res)=>{const rows=await sql`select id,username,avatar,bio,department,level,created_at,last_seen from players order by last_seen desc limit 80`;res.json({players:rows.map(publicProfile),online:[...online.keys()]})});
app.get('/api/messages',auth,async(req,res)=>{const room=clean(req.query.room||'campus',40)||'campus';const rows=await sql`select m.id,m.body,m.room,m.created_at,p.id as sender_id,p.username,p.avatar,p.department from messages m join players p on p.id=m.sender_id where m.room=${room} order by m.created_at desc limit 60`;res.json({messages:rows.reverse()})});
app.post('/api/messages',auth,async(req,res)=>{try{const body=clean(req.body.body,500),room=clean(req.body.room||'campus',40)||'campus';if(!body)return res.status(400).json({error:'Message cannot be empty.'});const rows=await sql`insert into messages(sender_id,room,body) values(${req.user.id},${room},${body}) returning id,room,body,created_at`;const me=await getMe(req.user.id);const msg={...rows[0],sender_id:me.id,username:me.username,avatar:me.avatar,department:me.department};broadcast({type:'message',message:msg,room});res.json({message:msg})}catch(e){res.status(400).json({error:'Could not send message.'})}});
app.get('/api/dm/:playerId',auth,async(req,res)=>{const other=req.params.playerId;const blocked=await isBlocked(req.user.id,other);if(blocked)return res.status(403).json({error:'Conversation unavailable.'});const rows=await sql`select d.id,d.body,d.sender_id,d.receiver_id,d.created_at,p.username,p.avatar from direct_messages d join players p on p.id=d.sender_id where (sender_id=${req.user.id} and receiver_id=${other}) or (sender_id=${other} and receiver_id=${req.user.id}) order by d.created_at desc limit 60`;res.json({messages:rows.reverse()})});
app.post('/api/dm/:playerId',auth,async(req,res)=>{try{const other=req.params.playerId,body=clean(req.body.body,500);if(!body)return res.status(400).json({error:'Message cannot be empty.'});if(await isBlocked(req.user.id,other))return res.status(403).json({error:'Conversation unavailable.'});const rows=await sql`insert into direct_messages(sender_id,receiver_id,body) values(${req.user.id},${other},${body}) returning id,body,sender_id,receiver_id,created_at`;const me=await getMe(req.user.id);const msg={...rows[0],username:me.username,avatar:me.avatar};sendTo(other,{type:'dm',message:msg});sendTo(req.user.id,{type:'dm',message:msg});res.json({message:msg})}catch(e){res.status(400).json({error:'Could not send DM.'})}});
app.post('/api/block/:playerId',auth,async(req,res)=>{await sql`insert into blocks(blocker_id,blocked_id) values(${req.user.id},${req.params.playerId}) on conflict do nothing`;res.json({ok:true})});
app.post('/api/report/:playerId',auth,async(req,res)=>{const reason=clean(req.body.reason,300)||'No reason supplied';await sql`insert into reports(reporter_id,reported_id,reason) values(${req.user.id},${req.params.playerId},${reason})`;res.json({ok:true})});
async function isBlocked(a,b){const r=await sql`select 1 from blocks where (blocker_id=${a} and blocked_id=${b}) or (blocker_id=${b} and blocked_id=${a}) limit 1`;return !!r[0]}
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')));
const server=http.createServer(app);const wss=new WebSocketServer({server,path:'/ws'});
function broadcast(payload){const msg=JSON.stringify(payload);for(const ws of wss.clients){if(ws.readyState===1)ws.send(msg)}}
function sendTo(userId,payload){const msg=JSON.stringify(payload);for(const ws of wss.clients){if(ws.userId===userId&&ws.readyState===1)ws.send(msg)}}
wss.on('connection',(ws,req)=>{try{const url=new URL(req.url,'http://localhost');const token=url.searchParams.get('token');const user=jwt.verify(token,JWT_SECRET);ws.userId=user.id;ws.pingId=crypto.randomUUID();getMe(user.id).then(p=>{if(p){online.set(user.id,p);broadcast({type:'online',online:[...online.values()].map(publicProfile)})}}).catch(()=>{});ws.on('close',()=>{let still=false;for(const c of wss.clients){if(c!==ws&&c.userId===ws.userId&&c.readyState===1)still=true}if(!still){online.delete(ws.userId);sql`update players set last_seen=now() where id=${ws.userId}`.catch(()=>{});broadcast({type:'online',online:[...online.values()].map(publicProfile)})}})}catch(e){ws.close()}});
initDb().then(()=>server.listen(PORT,()=>console.log('Abuad Life social API on '+PORT))).catch(e=>{console.error('DB init failed',e);server.listen(PORT,()=>console.log('API started but DB init failed'))});
