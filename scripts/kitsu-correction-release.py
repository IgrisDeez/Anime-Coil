"""Refresh corrected 1.6.9 delivery with measured, rather than fixed, metrics."""
from pathlib import Path
import json, hashlib, zipfile, re
BASE=Path(__file__).resolve().parents[1]; REVIEW=BASE.parent/'v169-review'
labels=['corrected-procedural-1.6.8','corrected-1.6.9']
evidence=json.loads((BASE/'docs/performance-results-1.6.9.json').read_text(encoding='utf-8'))
evidence['revision']='alignment and surface-fit correction'
evidence['protocol']='Hardware headless Edge / Iris Xe, 1440x900 CSS, DPR 1, Shibuya, seed 812, 21 present snakes, 987 segments, 850 food; short consecutive comparison with 5s warm-up and three 8s rendering windows after substantial drift in the longer runs. Corrected renderer held constant for procedural/new-head comparison. Desktop app/system workload and thermal state are uncontrolled. This is not an advancing simulation or physical-phone benchmark.'
evidence['results']={}
for label in labels:
    evidence['results'][label]=json.loads((REVIEW/(label+'-ordinary.json')).read_text(encoding='utf-8'))
    for key,suffix in [('drawBreakdown','draws'),('uploads','uploads')]:
        evidence['results'][label][key]=json.loads((REVIEW/(label+'-ordinary-'+suffix+'.json')).read_text(encoding='utf-8'))
