import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('ops/ui/live-modules/auth.js','utf8');
function fixture(){
 const phases=[];
 class MicrosoftAuth{constructor(){this.reconnectRequired=false;this.timeoutMs=20;this.pca={};}account(){return {homeAccountId:'owner'};}get scopes(){return ['Files.ReadWrite'];}async renewToken(){return 'fixture-token';}}
 const context={MicrosoftAuth,bounded:async work=>work(),CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},window:{dispatchEvent:event=>{if(event.type==='keepit-auth-state')phases.push(event.detail.phase);}}};
 const text=source.slice(source.indexOf('export class ResilientMicrosoftAuth'),source.indexOf('\nexport {ResilientMicrosoftAuth')).replace('export class','class');
 const Auth=vm.runInNewContext('(()=>{'+text+';return ResilientMicrosoftAuth;})()',context);
 return {auth:new Auth(),phases};
}
test('provider invalidation after a second rejection retains the required sign-in state',()=>{
 const {auth,phases}=fixture();auth.reconnectRequired=true;auth.invalidateToken();
 assert.equal(phases.at(-1),'signin');assert.equal(auth.reconnectRequired,true);
});
test('temporary renewal interruption remains retryable, then verified renewal restores access',async()=>{
 const {auth,phases}=fixture();auth.invalidateToken();
 auth.pca.acquireTokenSilent=async()=>{throw Object.assign(Error('timeout'),{code:'AUTH_TIMEOUT'});};
 await assert.rejects(()=>auth.renewToken(auth.account(),'owner'),error=>error.code==='NETWORK_UNKNOWN');
 assert.equal(auth.reconnectRequired,false);assert.equal(phases.at(-1),'waiting');
 auth.pca.acquireTokenSilent=async()=>({account:auth.account(),accessToken:'fixture-token'});
 assert.equal(await auth.renewToken(auth.account(),'owner'),'fixture-token');assert.equal(phases.at(-1),'restored');assert.equal(auth.forceNext,false);
});
