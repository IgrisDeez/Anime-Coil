"""Summarize the saved, paired Kurama rendering measurements without rerunning them."""
import json
import statistics
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / (sys.argv[1] if len(sys.argv)>1 else "docs/kurama-review")
PHASES = ("ordinary-21", "charge", "launch", "impact", "recovery")


def model_stats(profile):
    path = ROOT / f"assets/kurama/candidates/chibi-review/kurama-{profile}.glb"
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data)
    assert magic == b"glTF" and version == 2 and total == len(data)
    length, kind = struct.unpack_from("<I4s", data, 12)
    assert kind == b"JSON"
    document = json.loads(data[20:20 + length])
    counts = {}
    for mesh in document["meshes"]:
        triangles = 0
        for primitive in mesh["primitives"]:
            assert primitive.get("mode", 4) == 4
            accessor = primitive.get("indices", primitive["attributes"]["POSITION"])
            triangles += document["accessors"][accessor]["count"] // 3
        counts[mesh["name"]] = triangles
    tail = sum(count for name, count in counts.items() if "Tail" in name)
    body = sum(counts.values()) - tail
    return {"bodyTriangles": body, "tailPrototypeTriangles": tail,
            "nineTailsAndContoursTriangles": tail * 18,
            "modelTriangles": body + tail * 18, "modelDraws": 6,
            "bytes": len(data), "meshes": counts}


def summarize(samples, candidate):
    runs = [s for s in samples if s["metadata"]["candidate"] is candidate]
    reports = [s["reports"][0] for s in runs]
    median = statistics.median
    return {
        "runs": len(runs),
        "cpuMedianMs": median(r["performance"]["cpuMs"]["median"] for r in reports),
        "cpuP95Ms": median(r["performance"]["cpuMs"]["p95"] for r in reports),
        "cpuMedianRangeMs": [min(r["performance"]["cpuMs"]["median"] for r in reports),
                             max(r["performance"]["cpuMs"]["median"] for r in reports)],
        "cpuP95RangeMs": [min(r["performance"]["cpuMs"]["p95"] for r in reports),
                          max(r["performance"]["cpuMs"]["p95"] for r in reports)],
        "triangles": int(median(r["game"]["triangles"] for r in reports)),
        "draws": int(median(r["game"]["calls"] for r in reports)),
        "foxEffectDraws": int(median(s["draws"].get("fox", 0) for s in runs)),
        "resources": {key: int(median(r["memory"][key] for r in reports))
                      for key in ("geometries", "textures", "programs")},
    }


results = {"model": {p: model_stats(p) for p in ("desktop", "mobile")}, "measurements": []}
for profile in ("desktop", "mobile"):
    for phase in PHASES:
        data = json.loads((OUT / f"performance-repeat/{profile}-{phase}.json").read_text())
        samples = data["samples"]
        # Include the entire confirmation pair; don't choose only favorable runs.
        confirmation = OUT / f"performance-confirm/{profile}-{phase}.json"
        if confirmation.exists():
            samples += json.loads(confirmation.read_text(encoding="utf-8"))["samples"]
        for s in samples:
            m = s["metadata"]
            assert m["seed"] == 812 and m["population"] == 21 and m["segments"] == 987 and m["food"] == 850
            assert s["warmMs"] == 4000 and s["sampleMs"] == 6000
        before, after = summarize(samples, False), summarize(samples, True)
        results["measurements"].append({"profile": profile, "phase": phase,
            "baseline": before, "candidate": after,
            "cpuMedianChangePercent": (after["cpuMedianMs"] / before["cpuMedianMs"] - 1) * 100,
            "cpuP95ChangePercent": (after["cpuP95Ms"] / before["cpuP95Ms"] - 1) * 100})

