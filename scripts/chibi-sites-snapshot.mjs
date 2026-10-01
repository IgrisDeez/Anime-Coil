import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Pass the registered Sites checkout');
const manifestFile=path.join(target,'.openai/hosting.json');
const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
if(manifest.project_id!=='appgprj_6abe789685a88191a4528067c91c4ac4')throw Error('Unexpected Site identity');
const entries=['src','tests','public','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','README.md'];
for(const entry of entries)await fs.cp(path.join(root,entry),path.join(target,entry),{recursive:true});
await fs.mkdir(path.join(target,'docs'),{recursive:true});
await fs.cp(path.join(root,'docs/KITSU-CHIBI-1.7.2.md'),path.join(target,'docs/KITSU-CHIBI-1.7.2.md'));
await fs.cp(path.join(root,'docs/kitsu-chibi-review'),path.join(target,'docs/kitsu-chibi-review'),{recursive:true});
const hashes={};
async function verify(relative){const file=path.join(root,relative),stat=await fs.stat(file);if(stat.isDirectory()){for(const name of await fs.readdir(file))await verify(path.join(relative,name));return;}
 const source=await fs.readFile(file),copy=await fs.readFile(path.join(target,relative));if(!source.equals(copy))throw Error('Source changed during snapshot: '+relative);
 hashes[relative.replaceAll('\\','/')]=crypto.createHash('sha256').update(copy).digest('hex');}
for(const entry of entries)await verify(entry);
await fs.writeFile(path.join(root,'docs/kitsu-chibi-review/published-input-hashes.json'),JSON.stringify(hashes,null,2));
await fs.writeFile(path.join(target,'.gitignore'),'node_modules/\n*.log\n.sites-runtime/\n');
manifest.static={directory:'dist'};
await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
// Reuse the installed dependency tree for the identical lockfile; it is not published.
if(!await fs.lstat(path.join(target,'node_modules')).catch(()=>null))await fs.symlink(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
console.log('Site source snapshot verified:',Object.keys(hashes).length,'files. Production output will be built inside this snapshot.');
