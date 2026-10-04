"""Generate the 1.7.8 report from verified release evidence."""
from pathlib import Path
import hashlib, json, struct, re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/dense-shibuya-1.7.8'
BASE=ROOT.parent/'anime-coil-v177-baseline'
def read(name): return json.loads((OUT/name).read_text(encoding='utf-8'))
def dump(name,value): (OUT/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def sha(data): return hashlib.sha256(data).hexdigest().upper()
preserved=[]
for old in json.loads((ROOT/'docs/living-shibuya-1.7.7/preserved-files.json').read_text()):
    rel=old['path'];a=(ROOT/rel).read_bytes();b=(BASE/rel).read_bytes()
    if old['mode']=='canonical LF text': a=a.replace(b'\r\n',b'\n');b=b.replace(b'\r\n',b'\n')
    assert a==b,rel
    preserved.append({'path':rel,'sha256':sha(a),'mode':old['mode'],'unchanged':True})
dump('preserved-files.json',preserved)
assets=[]
for folder in ['shibuya','pomu']:
    for p in (ROOT/'public/assets'/folder).glob('*.glb'):
        data=p.read_bytes();magic,version,size=struct.unpack_from('<III',data)
        assert magic==0x46546c67 and version==2 and size==len(data)
        assets.append({'path':p.relative_to(ROOT).as_posix(),'bytes':size,'sha256':sha(data)})
for name in ['assets/shibuya/v178/dense-shibuya-editable.blend','assets/pomu-gear5/v178/pomu-haki-editable.blend']:
    p=ROOT/name;assets.append({'path':name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
dump('asset-manifest.json',assets)
rows=read('performance-promoted/summary.json');raw=read('performance-promoted/raw-abba.json')
review=read('after/validation.json');movie=read('cinematic/live-validation.json')
assert len(review['results'])==93 and not review['errors'] and not movie['errors']
assert len(raw['results'])==32 and not raw['errors']
assert all(x['stateUnchanged'] and x['population']==21 and x['food']==850 for x in raw['results'])
worlds={label:next(x['menu']['world'] for x in review['results'] if x.get('label')==label and 'menu' in x) for label in ['desktop','phone']}
effect={label:max(x['draws'].get('skybreaker',0)+x['draws'].get('ultimate-blast',0)+8 for x in review['results'] if x.get('label')==label and x.get('id')=='cloud' and 'stage' in x) for label in worlds}
testlog=re.sub(r'\x1b\[[0-9;]*m','',(OUT/'tests-final.log').read_text())
assert 'fail 0' in testlog
assert 'built in' in (OUT/'build-final.log').read_text()
def gpu(r):
    values=[g['ms'] for g in r['gpu'] if g['available'] and g['ms']['samples']]
    return {'median':sum(g['median'] for g in values)/len(values),'p95':sum(g['p95'] for g in values)/len(values),'samples':sum(g['samples'] for g in values)} if values else None
def pair(r): return f"{r['cpuMedian']:.2f} / {r['cpuP95']:.2f}"
def gp(g): return f"{g['median']:.3f} / {g['p95']:.3f}" if g else 'unavailable'
cpu=['| Profile / stage | CPU median / p95 before → after (ms) | Median change | Draws | Triangles |','| --- | --- | ---: | ---: | ---: |']
gpu_rows=['| Profile / stage | GPU median / p95 before → after (ms) | GPU queries | Geometry / texture / program resources |','| --- | --- | ---: | --- |']
flags=[]
for row in rows:
    b,a=row['before'],row['after'];bg,ag=gpu(b),gpu(a);label=row['profile']+' / '+row['phase']
    cpu.append(f"| {label} | {pair(b)} → {pair(a)} | {row['cpuMedianChangePercent']:+.1f}% | {b['draws']:.0f} → {a['draws']:.0f} | {b['triangles']:,.0f} → {a['triangles']:,.0f} |")
    memory=lambda r:' / '.join(str(r['memory'][k]) for k in ['geometries','textures','programs'])
    gpu_rows.append(f"| {label} | {gp(bg)} → {gp(ag)} | {bg['samples'] if bg else 0} / {ag['samples'] if ag else 0} | {memory(b)} → {memory(a)} |")
    if row['cpuMedianChangePercent']>10:flags.append(f"{label}: CPU median {row['cpuMedianChangePercent']:+.1f}%")
impact_audit=read('performance-impact-audit/summary.json')[0]
recovery_audit=read('performance-recovery-audit/summary.json')[0]
summary={'version':'1.7.8','baselineCommit':'f098a04eefd0fe4a235f9d21732288ca8bc02793','method':raw['method'],'final':rows,'initial':read('performance-final/summary.json'),'longNormalInvestigation':read('performance-normal-investigation/summary.json'),'pavementOptimizationRepeat':read('performance-paving-repeat/summary.json'),'longMobileImpactAudit':impact_audit,'longDesktopRecoveryAudit':recovery_audit,'environment':worlds,'peakPomuDrawsIncludingFormAndOutline':effect,'timingFlags':flags}
dump('performance-comparison.json',summary)
text=f"""# Anime Coil 1.7.8 — Dense Shibuya and Haki Punch

Shibuya has a connected junction with paved corner landings, road-mouth crossings and aligned lane paint, surrounded by narrower lots and varied architecture. Pomu's giant punch now has a coherent closed fist, wrist-driven orientation and red Haki aftermath. The approved normal roster, textured hair, Gear 5 head, other finishers and authoritative simulation remain unchanged.

## Design and assets

The [official Tokyo district map](https://www.gotokyo.org/book/wp-content/uploads/2024/03/2403_shibuydaymap_low_EN.pdf) and [Shibuya guide](https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html) inform the station, Qfront, Magnet, 109, Center Gai and surrounding street identities. This is a stylized game interpretation retaining the circular collision arena. Side streets bend outward instead of radiating symmetrically. Crossings stop at paved landings, lane dashes stop behind crossings, and sidewalk geometry follows building fronts. Paved corners leave a real hole over the central asphalt to avoid drawing it twice.

Fourteen editable Blender families include commercial curves, glass towers, narrow shops, terraces, station/arcade fronts, landmark façades, balcony hotels, civic buildings, rooftop gardens and angled crowns. Thirteen are placed in the foreground. Desktop has 48 foreground, 48 middle and 64 rear buildings; mobile has 48, 32 and 48. Window frames, balconies, setbacks, shop bays and rooftop details share immutable prototype geometry and an atlas. Raised scenery remains beyond the original arena radius plus six-unit margin.

Store names remain stable. Fit lettering, neutral cream type, padding and one accent line replace dense glowing labels; a few shop columns use upright Japanese lettering. Large ads occupy designated façades rather than every building. Existing rain, fog, 64/20 pedestrians, 8/4 vehicles, traffic and billboard cadence are preserved, including pause and reduced motion.

Blender MCP inspected the live scene before authoring. Dedicated scenes and collections preserve unrelated objects and previous assets. Both masters include the final review setup; GLBs contain applied geometry with finite outward normals, vertex colors, Y up and +Z forward, without lights, cameras or skeletons. Only the task-owned connection was stopped.

- [Editable city](../assets/shibuya/v178/dense-shibuya-editable.blend), [city desktop](../assets/shibuya/v178/city-kit-desktop.glb), [city mobile](../assets/shibuya/v178/city-kit-mobile.glb).
- [Editable Pomu ultimate](../assets/pomu-gear5/v178/pomu-haki-editable.blend), [ultimate desktop](../assets/pomu-gear5/v178/pomu-ultimate-desktop.glb), [ultimate mobile](../assets/pomu-gear5/v178/pomu-ultimate-mobile.glb).
- [City four views](dense-shibuya-1.7.8/city-four-views.png), [fourteen-family kit views](dense-shibuya-1.7.8/kit-four-views.png), [road study](dense-shibuya-1.7.8/road-study.png), [fist four views](dense-shibuya-1.7.8/fist-four-views.png), [wrist and coil attachment](dense-shibuya-1.7.8/coil-attachment.png).
- [Matched game comparison](dense-shibuya-1.7.8/matched-comparison.png), [eight-stage punch sequence](dense-shibuya-1.7.8/haki-timeline.png), [phone review](dense-shibuya-1.7.8/phone-review.png), [complete desktop cinematic](dense-shibuya-1.7.8/cinematic/desktop-gear5-complete.webm), [phone cinematic](dense-shibuya-1.7.8/cinematic/phone-gear5-complete.webm).

## Punch alignment and red aftermath

The new closed hand has four readable knuckles, folded fingers, a thumb across the palm and a defined wrist. Creases are projected onto the sculpt rather than floating above it. Exported wrist, contact and strike-axis anchors drive the runtime transform. The knuckle contact follows a cubic trajectory and reaches the intended impact point at ground height; the hand and shader-deformed arm share a tangent, including eight tested headings and boundary casts.

The old fixed screen overlay drew a second fist and arm at a conflicting angle. It has been removed so the sculpt's perspective governs the punch. Recovery framing follows the retreating hand and expression. Charcoal skin, red-black lightning, pressure rings, red fragments and red fading smoke use a common Haki palette. The shared Pomu kill frame keeps its color instead of turning the red impact grayscale. Other finishers retain their palettes.

The original 5.6-second presentation and 3.4-second elimination threshold remain. The approved Gear 5 head retains its 0.12 Y coil mount and 1.28 Y expression pivot. Arm and rubber street geometry are created once; shader uniforms and object transforms animate them. Selected-profile preload, accessible feedback, cached subsequent loads, synchronous factories and procedural fallback remain. Profile changes preserve cinematic time and state; imported geometry and textures are disposed only by their owning cache at teardown.

| Geometry or environment | Desktop | Mobile | Limit |
| --- | ---: | ---: | --- |
| Fourteen city prototypes / mesh batches | 9,058 / 44 | 7,534 / 44 | Selected-profile prototype kit |
| Complete environment triangles | {worlds['desktop']['triangles']:,} | {worlds['phone']['triangles']:,} | 150,000 / 75,000 |
| Complete environment draws | {worlds['desktop']['drawCalls']} | {worlds['phone']['drawCalls']} | 120 / 80 |
| Environment materials / textures | {worlds['desktop']['materials']} / {worlds['desktop']['textures']} | {worlds['phone']['materials']} / {worlds['phone']['textures']} | 32 materials |
| Preserved Gear 5 head including coil | 5,644 | 3,812 | 6,000 / 4,000 |
| New hand triangles / draws with outline | 2,598 / 3 | 1,618 / 3 | Optimized static sculpt |
| Peak held Pomu draws including transformed head and outline | {effect['desktop']} | {effect['phone']} | 24 / 16 |

## Validation and measurements

**345 tests pass**, production build succeeds and diff checks pass. The simulation regression suite and cooldown, elimination, respawn and collision behavior remain intact. Ninety-three real Edge browser cases cover desktop and phone widths, all normal characters and same-character crowds, large snakes, boundary casts, comfort settings, disabled cinematic camera, pause, load failure, profile caching and lifecycle restoration. The continuous recordings verify the actual wipe and approved normal-head restoration. Recordings are silent. Nineteen preserved source/asset files are compared with the 1.7.7 baseline using exact GLB bytes and canonical LF text hashes.

The frozen matched fixture retains 21 living snakes and 850 orbs without authoritative state changes. ABBA repeats advance real rendering and visual cadence; CPU excludes simulation and DOM. Tables average per-run medians/p95 values rather than pooling percentiles. Cinematic totals include each version's intended camera visibility. GPU measurements use optional asynchronous disjoint queries and fewer samples than CPU.

{chr(10).join(cpu)}

{chr(10).join(gpu_rows)}

The initial sample exposed significant normal-view overhead. A longer repeat confirmed desktop CPU increased about 33% and GPU about 68%, while mobile CPU was close to baseline. The extra junction layer redrew the opaque central road. Replacing it with pavement geometry containing a junction hole and bypassing inactive ripple fragment math brought normal GPU submission close to baseline in the optimization repeat. Recovery framing also narrows as the arm retreats. Initial and investigation measurements remain in [the combined evidence](dense-shibuya-1.7.8/performance-comparison.json), with [final raw samples](dense-shibuya-1.7.8/performance-promoted/raw-abba.json). Final CPU median increases above 10%: {('; '.join(flags)) if flags else 'none in this sample'}. Timing variability, especially p95 and sparse GPU queries, is reported rather than treated as a guarantee across devices.

The mobile impact flag comes from two identical candidate runs at 4.1 and 12.9 ms CPU, both with approximately 1.55 ms GPU time. The longer six-second warmup / twelve-second ABBA follow-up measures {impact_audit['before']['cpuMedian']:.2f} → {impact_audit['after']['cpuMedian']:.2f} ms ({impact_audit['cpuMedianChangePercent']:+.1f}%). The unchanged baseline also varied between 4.7 and 7.3 ms in the original pair. That CPU spike did not repeat; the impact uses fewer draws and triangles and lower measured GPU time.

The longer desktop recovery follow-up measures {recovery_audit['before']['cpuMedian']:.2f} → {recovery_audit['after']['cpuMedian']:.2f} ms ({recovery_audit['cpuMedianChangePercent']:+.1f}%). The new framing submits {recovery_audit['after']['draws']:.0f} rather than {recovery_audit['before']['draws']:.0f} draws in the intentionally retained 21-living-snake fixture: more normal heads and bodies remain visible around the fist. This is a measured scene-visibility cost, with the larger hand and full wrist/arm kept in frame. The actual live recording eliminates all twenty bots at impact, so its recovery workload differs from the held crowd stress fixture. These costs and the sparse GPU percentile variation remain disclosed; there is no claim of a universal performance improvement.

## Release

Version 1.7.8 updates package/lockfile, title, visible credits, documentation, source archive and local preview at http://127.0.0.1:4175/. Publication uses the existing [GitHub repository](https://github.com/IgrisDeez/Anime-Coil/tree/main) and existing public [GPT Site](https://animecoil.igrisdeez.chatgpt.site), preserving its audience. Private saved-state backups and setup credentials are excluded from copies and archives.

Phone-width review ran in Edge WebGL on this Windows computer. Physical-phone touch feel, battery use and sustained thermal performance remain untested. City layout and side/rear anatomy are stylized interpretations; the approved character models remain intact.
"""
(ROOT/'docs/DENSE-SHIBUYA-1.7.8.md').write_text(text,encoding='utf-8')
print(json.dumps({'version':'1.7.8','browserCases':93,'tests':345,'worlds':worlds,'peakPomuDraws':effect,'timingFlags':flags,'preserved':len(preserved)}))
