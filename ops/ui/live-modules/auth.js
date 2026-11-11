// Keep the existing MSAL client and identity checks. A network timeout does not
// revoke an account; an explicit interaction-required response still does.
import {a as bounded,b as MicrosoftAuth,c,d} from './chunk-ZJ27NWFH.js';
export {bounded as a,c,d};
export class ResilientMicrosoftAuth extends MicrosoftAuth {
  invalidateToken(){this.forceNext=true;this.authInterrupted=true;this.publish('renewing');}
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
