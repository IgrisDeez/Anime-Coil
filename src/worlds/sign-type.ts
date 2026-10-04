/** Fit type by changing font size, never by squeezing glyphs through fillText(maxWidth). */
export function cityType(c:CanvasRenderingContext2D,text:string,height:number,width:number){
  let size=height;
  c.font=`600 ${size}px "Segoe UI", "Yu Gothic", sans-serif`;
  const measured=c.measureText(text).width;
  if(measured>width){size*=width/measured;c.font=`600 ${size}px "Segoe UI", "Yu Gothic", sans-serif`;}
  return size;
}
