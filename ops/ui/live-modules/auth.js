// Keep the existing MSAL client and identity checks. A network timeout does not
// revoke an account; an explicit interaction-required response still does.
import {a as bounded,b as MicrosoftAuth,c,d} from './chunk-ZJ27NWFH.js';
export {bounded as a,c,d};
export class ResilientMicrosoftAuth extends MicrosoftAuth {
  // MSAL encrypts its saved sign-in with a key held in a session cookie
  // (msal.cache.encryption). An installed iPad/iPhone app starts a new browser
  // session whenever it is closed, so the key was lost and the saved sign-in could
  // no longer be read: KeepIt then asked to connect again. The key is kept with an
  // expiry date and a local backup, restored before MSAL starts.
  static keyCookie='msal.cache.encryption';
  static keyBackup='keepit-msal-cache-key-1';
  readKeyCookie(){
    const name=encodeURIComponent(ResilientMicrosoftAuth.keyCookie)+'=';
    const found=(globalThis.document?.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(name));
    if(!found)return '';
    try{return decodeURIComponent(found.slice(name.length));}catch{return '';}
  }
  writeKeyCookie(value){
    // 400 days is the longest browsers accept; it is renewed on every launch.
    globalThis.document.cookie=encodeURIComponent(ResilientMicrosoftAuth.keyCookie)+'='+encodeURIComponent(value)+';path=/;max-age=34560000;SameSite=None;Secure';
  }
  validKey(value){try{const key=JSON.parse(value);return !!(key&&key.id&&key.key);}catch{return false;}}
  async initialize(){
    if(!this.pca){
      try{
        const saved=globalThis.localStorage?.getItem(ResilientMicrosoftAuth.keyBackup);
        if(saved&&this.validKey(saved)&&!this.validKey(this.readKeyCookie()))this.writeKeyCookie(saved);
      }catch{}
    }
    const account=await super.initialize();
    try{
      const value=this.readKeyCookie();
      if(this.validKey(value)){this.writeKeyCookie(value);globalThis.localStorage?.setItem(ResilientMicrosoftAuth.keyBackup,value);}
    }catch{}
    return account;
  }
  async signOut(){
    await super.signOut();
    try{globalThis.localStorage?.removeItem(ResilientMicrosoftAuth.keyBackup);}catch{}
  }
  invalidateToken(){this.forceNext=true;this.authInterrupted=true;this.publish(this.reconnectRequired?'signin':'renewing');}
  publish(phase){
    globalThis.window?.dispatchEvent(new CustomEvent('keepit-auth-state',{detail:{phase,homeId:this.account()?.homeAccountId}}));
  }
  async renewToken(account,homeId){
    try{
      let token;
      if(this.forceNext){
        const result=await bounded(()=>this.pca.acquireTokenSilent({scopes:this.scopes,account,forceRefresh:true,cacheLookupPolicy:3}),this.timeoutMs,'Microsoft renewal did not respond in time.');
        if(this.account()?.homeAccountId!==homeId||result.account?.homeAccountId!==homeId)throw Object.assign(Error('Identity changed during token renewal.'),{code:'ACCOUNT'});
        this.forceNext=false;token=result.accessToken;
      }else token=await super.renewToken(account,homeId);
      if(this.authInterrupted){
        this.authInterrupted=false;this.publish('restored');
        globalThis.window?.dispatchEvent(new CustomEvent('keepit-auth-restored',{detail:{homeId}}));
      }
      return token;
    }catch(error){
      const code=error.errorCode||error.code||'';
      if(code==='AUTH_TIMEOUT'){
        this.reconnectRequired=false;this.authInterrupted=true;this.publish('waiting');
        throw Object.assign(Error('Microsoft renewal was interrupted. Your work is saved locally; renewal will retry.'),{code:'NETWORK_UNKNOWN'});
      }
      if(['interaction_required','login_required','consent_required','refresh_token_expired','no_tokens_found','invalid_grant','AUTH_REQUIRED'].includes(code)){
        this.reconnectRequired=true;this.authInterrupted=true;this.publish('signin');
        if(code!=='AUTH_REQUIRED')throw Object.assign(Error('Reconnect Microsoft to renew access. Your local work is retained.'),{code:'AUTH_REQUIRED'});
      }
      throw error;
    }
  }
}
export {ResilientMicrosoftAuth as b};
