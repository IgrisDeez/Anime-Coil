// Package the verified approved-head release without modifying the original Git checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const out=path.join(root,'docs/kitsu-chibi-review');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const previous=JSON.parse(await fs.readFile(path.join(out,'matched-before-ordinary.json'),'utf8'));
const current=JSON.parse(await fs.readFile(path.join(out,'matched-after-ordinary.json'),'utf8'));
const summary=data=>data.reports.map(r=>({cpu:r.performance.cpuMs,render:r.performance,memory:r.memory,gpu:r.gpu,population:r.population,segments:r.segments,food:r.food}));
const report={version,method:'Same current renderer and fixture; legacy head cache and GLBs substituted only through browser request interception. Three 9-second samples after a 3-second warmup; seeded 21 snakes, 987 segments, 850 food, 1440x900, DPR 1.',hardware:current.hardware,before:summary(previous),after:summary(current),limitations:'Headless hardware Edge on Intel Iris Xe. Shared host scheduling and short windows limit timing attribution; these are not sustained FPS or physical-phone measurements.'};
await fs.writeFile(path.join(out,'performance-comparison.json'),JSON.stringify(report,null,2));
const line=r=>`${r.performance.cpuMs.median.toFixed(1)} / ${r.performance.cpuMs.p95.toFixed(1)}`;
const first=previous.reports[0],last=current.reports[0];
const notes=`# Approved chibi Kitsu integration — Anime Coil ${version}

The user approved the Balanced Chibi Naruto sculpture and deployment to GPT Sites. The live normal head is now the approved candidate in menu, portraits, player and bot instances. The existing transformed head, fox summon, body cosmetics, IDs and gameplay contracts remain intact.

## Assets and compatibility

The editable source is [the dedicated Blender model](../assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend). Desktop/mobile runtime GLBs contain 5,507 / 3,597 triangles, or **5,859 / 3,949 including the original 352-triangle coil**. Eleven mesh/material batches plus the coil give twelve normal-head draws, with the existing separate restrained silhouette outline. The blue iris is the fourth eye batch; every clone owns its eye transforms while sharing immutable geometry and cached Lambert materials. No skeleton, reflection or glow pass was added.

Y-up, +Z forward, the 0.12 Y sculpt mount and 1.28 Y blink pivot are unchanged. Promotion preserves the entire approved geometry binary and only updates release/approval metadata. Selected-profile preload, accessible loading feedback, synchronous creation, failed-load fallback and profile caches remain in place.

## Review and checks

Actual menu and gameplay screenshots cover all four maps at 1440x900 and 390x844, reduced motion, large 21-Kitsu crowds, Fox Rush, ultimate transformation/recovery, death/respawn, restart and quit. Each context downloaded one initial profile and only two profiles across twelve switches. Geometry/material sharing and independent blink transforms pass; no owned head resources were disposed during removals, map switches or restarts. Forced network failure still initialized procedural menu and gameplay. Browser review reported no page errors. Raw evidence is in [kitsu-chibi-review](kitsu-chibi-review/).

Concurrent local work advanced the app to ${version} and removed the light-theme control. Those edits were preserved; review used the current dark-only UI. The initial sequential timing run was affected by concurrent source changes and is retained only as diagnostic history. The repeated comparison below holds the renderer and fixture constant and substitutes the old head cache and GLBs through browser interception without changing runtime files.

## Matched 21-snake rendering samples

| Measurement | Previous normal head | Approved chibi |
| --- | --- | --- |
| Rendered triangles | ${first.performance.triangles} | ${last.performance.triangles} |
| Draw calls | ${first.performance.calls} | ${last.performance.calls} |
| GPU geometry resources | ${first.memory.geometries} | ${last.memory.geometries} |
| Textures / programs | ${first.memory.textures} / ${first.memory.programs} | ${last.memory.textures} / ${last.memory.programs} |
| CPU median / p95 ms, run 1 | ${line(previous.reports[0])} | ${line(current.reports[0])} |
| CPU median / p95 ms, run 2 | ${line(previous.reports[1])} | ${line(current.reports[1])} |
| CPU median / p95 ms, run 3 | ${line(previous.reports[2])} | ${line(current.reports[2])} |

Three nine-second samples follow a three-second warmup on hardware-accelerated headless Edge / Intel Iris Xe, seed 812, 987 body segments, 850 food, Shibuya, DPR 1. Timing variation and any measured regressions are retained in [the comparison JSON](kitsu-chibi-review/performance-comparison.json); no zero-regression or sustained FPS claim is made. The extra iris adds one geometry resource and one visible draw in this camera sample; normal-head geometry remains within both profile budgets. Physical-phone touch, thermal behavior and prolonged real-device rendering remain unverified. Side and rear anatomy are inferred from the supplied references.

## Delivery and publication

The existing user-owned preview remains at http://127.0.0.1:4175/. The refreshed source archive includes the editable model, exports, comparison sheets and game screenshots. GPT Sites receives the verified production build in its own source checkout, preserving the original dirty Git checkout. Publication follows the user's explicit approval; the new Site retains its default private audience.
`;
await fs.writeFile(path.join(root,`docs/KITSU-CHIBI-${version}.md`),notes);
const readmePath=path.join(root,'README.md');
let readme=await fs.readFile(readmePath,'utf8');
if(!readme.includes('## Approved chibi Kitsu integration'))readme=readme.replace(/^# Anime Coil[^\n]*/,`# Anime Coil v${version} — Approved Chibi Kitsu`).replace(/\n## /,`\n## Approved chibi Kitsu integration\n\nThe approved Balanced Chibi Naruto sculpture is integrated into menu, portraits and gameplay with blue irises and independent blinking. Desktop/mobile heads including the coil use **5,859 / 3,949 triangles**. Cached preload, fallback, shared resources, cinematics and gameplay are preserved. The current v${version} local UI changes remain intact. See [the integration report](docs/KITSU-CHIBI-${version}.md), [four-view renders](assets/kitsu/candidates/chibi-naruto/four-view-renders.jpg) and [in-game review](docs/kitsu-chibi-review/). Deployment to GPT Sites is explicitly approved.\n\n## `);
await fs.writeFile(readmePath,readme);
for(const relative of ['assets/kitsu/README.md','assets/kitsu/candidates/chibi-naruto/README.md']){
 const file=path.join(root,relative);let text=await fs.readFile(file,'utf8');
 if(!text.includes('## Approved integration update'))text=`## Approved integration update\n\nThe user approved this candidate for integration and GPT Sites deployment. The live game is now v${version}, preserving concurrent local UI changes. Active editable source: \`assets/kitsu/candidates/chibi-naruto/kitsu-chibi-naruto.blend\`; public GLBs contain 11 batches and four eye batches. Desktop/mobile totals including the coil: 5,859 / 3,949 triangles. See \`docs/KITSU-CHIBI-${version}.md\`. The notes below describe the earlier review or asset state and are retained as history.\n\n`+text;
 await fs.writeFile(file,text);
}
// Record source/build content, excluding user data and Git metadata.
const trackedInputs=['src','public','tests','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html'];
const hashes={};
async function walk(relative){const target=path.join(root,relative),stat=await fs.stat(target).catch(()=>null);if(!stat)return;if(stat.isDirectory()){for(const name of await fs.readdir(target))await walk(path.join(relative,name));}else hashes[relative.replaceAll('\\','/')]=crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex');}
for(const entry of trackedInputs)await walk(entry);
await fs.writeFile(path.join(out,'release-input-hashes.json'),JSON.stringify(hashes,null,2));
console.log('release documentation and source fingerprints written for',version);
