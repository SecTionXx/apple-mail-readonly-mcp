import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, lstat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { makeService, safeName, publicError, MAX_BYTES } from '../core.mjs';

test('filenames cannot traverse folders; Unicode preserved',()=>{
  assert.equal(safeName('../../report.pdf'),'_.._report.pdf');
  assert.equal(safeName('แบบ.pdf'),'แบบ.pdf');
  assert.equal(safeName('...'),'attachment.bin');
  assert.ok(!safeName('a\u0000b\\c/d').includes('/'));
  assert.ok(Buffer.byteLength(safeName('ก'.repeat(200)))<=180);
});
test('error output never includes message bodies or raw command arguments',()=>{
  assert.match(publicError(new Error('private content')),/^MAIL_READ_FAILED/);
  assert.equal(publicError({stderr:'Mail error -1743'}),'AUTOMATION_PERMISSION_REQUIRED');
  assert.match(publicError({killed:true}),/^MAIL_TIMEOUT/);
});
test('export uses unique private directories and verifies bytes',async()=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'mail-mcp-test-')));
  const bridge=async p=>{
    if(p.action==='attachments') return {attachments:[{id:'a',name:'../../sample.txt',downloaded:true,size:5}]};
    assert.equal(p.expected_attachment_id,'a');
    assert.ok(dirname(p.destination).startsWith(root+'/attachment-'));
    await writeFile(p.destination,'hello');
    return {saved:true};
  };
  const service=makeService(bridge,root);
  const a=await service('export',{attachment_index:0});
  const b=await service('export',{attachment_index:0});
  assert.notEqual(a.path,b.path);
  assert.equal(await readFile(a.path,'utf8'),'hello');
  assert.equal(a.sha256,'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  assert.equal((await lstat(a.path)).mode & 0o777,0o600);
});
test('uncached, oversized and invalid attachments cannot reach save',async()=>{
  for(const [attachments,index,expected] of [
    [[{downloaded:false,size:1}],0,'ATTACHMENT_NOT_DOWNLOADED'],
    [[{downloaded:true,size:MAX_BYTES+1}],0,'ATTACHMENT_TOO_LARGE'],
    [[],0,'ATTACHMENT_NOT_FOUND']
  ]) {
    let calls=0;
    const service=makeService(async()=>{calls++;return {attachments};});
    await assert.rejects(service('export',{attachment_index:index}),new RegExp(expected));
    assert.equal(calls,1);
  }
});
test('bridge calls are serialized and queue recovers after failure',async()=>{
  let active=0,max=0;
  const service=makeService(async p=>{
    active++;max=Math.max(max,active);
    await new Promise(r=>setTimeout(r,5));active--;
    if(p.action==='bad') throw Error('expected');
    return p.action;
  });
  const r=await Promise.allSettled([service('bad'),service('accounts'),service('mailboxes')]);
  assert.equal(max,1);assert.equal(r[1].value,'accounts');assert.equal(r[2].value,'mailboxes');
});
