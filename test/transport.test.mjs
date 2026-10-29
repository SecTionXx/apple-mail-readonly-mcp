import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependency } from '../runtime.mjs';
test('fresh install exposes 12 tools and does not reuse credentials from the current computer',async()=>{
  const {Client}=await dependency('@modelcontextprotocol/sdk/client/index.js');
  const {StdioClientTransport}=await dependency('@modelcontextprotocol/sdk/client/stdio.js');
  const client=new Client({name:'portable-test',version:'0.3.0'});
  try {
    const home=await mkdtemp(join(tmpdir(),'mail-fresh-home-'));
    await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server.mjs',import.meta.url))],env:{APPLE_MAIL_MCP_HOME:home},stderr:'pipe'}));
    const tools=(await client.listTools()).tools;
    assert.equal(tools.length,12);
    assert.ok(tools.every(t=>!/(send|delete|move|mark|execute)/.test(t.name)));
    const status=await client.callTool({name:'server_mail_status',arguments:{}});
    assert.equal(status.isError,true);
    assert.equal(status.content[0].text,'GMAIL_AUTH_NOT_CONFIGURED');
  } finally {await client.close();}
});
