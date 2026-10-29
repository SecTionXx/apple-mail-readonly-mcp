import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
export async function dependency(name) {return import(pathToFileURL(require.resolve(name)).href);}
