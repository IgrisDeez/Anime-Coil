"""Collate raw captures, matched measurements and unchanged gameplay/asset hashes."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/ultimate-catastrophe'
NAMES={'fox':'Kitsu','spirit':'Kairo','purple':'Shiro','skybreaker':'Pomu'}
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def average(rows,k):return sum(r[k] for r in rows)/len(rows) if rows else None
def summary(data):
    result={}
    for candidate,label in [(False,'before'),(True,'after')]:
        runs=[r for r in data['samples'] if r['candidate']==candidate];last=runs[-1]
        cpu=[r['diagnostics']['performance']['cpuMs'] for r in runs]
        gpu=[r['diagnostics']['gpu']['ms'] for r in runs if r['diagnostics']['gpu']['available'] and r['diagnostics']['gpu']['ms']['samples']]
        result[label]={'cpu':{k:average(cpu,k) for k in ['median','p95']},'cpuRuns':cpu,'gpu':{k:average(gpu,k) for k in ['median','p95']},'gpuRuns':gpu,'calls':last['diagnostics']['performance']['calls'],'triangles':last['diagnostics']['performance']['triangles'],'memory':last['diagnostics']['memory'],'drawsBySubsystem':last['draws'],'raf':{k:average([r['diagnostics']['performance']['rafMs'] for r in runs],k) for k in ['median','p95']},'cpuStages':{stage:{k:average([r['diagnostics']['performance']['stages'][stage] for r in runs],k) for k in ['median','p95']} for stage in ['effects','environment','submit']}}
    result['change']={metric:{k:(result['after'][metric][k]/result['before'][metric][k]-1)*100 if result['before'][metric][k] else None for k in ['median','p95']} for metric in ['cpu','gpu','raf']}
    return result

samples={}
for folder in ['performance','performance-v174','performance-repeat','performance-fixed-camera']:
    for p in sorted((OUT/folder).glob('*.json')):
        if p.name=='browser-errors.json':assert read(p)==[];continue
        d=read(p);samples[folder+'/'+p.name]={'profile':p.name.split('-')[0],'kind':d['kind'],'phase':d['phase'],'hardware':d['hardware'],'baselineVersion':d.get('baselineVersion','175'),'fixedCamera':d.get('fixedCamera',False),'warmMs':d['warmMs'],'sampleMs':d['sampleMs'],**summary(d)}
assert len([k for k in samples if k.startswith('performance/')])==26
assert len([k for k in samples if k.startswith('performance-v174/')])==10
flags=read(OUT/'investigation-flags.json')
assert all('performance-repeat/'+r['file'] in samples for r in flags)
preserved=read(OUT/'preserved-before.json')
current={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in preserved}
assert current==preserved
(OUT/'preserved-after.json').write_text(json.dumps(current,indent=2)+'\n')
captures=read(OUT/'captures.json');app=read(OUT/'application/validation.json');live=read(OUT/'application/live-wipe-validation.json');keyframes=read(OUT/'application/exact-keyframes.json')
assert captures['errors']==app['errors']==live['errors']==[]
assert len(captures['results'])==112 and len(app['results'])==53 and len(live['results'])==len(keyframes)==8
for r in live['results']:
    first=next(s for s in r['trace'] if s['detonated']);assert first['kills']==20 and first['alive']==0 and first['keyframe'] and first['coreVisible']
    assert r['head'] and not r['form'] and all(b['count']==0 for b in r['blast']['batches'])
peaks={}
for profile,label,limit in [('desktop','desktop',24),('mobile','phone',16)]:
    for kind in NAMES:
        rows=[r for r in captures['results'] if r['label']==label and r['kind']==kind and r['candidate']]
        peak=max(r['draws'].get(kind,0)+r['draws'].get('ultimate-blast',0) for r in rows)
        assert peak<=limit;peaks[profile+'-'+kind]=peak

report={'candidateVersion':'1.7.6','packageVersion':read(ROOT/'package.json')['version'],'publication':'Awaiting the agreed combined visual approval; existing GPT Site remains 1.7.4','method':'Frozen 1.7.5 and 1.7.4 effect implementations in the same current renderer; seed 812, 21 held living snakes, mass 48, 850 food, Shibuya, DPR 1; ABBA. Initial 2s warm / 3.5s sample, flagged same-camera repeats 4s warm / 6s sample, supplemental fixed-camera impact repeats. Values are arithmetic means of two run medians/p95s, not pooled quantiles. GPU uses sparse nonblocking timer queries. All measurements retained.','allSamples':samples,'initialFlags':flags,'effectDrawPeaks':peaks,'blastPool':{'materials':4,'geometryBatches':4,'desktopTriangles':2690,'mobileTriangles':1436,'desktopCounts':{'coreAndSatellites':9,'waves':3,'streaks':32,'fragments':32,'sparks':64,'smoke':24},'mobileCounts':{'coreAndSatellites':4,'waves':2,'streaks':16,'fragments':16,'sparks':32,'smoke':10}},'preservedFiles':current,'validation':{'tests':329,'matchedHeldCaptures':112,'applicationChecks':53,'liveWipes':8,'exactKeyframes':8,'errors':[]},'limitations':'Hardware-accelerated headless Edge, Intel Iris Xe / ANGLE D3D11; short held-stage samples and sparse GPU queries on a shared Windows host. Cinematic camera differences change visible scene submissions. Browser phone-width captures do not validate physical-phone performance, touch or thermal behavior. Roster heads remain separate candidates.'}
(OUT/'performance-comparison.json').write_text(json.dumps(report,indent=2)+'\n')

def ms(v):return f"{v['median']:.2f} / {v['p95']:.2f}"
def table(keys):
    lines=['| Profile / character / stage | Triangles before → candidate | Calls | G/T/P resources | CPU median / p95 ms | CPU change | GPU median / p95 ms |','| --- | ---: | ---: | --- | --- | --- | --- |']
    for key in keys:
        r=samples[key];a,b=r['before'],r['after'];mem=lambda x:'/'.join(str(x['memory'][k]) for k in ['geometries','textures','programs'])
        lines.append(f"| {r['profile']} · {NAMES[r['kind']]} · {r['phase']} | {a['triangles']:,} → {b['triangles']:,} | {a['calls']} → {b['calls']} | {mem(a)} → {mem(b)} | {ms(a['cpu'])} → {ms(b['cpu'])} | {r['change']['cpu']['median']:+.1f}% / {r['change']['cpu']['p95']:+.1f}% | {ms(a['gpu'])} → {ms(b['gpu'])} |")
    return '\n'.join(lines)
rows=lambda folder:[k for k in samples if k.startswith(folder+'/')]
repeat_flags=[{'key':k,'cpu':r['change']['cpu'],'gpu':r['change']['gpu'],'raf':r['change']['raf']} for k,r in samples.items() if k.startswith('performance-repeat/') and any(v is not None and v>10.00001 for metric in ['cpu','gpu'] for v in r['change'][metric].values())]
notes="""# Anime Coil 1.7.6 candidate — Catastrophic Ultimate VFX

