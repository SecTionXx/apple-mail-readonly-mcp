import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependency } from '../runtime.mjs';
import { authHome,appHome } from '../paths.mjs';
const {Client}=await dependency('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=await dependency('@modelcontextprotocol/sdk/client/stdio.js');
const args=new Set(process.argv.slice(2));
const client=new Client({name:'portable-mail-doctor',version:'0.3.0'});
try {
  if(process.platform!=='darwin')throw Error('MACOS_REQUIRED');
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server.mjs',import.meta.url))],env:{APPLE_MAIL_MCP_HOME:appHome},stderr:'pipe'});
  await client.connect(transport);
  const names=(await client.listTools()).tools.map(t=>t.name);
  if(names.length!==12)throw Error('TOOLS_MISSING');
  console.log('MCP handshake: PASS; 12 tools available.');
  let configured=false;try{await access(join(authHome,'credentials.json'));configured=true;}catch{}
  console.log('Gmail configuration: '+(configured?'present (not yet verified)':'not configured; Apple Mail tools remain available'));
  for(const [flag,name] of [['--mail','list_accounts'],['--gmail','server_mail_status']]) {
    if(args.has(flag)) {
      const result=await client.callTool({name,arguments:{}});
      if(result.isError)throw Error(result.content[0].text);
      const data=JSON.parse(result.content[0].text);
      console.log(flag==='--mail'?`Apple Mail: PASS; ${data.accounts.length} account(s).`:`Gmail API: PASS; ${data.server_messages} messages.`);
    }
  }
} catch(e) {console.error('Doctor failed: '+(/^[A-Z_]+$/.test(e.message)?e.message:'Check dependencies, Node and macOS permissions.'));process.exitCode=1;}
finally {await client.close();}
