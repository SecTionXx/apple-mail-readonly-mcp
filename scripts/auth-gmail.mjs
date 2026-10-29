import { readFile,writeFile,mkdir,lstat,access } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { authHome } from '../paths.mjs';
import { authorizationFlow,READ_SCOPE } from '../oauth-flow.mjs';
import { boundedJSON } from '../gmail.mjs';
let flow;
try {
  if(process.platform!=='darwin')throw Error('MACOS_REQUIRED');
  if(process.argv.length!==3)throw Error('USAGE: node scripts/auth-gmail.mjs /absolute/path/to/desktop-client.json');
  const destination=join(authHome,'credentials.json');
  let exists=false;try{await access(destination);exists=true;}catch{}
  if(exists)throw Error('AUTH_ALREADY_CONFIGURED: Existing credentials will not be overwritten.');
  const clientFile=resolve(process.argv[2]);
  const document=JSON.parse(await readFile(clientFile,'utf8'));
  const client=document.installed;
  if(!client?.client_id?.endsWith('.apps.googleusercontent.com'))throw Error('DESKTOP_OAUTH_CLIENT_REQUIRED');
  flow=await authorizationFlow(client.client_id);
  console.log('Opening Google sign-in. Requested scope: Gmail read-only. Complete sign-in in your browser; do not paste credentials here.');
  await promisify(execFile)('/usr/bin/open',[flow.url]);
  const code=await flow.result;
  const body=new URLSearchParams({grant_type:'authorization_code',code,client_id:client.client_id,redirect_uri:flow.redirectURI,code_verifier:flow.verifier});
  if(client.client_secret)body.set('client_secret',client.client_secret);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw Error('OAUTH_EXCHANGE_FAILED');
  const tokens=await boundedJSON(response,64000);
  if(!tokens.refresh_token || !tokens.access_token || !Number.isFinite(tokens.expires_in))throw Error('OAUTH_OFFLINE_ACCESS_NOT_GRANTED');
  if(!String(tokens.scope||'').split(' ').includes(READ_SCOPE))throw Error('OAUTH_READONLY_SCOPE_NOT_GRANTED');
  await mkdir(authHome,{recursive:true,mode:0o700});
  if((await lstat(authHome)).isSymbolicLink())throw Error('AUTH_DIRECTORY_MUST_NOT_BE_SYMLINK');
  const record={client_file:clientFile,tokens:{access_token:tokens.access_token,refresh_token:tokens.refresh_token,scope:tokens.scope,expiry_date:Date.now()+tokens.expires_in*1000}};
  await writeFile(destination,JSON.stringify(record),{mode:0o600,flag:'wx'});
  console.log('Gmail authorization saved locally. No credential values were printed. Run: npm run doctor -- --gmail');
} catch(e) {
  const allowed=/^(USAGE:|AUTH_ALREADY_CONFIGURED:|MACOS_REQUIRED$|DESKTOP_OAUTH_CLIENT_REQUIRED$|OAUTH_[A-Z_]+$|AUTH_DIRECTORY_MUST_NOT_BE_SYMLINK$)/;
  console.error(allowed.test(e.message)?e.message:'Gmail setup failed. Check the client JSON file, connectivity and account permissions.');
  process.exitCode=1;
} finally {flow?.cancel();}