The local candidate rebuilds the four finisher impacts around a shared, arena-scale blast kit. Each keeps a distinct shape and palette: Kitsu has golden claw arcs and offset chakra explosions around the approved violet tailed-beast projectile; Kairo has a compact unstable blue sphere, white-blue radial beams and a raised plasma shell; Shiro has a fractured purple-white burst, broken waves and long jagged cracks; Pomu has stronger elastic fist compression, cream/ink loops and rebounding pressure fronts. Smoke and residual fragments continue through a bounded aftermath instead of ending immediately after the hit.

## Review and release state

This is a **1.7.6 visual-review candidate**. Package and visible versions deliberately remain **1.7.5**. The existing public GPT Site remains **1.7.4**; neither the unfinished prior release nor this candidate was published during this work. The agreed combined visual approval precedes the 1.7.6 version bump and publication to that same Site. Kairo, Pomu and Shiro normal-head approvals remain separate.

Local gameplay: http://127.0.0.1:4175/. Interactive held comparison: http://127.0.0.1:4175/tests/ultimate-review.html. Choose candidate/baseline, profile, comfort flags and boundary/crowd options. `ultimateReview.select(false,'174')` selects the older frozen effect baseline for reproducible diagnostics.

- [Animated candidate preview](ultimate-catastrophe/animated-preview.webm)
- [Animated before/candidate comparison](ultimate-catastrophe/animated-comparison.webm)
- [Matched charge and expansion screenshots](ultimate-catastrophe/comparison.png)
- [Timeline](ultimate-catastrophe/timeline.png), [exact kill keyframes](ultimate-catastrophe/exact-keyframes.png), [phone-width application screenshots](ultimate-catastrophe/phone-review.png)

