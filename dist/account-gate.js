(()=>{localStorage.removeItem('abuadLifeSocial');
window.AbuadSession=fetch('/api/me',{credentials:'same-origin'}).then(async r=>{if(r.status===401){location.replace('signup.html?mode=login');return null}if(!r.ok)throw Error('Unable to verify your session. Please retry.');return r.json()});
window.AbuadSession.catch(()=>{});
})();
