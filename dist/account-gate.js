(()=>{const epoch='2026-10-19-account-reset';let account;try{account=JSON.parse(localStorage.getItem('abuadLifeSocial')||'null')}catch{}
if(localStorage.getItem('abuad-account-epoch')!==epoch||!account?.token){location.replace('signup.html');return}
// The API verifies that the account still exists; a deleted account cannot reuse an old token.
const api=location.hostname==='abuad-life.onrender.com'?'https://abuad-life-api.onrender.com':location.origin;
fetch(api+'/api/me',{headers:{Authorization:'Bearer '+account.token}}).then(r=>{if(r.status===401){localStorage.removeItem('abuadLifeSocial');location.replace('signup.html?mode=login')}}).catch(()=>{});
})();