All media comes from actual browser rendering. Video captures are 25 fps; montages resample to 12 fps using recorded simulation/wall-time traces, so visual alignment is approximate. No blast imagery is painted or generated. Exact-keyframe screenshots hold browser scheduling immediately after the real application's first kill render. Ordinary live recordings and the fixed-step trace independently demonstrate the wipe and later restoration. Held comparison crowds intentionally remain alive for a matched 21-snake rendering load; live gameplay eliminates all 20 opponents.

## Runtime and gameplay

`UltimateVisualClock` returns one reused presentation frame consumed by the DOM artwork, effect owners, world blast, lighting response and camera punch. It latches the first authoritative detonated render, including a render arriving after the ideal timestamp. The manga keyframe and bright core therefore occur on the same rendered beat as the wipe. Reduced flashes removes the hard keyframe and suppresses the abrupt light response; reduced motion additionally removes the fast streaks, satellites, tail whip and camera movement while retaining subdued broad shapes. Camera disabled preserves gameplay framing.

The authoritative blast remains at 3.4 seconds and the cinematic completes at 5.6. Captured fixed-step traces cross the threshold at 3.4167 seconds (occasionally the next render at 3.4333), consistent with the existing fixed-step simulation. Normal heads restore at completion. Cooldowns, deterministic RNG, kills, collisions, trajectories, radius-based mouth clearance, body cosmetics, transformed heads and respawn behavior remain intact.

The simulation, head factory, Kitsu cache and latest eye fixes, Kurama cache and both approved profiles are byte-for-byte identical to the pre-candidate snapshot: eight verified SHA-256 hashes are recorded in `ultimate-catastrophe/preserved-before.json` and `preserved-after.json`. Renderer/effect updates are state-readonly in the all-stage checks. Shibuya remains the only arena.

## Bounded rendering kit

The renderer owns four immutable geometry batches and four cached materials: core/satellite billboards, warped ring fronts, segmented streaks/fragments/sparks, and smoke billboards. Seeded render-only events are written once per impact/kind and reused across profile changes; no arena randomness is consumed. Profile changes retain the common event prefix, pose and cinematic time. Per-frame work sets object transforms and shader uniforms/counts; it creates no blast geometry or materials. Shaders are warmed before the first impact. The existing bounded elastic-arm updates remain.

| Pool | Desktop | Mobile |
| --- | ---: | ---: |
| Main core plus satellites | 9 | 4 |
| Warped fronts | 3 | 2 |
| Long streaks | 32 | 16 |
| Fragments | 32 | 16 |
| Sparks | 64 | 32 |
| Smoke lobes | 24 | 10 |
| Submitted new blast triangles | 2,690 | 1,436 |
| New blast draws / materials | 4 / 4 | 4 / 4 |

Reduced motion uses one core, one fixed front, eight subdued sparks and four smoke lobes. The far front scales from impact position to pass the opposite arena boundary. It is excluded from camera-fit bounds. The recoil/FOV pulse settles within 300 ms; portrait framing uses a higher angle to reduce foreground-building obstruction and blends back during recovery. Aftermath duration from the hit is 1.5 seconds for Fox/Purple, 1.4 for Spirit and 1.2 for Skybreaker.

The managed blast replaces overlapping legacy impact layers; their hidden instance counts are zero before any old update loop. Production owners no longer create four separate two-material pressure kits. The shared kit is disposed once at renderer teardown, and cleared on completion, death, restart, quit and map reset. Approved asset caches survive individual snake removals and map rebuilds. There is no new glow/reflection pass, skeleton or light.

Peak submitted effect draws across the audited held stages:

