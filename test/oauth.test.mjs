import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { authorizationFlow,pkceChallenge,READ_SCOPE } from '../oauth-flow.mjs';
test('PKCE matches RFC vector',()=>{
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});
test('loopback callback validates state, method and host before accepting code',async()=>{
  const flow=await authorizationFlow('fixture.apps.googleusercontent.com',{timeoutMs:3000});
  try {
    const url=new URL(flow.url);
    assert.equal(url.searchParams.get('scope'),READ_SCOPE);
    assert.equal(url.searchParams.get('code_challenge'),pkceChallenge(flow.verifier));
    assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    const callback=new URL(flow.redirectURI);callback.searchParams.set('code','fixture-code');callback.searchParams.set('state','wrong');
    assert.equal((await fetch(callback)).status,400);
    callback.searchParams.set('state',url.searchParams.get('state'));
    assert.equal((await fetch(callback,{method:'POST'})).status,400);
    const wrongHost=await new Promise((resolve,reject)=>{
      const req=request(callback,{headers:{Host:'malicious.test'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('error',reject);req.end();
    });
    assert.equal(wrongHost,400);
    assert.equal((await fetch(callback)).status,200);
    assert.equal(await flow.result,'fixture-code');
  } finally {flow.cancel();}
});
test('declined consent and timeout reject without emitting authorization values',async()=>{
  const flow=await authorizationFlow('fixture',{timeoutMs:3000});
  const callback=new URL(flow.redirectURI);callback.searchParams.set('state',new URL(flow.url).searchParams.get('state'));callback.searchParams.set('error','access_denied');
  await fetch(callback);
  await assert.rejects(flow.result,/OAUTH_DECLINED/);
  const timeout=await authorizationFlow('fixture',{timeoutMs:10});
  await assert.rejects(timeout.result,/OAUTH_TIMEOUT/);
});
