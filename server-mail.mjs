import { mkdir, mkdtemp, readFile, writeFile, rename, realpath, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID,createHash } from 'node:crypto';
import { createGmail, MailServerError, flattenParts, parseMessage, serverError } from './gmail.mjs';
import { safeName,MAX_BYTES } from './core.mjs';
import { dataHome } from './paths.mjs';

export function createServerMail(api=createGmail(),root=join(dataHome,'gmail')) {
  let scanQueue=Promise.resolve();
  async function privateRoot() {
    await mkdir(root,{recursive:true,mode:0o700});
    await chmod(root,0o700);
    return realpath(root);
  }
  async function status() {
    const p=await api.profile();
    return {provider:'gmail',account:p.emailAddress,server_messages:p.messagesTotal,server_threads:p.threadsTotal,history_id:p.historyId,coverage:'all_current_messages_in_this_authorized_gmail_mailbox_including_spam_trash',other_accounts:'not_connected_by_this_adapter',inventory_verified:false};
  }
  async function list(args) {
    const p=await api.list(args);
    return {provider:'gmail',messages:p.messages||[],next_page_token:p.nextPageToken||null,result_size_estimate:p.resultSizeEstimate,exhausted:!p.nextPageToken,include_spam_trash:true,query:args.query||null};
  }
  async function read(args) {
    const m=await api.message(args.message_id);
    // Gmail may store large plain text bodies in the attachment endpoint.
    const parts=flattenParts(m.payload);
    const external=parts.filter(p=>p.mimeType==='text/plain' && !p.filename && p.body?.attachmentId && !p.body?.data);
    let hydratedBytes=0;
    const hydrate=new Map();
    for(const p of external.slice(0,4)) {
      if((p.body.size||0)+hydratedBytes>MAX_BYTES) continue;
      const body=await api.attachment(m.id,p.body.attachmentId);
      if(Buffer.byteLength(body.data||'','base64url')+hydratedBytes>MAX_BYTES) throw new MailServerError('ATTACHMENT_TOO_LARGE');
      hydrate.set(p.part_key,body.data);hydratedBytes+=Buffer.byteLength(body.data||'','base64url');
    }
    function apply(p,key='0') {
      if(hydrate.has(key)) p.body={...p.body,data:hydrate.get(key)};
      (p.parts||[]).forEach((child,i)=>apply(child,key+'.'+i));
    }
    if(m.payload) apply(m.payload);
    return {provider:'gmail',...parseMessage(m,args.max_chars)};
  }
  async function download(args) {
    const m=await api.message(args.message_id);
    const part=flattenParts(m.payload).find(p=>p.part_key===args.part_key);
    if(!part?.body || (!part.body.attachmentId && part.body.data===undefined)) throw new MailServerError('ATTACHMENT_NOT_FOUND');
    if(part.body.size>MAX_BYTES) throw new MailServerError('ATTACHMENT_TOO_LARGE');
    const b=part.body.attachmentId ? await api.attachment(m.id,part.body.attachmentId) : part.body;
    if(typeof b.data!=='string') throw new MailServerError('ATTACHMENT_DATA_MISSING');
    const bytes=Buffer.from(b.data,'base64url');
    if(bytes.length>MAX_BYTES) throw new MailServerError('ATTACHMENT_TOO_LARGE');
    if(Number.isFinite(b.size) && b.size!==bytes.length) throw new MailServerError('ATTACHMENT_SIZE_MISMATCH');
    const dir=await mkdtemp(join(await privateRoot(),'download-'));
    const path=join(dir,safeName(part.filename||'message-part.txt'));
    await writeFile(path,bytes,{mode:0o600,flag:'wx'});
    return {provider:'gmail',path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'gmail_server_api'};
  }
  async function scan({scan_id,max_pages=5}) {
    const dir=await privateRoot();
    let s;
    if(scan_id) {
      if(!/^[0-9a-f-]{36}$/.test(scan_id)) throw new MailServerError('INVALID_SCAN_ID');
      try {s=JSON.parse(await readFile(join(dir,scan_id+'.json'),'utf8'));}
      catch {throw new MailServerError('SCAN_NOT_FOUND');}
      const current=await api.profile();
      if(current.emailAddress!==s.before.emailAddress) throw new MailServerError('SCAN_ACCOUNT_CHANGED');
    } else {
      s={scan_id:randomUUID(),before:await api.profile(),ids:[],pages:0,next_page_token:null,exhausted:false,status:'scanning',started_at:new Date().toISOString()};
    }
    s.status=s.exhausted?s.status:'scanning';
    delete s.last_error;
    const checkpoint=async()=>{
      const tmp=join(dir,s.scan_id+'.'+randomUUID()+'.tmp');
      await writeFile(tmp,JSON.stringify(s),{mode:0o600,flag:'wx'});
      await rename(tmp,join(dir,s.scan_id+'.json'));
    };
    await checkpoint();
    const deadline=Date.now()+20000;
    const seen=new Set(s.ids);
    const tokens=new Set();
    try {
    for(let n=0;n<max_pages && !s.exhausted && Date.now()<deadline;n++) {
      const page=await api.list({page_token:s.next_page_token,limit:500});
      for(const m of page.messages||[]) seen.add(m.id);
      s.pages++;
      const next=page.nextPageToken||null;
      if(next && (next===s.next_page_token || tokens.has(next))) throw new MailServerError('PAGINATION_STALLED');
      if(next) tokens.add(next);
      s.next_page_token=next;s.exhausted=!next;s.ids=[...seen];
      // Atomic checkpoint after each successfully enumerated page.
      await checkpoint();
    }
    if(s.exhausted) {
      s.after=await api.profile();
      if(s.after.emailAddress!==s.before.emailAddress) throw new MailServerError('SCAN_ACCOUNT_CHANGED');
      s.status=s.before.historyId!==s.after.historyId ? 'changed_during_scan' : (s.ids.length===s.after.messagesTotal && s.ids.length===s.before.messagesTotal ? 'verified_message_inventory' : 'count_mismatch');
      s.finished_at=new Date().toISOString();
      await checkpoint();
    }
    } catch(error) {
      s.status='interrupted';s.last_error=serverError(error);await checkpoint();
    }
    return {scan_id:s.scan_id,account:s.before.emailAddress,status:s.status,last_error:s.last_error,unique_message_ids:s.ids.length,pages:s.pages,expected_before:s.before.messagesTotal,expected_after:s.after?.messagesTotal,exhausted:s.exhausted,include_spam_trash:true,manifest_path:join(dir,s.scan_id+'.json'),note:'Inventory of IDs only, not a full content or attachment backup. API-visible current messages only; excludes permanently deleted and admin-only retention archives.'};
  }
  return {status,list,read,download,scan:args=>{
    const result=scanQueue.then(()=>scan(args));scanQueue=result.catch(()=>{});return result;
  }};
}