"""
notes+='\n'.join(f"- {profile}: "+', '.join(f"{NAMES[kind]} {peaks[profile+'-'+kind]}" for kind in NAMES)+f" (budget {'24' if profile=='desktop' else '16'} each)." for profile in ['desktop','mobile'])
notes+="""

## Validation

`npm test`: **329 passed**, including preserved authoritative regressions, asset schema/orientation/bounds/profile budgets, cache/fallback/disposal contracts, independent blinking, finite geometry, seeded profile reuse, skipped-render kill presentation and comfort flags. `npm run build` passes; Vite retains the existing Three.js chunk-size advisory. Diff checks pass.

The application validation records **53 checks** at 1440×900 and 390×844: normal menu assets, selected-only initial profile requests, subsequent caching, no candidate-head downloads, state-readonly held updates, profile switching during a detonated 3.65-second impact without reset, normal-head restoration, death/respawn, restart/quit, stable repeated Shibuya rebuild resources, actual reduced-motion/flash/camera controls and failed-load fallback. Eight live casts additionally prove the 20-opponent wipe and restored normal head; eight exact-keyframe stills show the synchronized impact. The held review produces 112 before/candidate stage captures, plus comfort, camera-disabled, large same-character crowd and boundary-cast screenshots. All captures report no page/shader errors.

## Matched performance measurements

The seeded held scene has 21 living snakes of mass 48 and 850 food on Shibuya. Hardware is headless Edge on Intel Iris Xe, ANGLE D3D11, DPR 1. Frozen effect sources use the same current renderer/caches to isolate effect implementations; full previous-version application videos additionally verify the prior presentation. The shared warmed shader kit is present in the diagnostic renderer for both variants, so resource totals are not cold-start release-footprint measurements. Camera differences can reveal different scene objects, especially in portrait mode; supplementary camera-disabled pairs isolate that variable.

All pairs use ABBA order. Initial windows use 2 seconds warmup and 3.5 seconds measurement; every initial CPU/GPU mean-of-runs regression above 10% gets a 4-second warmup / 6-second repeat. The tables average two run medians and two p95s; they do not pool frame quantiles. G/T/P means uploaded geometries/textures/programs. GPU timing is sparse and asynchronous (one query every 30 renders), with raw sample counts retained. Whole-scene counts include ordinary scene/head draws. Timing is not a physical-phone FPS guarantee.

### Initial 1.7.5 comparison

"""+table(rows('performance'))+"""

### Longer repeats of all flagged initial windows

"""+table(rows('performance-repeat'))+"""

### Frozen 1.7.4 ordinary/impact comparison

"""+table(rows('performance-v174'))+"""

### Supplemental fixed-camera impact pairs

"""+table(rows('performance-fixed-camera'))+'\n\n'
notes+=f"{len(repeat_flags)} longer repeat windows still exceed 10% in at least one CPU/GPU summary. These are retained in `performance-comparison.json`; remaining costs and host variance are discussed in the review findings below. Ordinary-play geometry/draw counts are identical; impact draw reductions do not imply zero CPU cost.\n\n"
notes+='## Review findings and limitations\n\nSee `ultimate-catastrophe/performance-findings.md` for the final interpretation of the original, repeated and fixed-camera runs. Physical-phone touch, sustained GPU/thermal performance and prolonged live-play review remain unverified. Side/rear anatomy of the separate Blender roster candidates remains inferred.\n\nKairo, Pomu and Shiro editable models, desktop/mobile GLBs, four actual studio views, comparisons and coil studies remain in `assets/roster/candidates/` and `docs/roster-review/`. Production head/outline factories stay unchanged; no candidate is silently promoted. See [roster review](ROSTER-POLISH.md).\n\nThe refreshed source/review archive receipt is `ultimate-catastrophe/local-archives.json`. Publication and visible/package version promotion are the next step after the agreed visual approval. No GitHub publication or additional Site is part of this candidate.\n'
(ROOT/'docs/ULTIMATE-VFX-1.7.6-REVIEW.md').write_text(notes,encoding='utf-8')
print(json.dumps({'allPairedWindows':len(samples),'initialFlags':len(flags),'repeatFlags':repeat_flags,'effectPeaks':peaks,'preservedFiles':len(current)},indent=2))
