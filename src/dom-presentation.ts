/** Read back before writing, so dialog/reset writers cannot invalidate a stale cache. */
const styles=new WeakMap<CSSStyleDeclaration,Map<string,{requested:string;serialized:string}>>();
export function setStyle(node:Pick<HTMLElement,'style'>,name:string,value:string){
  const style=node.style;let values=styles.get(style);if(!values){values=new Map();styles.set(style,values);}
  const previous=values.get(name),current=style.getPropertyValue(name);
  if(previous?.requested===value&&previous.serialized===current)return;
  if(current!==value)style.setProperty(name,value);
  if(previous){previous.requested=value;previous.serialized=style.getPropertyValue(name);}
  else values.set(name,{requested:value,serialized:style.getPropertyValue(name)});
}
export function setClass(node:Pick<HTMLElement,'classList'>,name:string,on:boolean){if(node.classList.contains(name)!==on)node.classList.toggle(name,on);}
export function removeClasses(node:Pick<HTMLElement,'classList'>,...names:string[]){if(names.some(name=>node.classList.contains(name)))node.classList.remove(...names);}
export function setAttribute(node:Pick<HTMLElement,'getAttribute'|'setAttribute'>,name:string,value:string){if(node.getAttribute(name)!==value)node.setAttribute(name,value);}
export function setHidden(node:Pick<HTMLElement,'hidden'>,hidden:boolean){if(node.hidden!==hidden)node.hidden=hidden;}
export function setDisabled(node:Pick<HTMLButtonElement,'disabled'>,disabled:boolean){if(node.disabled!==disabled)node.disabled=disabled;}