evidence['longTimingRuns']={label:json.loads((REVIEW/('long-'+label+'-ordinary.json')).read_text(encoding='utf-8')) for label in labels}
for profile,triangles in [('desktop',5341),('mobile',3620)]:
    p=BASE/f'public/assets/kitsu/kitsu-head-{profile}.glb'
    evidence['exports'][profile].update(triangles=triangles,withRetainedCoil=triangles+352,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
evidence['integration']=json.loads((REVIEW/'integration-review.json').read_text(encoding='utf-8'))
assert not evidence['integration']['errors']
assert 'pass 328' in (REVIEW/'tests.log').read_text(encoding='utf-8')
assert 'fail 0' in (REVIEW/'tests.log').read_text(encoding='utf-8')
assert 'pass 6' in (REVIEW/'correction-asset-tests.log').read_text(encoding='utf-8')
evidence['validation']['tests']=328
evidence['validation']['finalAssetTests']=6
(BASE/'docs/performance-results-1.6.9.json').write_text(json.dumps(evidence,indent=2)+'\n')
a=evidence['results'][labels[0]]['reports'];b=evidence['results'][labels[1]]['reports']
table=['The correction uses the same hardware Edge rendering fixture: Shibuya, 1440x900, DPR 1, seed 812, 21 present snakes, 987 segments and 850 food. The consecutive short comparison has 5 seconds warm-up and three 8-second windows per asset choice. Culling remains enabled. These are rendering samples, not an advancing match or physical-phone benchmark. Longer 10-second warm-up / three 30-second runs are also retained in the evidence; their CPU p95 varied from 5.7–7.4 ms for procedural heads to 11.9–14.9 ms for the corrected sculpt, while GPU p95 also rose. This large regression prompted the additional short comparison; it cannot be dismissed as a proven host-only effect.','', '| Metric | Original procedural head | Corrected sculpture |','| --- | ---: | ---: |',f"| Scene triangles | {a[0]['game']['triangles']:,} | {b[0]['game']['triangles']:,} |",f"| Scene draws | {a[0]['game']['calls']} | {b[0]['game']['calls']} |",f"| Geometries / textures / programs | {a[0]['memory']['geometries']} / {a[0]['memory']['textures']} / {a[0]['memory']['programs']} | {b[0]['memory']['geometries']} / {b[0]['memory']['textures']} / {b[0]['memory']['programs']} |"]
for i,(before,after) in enumerate(zip(a,b),1):
    for kind in ['CPU','GPU']:
        x=before['performance']['cpuMs'] if kind=='CPU' else before['gpu']['ms']
        y=after['performance']['cpuMs'] if kind=='CPU' else after['gpu']['ms']
        table.append(f"| {kind} median / p95, window {i} | {x['median']:.2f} / {x['p95']:.2f} ms | {y['median']:.2f} / {y['p95']:.2f} ms |")
table.extend(['','The table reports all windows, including regressions. Host scheduling and thermal state are not controlled; no sustained whole-game improvement is claimed. Existing simulation, upload cadence, culling, body cosmetics and cinematic effects remain unchanged.','', '**328 tests pass**; the final six asset checks also pass after export. The production build and diff checks pass. The existing Three.js chunk-size warning remains.'])
table='\n'.join(table)
doc=BASE/'docs/KITSU-1.6.9.md';text=doc.read_text(encoding='utf-8')
start=text.index('## Matched rendering measurement');end=text.index('## Review limits',start)
text=text[:start]+'## Matched rendering measurement\n\n'+table+'\n\n'+text[end:]
correction='''## Visual correction

The first delivery had eyes protruding from the curved face, low ears, oversized outline seams between overlapping hair pieces, and excessive overlap between the chin and coil. The correction conforms eyes and raised marks to the cheek surface, broadens the cheek/chin balance, raises and angles the recessed ears, reshapes the swept hair, restores layered nape coverage and connects the rear knot and ribbons without intersections.

`KitsuSculptMount_<profile>` lifts the sculpture by 0.12 while the exported head root and existing coil attachment remain at the original origin. The blink pivot remains independent at local Y=1.28 below that mount. Cached Lambert materials provide smoother shading with a restrained material color floor for dark maps; no glow, reflection or extra rendering pass is added. A narrow normal-offset outline excludes the forward hair layers so their overlaps do not become black seams.

The correction remains part of the requested 1.6.9 release. The before model and before image are retained locally. The supplied reference, four-view comparison and [correction sheet](../assets/kitsu/alignment-correction.png) make remaining visual differences reviewable.

'''
if '## Visual correction' not in text:text=text.replace('## Model and exports',correction+'## Model and exports',1)
text=text.replace('toon materials','Lambert materials').replace('1.6.9 — Reference-sculpted','1.6.9 — Corrected reference-sculpted')
text=text.replace('| Desktop | 5,575 | 352 | 5,927 | 11 |','| Desktop | 5,341 | 352 | 5,693 | 11 |').replace('| Mobile | 3,543 | 352 | 3,895 | 11 |','| Mobile | 3,620 | 352 | 3,972 | 11 |')
text=re.sub(r'identity mesh transforms(?: and an internal 0\.12 mount offset)*','identity mesh transforms and an internal 0.12 mount offset',text).replace('`EyesPivot_<profile>` sits at Y=1.28','`EyesPivot_<profile>` sits at local Y=1.28 beneath the mount')
doc.write_text(text,encoding='utf-8')
for file in ['README.md','assets/kitsu/README.md']:
    p=BASE/file;s=p.read_text(encoding='utf-8')
    for old,new in [('5,575','5,341'),('3,543','3,620'),('5,927','5,693'),('3,895','3,972'),('327 tests','328 tests'),('toon materials','Lambert materials')]:s=s.replace(old,new)
    if file=='README.md':
        prefix='Corrected matched rendering samples measure' if 'Corrected matched rendering samples measure' in s else 'Matched rendering samples measure'
        begin=s.index(prefix);finish=s.index('Physical-phone review',begin)
        s=s[:begin]+f"Corrected matched rendering samples measure draws **{a[0]['game']['calls']} -> {b[0]['game']['calls']}** and scene triangles **{a[0]['game']['triangles']:,} -> {b[0]['game']['triangles']:,}**; all CPU/GPU timing windows and measured regressions are recorded in the detailed report. "+s[finish:]
        if 'The visual correction fits' not in s:s=s.replace('## v1.6.9 — Reference-Sculpted Kitsu Head','## v1.6.9 — Reference-Sculpted Kitsu Head\n\nThe visual correction fits the eyes to the face, balances cheeks and ears, lifts the sculpture clear of the retained coil, and softens hair normals and outline seams. See [the correction comparison](assets/kitsu/alignment-correction.png).')
    else:
        s=re.sub(r'(?:`correct_fit.py` and )*`profile_features.py` must run before','`correct_fit.py` and `profile_features.py` must run before',s)
        if 'Correction: the identity asset root' not in s:s+='\nCorrection: the identity asset root retains the coil origin; a named internal mount lifts the sculpt 0.12. Facial surfaces follow the skull and both export budgets include the retained 352-triangle coil. The prior model and image are retained for comparison.\n'
    p.write_text(s,encoding='utf-8')
target=BASE.parent/'anime-coil-source.zip';temp=target.with_suffix('.pending.zip')
with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in BASE.rglob('*'):
        if not p.is_file():continue
        rel=p.relative_to(BASE)
        if any(part in ('node_modules','dist','.git') for part in rel.parts):continue
        if p.suffix in ('.blend1','.log') or p.name in ('preexisting-changes.patch','kitsu-head-before-correction.blend','front-corrected.png'):continue
        z.write(p,'anime-coil/'+str(rel).replace('\\','/'))
with zipfile.ZipFile(temp,'r') as z:
    assert z.testzip() is None
temp.replace(target)
print(table)
print('Corrected release archive:',target)

