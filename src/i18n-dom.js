import { tr } from './i18n.cjs';
// Capture only the initial application chrome, before any user data is rendered.
export function captureStaticUi(root) {
  const texts=[], attributes=[];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(node.textContent.trim() && !['SCRIPT','STYLE'].includes(node.parentElement.tagName))texts.push([node,node.textContent]);
  }
  root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(el=>{
    for(const name of ['title','placeholder','aria-label'])if(el.hasAttribute(name))attributes.push([el,name,el.getAttribute(name)]);
  });
  return ()=>{
    for(const [node,text] of texts)if(node.isConnected)node.textContent=tr(text);
    for(const [el,name,text] of attributes)if(el.isConnected)el.setAttribute(name,tr(text));
  };
}
