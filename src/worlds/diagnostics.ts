import type { GameRenderer } from "../renderer";
import { MAPS, type MapId } from "../maps";

// Opt-in, local review surface. Does not alter gameplay or saved preferences.
export function installWorldDiagnostics(view: GameRenderer, mode:()=>string, select:(id:MapId)=>void, previewMotion?:(reduced:boolean)=>void) {
  if (!new URLSearchParams(location.search).has("worldDebug")&&!new URLSearchParams(location.search).has('perfDebug')) return ()=>{};
  const panel=document.createElement("details");
  panel.style.cssText="position:fixed;z-index:500;right:8px;bottom:8px;background:#fff8e8;color:#493e38;padding:8px;border-radius:12px;max-width:92vw;max-height:42vh;overflow:auto;font:11px monospace";
  panel.innerHTML='<summary>Local performance diagnostics</summary><button>Measure frames</button> <button>Profile 40s</button> <button>Capture stats</button> <button>Cycle maps ×40</button><pre></pre>';
  document.body.append(panel);
  if (previewMotion) {
    const label = document.createElement('label'), toggle = document.createElement('input');
    toggle.type = 'checkbox'; toggle.onchange = () => previewMotion(toggle.checked);
    label.append(toggle, 'Reduced motion preview'); panel.append(label);
  }
  const [reset,profile,capture,cycle]=Array.from(panel.querySelectorAll("button")),output=panel.querySelector("pre")!;
  const show=()=>output.textContent=JSON.stringify(view.diagnostics(),null,2);
  reset.onclick=()=>{view.resetMeasurements();output.textContent="Sampling frames…";};
  const visibleInterval=(duration:number)=>new Promise<boolean>(resolve=>{
    let start=0;
    const tick=(now:number)=>{
      if(document.hidden||mode()!=="game"||view.presentation.paused){resolve(false);return;}
      if(!start)start=now;
      if(now-start>=duration){resolve(true);return;}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  profile.onclick=async()=>{
    if(mode()!=="game"||view.presentation.paused||view.diagnostics().snakes<21){output.textContent="Start a full 21-snake match before profiling.";return;}
    profile.disabled=true;
    try{
      output.textContent="Warming up for 10 seconds…";
      if(!await visibleInterval(10000)){output.textContent="Profile interrupted.";return;}
      view.resetMeasurements();
      output.textContent="Sampling for 30 seconds. Population and cinematic phases are reported separately.";
      if(!await visibleInterval(30000)){output.textContent="Profile interrupted; partial samples follow.\n"+JSON.stringify(view.diagnostics(),null,2);return;}
      show();
    }finally{profile.disabled=false;}
  };
  capture.onclick=()=>{view.measureDrawCalls();show();};
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
  let lastRefresh=0;
  return (now:number)=>{if(panel.open&&!profile.disabled&&!cycle.disabled&&now-lastRefresh>=1000){lastRefresh=now;show();}};
}

