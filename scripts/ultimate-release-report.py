"""Record all paired rendering samples, including noisy/regressed windows."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/ultimate-polish'
NAMES={'fox':'Kitsu','spirit':'Kairo','skybreaker':'Pomu','purple':'Shiro'}
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def summary(data):
    out={}
    for value,label in [(False,'before'),(True,'after')]:
        runs=[r for r in data['samples'] if r['candidate']==value]
        cpu=[r['diagnostics']['performance']['cpuMs'] for r in runs];last=runs[-1]
        out[label]={'cpuMeanOfRuns':{k:sum(c[k] for c in cpu)/len(cpu) for k in ['median','p95']},'cpuRuns':cpu,'calls':last['diagnostics']['performance']['calls'],'triangles':last['diagnostics']['performance']['triangles'],'memory':last['diagnostics']['memory'],'drawsBySubsystem':last['draws'],'gpuRuns':[r['diagnostics']['gpu'] for r in runs]}
    out['percentChange']={k:(out['after']['cpuMeanOfRuns'][k]/out['before']['cpuMeanOfRuns'][k]-1)*100 for k in ['median','p95']}
    return out
canonical=[];all_samples={}
for folder in ['performance','performance-confirm','performance-final','performance-quiet','performance-mobile-core']:
    for p in sorted((OUT/folder).glob('*.json')):
        if p.name=='browser-errors.json':assert read(p)==[];continue
        data=read(p);all_samples[folder+'/'+p.name]={'hardware':data['hardware'],'kind':data['kind'],'phase':data['phase'],'warmMs':data['warmMs'],'sampleMs':data['sampleMs'],**summary(data)}
for profile in ['desktop','mobile']:
    for kind,phase in [('fox','ordinary-21'),('fox','charge'),('fox','impact'),('spirit','charge'),('spirit','impact'),('skybreaker','charge'),('skybreaker','impact'),('purple','charge'),('purple','impact')]:
        folder='performance'
        if kind=='spirit':folder='performance-final' if profile=='desktop' else 'performance-confirm'
        if profile=='desktop' and kind=='spirit' and phase=='impact':folder='performance-quiet'
        if kind=='purple':folder='performance-final'
        if profile=='mobile' and kind=='purple' and phase=='charge':folder='performance-mobile-core'
        key=f'{folder}/{profile}-{kind}-{phase}.json';canonical.append({'profile':profile,'key':key,**all_samples[key]})
preserved=read(OUT/'preserved-before.json');current={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest().upper() for p in preserved};assert current==preserved
(OUT/'preserved-after.json').write_text(json.dumps(current,indent=2)+'\n',encoding='utf-8')
capture=read(OUT/'captures.json');application=read(OUT/'application/validation.json');assert application['errors']==[]
roster=read(ROOT/'docs/roster-review/validation.json');assert roster['errors']==[]
peaks={}
for profile,label in [('desktop','desktop'),('mobile','phone')]:
    for kind in NAMES:
        rows=[r for r in capture if r['label']==label and r['kind']==kind and r['candidate'] and r['phase'] in ['charge','release','hit','shockwave','recovery']]
        peaks[profile+'-'+kind]=max(r['draws'].get(kind,0) for r in rows)
assert peaks['desktop-fox']<=24 and peaks['mobile-fox']<=16
report={'version':'1.7.5','method':'Frozen 1.7.4 effects versus final effects in the same real GameRenderer; seeded held 21-snake Shibuya scene, mass 48, 850 food, DPR 1; ABBA paired samples. Initial 2s warm / 3.5s sample; targeted final-source and quiet repeats use 4s warm / 6s sample. CPU summaries are the arithmetic mean of two run medians and two run p95s, not pooled quantiles. All exploratory runs remain recorded.','canonical':canonical,'allSamples':all_samples,'effectDrawPeaks':peaks,'preserved':current,'validation':{'applicationRecords':len(application['results']),'applicationErrors':[],'rosterErrors':[]},'limitations':'Hardware-accelerated headless Edge on Intel Iris Xe; shared-host CPU/driver scheduling and short held-stage windows. No physical-phone touch, thermal or prolonged live-match validation. Side/rear roster anatomy is inferred. Staged head candidates are not default-integrated.'}
(OUT/'performance-comparison.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
def cpu(v):return f"{v['median']:.2f} / {v['p95']:.2f}"
lines=[]
for r in canonical:
    a,b=r['before'],r['after'];mem=lambda x:f"{x['memory']['geometries']}/{x['memory']['textures']}/{x['memory']['programs']}"
    lines.append(f"| {r['profile']} · {NAMES[r['kind']]} · {r['phase']} | {a['triangles']:,} → {b['triangles']:,} | {a['calls']} → {b['calls']} | {mem(a)} → {mem(b)} | {cpu(a['cpuMeanOfRuns'])} → {cpu(b['cpuMeanOfRuns'])} | {r['percentChange']['median']:+.1f}% / {r['percentChange']['p95']:+.1f}% |")
notes="""# Anime Coil 1.7.5 — Ultimate VFX polish and Blender roster review

