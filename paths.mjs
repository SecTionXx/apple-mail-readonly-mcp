import { homedir } from 'node:os';
import { join,isAbsolute } from 'node:path';
const custom=process.env.APPLE_MAIL_MCP_HOME;
if(custom && !isAbsolute(custom)) throw Error('APPLE_MAIL_MCP_HOME must be absolute');
export const appHome=custom || join(homedir(),'Library','Application Support','AppleMailMCP');
export const authHome=join(appHome,'auth');
export const dataHome=join(appHome,'data');
