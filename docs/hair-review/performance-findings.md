# Hair detail performance review

The final outline geometry is measured in `performance-final-clean/`: 11 ABBA windows / 44 runs, with no concurrent capture, build or packaging workload. Each window uses 21 living snakes, mass 48, food 850, Shibuya, held state, identical camera and time. Medians/p95 are the mean of two runs, not pooled percentiles. Both paths include the fixture second render. The baseline is the previous Blender roster candidate plus approved Kitsu, not the public procedural roster.

| Profile / case | CPU before median/p95 ms | CPU after median/p95 ms | Median change | Draws before/after | Triangles before/after |
| --- | ---: | ---: | ---: | ---: | ---: |
| desktop-kairo | 13.30 / 17.90 | 13.15 / 17.95 | -1.1% | 135 / 135 | 299,132 / 299,312 |
| desktop-kitsu | 13.55 / 19.00 | 13.60 / 18.40 | +0.4% | 139 / 139 | 304,228 / 303,236 |
| desktop-mixed | 15.65 / 20.80 | 16.75 / 30.70 | +7.0% | 135 / 135 | 301,431 / 301,340 |
| desktop-mixedrepeat | 14.45 / 20.95 | 13.60 / 18.55 | -5.9% | 135 / 135 | 301,431 / 301,340 |
| desktop-pomu | 13.35 / 20.45 | 14.00 / 19.15 | +4.9% | 143 / 143 | 305,356 / 305,888 |
| desktop-shiro | 11.85 / 15.90 | 12.35 / 16.90 | +4.2% | 123 / 123 | 297,008 / 296,924 |
| mobile-kairo | 5.50 / 7.45 | 5.10 / 7.30 | -7.3% | 150 / 150 | 213,176 / 209,856 |
| mobile-kitsu | 5.55 / 7.60 | 5.65 / 7.45 | +1.8% | 156 / 156 | 219,464 / 216,304 |
| mobile-mixed | 6.05 / 8.10 | 6.10 / 8.10 | +0.8% | 152 / 152 | 215,442 / 212,480 |
| mobile-pomu | 5.75 / 7.70 | 5.50 / 7.50 | -4.3% | 167 / 167 | 218,599 / 216,623 |
| mobile-shiro | 5.10 / 7.05 | 4.90 / 6.95 | -3.9% | 130 / 130 | 209,992 / 206,600 |

Final ordinary mixed desktop: CPU 15.65 / 20.80 ms before, 16.75 / 30.70 after (+7.0% median, +47.6% p95). Its longer 4-second warm / 6-second repeat was 14.45 / 20.95 before, 13.60 / 18.55 after (-5.9% median, -11.5% p95). The large p95 spike did not repeat; no speedup claim is made because baseline timings vary. Desktop crowds ranged -1.1% to +4.9% median, with at most +6.3% p95.

Final ordinary mixed phone-width: CPU 6.05 / 8.10 ms before, 6.10 / 8.10 after (+0.8% median, unchanged p95). Earlier pre-outline samples in `performance/` had one +10.1% mobile median (+0.75 ms); two longer repeats are retained, including an unstable scheduling window and a later +3.3% median / -1.1% p95 window. Those samples prompted investigation and are not substituted for the final geometry results. The interrupted run in `performance-final/` overlapped capture/compilation, is labeled and is excluded from conclusions.

All final windows preserve the paused snake state and draw counts. Fixture resource counters: desktop 171 geometries / 9 textures; mobile 164 / 9. Both asset sets are retained in this fixture, including new hair maps; equal counters do not mean texture memory is free. Four selected-profile diffuse textures cost about 5.33 MiB desktop / 1.33 MiB mobile RGBA8 including mipmaps.

Reported triangles include the world, bodies and restrained outlines under normal frustum culling. Heads outside the camera are not forced visible. Phone width is emulated on the same Windows/Iris Xe host. These samples do not establish physical-phone frame rate, sustained thermals or a GPU-time regression bound. All raw completed windows remain available; no browser errors occurred.
