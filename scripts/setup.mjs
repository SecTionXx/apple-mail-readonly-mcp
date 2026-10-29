import { mkdir,writeFile,copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=join(root,'generated-configs');
await mkdir(target,{recursive:true});
async function save(name,text) {
  const path=join(target,name);
  try {await copyFile(path,path+'.backup-'+Date.now());}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(path,text,{mode:0o600});
}
const server=join(root,'server.mjs');
const launch={command:process.execPath,args:[server]};
if(process.env.APPLE_MAIL_MCP_HOME)launch.env={APPLE_MAIL_MCP_HOME:process.env.APPLE_MAIL_MCP_HOME};
await save('mcp.json',JSON.stringify({mcpServers:{'apple-mail-readonly':launch}},null,2)+'\n');
await save('codex.toml',`[mcp_servers.apple-mail-readonly]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(server)}]\nstartup_timeout_sec = 20\ntool_timeout_sec = 60\n`+(launch.env?`[mcp_servers.apple-mail-readonly.env]\nAPPLE_MAIL_MCP_HOME = ${JSON.stringify(process.env.APPLE_MAIL_MCP_HOME)}\n`:''));
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const environment=launch.env?`export APPLE_MAIL_MCP_HOME=${quote(process.env.APPLE_MAIL_MCP_HOME)}\n`:'';
await save('run-server.sh',`#!/bin/sh\n${environment}exec ${quote(process.execPath)} ${quote(server)}\n`);
const extra=launch.env?' -c '+quote('mcp_servers.apple-mail-readonly.env.APPLE_MAIL_MCP_HOME='+JSON.stringify(process.env.APPLE_MAIL_MCP_HOME)):'';
await save('codex-with-mail.sh',`#!/bin/sh\nexec codex -c ${quote('mcp_servers.apple-mail-readonly.command='+JSON.stringify(process.execPath))} -c ${quote('mcp_servers.apple-mail-readonly.args='+JSON.stringify([server]))}${extra} -c 'mcp_servers.apple-mail-readonly.tool_timeout_sec=60' "$@"\n`);
console.log('Generated client settings. No existing client/global configuration changed.');
