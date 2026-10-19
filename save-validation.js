function validSave(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||s.version!==1)return false;
 if(typeof s.name!=='string'||s.name.length>24||typeof s.course!=='string')return false;
 if(!Number.isInteger(s.day)||s.day<1||s.day>28||!Number.isFinite(s.hour)||s.hour<0||s.hour>24)return false;
 if(!Array.isArray(s.friends)||!Array.isArray(s.logs)||!Array.isArray(s.actions)||!s.daily)return false;
 for(const k of ['money','energy','hunger','mood','social','knowledge','skills'])if(!Number.isFinite(s[k])||s[k]<0)return false;
 return Buffer.byteLength(JSON.stringify(s))<=80000;
}
module.exports={validSave};
