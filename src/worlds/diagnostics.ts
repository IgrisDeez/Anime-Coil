import type { GameRenderer } from "../renderer";
import { MAPS, type MapId } from "../maps";

// Opt-in, local review surface. Does not alter gameplay or saved preferences.
export function installWorldDiagnostics(view: GameRenderer, mode:()=>string, select:(id:MapId)=>void) {
  if (!new URLSearchParams(location.search).has("worldDebug")) return;
  const panel=document.createElement("details");
  panel.style.cssText="position:fixed;z-index:500;right:8px;bottom:8px;background:#fff8e8;color:#493e38;padding:8px;border-radius:12px;max-width:92vw;max-height:42vh;overflow:auto;font:11px monospace";
  panel.innerHTML='<summary>World diagnostics</summary><button>Measure frames</button> <button>Capture stats</button> <button>Cycle maps ×40</button><pre aria-live="polite"></pre>';
  document.body.append(panel);
  const [reset,capture,cycle]=Array.from(panel.querySelectorAll("button")),output=panel.querySelector("pre")!;
  const show=()=>output.textContent=JSON.stringify(view.diagnostics(),null,2);
  reset.onclick=()=>{view.resetMeasurements();output.textContent="Sampling frames…";};
  capture.onclick=show;
  cycle.onclick=async()=>{
    if(mode()!=="menu"){output.textContent="Return to the menu before cycling worlds.";return;}
    const original=view.mapId,results:ReturnType<GameRenderer["diagnostics"]>[]=[];
    cycle.disabled=true;
    try {
      for(let i=0;i<40;i++){
        select(MAPS[i%MAPS.length].id);
        // Let the normal renderer upload resources and retire the previous map.
        await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
        results.push(view.diagnostics());output.textContent=`Switch ${i+1}/40`;
      }
      output.textContent=JSON.stringify({cycles:40,warm:results.slice(4,8).map(x=>({map:x.map,...x.memory})),final:results.slice(-4).map(x=>({map:x.map,...x.memory}))},null,2);
    } finally {select(original);cycle.disabled=false;}
  };
}

