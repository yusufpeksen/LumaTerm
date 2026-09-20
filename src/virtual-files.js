export class VirtualFiles {
  constructor(root,render,bind){
    this.root=root;this.render=render;this.bind=bind;this.entries=[];this.rowHeight=36;this.start=-1;this.end=-1;
    root.addEventListener('scroll',()=>this.schedule());
    this.observer=new ResizeObserver(()=>this.schedule());this.observer.observe(root);
  }
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
  set(entries){this.entries=entries;this.start=-1;this.end=-1;this.root.scrollTop=0;this.draw();}
  draw(){
    const start=Math.max(0,Math.floor(this.root.scrollTop/this.rowHeight)-6);
    const end=Math.min(this.entries.length,start+Math.ceil((this.root.clientHeight||400)/this.rowHeight)+12);
    if(start===this.start&&end===this.end)return;this.start=start;this.end=end;
    this.root.innerHTML=`<div class="file-spacer" style="height:${start*this.rowHeight}px"></div>`+this.render(this.entries.slice(start,end))+`<div class="file-spacer" style="height:${Math.max(0,(this.entries.length-end)*this.rowHeight)}px"></div>`;
    this.bind();
  }
}
