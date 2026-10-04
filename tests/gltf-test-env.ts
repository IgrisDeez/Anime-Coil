// Geometry/resource unit tests inspect embedded PNG dimensions. Edge review validates pixels and shaders.
Object.defineProperty(globalThis,'self',{value:globalThis,configurable:true});
globalThis.createImageBitmap=async(blob:ImageBitmapSource)=>{
  const data=await (blob as Blob).arrayBuffer(),view=new DataView(data);
  return {width:view.getUint32(16),height:view.getUint32(20),close(){}} as ImageBitmap;
};
