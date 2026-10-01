// Windows recovery for the bundled Sites Bash packager. Reuse its shared validator.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const [project,archive]=process.argv.slice(2);
if(!path.isAbsolute(project)||!path.isAbsolute(archive))throw Error('Use absolute project/archive paths');
const stage=await fs.mkdtemp(path.join(os.tmpdir(),'anime-coil-sites-package-'));
const helper='C:/Users/denze/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/skills/sites-hosting/scripts/prepare-site-build.cjs';
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.error?.message||'Packaging failed');return r.stdout;};
try{
 const kind=run(process.execPath,[helper,project,path.join(stage,'dist')]).trim();
 assert.equal(kind,'static','This game deploys as a static build');
 const metadata=JSON.parse(await fs.readFile(path.join(stage,'dist/.openai/hosting.json'),'utf8'));
 assert.equal(metadata.project_id,'appgprj_6abe789685a88191a4528067c91c4ac4');
 assert.equal(metadata.static.directory,'dist');
 assert.ok((await fs.stat(path.join(stage,'dist/index.html'))).isFile());
 for(const profile of ['desktop','mobile'])assert.deepEqual(await fs.readFile(path.join(stage,`dist/assets/kitsu/kitsu-head-${profile}.glb`)),await fs.readFile(path.join(project,`public/assets/kitsu/kitsu-head-${profile}.glb`)));
 await fs.mkdir(path.dirname(archive),{recursive:true});
 run('tar',['-C',stage,'-czf',archive,'dist']);
 const entries=run('tar',['-tzf',archive]).replaceAll('\\','/').split(/\r?\n/);
 assert.ok(entries.includes('dist/.openai/hosting.json'));assert.ok(entries.includes('dist/index.html'));
 console.log(JSON.stringify({archive,bytes:(await fs.stat(archive)).size,entries:entries.length,validatedBy:helper}));
}finally{
 // Delete only the verified setup-owned staging directory using native APIs.
 const absolute=path.resolve(stage),base=path.resolve(os.tmpdir());
 assert.equal(path.dirname(absolute),base);assert.ok(path.basename(absolute).startsWith('anime-coil-sites-package-'));
 await fs.rm(absolute,{recursive:true,force:true});
}
