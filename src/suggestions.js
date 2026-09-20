import { completions, shellKind, safeHistory, replacementInput } from './completions.cjs';
import { tr } from './i18n.cjs';
import { icon } from './icons.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const promptPattern=/^(?:PS [^\r\n]*?> ?|[A-Za-z]:\\[^\r\n]*?> ?|(?:\([^)]*\)\s*)?(?:[\w.-]+@[\w.-]+(?::[^$#%❯]*)?|\[[^\]]+\]|[~\/][^$#%❯]*|[\w.-]+(?::[^$#%❯]*)?)?[$#%❯➜] ?)/;
export class Suggestions {
  constructor(session,{enabled,send,isActive}){
    this.s=session;this.term=session.term;this.enabled=enabled;this.send=send;this.isActive=isActive;
    this.history=[];this.selected=0;this.items=[];this.expected=null;this.anchor=null;this.afterSubmit=-1;this.suppressed=false;
    this.panel=document.createElement('div');this.panel.className='suggestions';this.panel.hidden=true;this.panel.setAttribute('role','listbox');this.panel.setAttribute('aria-label',tr('Komut önerileri'));session.pane.append(this.panel);
    this.panel.addEventListener('mousedown',event=>event.preventDefault());
    this.disposables=[this.term.parser.registerOscHandler(133,data=>{
      if(data==='A')this.anchor=null;
      if(data==='B'){const b=this.term.buffer.active;this.anchor={line:b.baseY+b.cursorY,col:b.cursorX};this.expected=null;this.suppressed=false;this.afterSubmit=-1;}
      if(data==='C'){this.suppressed=true;this.hide();}return false;
    }),this.term.onWriteParsed(()=>this.schedule()),this.term.onScroll(()=>this.hide())];
  }
  command(){
    const b=this.term.buffer.active;if(b.type!=='normal')return null;
    const lineIndex=b.baseY+b.cursorY;if(lineIndex<=this.afterSubmit)return null;
    let start=lineIndex;while(start>0&&lineIndex-start<8&&b.getLine(start)?.isWrapped)start--;
    let text='';for(let row=start;row<=lineIndex;row++)text+=b.getLine(row)?.translateToString(row===lineIndex,0,row===lineIndex?b.cursorX:undefined)||'';
    if(this.anchor&&this.anchor.line>=start&&this.anchor.line<=lineIndex){
      let command='';for(let row=this.anchor.line;row<=lineIndex;row++)command+=b.getLine(row)?.translateToString(row===lineIndex,row===this.anchor.line?this.anchor.col:0,row===lineIndex?b.cursorX:undefined)||'';
      return command;
    }
    const match=text.match(promptPattern);return match?text.slice(match[0].length):null;
  }
  input(data){
    const current=this.expected??this.command();this.hide();
    if(data==='\x03'){this.anchor=null;this.expected=null;this.suppressed=false;return;}
    if(data==='\r'||data==='\n'){
      const visible=this.command();if(visible&&visible===current&&safeHistory(visible)){this.history=[visible,...this.history.filter(x=>x!==visible)].slice(0,100);}
      const b=this.term.buffer.active;this.afterSubmit=b.baseY+b.cursorY;this.anchor=null;this.expected=null;this.suppressed=false;return;
    }
    if(current===null)return;
    if(/^[^\x00-\x1f\x7f]+$/.test(data)){this.expected=current+data;return;}
    if(data==='\x7f'||data==='\b'){this.expected=Array.from(current).slice(0,-1).join('');return;}
    // Let native line editors own cursor navigation, completion, pasted blocks and controls.
    this.expected=null;this.suppressed=true;
  }
  schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.update(false),75);}
  update(manual=false){
    if(!this.isActive()||this.s.exited||this.term.buffer.active.type!=='normal'||(!manual&&(!this.enabled()||this.suppressed)))return this.hide();
    const command=this.command();if(command===null||(this.expected!==null&&command!==this.expected)||(!manual&&!command.length))return this.hide();
    this.suppressed=false;this.snapshot=command;this.expected=command;
    this.items=completions(command,{kind:shellKind(this.s.spec),history:this.history,entries:this.s.fileDirectory===this.s.cwd?this.s.fileEntries||[]:[]});
    this.selected=0;this.render();
  }
  render(){
    if(!this.items.length)return this.hide();
    this.panel.innerHTML=`<div class="suggestions-heading">${icon('sparkles')}<span>${escape(tr('Komut önerileri'))}</span><kbd>Ctrl →</kbd></div>`+this.items.map((item,index)=>`<button type="button" role="option" aria-selected="${index===this.selected}" class="suggestion ${index===this.selected?'selected':''}" data-index="${index}">${icon(item.type==='history'?'history':item.type==='command'?'terminal':item.type)}<span>${escape(item.value)}</span><small>${escape(tr(({history:'Geçmiş',command:'Komut',folder:'Klasör',file:'Dosya'})[item.type]))}</small></button>`).join('')+`<div class="suggestions-hint">${escape(tr('Alt ↑/↓ seç · Ctrl → ekle · Esc kapat'))}</div>`;
    this.panel.hidden=false;this.panel.querySelectorAll('.suggestion').forEach(button=>button.onclick=()=>this.accept(Number(button.dataset.index)));
  }
  accept(index=this.selected){
    const command=this.command(),item=this.items[index];if(!item||command!==this.snapshot||this.expected!==command||!this.isActive())return this.hide();
    const data=replacementInput(command,item.value);this.expected=item.value;this.hide();this.send(data);this.term.focus();
  }
  key(event){
    if(event.ctrlKey&&!event.altKey&&event.code==='Space'){event.preventDefault();this.update(true);return false;}
    if(this.panel.hidden)return true;
    if(event.ctrlKey&&!event.shiftKey&&event.key==='ArrowRight'){event.preventDefault();this.accept();return false;}
    if(event.altKey&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();this.selected=(this.selected+(event.key==='ArrowDown'?1:-1)+this.items.length)%this.items.length;this.render();return false;}
    if(event.key==='Escape'){event.preventDefault();this.hide();return false;}
    return true;
  }
  hide(){this.panel.hidden=true;}
  dispose(){clearTimeout(this.timer);this.disposables.forEach(d=>d.dispose());this.history=[];this.panel.remove();}
}
