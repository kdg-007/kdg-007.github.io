// Synthetic OAuth and read-only OneDrive fixture. Never contacts an account.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function connectionFixture(origin){
 const tenant='9188040d-6c67-4c5b-b112-36a304b66dad',authority='https://login.microsoftonline.com',base=authority+'/consumers/oauth2/v2.0';
 const libraryId='a1000000-0000-4000-8000-000000000001',commitId='a1000000-0000-4000-8000-000000000002';
 const items=new Map(),bytes=new Map();
 const add=(id,parent,name,value)=>{
  const folder=value===undefined,data=folder?null:Buffer.from(JSON.stringify(value));
  items.set(id,{id,name,eTag:'"fixture-'+id+'"',parentReference:{id:parent,driveId:'fixture-drive'},...(folder?{folder:{}}:{file:{mimeType:'application/json'},size:data.length,'@microsoft.graph.downloadUrl':'https://fixture.storage.live.com/download/'+id})});if(data)bytes.set(id,data);
 };
 add('root',null,'root');add('library','root','KeepIt');add('catalog','library','_Catalog');add('files','library','Files');add('legacy','catalog','commits');add('cloud','catalog','keepit-cloud');add('commits','cloud','commits');
 const identity={format:'mylibrary-folder-1',libraryId,createdAt:'2026-11-01T00:00:00.000Z'};
 add('identity','catalog','library.json',identity);
 add('index','catalog','keepit-cloud.json',{format:'keepit-cloud-index-1',libraryId,driveId:'fixture-drive',rootId:'library',filesId:'files',cloudId:'cloud',commitsId:'commits',headId:'head',legacyCommitId:null,createdAt:identity.createdAt});
 add('head','cloud','head-'+commitId+'.json',{format:'keepit-cloud-anchor-1',libraryId});
 const body={format:'mylibrary-folder-snapshot-2',libraryId,commitId,revision:0,parent:null,info:{libraryId,createdAt:identity.createdAt,backupRevision:-1,revision:0},items:[],paths:{}};
 add('snapshot','commits',commitId+'.json',{...body,checksum:createHash('sha256').update(JSON.stringify(body)).digest('hex')});
 const fixture={requests:[],navigations:[],nonce:null,clientId:null,hold:null,driveRequests:0,signins:0};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 fixture.route=async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();
  if(url.origin===origin)return route.continue();
  const cors={'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,OPTIONS','access-control-expose-headers':'*'};
  const json=(value,status=200)=>route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(value)});
  if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(url.hostname==='login.microsoftonline.com'){
   if(url.pathname.includes('openid-configuration'))return json({authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',end_session_endpoint:base+'/logout',issuer:authority+'/'+tenant+'/v2.0',jwks_uri:authority+'/consumers/discovery/v2.0/keys',response_types_supported:['code'],subject_types_supported:['pairwise'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],scopes_supported:['openid','profile','email'],cloud_instance_host_name:'microsoftonline.com'});
   if(url.pathname.includes('/discovery/instance'))return json({tenant_discovery_endpoint:authority+'/consumers/v2.0/.well-known/openid-configuration',metadata:[{preferred_network:'login.microsoftonline.com',preferred_cache:'login.windows.net',aliases:['login.microsoftonline.com','login.windows.net','sts.windows.net']} ]});
   if(url.pathname.endsWith('/authorize')){
    fixture.signins++;fixture.nonce=url.searchParams.get('nonce');fixture.clientId=url.searchParams.get('client_id');
    const callback=new URL(url.searchParams.get('redirect_uri'));assert.equal(callback.origin,origin);assert.equal(callback.pathname,'/auth/callback/');
    callback.hash=new URLSearchParams({code:'fixture-code',state:url.searchParams.get('state'),client_info:encode({uid:'fixture-user',utid:tenant})}).toString();
    return route.fulfill({status:302,headers:{...cors,location:callback.href},body:''});
   }
   if(url.pathname.endsWith('/token')){
    const now=Math.floor(Date.now()/1000),claims={aud:fixture.clientId,iss:authority+'/'+tenant+'/v2.0',iat:now,nbf:now,exp:now+3600,nonce:fixture.nonce,oid:'a1000000-0000-4000-8000-000000000003',tid:tenant,sub:'fixture-user',preferred_username:'owner@example.test',name:'Synthetic Owner',ver:'2.0'};
    return json({token_type:'Bearer',scope:'Files.ReadWrite openid profile offline_access',expires_in:3600,access_token:'fixture-access',refresh_token:'fixture-refresh',client_info:encode({uid:'fixture-user',utid:tenant}),id_token:encode({alg:'RS256',typ:'JWT'})+'.'+encode(claims)+'.fixture-signature'});
   }
   throw Error('Unmocked Microsoft request: '+method+' '+url.pathname);
  }
  if(url.hostname==='graph.microsoft.com'){
   fixture.requests.push({method,path:url.pathname});assert.equal(method,'GET','Connection to existing cloud must be read-only');assert.equal(req.headers()['authorization'],'Bearer fixture-access');
   if(url.pathname==='/v1.0/me/drive'){
    fixture.driveRequests++;if(fixture.hold)await fixture.hold;
    if(fixture.failDrive)return json({error:{code:'accessDenied',message:'Synthetic connection interrupted'}},403);
    return json({id:'fixture-drive',driveType:'personal'});
   }
   if(url.pathname==='/v1.0/drives/fixture-drive/root')return json(items.get('root'));
   const match=/^\/v1.0\/drives\/fixture-drive\/items\/([^/:]+)(.*)$/.exec(decodeURIComponent(url.pathname));
   if(!match)return json({},404);
   const [,id,suffix]=match;
   if(!suffix)return json(items.get(id)||{},items.has(id)?200:404);
   if(suffix==='/children')return json({value:[...items.values()].filter(item=>item.parentReference.id===id)});
   if(suffix.startsWith(':/')){const found=[...items.values()].find(item=>item.parentReference.id===id&&item.name===suffix.slice(2));return json(found||{},found?200:404);}
   throw Error('Unmocked Graph GET '+url.pathname);
  }
  if(url.hostname==='fixture.storage.live.com'){
   assert.ok(!req.headers()['authorization'],'Signed downloads must not receive bearer tokens');const data=bytes.get(url.pathname.split('/').pop());return route.fulfill({status:data?200:404,headers:cors,contentType:'application/json',body:data||''});
  }
  return route.abort();
 };
 return fixture;
}
