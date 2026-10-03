"""Build a release report from actual model, browser and rendering evidence."""
from pathlib import Path
import hashlib, json, struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/living-shibuya-1.7.7'
def read(name):
    return json.loads((OUT / name).read_text(encoding='utf-8'))
def dump(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
def number(value):
    return f'{value:,.0f}'
def pair(row, key):
    return f"{row[key+'Median']:.2f} / {row[key+'P95']:.2f}"
def gpu(row):
    samples = [x['ms'] for x in row['gpu'] if x.get('available') and x.get('ms')]
    if not samples:
        return None
    return {'median': sum(x['median'] for x in samples)/len(samples),
            'p95': sum(x['p95'] for x in samples)/len(samples),
            'samples': sum(x['samples'] for x in samples)}
def gpu_pair(value):
    return 'unavailable' if value is None else f"{value['median']:.3f} / {value['p95']:.3f}"
def memory(row):
    return ' / '.join(str(row['memory'][k]) for k in ['geometries','textures','programs'])

rows = read('performance-final/summary.json')
validation = read('after/validation.json')
movie = read('cinematic/live-validation.json')
assert len(validation['results']) == 93 and not validation['errors']
assert not movie['errors']
assert len(rows) == 8
raw = read('performance-final/raw-abba.json')
assert not raw['errors'] and len(raw['results']) == 32
assert all(x['stateUnchanged'] and x['population'] == 21 and x['food'] == 850 for x in raw['results'])

worlds = {}
for label in ['desktop', 'phone']:
    result = next(x for x in validation['results'] if x.get('label') == label and 'menu' in x)
    worlds[label] = result['menu']['world']
effect_draws = {}
for label in ['desktop', 'phone']:
    effect_draws[label] = max(x['draws'].get('skybreaker',0)+x['draws'].get('ultimate-blast',0)+8
                            for x in validation['results'] if x.get('label')==label and x.get('id')=='cloud' and 'stage' in x)

preserved = read('preserved-files.json')
for entry in preserved:
    data = (ROOT / entry['path']).read_bytes()
    if entry['mode'] == 'canonical LF text':
        data = data.replace(b'\r\n', b'\n')
    assert hashlib.sha256(data).hexdigest().upper() == entry['sha256']
assert all(x['unchanged'] for x in preserved)

assets = []
for family in ['shibuya','pomu']:
    for path in sorted((ROOT/'public/assets'/family).glob('*.glb')):
        data=path.read_bytes();header=struct.unpack_from('<III',data)
        assert header[0]==0x46546C67 and header[1]==2 and header[2]==len(data)
        assets.append({'path':path.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for path in [ROOT/'assets/shibuya/v177/living-shibuya-editable.blend',ROOT/'assets/pomu-gear5/v177/pomu-gear5-editable.blend']:
    data=path.read_bytes();assets.append({'path':path.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
dump(OUT/'asset-manifest.json',assets)
summary={'version':'1.7.7','baselineCommit':'1a9eb4335bc3f1d099fe1ef05f3cc3f4d4aa2a40',
         'method':raw['method'],'final':rows,'initial':read('performance-initial/summary.json'),
         'mobileDistrictRepeat':read('performance-repeat/summary.json'),
         'shaderOptimizationRepeat':read('performance-shader-repeat/summary.json'),
         'gpuFollowUpBeforeFinalOptimizations':read('performance-gpu-audit/summary.json'),
         'environment':worlds,'peakPomuDrawsIncludingTransformedHeadAndOutline':effect_draws}
dump(OUT/'performance-comparison.json',summary)

cpu_table=['| Profile / held stage | CPU median / p95 before → after (ms) | Median change | Draws before → after | Triangles before → after |',
           '| --- | --- | ---: | ---: | ---: |']
gpu_table=['| Profile / held stage | GPU median / p95 before → after (ms) | Query samples before / after | Resources G / T / P before → after |',
           '| --- | --- | ---: | --- |']
for row in rows:
    before,after=row['before'],row['after'];bg,ag=gpu(before),gpu(after)
    label=row['profile'].title()+' / '+row['phase']
    cpu_table.append(f"| {label} | {pair(before,'cpu')} → {pair(after,'cpu')} | {row['cpuMedianChangePercent']:+.1f}% | {number(before['draws'])} → {number(after['draws'])} | {number(before['triangles'])} → {number(after['triangles'])} |")
    gpu_table.append(f"| {label} | {gpu_pair(bg)} → {gpu_pair(ag)} | {bg['samples'] if bg else 0} / {ag['samples'] if ag else 0} | {memory(before)} → {memory(after)} |")

timing_flags=[]
for row in rows:
    label=row['profile']+' '+row['phase']
    if row['cpuMedianChangePercent']>10:
        timing_flags.append(f"{label}: CPU median {row['cpuMedianChangePercent']:+.1f}%")
    for kind in ['median','p95']:
        before,after=gpu(row['before']),gpu(row['after'])
        if before and after:
            delta=(after[kind]/before[kind]-1)*100
            if delta>10:
                timing_flags.append(f'{label}: GPU {kind} {delta:+.1f}%')
flags='; '.join(timing_flags) if timing_flags else 'No final CPU median or GPU median/p95 increase above 10% in this sample.'

text=f'''# Anime Coil 1.7.7 — Living Shibuya and Gear 5

This release replaces the repetitive Shibuya architecture with a six-family Blender kit and rebuilds Pomu's ultimate as a chibi Gear 5 giant punch with cartoon expression, elastic staging and a rubber street. The approved normal roster and its textured hair remain unchanged. Shibuya is the only arena.

## Design and editable assets

Shibuya's crossing, shopping streets, station landmarks and meeting area informed the architecture and district layout. The seated dog is an original stylized meeting-area sculpture. [Official Tokyo guide](https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html).

Rubber elasticity, gigantification and comic fighting are grounded in [official episode 1072](https://one-piece.com/anime/62948/index.html); the giant finishing punch is inspired by [episode 1075's Bajrang Gun](https://one-piece.com/anime/63686/index.html). The combined eye-pop, balloon windup and flattened recovery are original game choreography. Models, sign art and synthesized effects sounds are authored for the game.

Blender MCP connectivity and the active scene were inspected before authoring. Separate named scenes and collections preserve unrelated objects and previous assets. Applied mesh transforms, finite normalized normals, vertex colors, Y up and +Z facing exports were verified in both profiles. No cameras, lights, skeletons or live modifiers are exported. The task-owned localhost connection was stopped after saving.

- [Editable city master](../assets/shibuya/v177/living-shibuya-editable.blend), [desktop GLB](../assets/shibuya/v177/city-kit-desktop.glb), [mobile GLB](../assets/shibuya/v177/city-kit-mobile.glb), [asset notes](../assets/shibuya/v177/README.md).
- [Editable Gear 5 master](../assets/pomu-gear5/v177/pomu-gear5-editable.blend), [desktop GLB](../assets/pomu-gear5/v177/pomu-ultimate-desktop.glb), [mobile GLB](../assets/pomu-gear5/v177/pomu-ultimate-mobile.glb), [asset notes](../assets/pomu-gear5/v177/README.md).
- [Actual city four views](living-shibuya-1.7.7/city-four-views.png), [kit overview](../assets/shibuya/v177/renders/city-kit-overview.png), [Gear 5 four views](living-shibuya-1.7.7/gear5-four-views.png), [fist four views](living-shibuya-1.7.7/fist-four-views.png), [matching-scale coil attachment](living-shibuya-1.7.7/coil-attachment.png).
- [Matched before/after game captures](living-shibuya-1.7.7/matched-comparison.png), [eight-stage timeline](living-shibuya-1.7.7/gear5-timeline.png), [phone-width captures](living-shibuya-1.7.7/phone-review.png).
- [Complete desktop cinematic](living-shibuya-1.7.7/cinematic/desktop-gear5-complete.webm), [complete phone-width cinematic](living-shibuya-1.7.7/cinematic/phone-gear5-complete.webm). Browser video captures are silent; the game uses original synthesized Effects-channel cues.

## Runtime behavior and budgets

Seven selected-profile GLBs preload before renderer initialization: the four approved normal heads, Kurama, the city kit and Pomu's head/fist. Accessible loading feedback remains visible; a failed or invalid new asset uses the procedural fallback. Later profile loads are cached. Synchronous environment and transformed-head factories are preserved. Geometry and source materials are immutable; expression/blink transforms are independent. Whole-world rebuilds dispose only owned clones and merged district buffers. Shared caches are disposed once at application teardown, including late-load handling.

The city has four culling districts, varied heights, setbacks and rooftops; all raised architecture remains outside the unchanged arena radius plus six-unit clearance. Navy architecture, cyan/magenta signs, warm interiors, painted wet puddles, distance fog and rain retain character/orb contrast. Umbrellas, waiting groups, taxis, traffic signals, billboard crossfades and restaurant steam use bounded pools. Reduced motion freezes decoration; pause and hidden tabs retain the existing frozen visual clock. Lighting is retained without new reflection, bloom or glow passes.

| Asset / assembled environment | Desktop | Mobile | Required limit |
| --- | ---: | ---: | --- |
| City prototypes | 4,800 triangles / 14 mesh batches | 3,728 / 14 | Selected-profile kit |
| Full environment triangles | {worlds['desktop']['triangles']:,} | {worlds['phone']['triangles']:,} | 150,000 / 75,000 |
| Full environment draws | {worlds['desktop']['drawCalls']} | {worlds['phone']['drawCalls']} | 120 / 80 |
| Full environment materials | {worlds['desktop']['materials']} | {worlds['phone']['materials']} | 32 each |
| Full environment textures | {worlds['desktop']['textures']} | {worlds['phone']['textures']} | Shared textures/atlases |
| Pedestrians / vehicles | 64 / 8 | 20 / 4 | 64 / 8 and 20 / 4 |
| Rain particles | 220 | 72 | Existing bounded rain pool |
| Gear 5 head including original coil | 5,644 triangles | 3,812 | 6,000 / 4,000 |
| Head draws including coil, plus outline | 7 + 1 | 7 + 1 | 12 + 1 |
| Haki fist triangles / draws including contour | 2,444 / 3 | 1,544 / 3 | Coherent optimized sculpt |
| Peak held Pomu draws including form head/outline | {effect_draws['desktop']} | {effect_draws['phone']} | 24 / 16 |

The head retains the 0.12 Y mount and 1.28 Y eye pivot. White curls, spiral brows, a broad grin and cloud scarf accompany bounded bounce, ballooning, eye-pop and flattened recovery. The Haki fist uses front-face culling on its closed skin and a restrained contour. Its wrist anchor, actual bounds and expression controls extend the existing staging contract. The fixed arm buffer deforms through shader uniforms. Tessellated asphalt, crossings, paint and puddles share one world-space displacement formula; collision surfaces and snake positions remain authoritative and unchanged. Unaffected vertices skip deformation math, and stationary billboard phases avoid a redundant atlas sample.

| Time | Presentation |
| --- | --- |
| 0–0.9 s | Laughing white-haired transformation and compact bounce |
| 0.9–2.5 s | Balloon windup, brief eye-pop, charcoal Haki fist and red-black accents |
| 2.5–3.4 s | Anticipation hold, elastic arm and descending punch |
| 3.4 s | Shared kill-frame impact, compressed street, manga accent and pressure wave |
| 3.4–4.3 s | Coherent rubber rebound, curled smoke and cartoon fragments |
| 4.3–5.6 s | Wobbling retraction, flattened pose and restoration of approved normal head |

Original synthesized spring, inflation, drum and punch sounds use existing channels/cues. Reduced motion neutralizes expression wobble and terrain displacement; reduced flashes suppress fast lightning and pressure flash. Disabled cinematic camera retains gameplay framing. Profile changes keep cinematic time, pose and gameplay state, including a paused rubber-street pose. Completion, death, respawn, restart and quit restore the approved normal head and clear transient pools.

## Validation

**342 tests pass**, `npm run build` succeeds and `git diff --check` passes. The build retains the existing Three.js chunk-size advisory. The full suite includes simulation/ultimate regressions, exact differential stepping, fixed 3.4-second elimination and 5.6-second completion, scoring/cooldowns and respawns. New checks cover actual GLB schemas, geometry and orientation, head/fist bounds, budgets, finite normals, shared ownership, independent eyes, invalid/failed/late preload, profile changes, pause, clearance, static arm buffers, coherent floor/paint shaders and teardown.

The hardware-browser review passed **93 recorded cases with no page or shader errors**, at 1440×900 and 390×844. It covers the menu/portraits and 21-member same-character crowds for all four characters, all held Pomu stages, other finishers, large/boundary casts, comfort settings, disabled cinematic camera, cached profile switching, lifecycle restoration, eight world rebuilds, and forced city/Pomu load failures. Startup requests only the chosen profile; switching loads the other profile once, then reuses all fourteen cached downloads. Continuous desktop and phone-width recordings verify the actual kill-frame wipe and cleanup. The first observed detonation frame is subject to fixed-step/RAF quantization; simulation retains the exact 3.4-second threshold.

Nineteen preserved files/exports are verified against the 1.7.6 source, with canonical LF hashing for text and exact bytes for GLBs. This includes simulation, the other three cinematic modules, approved head/cache modules, their normal exports and Kurama. [Preservation evidence](living-shibuya-1.7.7/preserved-files.json), [asset manifest](living-shibuya-1.7.7/asset-manifest.json), [browser evidence](living-shibuya-1.7.7/after/validation.json), [live cinematic trace](living-shibuya-1.7.7/cinematic/live-validation.json).

## Matched rendering measurements

The baseline is commit `1a9eb4335bc3f1d099fe1ef05f3cc3f4d4aa2a40` (1.7.6). Both versions use the identical seeded 21-living-snake / 850-orb fixture. Native RAF drives the real renderer and visual cadence while authoritative simulation remains frozen. Each final ABBA run warms for three seconds then samples five seconds; there are two runs per version per stage. CPU includes renderer update and submission, excluding simulation and DOM. Tables average the two per-run medians/p95 values; they are not pooled percentiles. Cinematic cameras intentionally reflect each version's staging, so cinematic scene totals include different visibility.

{chr(10).join(cpu_table)}

GPU values come from available asynchronous disjoint timer queries. G / T / P are live geometries / textures / compiled programs. GPU percentiles use much smaller sample counts than CPU and share this computer with its other applications; they are observations rather than sustained device guarantees.

{chr(10).join(gpu_table)}

The initial mobile sample exposed opposing-district culling/batching overhead: normal CPU rose 12.6% and recovery 19.6%. Four tight districts and compatible surface merging reduced mobile normal scene draws from 122 to 88 and recovery from 258 to 242. The intermediate repeat measured recovery CPU unchanged. A longer GPU follow-up also exposed unstable timings: unchanged desktop baseline CPU medians ranged from 6.8 to 11.6 ms, and unchanged mobile baseline GPU medians varied widely between runs. Its aggregate desktop CPU increase was 38.6%, while the adjacent later pair differed by about 2.6%. These observations remain in the report instead of being discarded.

The shader optimization culls closed fist back faces, skips street displacement outside its radius/inactive state, and avoids a second billboard sample during stationary ads. Its repeat still showed a 20.8% desktop normal CPU increase, so compatible surface merging was extended to desktop. The final repeat measures normal CPU increases of 6.0% desktop / 9.1% mobile; desktop submission medians are similar to baseline while environmental update medians rise roughly 0.3–0.4 ms for the larger city-life pool. Charge/impact/recovery remain mostly faster. This retains the richer architecture and population while keeping both assembled worlds to 70 draws.

Final observed GPU timing increases above the investigation threshold: **{flags}** These were inspected across the retained follow-ups and per-stage timings. Added rubber deformation and the diffuse sculpt can cost GPU time during impact; sparse asynchronous samples also vary substantially on the unchanged baseline. Remaining higher values are reported as costs/measurement uncertainty, not a claim of universal improvement. All original, intermediate, shader-repeat, follow-up and final measurements remain in [the combined JSON](living-shibuya-1.7.7/performance-comparison.json); [final raw samples](living-shibuya-1.7.7/performance-final/raw-abba.json) include per-stage timing and state assertions.

## Release and practical limits

The release is version **1.7.7**, including package/lockfile, browser title and visible branding/credits. The local preview is `http://127.0.0.1:4175/`; release targets are the existing [GitHub main repository](https://github.com/IgrisDeez/Anime-Coil/tree/main) and the existing public [Anime Coil Site](https://animecoil.igrisdeez.chatgpt.site), preserving its audience. The editable-asset and source archives are refreshed locally; generated archive receipts are intentionally excluded from Git. User-state backups and setup credentials are excluded from commits, copies and archives.

Review was performed in headless Edge WebGL on this Windows computer, including phone-sized layouts. Physical-phone thermal behavior, touch feel and sustained battery/GPU performance remain untested. Browser recordings have no captured audio. Side/rear character anatomy and stylized city details are authored interpretations; the supplied approved normal roster is preserved.
'''
(ROOT/'docs/LIVING-SHIBUYA-1.7.7.md').write_text(text,encoding='utf-8')
print(json.dumps({'version':'1.7.7','cases':len(validation['results']),'tests':342,'environment':worlds,
                  'peakPomuDraws':effect_draws,'timingFlags':timing_flags,'assets':len(assets)},indent=2))