(OUT / "performance-summary.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
lines = [
    "# Kurama Stage 1 — held-render performance review",
    "",
    "Local review candidate on the unchanged 1.7.3 game. Measurements are browser render CPU time on Intel Iris Xe / Edge ANGLE D3D11, not physical-phone frame rate or full-match simulation timing.",
    "",
    "## Method",
    "",
    "Matched seed 812, 21 snakes, 987 body segments, 850 food items; desktop 1440×900 and phone-width 390×844, DPR 1. The simulation is held while the current GameRenderer renders ordinary gameplay or a fixed cinematic time. Each clean ABBA pair uses 4 seconds warm-up and 6 seconds measurement per run; two baseline and two candidate runs per phase. Mobile impact includes another complete ABBA confirmation pair (four runs per mode). Blender was closed before these repeat measurements.",
    "",
    "CPU columns are the median of the per-run medians and the median of the per-run p95 values. They are not pooled percentiles. Geometry, draw and resource columns come from the renderer's counters in the same held runs. Imported model bounds guide the existing cinematic camera, so frustum culling can differ despite identical authoritative snake/food state. Whole-scene triangle changes cannot all be attributed to the fox.",
    "",
    "## Model budgets",
    "",
    "| Profile | Body | Tail prototype | Nine tails + contours | Model total | Budget | Model draws |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
]
for profile, m in results["model"].items():
    lines.append(f"| {profile} | {m['bodyTriangles']:,} | {m['tailPrototypeTriangles']:,} | {m['nineTailsAndContoursTriangles']:,} | {m['modelTriangles']:,} | {20000 if profile == 'desktop' else 12000:,} | 6 |")
lines += [
    "",
    "The procedural fox has 50,088 triangles including nine tails and nine contours. The candidate reduces this model total by 65.0% on desktop and 77.6% on mobile. Four articulated body batches plus instanced tails and contours use six model draws. Peak sampled effect draws, including bomb/pooled effects, are 15 desktop and 14 mobile (budgets 24/16); charge uses 11 in both profiles.",
    "",
    "## Matched scene samples",
    "",
    "B = current procedural model; C = candidate. Resource counts are geometries / textures / shader programs resident in the renderer. Ordinary rows have no visible fox.",
    "",
    "| Profile / phase | Triangles B → C | Draws B → C | Fox draws B → C | Resources B → C | CPU median B → C ms | CPU p95 B → C ms | Median change |",
    "| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |",
]
for row in results["measurements"]:
    b, c = row["baseline"], row["candidate"]
    rb, rc = b["resources"], c["resources"]
    resources = f"{rb['geometries']}/{rb['textures']}/{rb['programs']} → {rc['geometries']}/{rc['textures']}/{rc['programs']}"
    lines.append(f"| {row['profile']} / {row['phase']} | {b['triangles']:,} → {c['triangles']:,} | {b['draws']} → {c['draws']} | {b['foxEffectDraws']} → {c['foxEffectDraws']} | {resources} | {b['cpuMedianMs']:.2f} → {c['cpuMedianMs']:.2f} | {b['cpuP95Ms']:.2f} → {c['cpuP95Ms']:.2f} | {row['cpuMedianChangePercent']:+.1f}% |")
lines += [
    "",
    "## Timing investigation and limits",
    "",
    "The initial exploratory samples in `performance/` varied above 10% in several phases while authoring tools were open. The clean ABBA repeats in `performance-repeat/` reversed or reduced those differences. An apparent mobile impact increase also reversed in `performance-confirm/mobile-impact.json`; the table combines both complete pairs instead of discarding either. No consistent repeatable median slowdown above 10% was established. This supports local review; it does not establish a universal CPU or FPS improvement.",
    "",
    "Per-run median and p95 ranges, raw measurements, hardware identity and fixture metadata are preserved in `performance-summary.json` and the raw sample directories. Frame intervals include headless browser scheduling and should not be treated as physical-phone latency. A final live-game benchmark is still required after approved promotion, and a real phone remains untested.",
]
if OUT.name == "kurama-1.7.4":
    lines[0] = "# Kurama 1.7.4 — integrated held-render performance review"
    lines[2] = "Approved Stage 1 integrated in 1.7.4. Measurements are browser render CPU time on Intel Iris Xe / Edge ANGLE D3D11, not physical-phone frame rate or full-match simulation timing."
    lines = [line.replace("Mobile impact includes another complete ABBA confirmation pair (four runs per mode).", "Complete confirmation pairs, when present in performance-confirm, are combined with the initial pair; exact run counts and ranges are in performance-summary.json.") for line in lines]
    index = next(i for i, line in enumerate(lines) if line.startswith("The initial exploratory samples"))
    lines[index] = "The initial pre-integration timing investigation is preserved in docs/kurama-review/performance.md. This report uses fresh alternating samples of the promoted renderer and combines any complete confirmation pairs without discarding either pair. Per-run timing ranges remain in performance-summary.json. Interpret differences alongside scheduling variability; these CPU results do not establish universal FPS improvement."
    lines[-1] = "Per-run median and p95 ranges, raw measurements, hardware identity and fixture metadata are preserved in performance-summary.json and the raw sample directories. Frame intervals include headless browser scheduling and should not be treated as physical-phone latency. The actual application preload, profile-switch continuity, restoration and fallback are additionally checked in browser-validation.json. A real phone remains untested."
(OUT / "performance.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(json.dumps({"models": results["model"], "largestAggregateMedianIncreasePercent": max(r["cpuMedianChangePercent"] for r in results["measurements"]), "report": str((OUT / "performance.md").relative_to(ROOT))}, indent=2))
