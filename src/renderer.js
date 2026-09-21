import { tr, msg, setLanguage, getLanguage } from './i18n.cjs';
import { captureStaticUi } from './i18n-dom.js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { icon, paintIcons, shellIcon, fileIcon } from './icons.js';
import { VirtualFiles } from './virtual-files.js';
const $ = id => document.getElementById(id), api = window.luma;
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state, active, split = false, panelVisible = true, sidebarVisible = true, localDir, remoteDir = '/', remoteEntries = [], localEntries = [], remoteRequest = 0, localRequest = 0;
const tabs = new Map(), pending = new Map(), transfers = new Map();
let translateStaticUi = () => {};
let remoteView, localView, fitFrame;
const toast = (text,error=false) => { const el=document.createElement('div'); el.className='toast'+(error?' error':''); el.textContent=text; $('toasts').append(el); setTimeout(()=>el.remove(),error?10000:5000); };
const run = fn => async (...args) => { try { return await fn(...args); } catch(e) { toast(e.message,true); } };
const on = (id,fn) => $(id).addEventListener('click',run(fn));
const current = () => tabs.get(active);
const ssh = () => { const s=current(); if(!s || s.kind!=='ssh' || s.exited) throw new Error(tr('Önce etkin bir SSH bağlantısı aç.')); return s; };
function applySettings() {
  setLanguage(state.settings.language);
  document.documentElement.lang = getLanguage();
  translateStaticUi();
  document.body.className = state.settings.theme;
  document.documentElement.style.setProperty('--accent',state.settings.accent);
  for(const s of tabs.values()) { Object.assign(s.term.options,terminalOptions()); s.fit.fit(); }
  sidebar(); updateTabs(); updateFooter();
}
function terminalOptions() {
  const v=state.settings, light=v.theme==='light', forest=v.theme==='forest';
  return { fontFamily:v.fontFamily,fontSize:v.fontSize,lineHeight:v.lineHeight,cursorStyle:v.cursorStyle,cursorBlink:v.cursorBlink,scrollback:v.scrollback,allowProposedApi:false,
    theme:{ background:light?'#f7f8fc':forest?'#101a19':'#101218',foreground:light?'#20283b':'#e6e8f1',cursor:v.accent,selectionBackground:light?'#b9c6ee':'#384263',black:'#434b61',red:'#f18595',green:'#63d6ab',yellow:'#e2c485',blue:'#8b9cff',magenta:'#c9a0ee',cyan:'#79d4e1',white:'#e6e8f1',brightBlack:'#818ba3',brightRed:'#ffa5b3',brightGreen:'#96edc8',brightYellow:'#f5dfa7',brightBlue:'#b3bfff',brightMagenta:'#dfbaff',brightCyan:'#a5ebef',brightWhite:'#ffffff' } };
}
function sidebar() {
  $('shell-list').innerHTML = [['powershell.exe','PowerShell'],['pwsh.exe','PowerShell 7'],['cmd.exe',tr('Komut İstemi')],['wsl.exe','WSL / Linux']].map(([shell,name])=>`<button class="nav-item" data-shell="${shell}">${shellIcon(shell)} ${name}</button>`).join('');
  $('shell-list').querySelectorAll('button').forEach(b=>b.onclick=run(()=>openSession({kind:'local',shell:b.dataset.shell})));
  const query=$('connection-filter').value.toLocaleLowerCase(getLanguage());
  const profiles=state.profiles.filter(p=>(p.name+' '+p.host+' '+p.group).toLocaleLowerCase(getLanguage()).includes(query));
  $('connection-list').innerHTML = profiles.map(p=>msg`<div class="connection-row"><button class="nav-item" data-profile="${esc(p.id)}"><span class="connection-dot" style="background:${esc(p.color)}"></span><span class="item-text">${esc(p.name)}<small>${esc(p.group ? p.group+' · ' : '')}${esc(p.username)}@${esc(p.host)}${p.forwards?.length?esc(' · ↪ '+p.forwards.length):''}</small></span></button><button class="icon-button edit-profile" data-id="${esc(p.id)}" title="Bağlantıyı düzenle">${icon('more-horizontal')}</button></div>`).join('') || '<div class="empty-note">'+(state.profiles.length?tr('Eşleşen bağlantı yok.'):tr('İlk sunucunu + ile ekle.<br>Bir sonraki bağlantın tek tık uzakta.'))+'</div>';
  $('connection-list').querySelectorAll('[data-profile]').forEach(b=>b.onclick=run(()=>connect(b.dataset.profile)));
  $('connection-list').querySelectorAll('.edit-profile').forEach(b=>b.onclick=()=>profileModal(state.profiles.find(p=>p.id===b.dataset.id)));
  $('workspace-list').innerHTML=state.workspaces.map((w,i)=>msg`<div class="connection-row"><button class="nav-item" data-workspace="${i}">${icon('layers')}<span class="item-text">${esc(w.name)}<small>${w.sessions.length} oturum</small></span></button><button class="icon-button" data-delete-workspace="${i}" title="Çalışma alanını sil">${icon('x')}</button></div>`).join('') || tr('<div class="empty-note">Açık sekmelerini bir araya getir,<br>çalışma düzenini kaydet.</div>');
  $('workspace-list').querySelectorAll('[data-workspace]').forEach(b=>b.onclick=run(async()=>{ for(const spec of state.workspaces[Number(b.dataset.workspace)].sessions) { try { spec.kind==='ssh'?await connect(spec.profileId):await openSession(spec); } catch(e){toast(e.message,true);} } }));
  $('workspace-list').querySelectorAll('[data-delete-workspace]').forEach(b=>b.onclick=run(async()=>{const w=state.workspaces[Number(b.dataset.deleteWorkspace)]; if(await ask(tr('Çalışma alanı silinsin mi?'),w.name)) { Object.assign(state,await api.workspaceDelete(w.name)); sidebar(); }}));
  paintIcons();
}
async function connect(profileId) {
  const p=state.profiles.find(x=>x.id===profileId); if(!p) throw new Error(tr('Kayıtlı SSH bağlantısı bulunamadı.'));
  let password;
  if(p.auth==='password' && !p.hasSecret) { password=await promptValue(tr('SSH parolası'),p.username+'@'+p.host,'','password'); if(password===null)return; }
  if(p.auth==='key' && !p.hasSecret) { password=await promptValue(tr('SSH anahtar şifresi'),tr('Anahtar şifreli değilse boş bırakıp onayla.'),'','password'); if(password===null)return; }
  return openSession({kind:'ssh',profileId,password});
}
async function openSession(spec) {
  $('footer-status').textContent=spec.kind==='ssh'?tr('SSH bağlantısı kuruluyor…'):tr('Terminal başlatılıyor…');
  try {
    const result=await api.sessionOpen(spec);
    const term=new Terminal(terminalOptions()), fit=new FitAddon(), search=new SearchAddon();
    term.loadAddon(fit); term.loadAddon(search);
    const pane=document.createElement('div'); pane.className='terminal-pane'; $('terminal-host').append(pane);
    const s={...result,term,fit,search,pane,remoteDir:result.cwd,localDir:result.kind==='local'?result.cwd:localDir,follow:false}; tabs.set(s.id,s);
    term.open(pane);
    term.onData(data=>api.input(s.id,data));
    term.onResize(({cols,rows})=>api.resize(s.id,cols,rows));
    term.onSelectionChange(()=>{if(state.settings.copyOnSelect && term.hasSelection()) api.clipboardWrite(term.getSelection());});
    term.onBell(()=>{if(state.settings.terminalBell) toast(tr('Terminal bildirimi · ')+s.title);});
    term.attachCustomKeyEventHandler(event=>{
      if(event.type!=='keydown')return true;
      if(event.ctrlKey && (event.key.toLowerCase()==='v' || (event.shiftKey && event.key.toLowerCase()==='c'))) {
        event.preventDefault();
        if(event.key.toLowerCase()==='c') api.clipboardWrite(term.getSelection()); else run(()=>pasteInto(s))();
        return false;
      }
      if(Object.values(state.settings.shortcuts).some(v=>matches(event,v)))return false;
      return true;
    });
    pane.addEventListener('mousedown',()=>{if(active!==s.id){active=s.id;updateTabs();updateSessionInfo();}});
    pane.addEventListener('contextmenu',run(async e=>{ e.preventDefault(); if(term.hasSelection()) await api.clipboardWrite(term.getSelection()); else await pasteInto(s); }));
    activate(s.id);
    if(s.forwards?.length)toast(tr('Port yönlendirme etkin: ')+s.forwards.map(f=>`127.0.0.1:${f.localPort} → ${f.host}:${f.port}`).join(' · '));
    for(const ev of pending.get(s.id)||[])eventReceived(ev);
    pending.delete(s.id);
    api.ready(s.id);
    return s;
  } finally { updateFooter(); }
}
async function pasteInto(s) { const text=await api.clipboardRead(); if(/[\r\n]/.test(text) && !await ask(tr('Çok satırlı metin yapıştırılsın mı?'), tr('Bu metin birden fazla komut çalıştırabilir.\n\n')+text.slice(0,600)))return; s.term.paste(text); }
function updateFooter(){ $('footer-status').textContent=tabs.size?msg`${tabs.size} oturum · ${[...tabs.values()].filter(s=>s.kind==='ssh').length} SSH`:tr('Hazır'); }
const elapsed = milliseconds => { const seconds=Math.max(0,Math.floor(milliseconds/1000));return `${Math.floor(seconds/3600).toString().padStart(2,'0')}:${Math.floor(seconds%3600/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`; };
async function updateMetrics(){
  try{const data=await api.metrics(active),s=data.session,now=s?.endedAt||Date.now();
    $('footer-metrics').textContent=`CPU ${data.cpu.toFixed(1)}%  ·  RAM ${size(data.ram)} / ${size(data.ramTotal)}  ·  ${tr('Bağlantı')} ${s?elapsed(now-s.openedAt):'—'}  ·  ${tr('Etkinlik')} ${s?elapsed(now-s.lastActivityAt):'—'}  ·  ↓ ${size(data.transfer.download)}  ↑ ${size(data.transfer.upload)}`;
  }catch{}
}
function updateTabs(){
  $('tabs').innerHTML=[...tabs.values()].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)).map(s=>msg`<button class="tab ${s.id===active?'active':''} ${s.pinned?'pinned':''}" data-id="${s.id}" title="${esc(tr('Yeniden adlandırmak için çift tıkla; sekme işlemleri için sağ tıkla'))}">${s.kind==='ssh'?icon('server-cog'):shellIcon(s.spec.shell||'powershell')}<span>${esc(s.title)}${s.exited?tr(' · kapalı'):''}</span><span class="tab-pin" title="${esc(s.pinned?tr('Sekmenin sabitini kaldır'):tr('Sekmeyi sabitle'))}">${icon(s.pinned?'pin-off':'pin')}</span><span class="tab-close" title="${esc(tr('Sekmeyi kapat'))}">${icon('x')}</span></button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(b=>{b.onclick=()=>activate(b.dataset.id);b.ondblclick=run(()=>renameTab(b.dataset.id));b.oncontextmenu=e=>{e.preventDefault();tabActions(b.dataset.id);};b.querySelector('.tab-pin').onclick=e=>{e.stopPropagation();const s=tabs.get(b.dataset.id);s.pinned=!s.pinned;updateTabs();};b.querySelector('.tab-close').onclick=run(e=>{e.stopPropagation();return closeSession(b.dataset.id);});}); paintIcons();
}
async function renameTab(id){const s=tabs.get(id);if(!s)return;const value=await promptValue(tr('Sekmeyi yeniden adlandır'),tr('Bu oturuma bir ad ver.'),s.title);if(value?.trim()){s.title=value.trim().slice(0,80);updateTabs();}}
function tabActions(id){const s=tabs.get(id);if(!s)return;modal(tr('Sekme işlemleri'),s.title,`<div class="tab-actions"><button id="tab-rename" class="secondary">${icon('pencil')} ${esc(tr('Yeniden adlandır'))}</button><button id="tab-pin-toggle" class="secondary">${icon(s.pinned?'pin-off':'pin')} ${esc(s.pinned?tr('Sabiti kaldır'):tr('Sabitle'))}</button></div>`);$('tab-rename').onclick=()=>{$('modal').close();renameTab(id);};$('tab-pin-toggle').onclick=()=>{s.pinned=!s.pinned;$('modal').close();updateTabs();};}
function activate(id){active=id; updateTabs(); layout(); updateSessionInfo(); current()?.term.focus(); }
function layout(){
  $('welcome').hidden=!!tabs.size; $('session-layout').hidden=!tabs.size;
  const values=[...tabs.values()], second=split?values.find(s=>s.id!==active):null;
  for(const s of values){s.pane.hidden=s.id!==active&&s!==second; s.pane.classList.toggle('focused',s.id===active);}
  $('file-panel').hidden=!panelVisible; $('sidebar').hidden=!sidebarVisible; $('left-resizer').hidden=!sidebarVisible; $('right-resizer').hidden=!panelVisible||!tabs.size; $('split-button').style.color=split?'var(--accent)':'';
  scheduleFit();
}
function scheduleFit(){if(fitFrame)return;fitFrame=requestAnimationFrame(()=>{fitFrame=null;for(const s of tabs.values())if(!s.pane.hidden){try{s.fit.fit();}catch{}}});}
function updateSessionInfo(){
  ++localRequest; ++remoteRequest;
  const s=current(); $('session-info').textContent=s?`${s.kind==='ssh'?'SSH':'LOCAL'}  /  ${s.cwd||s.title}${s.forwards?.length?'  /  ↪ '+s.forwards.length:''}`:'';
  $('remote-explorer').hidden=s?.kind!=='ssh';
  $('local-explorer').hidden=s?.kind==='ssh';
  if(s?.kind==='ssh'){remoteDir=s.remoteDir||s.cwd||'/';$('remote-path').value=remoteDir;$('cwd-follow').textContent=s.follow?tr('Takip açık'):tr('Dizini takip et');run(()=>loadRemote())();}
  if(s?.kind==='local')run(()=>loadLocal(s.cwd))();
}
async function closeSession(id){const s=tabs.get(id);if(!s)return;if(s.pinned)return;if(state.settings.confirmClose&&!s.exited&&!await ask(tr('Oturum kapatılsın mı?'),s.title+tr(' oturumundaki çalışan işlemler sonlanır.')))return;await api.sessionClose(id);s.term.dispose();s.pane.remove();tabs.delete(id);if(active===id)active=[...tabs.keys()].at(-1);updateTabs();layout();updateSessionInfo();updateFooter();}
function eventReceived(e){
  if(e.type==='notice'){toast(e.message,true);return;}
  if(e.type==='transfer'){const previous=transfers.get(e.transferId),at=Date.now();e.rate=previous?.name===e.name?Math.max(0,(e.done-previous.done)*1000/Math.max(1,at-previous.at)):0;e.at=at;transfers.set(e.transferId,e);renderTransfer();return;}
  if(e.type==='transfer-end'){transfers.delete(e.transferId);renderTransfer();return;}
  const s=tabs.get(e.id);
  if(!s){const list=pending.get(e.id)||[];if(list.length<200)list.push(e);pending.set(e.id,list);if(pending.size>100)pending.delete(pending.keys().next().value);return;}
  if(e.type==='data')s.term.write(e.data,()=>api.ack(s.id,e.data.length));
  if(e.type==='exit'){s.exited=true;s.term.write('\r\n\x1b[90m['+e.message+']\x1b[0m\r\n');updateTabs();}
  if(e.type==='cwd'){
    s.cwd=e.cwd;
    if(s.kind==='local') { s.localDir=e.cwd; s.spec.cwd=e.cwd; if(s.id===active)run(()=>loadLocal(e.cwd))(); }
    else if(s.follow){s.remoteDir=e.cwd;if(s.id===active){remoteDir=e.cwd;run(()=>loadRemote())();}}
    if(s.id===active)$('session-info').textContent=(s.kind==='ssh'?'SSH':'LOCAL')+'  /  '+e.cwd;
  }
}
function renderTransfer(){const t=[...transfers.values()].at(-1);$('transfer-status').textContent=t?`${transfers.size>1?transfers.size+tr(' aktarım · '):''}${t.direction==='upload'?'↑':'↓'} ${t.name} · ${t.total?Math.round(t.done/t.total*100):0}%${t.rate?' · '+size(t.rate)+'/s':''}`:'';}
function modal(title,subtitle,body,footer=''){ $('modal-content').innerHTML=msg`<div class="modal-header"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button id="modal-close" class="icon-button" aria-label="Kapat">${icon('x')}</button></div><div class="modal-body">${body}<div id="modal-error" class="modal-error"></div></div><div class="modal-footer">${footer}</div>`;$('modal').showModal();$('modal-close').onclick=()=>$('modal').close();paintIcons();}
function promptValue(title,description,value='',type='text') { return new Promise(resolve=>{
  modal(title,description,`<input id="prompt-value" type="${type}" value="${esc(value)}" class="full">`,tr('<button id="prompt-cancel" class="secondary">Vazgeç</button><button id="prompt-ok" class="primary">Onayla</button>'));let result=null;
  $('prompt-cancel').onclick=()=>$('modal').close();$('prompt-ok').onclick=()=>{result=$('prompt-value').value;$('modal').close();};$('prompt-value').onkeydown=e=>{if(e.key==='Enter')$('prompt-ok').click();};$('modal').addEventListener('close',()=>resolve(result),{once:true});$('prompt-value').focus();
}); }
function ask(title,description){return new Promise(resolve=>{modal(title,'',`<div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8">${esc(description)}</div>`,tr('<button id="ask-no" class="secondary">Vazgeç</button><button id="ask-yes" class="primary">Onayla</button>'));let ok=false;$('ask-no').onclick=()=>$('modal').close();$('ask-yes').onclick=()=>{ok=true;$('modal').close();};$('modal').addEventListener('close',()=>resolve(ok),{once:true});});}
const field=(label,name,value='',type='text',wide=false)=>`<label class="field ${wide?'wide':''}">${label}<input name="${name}" type="${type}" value="${esc(value)}"></label>`;
const textareaField=(label,name,value='',hint='')=>`<label class="field wide">${label}<textarea name="${name}" rows="3">${esc(value)}</textarea>${hint?`<small>${esc(hint)}</small>`:''}</label>`;
const selectField=(label,name,value,options)=>`<label class="field">${label}<select name="${name}">${options.map(([v,n])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
function profileModal(p={}) {
  modal(p.id?tr('Bağlantıyı düzenle'):tr('Yeni SSH bağlantısı'),tr('Sunucunu kaydet. Bir sonraki sefer tek tıkla bağlan.'),msg`<form id="profile-form"><div class="form-grid">${field(tr('Bağlantı adı'),'name',p.name||'','text',true)}${field(tr('Sunucu adresi'),'host',p.host||'')}${field('Port','port',p.port||22,'number')}${field(tr('Kullanıcı adı'),'username',p.username||'')}${selectField(tr('Kimlik doğrulama'),'auth',p.auth||'password',[['password',tr('Parola')],['key',tr('SSH özel anahtarı')]])}<label class="field wide">Özel anahtar dosyası<div class="field-row"><input name="privateKeyPath" value="${esc(p.privateKeyPath)}" placeholder="C:\\Users\\…\\.ssh\\id_ed25519"><button id="key-pick" type="button" class="secondary">Seç</button></div></label>${field(p.hasSecret?tr('Parola / anahtar şifresi (boş bırak: koru)'):tr('Parola / anahtar şifresi'),'password','','password',true)}${field(tr('Grup etiketi'),'group',p.group||'')}${field(tr('Bağlantı rengi'),'color',p.color||'#8b9cff','color')}${field(tr('Başlangıç dizini (isteğe bağlı)'),'initialDirectory',p.initialDirectory||'','text',true)}${textareaField(tr('Yerel port yönlendirme'),'forwards',(p.forwards||[]).map(f=>`${f.localPort}:${f.host}:${f.port}`).join('\n'),tr('Her satıra localPort:host:port yaz. Yalnızca 127.0.0.1 üzerinde dinlenir.'))}</div><label class="check-field"><input type="checkbox" name="remember" checked> Parolayı bu Windows hesabında şifreli sakla</label><div class="info-box">Parolalar Windows DPAPI ile korunur. İlk bağlantıda sunucunun kimliğini onaylaman istenir. Anahtarla bağlantıda parola alanı anahtarın şifresidir.</div></form>`,msg`${p.id?tr('<button id="profile-remove" class="secondary danger" style="margin-right:auto">Sil</button>'):''}<button id="profile-submit" class="primary">${icon('bookmark')} Bağlantıyı kaydet</button>`);
  on('key-pick',async()=>{const selected=await api.pickKey();if(selected)$('profile-form').elements.privateKeyPath.value=selected;});
  on('profile-submit',async()=>{const form=$('profile-form');const data=Object.fromEntries(new FormData(form));data.id=p.id;data.forgetSecret=!form.elements.remember.checked;if(data.forgetSecret)data.password='';try{Object.assign(state,await api.profileSave(data));sidebar();$('modal').close();toast(tr('Bağlantı kaydedildi.'));}catch(e){$('modal-error').textContent=e.message;}});
  $('profile-form').onsubmit=e=>{e.preventDefault();$('profile-submit').click();};
  if(p.id)on('profile-remove',async()=>{$('modal').close();if(await ask(tr('Bağlantı silinsin mi?'),p.name)){Object.assign(state,await api.profileDelete(p.id));sidebar();}});
}
async function settingsModal(){
  Object.assign(state,await api.state());
  const s=state.settings;
  modal(tr('Sana göre bir terminal'),tr('Görünüm, davranış ve bağlantı tercihleri.'),msg`<form id="settings-form"><div class="form-grid"><div class="form-section">GÖRÜNÜM</div>${selectField(tr('Tema'),'theme',s.theme,[['midnight',tr('Gece')],['light',tr('Aydınlık')],['forest',tr('Orman')]])}${field(tr('Vurgu rengi'),'accent',s.accent,'color')}${field(tr('Yazı tipi'),'fontFamily',s.fontFamily,'text',true)}${field(tr('Yazı boyutu (9–32)'),'fontSize',s.fontSize,'number')}${field(tr('Satır yüksekliği (1–2)'),'lineHeight',s.lineHeight,'number')}${selectField(tr('İmleç'),'cursorStyle',s.cursorStyle,[['bar',tr('Çizgi')],['block',tr('Blok')],['underline',tr('Alt çizgi')]])}${field(tr('Geçmiş satır sayısı'),'scrollback',s.scrollback,'number')}<div class="form-section">TERMİNAL VE SSH</div>${field(tr('Varsayılan kabuk / uygulama yolu'),'defaultShell',s.defaultShell,'text',true)}${field(tr('Başlangıç klasörü (boş: kullanıcı klasörü)'),'startDirectory',s.startDirectory,'text',true)}${field(tr('SSH canlı tutma aralığı (ms)'),'keepaliveInterval',s.keepaliveInterval,'number')}<div class="field">Davranış${[['cursorBlink',tr('Yanıp sönen imleç')],['copyOnSelect',tr('Seçileni otomatik kopyala')],['confirmClose',tr('Kapatırken onay iste')],['showHidden',tr('Gizli dosyaları göster')],['terminalBell',tr('Terminal bildirimini göster')]].map(([k,n])=>`<label class="check-field"><input type="checkbox" name="${k}" ${s[k]?'checked':''}>${n}</label>`).join('')}</div><div class="form-section">KLAVYE KISAYOLLARI</div>${Object.entries(s.shortcuts).map(([k,v])=>field(({newTab:tr('Yeni terminal'),closeTab:tr('Sekmeyi kapat'),settings:tr('Ayarlar'),search:tr('Terminalde ara'),palette:tr('Komut paleti')})[k],'shortcut-'+k,v)).join('')}</div><div class="info-box">Ctrl+Shift+C: kopyala · Ctrl+V: yapıştır · Ctrl+Tab: sonraki sekme.<br>PowerShell 7 ve WSL, bilgisayarda kuruluysa kullanılabilir. SSH canlı tutma ayarı yeni bağlantılarda uygulanır.</div></form>`,msg`<button id="settings-export" class="secondary" style="margin-right:auto">Dışa aktar</button><button id="settings-import" class="secondary">İçe aktar</button><button id="settings-submit" class="primary">Kaydet</button>`);
  $('settings-form').elements.lineHeight.step='0.05';
  const languageField=document.createElement('div');languageField.className='field wide';
  languageField.innerHTML=selectField(tr('Dil / Language'),'language',s.language,[['tr','Türkçe'],['en','English']]);
  $('settings-form').querySelector('.form-grid').prepend(languageField);
  const promptSettings=document.createElement('div');promptSettings.className='form-grid prompt-settings';
  promptSettings.innerHTML=`<div class="form-section">${esc(tr('KOMUT SATIRI'))}</div>${selectField(tr('Komut satırı teması'),'promptTheme',s.promptTheme,[['accent',tr('Vurgu rengi')],['ocean',tr('Okyanus')],['sunset',tr('Gün batımı')],['mono',tr('Tek renk')]])}<div class="field">${esc(tr('Bilgiler'))}<label class="check-field"><input type="checkbox" name="promptGit" ${s.promptGit?'checked':''}>${esc(tr('Git dalı ve değişiklik durumu'))}</label><label class="check-field"><input type="checkbox" name="promptIcons" ${s.promptIcons?'checked':''}>${esc(tr('Komut satırı simgeleri'))}</label></div>`;
  $('settings-form').append(promptSettings);
  const promptNote=document.createElement('div');promptNote.className='info-box';promptNote.textContent=tr('Yeni ayarlar yeni açılan terminal ve SSH dizin takibi oturumlarında uygulanır. Git bilgisi dalı, değişiklik sayısını ve uzak dalın ileri/geri durumunu gösterir.');$('settings-form').append(promptNote);
  $('settings-form').onsubmit=e=>{e.preventDefault();$('settings-submit').click();};
  const trusted=document.createElement('div');trusted.className='info-box';trusted.innerHTML=tr('<strong>Güvenilen sunucular</strong>')+(state.trustedHosts?.length?state.trustedHosts.map((h,i)=>msg`<div style="margin-top:10px;overflow-wrap:anywhere">${esc(h.host)}<br><small>${esc(h.fingerprint)}</small> <button class="text-button danger" data-forget-host="${i}" type="button">Unut</button></div>`).join(''):tr('<div>Henüz doğrulanmış SSH sunucusu yok.</div>'));$('settings-form').append(trusted);
  const securityHeading=document.createElement('div');securityHeading.className='form-section';securityHeading.textContent=tr('GÜVENLİK');$('settings-form').insertBefore(securityHeading,trusted);
  const settingsNav=document.createElement('nav');settingsNav.className='settings-nav';settingsNav.setAttribute('aria-label',tr('Ayar bölümleri'));
  const settingsSections=[...$('settings-form').querySelectorAll('.form-section')];settingsNav.innerHTML=settingsSections.map((section,index)=>`<button type="button" data-settings-section="${index}">${esc(section.textContent)}</button>`).join('');$('settings-form').prepend(settingsNav);
  settingsNav.querySelectorAll('button').forEach(button=>button.onclick=()=>settingsSections[Number(button.dataset.settingsSection)].scrollIntoView({behavior:'smooth',block:'start'}));
  trusted.querySelectorAll('[data-forget-host]').forEach(b=>b.onclick=run(async()=>{Object.assign(state,await api.hostForget(state.trustedHosts[Number(b.dataset.forgetHost)].host));$('modal').close();settingsModal();}));
  on('settings-submit',async()=>{const form=$('settings-form'),data=Object.fromEntries(new FormData(form));const shortcuts={};for(const key of Object.keys(s.shortcuts)){shortcuts[key]=data['shortcut-'+key];delete data['shortcut-'+key];}for(const k of ['cursorBlink','copyOnSelect','confirmClose','showHidden','terminalBell','promptGit','promptIcons'])data[k]=form.elements[k].checked;Object.assign(state,await api.settings({...data,shortcuts}));applySettings();$('modal').close();toast(tr('Ayarlar uygulandı.'));updateSessionInfo();});
  on('settings-export',async()=>{await api.exportConfig();toast(tr('Dışa aktarılan ayarlara parolalar dahil edilmez.'));});
  on('settings-import',async()=>{Object.assign(state,await api.importConfig());applySettings();sidebar();$('modal').close();});
}
function palette(){const actions=[[tr('Yeni terminal'),()=>openSession({kind:'local'})],[tr('SSH bağlantısı ekle'),()=>profileModal()],[tr('Ayarlar'),settingsModal],[tr('Bölünmüş görünüm'),()=>{split=!split;layout();}],[tr('Dosya panelini aç / kapat'),()=>{panelVisible=!panelVisible;layout();}],[tr('Çalışma alanını kaydet'),saveWorkspace],...state.profiles.map(p=>[tr('Bağlan: ')+p.name,()=>connect(p.id)])];modal(tr('Komut paleti'),tr('Aradığını yaz, Enter ile aç.'),tr('<input id="palette-query" class="full" placeholder="Bir komut veya sunucu ara…"><div id="palette-results" class="palette-list"></div>'));const render=()=>{const list=actions.filter(([n])=>n.toLocaleLowerCase(getLanguage()).includes($('palette-query').value.toLocaleLowerCase(getLanguage())));$('palette-results').innerHTML=list.map(([n],i)=>`<button data-action="${i}">${icon('chevron-right')}${esc(n)}</button>`).join('');$('palette-results').querySelectorAll('button').forEach(b=>b.onclick=run(()=>{$('modal').close();return list[Number(b.dataset.action)][1]();}));paintIcons();};$('palette-query').oninput=render;$('palette-query').onkeydown=e=>{if(e.key==='Enter')$('palette-results').querySelector('button')?.click();};render();$('palette-query').focus();}
async function saveWorkspace(){if(!tabs.size){toast(tr('Önce kaydetmek istediğin oturumları aç.'));return;}const name=await promptValue(tr('Çalışma alanını kaydet'),tr('Açık oturumlar bu adla yeniden açılabilir. Terminal çıktısı kaydedilmez.'));if(!name?.trim())return;Object.assign(state,await api.workspaceSave({name,sessions:[...tabs.values()].map(s=>s.spec)}));sidebar();toast(tr('Çalışma alanı kaydedildi.'));}
const remoteJoin=(dir,name)=>(dir==='/'?'':dir.replace(/\/$/,''))+'/'+name;
const remoteParent=dir=>dir.replace(/\/+$/,'').split('/').slice(0,-1).join('/')||'/';
const localJoin=(dir,name)=>dir.replace(/[\\/]$/,'')+'\\'+name;
const localParent=dir=>{const normalized=dir.replace(/[\\/]$/,'');return normalized.includes('\\')?normalized.slice(0,normalized.lastIndexOf('\\')+1):dir;};
const size=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':n<1073741824?(n/1048576).toFixed(1)+' MB':(n/1073741824).toFixed(1)+' GB';
function sortedFiles(entries){return entries.filter(e=>state.settings.showHidden||!e.name.startsWith('.')).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));}
function visibleFiles(entries){const query=$('file-filter').value.trim().toLocaleLowerCase(getLanguage());return sortedFiles(entries).filter(entry=>!query||entry.name.toLocaleLowerCase(getLanguage()).includes(query));}
function filterFiles(){if(current()?.kind==='ssh')remoteView.set(visibleFiles(remoteEntries));else localView.set(visibleFiles(localEntries));}
function fileRows(entries,remote){return entries.map((e,i)=>`<div class="file-row ${e.directory?'directory':''} ext-${esc(e.name.split('.').at(-1).toLowerCase().replace(/[^a-z0-9]/g,''))}" draggable="true" data-name="${esc(e.name)}" title="${esc(e.name)} · ${new Date(e.mtime).toLocaleString(getLanguage()==='en'?'en-US':'tr-TR')}">${icon(fileIcon(e))}<span class="file-name">${esc(e.name)}${e.symlink?' ↗':''}</span><span class="file-size">${e.directory?'—':size(e.size)}</span>${!e.directory?`<span class="file-tools"><button data-action="edit" title="${esc(tr('Dosyayı düzenle'))}">${icon('file-pen-line')}</button>${remote?msg`<button data-action="download" title="İndir">${icon('download')}</button><button data-action="drag" title="Explorer’a sürüklemek için hazırla">${icon('external-link')}</button><button data-action="rename" title="Yeniden adlandır">${icon('pencil')}</button><button data-action="delete" title="Sil">${icon('trash-2')}</button>`:''}</span>`:''}</div>`).join('')||tr('<div class="empty-note">Bu klasör boş.</div>');}
async function loadRemote(dir=remoteDir){const s=ssh(),request=++remoteRequest;$('remote-files').innerHTML=tr('<div class="empty-note">Dosyalar yükleniyor…</div>');try{const entries=await api.filesList(s.id,dir);if(request!==remoteRequest||s.id!==active)return;remoteDir=dir;s.remoteDir=dir;remoteEntries=entries;$('remote-path').value=dir;s.fileEntries=entries;s.fileDirectory=dir;remoteView.set(visibleFiles(entries));}catch(e){if(request===remoteRequest)$('remote-files').innerHTML=`<div class="empty-note danger">${esc(e.message)}</div>`;throw e;}}
async function loadLocal(dir=localDir){const id=active,request=++localRequest;const entries=await api.filesList(null,dir);if(request!==localRequest||id!==active)return;localDir=dir;if(current())current().localDir=dir;localEntries=entries;$('local-path').value=dir;if(current()){current().fileEntries=entries;current().fileDirectory=dir;}localView.set(visibleFiles(entries));}
function bindFiles(remote){const root=$(remote?'remote-files':'local-files');root.querySelectorAll('.file-row').forEach(row=>{
  const name=row.dataset.name,entry=(remote?remoteEntries:localEntries).find(e=>e.name===name),full=remote?remoteJoin(remoteDir,name):localJoin(localDir,name),sessionId=remote?active:null;
  row.ondblclick=run(()=>entry.directory?(remote?loadRemote(full):loadLocal(full)):openEditor(sessionId,full));
  row.onclick=()=>{root.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));row.classList.add('selected');};
  row.ondragstart=e=>{e.dataTransfer.setData('application/x-lumaterm',JSON.stringify({remote,path:full,id:sessionId}));e.dataTransfer.effectAllowed='copy';};
  row.querySelectorAll('[data-action]').forEach(b=>b.onclick=run(async e=>{e.stopPropagation();const action=b.dataset.action;
    if(action==='edit')await openEditor(sessionId,full);
    if(action==='download')await download([full],sessionId);
    if(action==='drag'){toast(tr('Dosya hazırlanıyor. İndirme tamamlanınca açılan düğmeyi Explorer’a sürükle.'));await prepareDrag(sessionId,full);}
    if(action==='rename'){const value=await promptValue(tr('Yeniden adlandır'),name,name);if(value&&value!==name)await api.filesRename(sessionId,full,value);}
    if(action==='delete')await api.filesDelete(sessionId,full);
    if(active===sessionId)await loadRemote();
  }));
});}
async function download(paths,id=ssh().id,dest){const count=await api.filesDownload(id,paths,dest);if(count===undefined)return;toast(msg`${count||0} dosya indirildi.`);if(current()?.kind==='local')await loadLocal();}
async function upload(paths){if(!paths.length)return;const s=ssh(),dir=remoteDir;const count=await api.filesUpload(s.id,paths,dir);toast(msg`${count} dosya yüklendi.`);if(active===s.id)await loadRemote(dir);}
async function prepareDrag(id,remote){
  // Native dragging is initiated on a subsequent user gesture after staging.
  const staged=await api.filesDrag(id,remote);
  modal(tr('Dosya hazır'),tr('Aşağıdaki dosyayı Windows Explorer’a veya masaüstüne sürükle.'),msg`<button id="native-drag" class="secondary full" draggable="true">${icon('file')} ${esc(remote.split('/').pop())}</button><div class="info-box">Geçici kopya: ${esc(staged.local)}</div>`);
  $('native-drag').ondragstart=e=>{e.preventDefault();api.nativeDrag(staged.token);};
}
function dropZone(id,remote){const el=$(id);el.ondragover=e=>{e.preventDefault();el.classList.add('drag-over');};el.ondragleave=e=>{if(!el.contains(e.relatedTarget))el.classList.remove('drag-over');};el.ondrop=run(async e=>{e.preventDefault();el.classList.remove('drag-over');const internal=e.dataTransfer.getData('application/x-lumaterm');if(internal){const item=JSON.parse(internal);if(remote&&!item.remote)await upload([item.path]);else if(!remote&&item.remote)await download([item.path],item.id);}else if(remote){const paths=[...e.dataTransfer.files].map(api.filePath).filter(Boolean);await upload(paths);}});}
function matches(e,shortcut){const parts=String(shortcut).toLowerCase().split('+').map(x=>x.trim());return e.ctrlKey===parts.includes('ctrl')&&e.shiftKey===parts.includes('shift')&&e.altKey===parts.includes('alt')&&e.key.toLowerCase()===parts.at(-1);}
async function openEditor(id,target){
  const file=await api.editorRead(id,target);
  modal(tr('Metin editörü'),target,`<textarea id="editor-content" spellcheck="false" aria-label="${esc(tr('Dosya içeriği'))}"></textarea>`, `<span id="editor-state">UTF-8</span><button id="editor-save" class="primary">${icon('save')} ${esc(tr('Dosyayı kaydet'))}</button>`);
  const input=$('editor-content');input.value=file.content;let version=file.version,original=file.content;
  const mark=()=>{$('editor-state').textContent=input.value===original?'UTF-8':tr('Kaydedilmemiş değişiklikler')};input.oninput=mark;
  let discardArmed=false;
  $('modal-close').onclick=()=>{if(input.value!==original&&!discardArmed){discardArmed=true;$('modal-error').textContent=tr('Değişiklikleri atmak için Kapat düğmesine yeniden bas.');return;}$('modal').close();};
  const guard=e=>{if(input.value!==original){e.preventDefault();$('modal-error').textContent=tr('Önce dosyayı kaydet veya Kapat düğmesini iki kez kullan.');}};
  $('modal').addEventListener('cancel',guard);$('modal').addEventListener('close',()=>$('modal').removeEventListener('cancel',guard),{once:true});
  const save=run(async()=>{const result=await api.editorSave(id,target,input.value,version);version=result.version;original=input.value;mark();toast(tr('Dosya kaydedildi.'));if(current()?.kind==='ssh'&&id===active)await loadRemote();else if(!id&&current()?.kind==='local')await loadLocal();});
  $('editor-save').onclick=save;input.onkeydown=e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();save();}if(e.key==='Tab'){e.preventDefault();const start=input.selectionStart;input.setRangeText('  ',start,input.selectionEnd,'end');mark();}};
  input.focus();
}
function installResizer(id,panel,side,min,max){
  const handle=document.createElement('div');handle.id=id;handle.className='panel-resizer';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');panel[side==='left'?'after':'before'](handle);
  handle.onpointerdown=e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing-panel');};
  handle.onpointermove=e=>{if(!handle.hasPointerCapture(e.pointerId))return;const rect=document.querySelector('.app-layout').getBoundingClientRect();const width=side==='left'?e.clientX-rect.left:rect.right-e.clientX;const other=side==='left'?($('file-panel').hidden?0:$('file-panel').getBoundingClientRect().width+5):($('sidebar').hidden?0:$('sidebar').getBoundingClientRect().width+5);panel.style.width=Math.max(min,Math.min(max,rect.width-other-320,width))+'px';scheduleFit();};
  handle.onpointerup=e=>{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);document.body.classList.remove('resizing-panel');localStorage.setItem(id+'-width',panel.style.width);};
  const saved=Number.parseInt(localStorage.getItem(id+'-width'),10);if(Number.isFinite(saved))panel.style.width=Math.max(min,Math.min(max,saved))+'px';
}
function searchTerminal(){if(!current())return;$('terminal-search').hidden=false;$('terminal-search-input').focus();}
async function init(){
  translateStaticUi=captureStaticUi(document.body);
  remoteView=new VirtualFiles($('remote-files'),entries=>fileRows(entries,true),()=>bindFiles(true));
  localView=new VirtualFiles($('local-files'),entries=>fileRows(entries,false),()=>bindFiles(false));
  api.on(eventReceived);state=await api.state();localDir=state.home;applySettings();paintIcons();
  $('footer-right').textContent=`UTF-8  │  LumaTerm ${state.version}`;
  document.querySelector('.brand').innerHTML='<img class="brand-logo" src="logo.svg" alt="LumaTerm"><span class="version">PREVIEW</span>';
  document.querySelector('.welcome-symbol').innerHTML='<img src="brand-mark.svg" alt="">';
  sidebarVisible=localStorage.getItem('sidebar-visible')!=='false';panelVisible=localStorage.getItem('panel-visible')!=='false';
  installResizer('left-resizer',$('sidebar'),'left',180,440);installResizer('right-resizer',$('file-panel'),'right',240,650);
  const sidebarButton=document.createElement('button');sidebarButton.id='sidebar-toggle';sidebarButton.className='icon-button';sidebarButton.title=tr('Sol paneli aç / kapat');sidebarButton.innerHTML=icon('panel-left');$('tabs-bar').prepend(sidebarButton);
  sidebarButton.onclick=()=>{sidebarVisible=!sidebarVisible;localStorage.setItem('sidebar-visible',String(sidebarVisible));layout();};
  const editButton=document.createElement('button');editButton.id='terminal-edit';editButton.className='icon-button';editButton.title=tr('Geçerli klasörde dosya aç');editButton.innerHTML=icon('file-pen-line');$('terminal-search-button').before(editButton);
  editButton.onclick=run(async()=>{const s=current();if(!s)return;const value=await promptValue(tr('Dosya aç'),tr('Geçerli klasöre göre dosya yolu yaz.'), '');if(!value?.trim())return;const target=s.kind==='ssh'?(value.startsWith('/')?value:remoteJoin(s.cwd||remoteDir,value)):(/^[a-z]:[\\/]/i.test(value)?value:localJoin(s.cwd||localDir,value));await openEditor(s.kind==='ssh'?s.id:null,target);});
  const metrics=document.createElement('span');metrics.id='footer-metrics';$('footer-right').before(metrics);updateMetrics();setInterval(updateMetrics,2000);
  layout();
  document.querySelectorAll('[data-window]').forEach(b=>b.onclick=()=>api.windowAction(b.dataset.window));
  for(const id of ['new-terminal','tab-add','welcome-terminal'])on(id,()=>openSession({kind:'local'}));
  for(const id of ['add-connection','welcome-ssh'])on(id,()=>profileModal());
  on('settings-button',settingsModal);on('palette-button',palette);on('save-workspace',saveWorkspace);
  $('connection-filter').oninput=sidebar;
  $('file-filter').oninput=filterFiles;
  on('split-button',()=>{if(tabs.size<2){toast(tr('Yan yana görünüm için en az iki oturum aç.'));return;}split=!split;layout();});
  on('files-toggle',()=>{panelVisible=!panelVisible;localStorage.setItem('panel-visible',String(panelVisible));layout();});
  on('terminal-search-button',searchTerminal);on('search-close',()=>{$('terminal-search').hidden=true;current()?.term.focus();});
  on('search-next',()=>{if(!current()?.search.findNext($('terminal-search-input').value))toast(tr('Eşleşme bulunamadı.'));});on('search-prev',()=>current()?.search.findPrevious($('terminal-search-input').value));
  $('terminal-search-input').onkeydown=e=>{if(e.key==='Enter')$(e.shiftKey?'search-prev':'search-next').click();if(e.key==='Escape')$('search-close').click();};
  on('terminal-clear',()=>current()?.term.clear());
  on('terminal-save',async()=>{const s=current();if(!s)return;const lines=[];for(let i=0;i<s.term.buffer.active.length;i++)lines.push(s.term.buffer.active.getLine(i).translateToString(true));await api.terminalSave(lines.join('\r\n'));});
  on('reconnect',()=>{const s=current();if(s)return s.kind==='ssh'?connect(s.spec.profileId):openSession(s.spec);});
  on('file-refresh',async()=>{if(current()?.kind==='ssh')await loadRemote();else if(current())await loadLocal();});
  on('remote-go',()=>loadRemote($('remote-path').value));on('local-go',()=>loadLocal($('local-path').value));
  $('remote-path').onkeydown=e=>{if(e.key==='Enter')$('remote-go').click();};$('local-path').onkeydown=e=>{if(e.key==='Enter')$('local-go').click();};
  on('remote-up',()=>loadRemote(remoteParent(remoteDir)));on('local-up',()=>loadLocal(localParent(localDir)));
  on('local-pick',async()=>{const dir=await api.pickDirectory();if(dir)await loadLocal(dir);});
  on('upload-button',async()=>upload(await api.pickUpload(false)));on('upload-folder',async()=>upload(await api.pickUpload(true)));
  on('remote-mkdir',async()=>{const s=ssh(),dir=remoteDir,name=await promptValue(tr('Yeni klasör'),tr('Uzak sunucuda oluşturulacak klasör adı.'));if(name){await api.filesMkdir(s.id,dir,name);await loadRemote();}});
  on('remote-cd',()=>{const s=ssh();if(/[\x00-\x1f\x7f]/.test(remoteDir))throw new Error(tr('Dizin kontrol karakteri içeriyor.'));api.input(s.id,"cd -- '"+remoteDir.replace(/'/g,"'\\''")+"'\r");s.term.focus();});
  on('cwd-follow',async()=>{const s=ssh();if(s.follow){s.follow=false;$('cwd-follow').textContent=tr('Dizini takip et');return;}if(await ask(tr('Terminal dizini takip edilsin mi?'),tr('Bash veya Zsh komut satırında olduğundan emin ol. Bu işlem oturumluk bir prompt fonksiyonu çalıştırır; sunucudaki ayar dosyalarını değiştirmez.'))){await api.cwdEnable(s.id);s.follow=true;$('cwd-follow').textContent=tr('Takip açık');}});
  dropZone('remote-files',true);dropZone('local-files',false);
  new ResizeObserver(scheduleFit).observe($('terminal-area'));
  document.addEventListener('keydown',run(async e=>{
    if($('modal').open)return;
    const actions={newTab:()=>openSession({kind:'local'}),closeTab:()=>closeSession(active),settings:settingsModal,search:searchTerminal,palette};
    for(const [key,shortcut] of Object.entries(state.settings.shortcuts))if(matches(e,shortcut)){e.preventDefault();await actions[key]();return;}
    if(e.ctrlKey&&e.key==='Tab'){e.preventDefault();const ids=[...tabs.keys()];if(ids.length)activate(ids[(ids.indexOf(active)+(e.shiftKey?-1:1)+ids.length)%ids.length]);}
  }));
  window.__lumaReady=true;
}
run(init)();