All four ultimates now have stronger visual separation between charge, launch and impact. Kitsu keeps the approved Kurama sculpture and mouth-launched purple-black bomb; violet channel/rim contrast and an outward burst improve the hit. Kairo's focal orb has deeper cyan-blue flow and restrained white compression veins; decorative debris uses a low-detail shared mesh. Pomu's elastic fist compresses through windup before release, with a cream/ink pressure burst. Shiro's merged purple core has darker depth, visible flow and a narrow rim; its mobile profile uses one simpler directional wave.

## Gameplay and resource boundaries

The simulation, Kitsu normal-head cache, procedural head factory, approved Kitsu/Kurama GLBs and Kurama asset cache are byte-for-byte identical to the saved 1.7.4 baseline; verified hashes are in `ultimate-polish/preserved-before.json` and `preserved-after.json`. Character IDs, body cosmetics, transformed heads, summon/muzzle anchors, trajectories, ground clearance, staging and the existing 5.6-second timelines are preserved. Rendering-only updates never change arena state in the all-stage tests or application captures.

Each ultimate adds one short pressure-front mesh and one bounded instanced batch of tapered impact strokes. Those meshes are constructed once and disposed once by the cinematic owner. Desktop/mobile stroke counts are 18/10; reduced motion removes strokes and uses one subdued fixed-radius front. No new light, bloom pass, reflection, skeleton or frame-time mesh construction is introduced. Existing flash settings and reduced-motion/cinematic-camera controls remain. Purple now clears and disposes its owned resources consistently on lifecycle transitions and respects the camera-disabled option.

The front adds 64 triangles; strokes add 108 desktop / 60 mobile triangles. Kairo's decorative petals/motes switch from the focal orb's 1,472-triangle sphere to a shared 20-triangle icosahedron, retaining pool limits and preserving the smooth focal orb. Shiro's outer shell is reserved for impact; charge uses its existing core draw. Two impact draws remain the deliberate visual cost. Peak audited fox calls remain within 24 desktop / 16 mobile.

## Validation and visual review

`npm test` passes **326 tests**, including preserved simulation regressions and new checks for all six actual head exports, selected-profile caching, shared resources, independent blink transforms, malformed/failed/late loads, once-only disposal, finite bounded effect geometry, all-stage arena-state parity and camera-disabled behavior. `npm run build` and diff checks pass. Two existing visual tests now identify the named Spirit Bomb surface rather than treating the last shader mesh as the orb; their original detail/height assertions remain.

The actual application check records 53 results across desktop 1440×900 and phone-width 390×844, with no page errors. Each initial context loads one Kitsu and one Kurama GLB for the selected profile, caches the other profile on demand, and downloads no candidate roster head. All four effects are captured at charge, release, hit, shockwave and recovery. Normal-head restoration, death/respawn, restart, quit, profile switching without cinematic-time reset, reduced motion/flash settings, camera disabled, repeated Shibuya rebuilds and failed asset loads pass. Settled resource counts remain stable across repeated rebuilds.

The held review additionally includes large coils, same-character crowds and arena-boundary casts. Its scene intentionally retains 21 snakes at each held stage so rendering comparisons have the same population; it does not replace the authoritative wipe or simulate live eliminations. The production game retains its original authoritative outcomes. Actual comparison/timeline sheets and individual screenshots are in `ultimate-polish/`; real-application screenshots and validation are in `ultimate-polish/application/`.

## Matched rendering measurements

