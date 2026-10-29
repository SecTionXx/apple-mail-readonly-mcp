import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, chmod, lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { dataHome } from './paths.mjs';
const exec = promisify(execFile);
const script=fileURLToPath(new URL('./mail-bridge.js',import.meta.url));
export const MAX_BYTES=25*1024*1024;
export function safeName(name) {
  let cleaned=String(name).normalize('NFC').replace(/[\x00-\x1f\x7f/\\:]/g,'_').replace(/^\.+/,'');
  while(Buffer.byteLength(cleaned,'utf8')>180) cleaned=Array.from(cleaned).slice(0,-1).join('');
  return cleaned || 'attachment.bin';
}
export function publicError(error) {
  const text=String(error?.stderr || error?.message || '');
  for(const code of ['ACCOUNT_NOT_FOUND','MAILBOX_NOT_FOUND','MESSAGE_NOT_FOUND','ATTACHMENT_NOT_FOUND','ATTACHMENT_CHANGED','ATTACHMENT_NOT_DOWNLOADED','ATTACHMENT_TOO_LARGE','EXPORT_UNVERIFIED']) if(text.includes(code)) return code;
  if(text.includes('-1743')) return 'AUTOMATION_PERMISSION_REQUIRED';
  if(error?.killed || error?.code==='ETIMEDOUT') return 'MAIL_TIMEOUT: Mail may still be processing; no automatic retry.';
  return 'MAIL_READ_FAILED: Check Mail availability and macOS Automation permission.';
}
export async function runBridge(payload) {
  const {stdout}=await exec('/usr/bin/osascript',['-l','JavaScript',script,JSON.stringify(payload)],{timeout:20000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,encoding:'utf8'});
  return JSON.parse(stdout);
}
export function makeService(bridge=runBridge, downloadRoot=join(dataHome,'apple-mail-downloads')) {
  let queue=Promise.resolve();
  async function perform(action,args) {
    if(action!=='export') return bridge({...args,action});
    const listing=await bridge({...args,action:'attachments'});
    const a=listing.attachments[args.attachment_index];
    if(!a) throw Error('ATTACHMENT_NOT_FOUND');
    if(!a.downloaded) throw Error('ATTACHMENT_NOT_DOWNLOADED');
    if(a.size>MAX_BYTES) throw Error('ATTACHMENT_TOO_LARGE');
    await mkdir(downloadRoot,{recursive:true,mode:0o700});
    const root=await realpath(downloadRoot);
    if(root!==resolve(downloadRoot)) throw Error('EXPORT_UNVERIFIED');
    const dir=await mkdtemp(join(root,'attachment-'));
    await chmod(dir,0o700);
    const destination=join(dir,safeName(a.name));
    await bridge({...args,action:'export',expected_attachment_id:a.id,destination,max_bytes:MAX_BYTES});
    const st=await lstat(destination);
    if(!st.isFile() || st.isSymbolicLink() || st.size>MAX_BYTES || (a.size>0 && st.size===0)) throw Error('EXPORT_UNVERIFIED');
    await chmod(destination,0o600);
    const sha256=createHash('sha256').update(await readFile(destination)).digest('hex');
    return {path:destination,bytes:st.size,sha256,original_name:a.name};
  }
  return (action,args={})=>{
    const task=queue.then(()=>perform(action,args));
    queue=task.catch(()=>{});
    return task;
  };
}
