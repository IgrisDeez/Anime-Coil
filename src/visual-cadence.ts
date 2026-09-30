/** A presentation clock gate; never advances or reads the simulation. */
export class VisualCadence {
  private bucket=NaN;
  private reduced:boolean|undefined;
  due(time:number,reduced:boolean){
    const bucket=Math.floor(time*30+1e-8);
    if(this.reduced===reduced&&(reduced||bucket===this.bucket))return false;
    this.bucket=bucket;this.reduced=reduced;return true;
  }
  clear(){this.bucket=NaN;this.reduced=undefined;}
}