Measurements use the same current GameRenderer and frozen 1.7.4 effect files in `src/ultimate-baseline/`, seed 812, 21 snakes of mass 48 and 850 food, Shibuya, DPR 1. ABBA samples isolate ordinary rendering and held charge/impact stages. CPU columns report the arithmetic mean of two medians and two p95s; these are not pooled quantiles. Counts are whole-scene submissions, and resources are uploaded geometry/texture/program counts at the end of each sample. Frustum culling explains different visible populations between cinematic cameras.

Initial windows are 2 seconds warmup / 3.5 seconds measurement. Above-10% exploratory differences were investigated through targeted 4/6-second repeats, removal of the extra Shiro charge shell, cheaper shader arithmetic and the mobile core variant. Quiet repeats isolate host activity. The table selects final-source runs by variant; all earlier runs, flags and GPU samples remain in `ultimate-polish/performance-comparison.json` and the raw folders.

| Profile / character / stage | Triangles before → after | Calls before → after | Geometry/texture/program resources before → after | CPU median / p95 ms before → after | Median / p95 change |
| --- | ---: | ---: | --- | --- | --- |
"""+'\n'.join(lines)+"""

The longer quiet check did not reproduce the initial Kairo desktop-impact median regression. The final simplified mobile Shiro charge no longer shows the earlier median slowdown. Desktop Shiro charge still records a mean p95 increase above 10% in its final window, while its median and GPU p95 improve; the initial window did not show that p95 increase. This variation is retained, not presented as zero regression or sustained FPS. Kairo mobile impact has a small p95 cost from the two additional bounded impact draws. Shared-host scheduling/driver variation limits attribution, and physical-phone performance remains unverified.

## Separate Blender candidates

Kairo, Pomu and Shiro each have a dedicated editable `.blend`, applied-transform desktop/mobile GLBs, actual front/three-quarter/side/rear studio renders, current-head reference comparisons and original-coil attachment studies. Their game coordinates remain Y-up, +Z forward, origin zero, 0.12 Y mount and 1.28 Y blink pivot. Normals/geometry and bounds pass validation. Existing unrelated Blender objects and previous candidates were retained in separate scenes/collections; the task-owned localhost connection was stopped after saving.

| Head | Desktop/mobile triangles including original coil | Batches including coil |
| --- | ---: | ---: |
| Kairo | 4,494 / 3,058 | 10 |
| Pomu | 5,685 / 3,749 | 12 |
| Shiro | 4,120 / 2,874 | 7 |

One cached restrained outline draw is separate. Kairo/Pomu have four eye batches; Shiro retains a named empty blink pivot beneath the blindfold. All three stay within 6,000/4,000 triangles and twelve normal-head draws. `src/roster-head.ts` remains an isolated review cache, with production `createHead` and `createHeadOutline` unchanged. The staged real-renderer review demonstrates menu-coil, portrait and 21-snake gameplay attachment, selected profiles, independent resources/blinking, fallback, large crowds, reduced motion and lifecycle restoration.

See `assets/roster/README.md`, `docs/roster-review/` and `docs/ROSTER-POLISH.md`. These normal heads remain candidates pending one visual approval per character, starting with Kairo. The published VFX release retains the existing normal heads. Side and rear anatomy is inferred; physical-phone touch, thermal behavior and prolonged live play remain unreviewed.

## Release delivery

Package/visible versions and documentation are 1.7.5. The local preview is refreshed at http://127.0.0.1:4175/; interactive local review pages are `/tests/ultimate-review.html` and `/tests/roster-review.html`. The refreshed source archive includes editable models, exports and review evidence. Publication updates the existing Anime Coil GPT Site and preserves its public audience; no GitHub publication or new Site. The native deployment receipt is stored in `ultimate-polish/deployment.json` after publishing.
"""
(ROOT/'docs/ULTIMATE-VFX-1.7.5.md').write_text(notes,encoding='utf-8')
print(json.dumps({'samples':len(all_samples),'finalRows':len(canonical),'effectPeaks':peaks,'preservedFiles':len(current),'above10':[{ 'profile':r['profile'],'kind':r['kind'],'phase':r['phase'],'change':r['percentChange']} for r in canonical if max(r['percentChange'].values())>10.0001]},indent=2))
