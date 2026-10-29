import { createServer } from 'node:http';
import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
export const READ_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export function pkceChallenge(verifier) {return createHash('sha256').update(verifier).digest('base64url');}
function equal(a,b) {const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length && timingSafeEqual(aa,bb);}
export async function authorizationFlow(clientId,{timeoutMs=300000}={}) {
  const state=randomBytes(32).toString('base64url');
  const verifier=randomBytes(48).toString('base64url');
  let resolveResult,rejectResult,settled=false,timer;
  const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});
  // Caller may still be opening the browser when an error arrives.
  result.catch(()=>{});
  let redirectURI;
  const server=createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'");
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    const expected=new URL(redirectURI);
    if(req.method!=='GET' || req.headers.host!==expected.host) {res.writeHead(400).end('Invalid callback.');return;}
    const callback=new URL(req.url,redirectURI);
    if(callback.pathname!=='/oauth2callback') {res.writeHead(404).end('Not found.');return;}
    if(settled || !equal(callback.searchParams.get('state')||'',state)) {res.writeHead(400).end('Invalid authorization state.');return;}
    if(callback.searchParams.has('error')) {res.writeHead(400).end('Authorization declined.');finish(Error('OAUTH_DECLINED'));return;}
    const code=callback.searchParams.get('code');
    if(!code || code.length>4096) {res.writeHead(400).end('Missing authorization code.');return;}
    res.end('Authorization received. Return to Terminal to check completion. You may close this page.');
    finish(null,code);
  });
  function finish(error,code) {
    if(settled)return;settled=true;clearTimeout(timer);server.close();
    error?rejectResult(error):resolveResult(code);
  }
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  server.on('error',()=>finish(Error('OAUTH_LISTENER_FAILED')));
  redirectURI=`http://127.0.0.1:${server.address().port}/oauth2callback`;
  timer=setTimeout(()=>finish(Error('OAUTH_TIMEOUT')),timeoutMs);
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,value] of Object.entries({client_id:clientId,redirect_uri:redirectURI,response_type:'code',scope:READ_SCOPE,state,code_challenge:pkceChallenge(verifier),code_challenge_method:'S256',access_type:'offline',prompt:'consent'}))url.searchParams.set(key,value);
  return {url:url.toString(),redirectURI,verifier,result,cancel:()=>finish(Error('OAUTH_CANCELLED'))};
}
