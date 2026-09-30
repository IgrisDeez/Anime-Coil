/** Opt-in, local CPU measurements. No timers, telemetry, or unbounded sample arrays. */
export const CPU_STAGES = ['simulation', 'snakes', 'food', 'effects', 'environment', 'submit', 'dom'] as const;
export type CpuStage = typeof CPU_STAGES[number];
export type PerfPhase = 'normal' | 'cinematic-charge' | 'post-wipe-recovery';
export interface FrameCounts {
  calls: number; triangles: number; snakes: number; segments: number; visibleSegments: number;
  food: number; dpr: number; matrices: number; updatedInstances: number; dirtyRanges: number; uploadBytes: number;
}
const emptyCounts = (): FrameCounts => ({calls:0,triangles:0,snakes:0,segments:0,visibleSegments:0,food:0,dpr:1,matrices:0,updatedInstances:0,dirtyRanges:0,uploadBytes:0});
export function distribution(values: readonly number[]) {
  const sorted = [...values].sort((a,b)=>a-b);
  return {median: sorted[Math.floor(sorted.length*.5)] ?? 0, p95: sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))] ?? 0, samples:sorted.length};
}
export class FrameProfiler {
  enabled = false;
  inFrame = false;
  private start = 0;
  private elapsed = new Float64Array(CPU_STAGES.length);
  private readonly data = new Float64Array(8192 * (CPU_STAGES.length+9));
  private readonly phases = new Uint8Array(8192);
  private cursor = 0;
  private count = 0;
  readonly counts = emptyCounts();
  phase: PerfPhase = 'normal';
  rafMs = 0;
  beginFrame() {
    if (!this.enabled) return;
    this.start=performance.now();this.elapsed.fill(0);this.inFrame=true;
    this.counts.matrices=this.counts.updatedInstances=this.counts.dirtyRanges=this.counts.uploadBytes=0;
  }
  stamp() { return this.enabled ? performance.now() : 0; }
  finish(stage: CpuStage, start: number) { if(this.enabled)this.elapsed[CPU_STAGES.indexOf(stage)]+=performance.now()-start; }
  endFrame() {
    if (!this.enabled || !this.inFrame) return;
    const offset=this.cursor*(CPU_STAGES.length+9);
    this.data[offset]=performance.now()-this.start;this.data[offset+1]=this.rafMs;
    for(let i=0;i<this.elapsed.length;i++)this.data[offset+2+i]=this.elapsed[i];
    const extra=offset+CPU_STAGES.length+2;
    this.data[extra]=this.counts.uploadBytes;this.data[extra+1]=this.counts.matrices;this.data[extra+2]=this.counts.updatedInstances;
    this.data[extra+3]=this.counts.dirtyRanges;this.data[extra+4]=this.counts.snakes;this.data[extra+5]=this.counts.segments;this.data[extra+6]=this.counts.food;
    this.phases[this.cursor]=this.phase==='normal'?0:this.phase==='cinematic-charge'?1:2;
    this.cursor=(this.cursor+1)%8192;this.count=Math.min(8192,this.count+1);this.inFrame=false;
  }
  reset() {this.cursor=this.count=0;this.inFrame=false;}
  snapshot() {
    const describe=(phase?:number,population?:number)=>{const columns=Array.from({length:CPU_STAGES.length+9},()=>[] as number[]);
      for(let i=0;i<this.count;i++){if(phase!==undefined&&this.phases[i]!==phase)continue;if(population!==undefined&&this.data[i*(CPU_STAGES.length+9)+CPU_STAGES.length+6]!==population)continue;for(let k=0;k<columns.length;k++)columns[k].push(this.data[i*columns.length+k]);}
      const raf=distribution(columns[1]);return {cpuMs:distribution(columns[0]),rafMs:raf,fps:columns[1].length&&columns[1].reduce((n,v)=>n+v,0)>0?1000*columns[1].length/columns[1].reduce((n,v)=>n+v,0):0,
        stages:Object.fromEntries(CPU_STAGES.map((key,i)=>[key,distribution(columns[i+2])])),uploadBytesPerFrame:distribution(columns[CPU_STAGES.length+2]),
        instanceWork:Object.fromEntries(['matrices','updatedInstances','dirtyRanges'].map((key,i)=>[key,distribution(columns[CPU_STAGES.length+3+i])])),
        populationRange:Object.fromEntries(['snakes','segments','food'].map((key,i)=>{const values=columns[CPU_STAGES.length+6+i];return [key,{min:values.length?Math.min(...values):0,max:values.length?Math.max(...values):0}];}))};};
    return {enabled:this.enabled,instanceCounterScope:'snake body, outline, shadow, ownership and food; whole-scene GL uploads measured separately',...describe(),phases:{normal:describe(0),charge:describe(1),recovery:describe(2)},ordinary21:describe(0,21),...this.counts};
  }
}

/** WebGL2 timer queries are optional and asynchronous; no gl.finish or blocking reads. */
export class GpuTimer {
  private extension: {TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number} | null;
  private pending: WebGLQuery[]=[];
  private active:WebGLQuery|undefined;
  private samples:number[]=[];
  private frame=0;
  constructor(private gl:WebGL2RenderingContext){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');}
  begin(enabled:boolean){if(!enabled||!this.extension)return;this.poll();if(++this.frame%30||this.pending.length>=8)return;
    const query=this.gl.createQuery();if(query){this.active=query;this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,query);}}
  end(){if(!this.active||!this.extension)return;this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=undefined;}
  private poll(){const gl=this.gl;if(!this.extension)return;if(gl.getParameter(this.extension.GPU_DISJOINT_EXT)){for(const q of this.pending)gl.deleteQuery(q);this.pending=[];this.samples=[];return;}
    while(this.pending.length&&gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)){const q=this.pending.shift()!;this.samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);if(this.samples.length>300)this.samples.shift();}}
  snapshot(){return {available:!!this.extension,ms:distribution(this.samples),status:this.extension?'asynchronous GPU queries':'GPU timing unavailable'};}
  reset(){for(const q of this.pending)this.gl.deleteQuery(q);this.pending=[];this.samples=[];}
  dispose(){this.end();this.reset();}
}
