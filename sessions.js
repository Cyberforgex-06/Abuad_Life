const crypto=require('node:crypto');
const production=process.env.NODE_ENV==='production';
const COOKIE=production?'__Host-abuad_session':'abuad_session';
const cookieOptions={httpOnly:true,secure:production,sameSite:'lax',path:'/'};
function hash(value){return crypto.createHash('sha256').update(value).digest('hex')}
function cookieValue(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return raw?raw.slice(COOKIE.length+1):''}
function sessionService(sql){
 return {
 async create(res,playerId){const token=crypto.randomBytes(32).toString('hex');const digest=hash(token);await sql`insert into player_sessions(token_hash,player_id,expires_at) values(${digest},${playerId},now()+interval '7 days')`;res.cookie(COOKIE,token,{...cookieOptions,maxAge:7*86400000});},
 async read(req){const value=cookieValue(req);if(!/^[a-f0-9]{64}$/.test(value))return null;const digest=hash(value);const rows=await sql`select s.token_hash,s.player_id as id,s.expires_at from player_sessions s join players p on p.id=s.player_id where s.token_hash=${digest} and s.expires_at>now()`;return rows[0]||null;},
 async revoke(req,res){const value=cookieValue(req);if(value)await sql`delete from player_sessions where token_hash=${hash(value)}`;res.clearCookie(COOKIE,cookieOptions);return value?hash(value):null;}
 };
}
module.exports={sessionService,COOKIE};
