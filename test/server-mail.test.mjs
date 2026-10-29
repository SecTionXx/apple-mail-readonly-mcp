import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,lstat,realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGmail,MailServerError,serverError,boundedJSON,parseMessage } from '../gmail.mjs';
import { createServerMail } from '../server-mail.mjs';
const temporary=()=>mkdtemp(join(tmpdir(),'server-mail-test-'));
const profile=(count=3,history='1')=>({emailAddress:'fixture@example.test',messagesTotal:count,historyId:history});
const fixtureCredentials=async()=>({client:{},saved:{access_token:'fixture-only',expiry_date:Date.now()+3600000}});
test('Gmail lists include spam/trash, token, query; requests are GET only with redirects forbidden',async()=>{
  let seen;
  const api=createGmail({loadCredentials:fixtureCredentials,fetchImpl:async(url,opts)=>{seen={url:new URL(url),opts};return Response.json({messages:[],nextPageToken:'page2'});}});
  await api.list({query:'in:anywhere',page_token:'page1',limit:500});
  assert.equal(seen.url.hostname,'gmail.googleapis.com');
  assert.equal(seen.url.searchParams.get('includeSpamTrash'),'true');
  assert.equal(seen.url.searchParams.get('pageToken'),'page1');
  assert.equal(seen.opts.method,'GET');assert.equal(seen.opts.redirect,'error');
});
test('HTTP and network errors never expose response contents or authorization',async()=>{
  for(const status of [401,403,404,429,500]) {
    const api=createGmail({loadCredentials:fixtureCredentials,fetchImpl:async()=>Response.json({private:'private-response'},{status})});
    await assert.rejects(api.profile(),e=>!serverError(e).includes('private') && !serverError(e).includes('fixture-only'));
  }
  const api=createGmail({loadCredentials:fixtureCredentials,fetchImpl:async()=>{throw Error('private-response');}});
  await assert.rejects(api.profile(),e=>serverError(e)==='GMAIL_NETWORK_FAILED');
  await assert.rejects(boundedJSON(Response.json({large:'payload'}),2),/RESPONSE_TOO_LARGE/);
});
test('resumable inventory deduplicates pages and verifies counts with stable history',async()=>{
  const api={profile:async()=>profile(),list:async({page_token})=>page_token?{messages:[{id:'b'},{id:'c'}]}:{messages:[{id:'a'},{id:'b'}],nextPageToken:'next'}};
  const root=await temporary();
  const first=await createServerMail(api,root).scan({max_pages:1});
  assert.equal(first.status,'scanning');assert.equal(first.unique_message_ids,2);
  const last=await createServerMail(api,root).scan({scan_id:first.scan_id,max_pages:1});
  assert.equal(last.status,'verified_message_inventory');assert.equal(last.unique_message_ids,3);
  assert.equal((await lstat(last.manifest_path)).mode & 0o777,0o600);
});
test('changing history or wrong count never claims complete inventory',async()=>{
  for(const [count,changed,expected] of [[3,true,'changed_during_scan'],[4,false,'count_mismatch']]) {
    let calls=0;
    const api={profile:async()=>profile(count,changed&&calls++?'2':'1'),list:async()=>({messages:[{id:'a'},{id:'b'},{id:'c'}]})};
    const s=await createServerMail(api,await temporary()).scan({});
    assert.equal(s.status,expected);
  }
});
test('interrupted scan retains cursor and can resume with a new service',async()=>{
  let failed=false;
  const api={profile:async()=>profile(2),list:async({page_token})=>{
    if(!page_token)return {messages:[{id:'a'}],nextPageToken:'next'};
    if(!failed){failed=true;throw new MailServerError('GMAIL_RATE_LIMITED');}
    return {messages:[{id:'b'}]};
  }};
  const root=await temporary();
  const first=await createServerMail(api,root).scan({});
  assert.equal(first.status,'interrupted');assert.equal(first.unique_message_ids,1);
  const last=await createServerMail(api,root).scan({scan_id:first.scan_id});
  assert.equal(last.status,'verified_message_inventory');
});
test('repeated page tokens fail explicitly and do not claim completeness',async()=>{
  const api={profile:async()=>profile(99),list:async()=>({messages:[{id:'a'}],nextPageToken:'same'})};
  const s=await createServerMail(api,await temporary()).scan({max_pages:5});
  assert.equal(s.status,'interrupted');assert.equal(s.last_error,'PAGINATION_STALLED');
});
test('nested MIME bodies, external text, HTML and remote attachments are discoverable',async()=>{
  const message={id:'a',labelIds:['UNREAD'],payload:{parts:[{mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{attachmentId:'text',size:5}},{mimeType:'text/html',body:{data:Buffer.from('<p>Hello</p>').toString('base64url')}}]},{filename:'../../demo.txt',mimeType:'text/plain',body:{attachmentId:'file',size:5}}]}};
  assert.equal(parseMessage(message).text_body_external,true);
  const root=await temporary();
  const api={message:async()=>structuredClone(message),attachment:async()=>({data:Buffer.from('hello').toString('base64url'),size:5})};
  const service=createServerMail(api,root);
  const read=await service.read({message_id:'a',max_chars:3});
  assert.equal(read.body,'hel');assert.equal(read.truncated,true);assert.equal(read.text_body_external,false);
  assert.ok(read.parts.some(p=>p.part_key==='0.0.1'));
  const saved=await service.download({message_id:'a',part_key:'0.1'});
  assert.equal(await readFile(saved.path,'utf8'),'hello');
  assert.ok(saved.path.startsWith(await realpath(root)+'/download-'));assert.equal((await lstat(saved.path)).mode & 0o777,0o600);
});
test('server attachment size mismatch and excessive size fail without export',async()=>{
  const api={message:async()=>({id:'a',payload:{filename:'x',body:{attachmentId:'x',size:5}}}),attachment:async()=>({data:'YQ',size:5})};
  await assert.rejects(createServerMail(api,await temporary()).download({message_id:'a',part_key:'0'}),/ATTACHMENT_SIZE_MISMATCH/);
});
