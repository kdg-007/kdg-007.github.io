
/* LiveIt W3 encrypted, authenticated backup envelope. No cloud/network or app credentials.
   AES-256-GCM + PBKDF2-SHA256; integrity is authenticated by GCM and internal SHA-256.
   User MUST keep passphrase: unrecoverable without it. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LiveItBackupCrypto=api;})(typeof window!=='undefined'?window:undefined,function(){
'use strict';
const VERSION=1, FORMAT='liveit-encrypted-backup', ITERATIONS=250000, MAX_FILE_BYTES=25*1024*1024;
const bytes=x=>new TextEncoder().encode(x);
const toBase64=a=>{const u=new Uint8Array(a);if(typeof Buffer!=='undefined')return Buffer.from(u).toString('base64');let s='';for(const b of u)s+=String.fromCharCode(b);return btoa(s);};
const fromBase64=(s,max)=>{if(typeof s!=='string'||!s||s.length>max*2||!/^[-A-Za-z0-9+/]*={0,2}$/.test(s)||s.length%4!==0)throw new Error('Invalid backup encoding');let out;if(typeof Buffer!=='undefined')out=new Uint8Array(Buffer.from(s,'base64'));else{const decoded=atob(s);out=Uint8Array.from(decoded,c=>c.charCodeAt(0));}if(out.length>max||toBase64(out)!==s)throw new Error('Invalid backup encoding');return out;};
const cryptoFor=value=>{const c=value || (typeof globalThis!=='undefined'?globalThis.crypto:null);if(!c||!c.subtle||!c.getRandomValues)throw new Error('Secure WebCrypto is required for encrypted backup');return c;};
async function keyFor(c,password,salt,iterations){const initial=await c.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveKey']);return c.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},initial,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
function passwordOK(s){if(typeof s!=='string'||s.length<12||s.length>1024)throw new Error('Backup passphrase must be 12–1024 characters');}
async function seal(snapshot,password,providedCrypto){passwordOK(password);const c=cryptoFor(providedCrypto);const payloadText=JSON.stringify(snapshot);if(bytes(payloadText).length>MAX_FILE_BYTES)throw new Error('Backup snapshot too large');const hash=toBase64(await c.subtle.digest('SHA-256',bytes(payloadText)));const content=bytes(JSON.stringify({snapshot,sha256:hash}));
 const salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));const key=await keyFor(c,password,salt,ITERATIONS);const ciphertext=await c.subtle.encrypt({name:'AES-GCM',iv},key,content);
 return {format:FORMAT,version:VERSION,encrypted:true,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(ciphertext)};
}
async function open(envelope,password,providedCrypto){passwordOK(password);const c=cryptoFor(providedCrypto);if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||envelope.format!==FORMAT||envelope.version!==VERSION||envelope.encrypted!==true||envelope.cipher!=='AES-256-GCM'||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==ITERATIONS)throw new Error('Unsupported or malformed encrypted backup');
 const salt=fromBase64(envelope.salt,16),iv=fromBase64(envelope.iv,12),ciphertext=fromBase64(envelope.ciphertext,MAX_FILE_BYTES+1024);if(salt.length!==16||iv.length!==12||ciphertext.length<16)throw new Error('Malformed encrypted backup');
 let plain;try{const key=await keyFor(c,password,salt,ITERATIONS);plain=await c.subtle.decrypt({name:'AES-GCM',iv},key,ciphertext);}catch{throw new Error('Cannot decrypt backup (wrong passphrase or damaged file)');}
 let result;try{result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));}catch{throw new Error('Decrypted backup has invalid JSON');}
 if(!result||!result.snapshot||typeof result.sha256!=='string')throw new Error('Backup integrity metadata missing');
 const actual=toBase64(await c.subtle.digest('SHA-256',bytes(JSON.stringify(result.snapshot))));if(actual!==result.sha256)throw new Error('Backup content integrity check failed');return result.snapshot;
}
return {FORMAT,VERSION,MAX_FILE_BYTES,seal,open};
});

