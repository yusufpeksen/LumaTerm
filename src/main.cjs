const { tr, msg, setLanguage } = require('./i18n.cjs');
const { app, BrowserWindow, ipcMain, dialog, safeStorage, clipboard, nativeImage, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { Store } = require('./store.cjs');
const { settings, profile, safeName } = require('./core.cjs');
const { Sessions } = require('./sessions.cjs');
const { Files } = require('./files.cjs');
const { Editor } = require('./editor.cjs');
let win, store, sessions, files, editor, allowClose = false, updateTimer, offeredUpdate, previousCpu;
const stagedFiles = new Map();
const smoke = process.argv.includes('--smoke-test');
const packageCheck = process.argv.includes('--verify-package');
if(smoke) app.setPath('userData', path.join(__dirname,'../test-results/user-data'));
if(packageCheck) app.setPath('userData', path.join(app.getPath('temp'),'lumaterm-package-check'));
if(smoke || packageCheck) app.disableHardwareAcceleration();
app.setAppUserModelId('com.lumaterm.desktop');
const page = path.join(__dirname,'../dist/index.html');
function emit(event) { if(win && !win.isDestroyed()) win.webContents.send('event', event); }
function startAutoUpdater() {
  if(!app.isPackaged || smoke || packageCheck || app.getVersion().includes('-')) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', error => console.error('Update check failed:',error.message));
  autoUpdater.on('update-available', info => {
    if(offeredUpdate===info.version)return;
    offeredUpdate=info.version;
    dialog.showMessageBox(win,{
      type:'info',title:'LumaTerm',message:msg`${info.version} · Yeni LumaTerm sürümü hazır`,
      detail:tr('Güncellemeyi şimdi indirmek ister misin? İndirme sırasında uygulamayı kullanabilirsin.'),
      buttons:[tr('Sonra'),tr('İndir')],defaultId:1,cancelId:0,noLink:true
    }).then(({response})=>{if(response===1)autoUpdater.downloadUpdate().catch(error=>console.error('Update download failed:',error.message));});
  });
  autoUpdater.on('update-downloaded', info => {
    dialog.showMessageBox(win,{
      type:'info',
      title:'LumaTerm',
      message:tr('LumaTerm güncellemesi hazır'),
      detail:msg`${info.version} sürümü indirildi. Güncellemeyi uygulamak için LumaTerm yeniden başlatılacak.`,
      buttons:[tr('Daha sonra'),tr('Şimdi yeniden başlat')],
      defaultId:1,
      cancelId:0,
      noLink:true
    }).then(({response})=>{
      if(response===1){allowClose=true;sessions.closeAll();autoUpdater.quitAndInstall(false,true);}
    });
  });
  const check=()=>autoUpdater.checkForUpdates().catch(error=>console.error('Update check failed:',error.message));
  setTimeout(check,10000);
  updateTimer=setInterval(check,4*60*60*1000);
  updateTimer.unref?.();
}
async function confirm(message, detail) { return (await dialog.showMessageBox(win, { type: 'question', message, detail, buttons: [tr('Vazgeç'),tr('Onayla')], defaultId: 0, cancelId: 0, noLink: true })).response === 1; }
function trusted(event) { if(event.sender !== win.webContents || event.senderFrame?.url !== pathToFileURL(page).href) throw new Error(tr('Yetkisiz istek.')); }
function handle(name, fn) { ipcMain.handle(name, async (event,...args) => { trusted(event); return fn(...args); }); }
function register() {
  handle('state', () => ({ ...store.public(), home: os.homedir(), version: app.getVersion() }));
  handle('metrics', id => {
    const cpus=os.cpus(),totals=cpus.reduce((acc,cpu)=>{const times=cpu.times;acc.idle+=times.idle;acc.total+=Object.values(times).reduce((sum,value)=>sum+value,0);return acc;},{idle:0,total:0});
    const cpu=previousCpu?100*(1-(totals.idle-previousCpu.idle)/(totals.total-previousCpu.total)):0;previousCpu=totals;
    return {cpu:Number.isFinite(cpu)?Math.max(0,Math.min(100,cpu)):0,ram:os.totalmem()-os.freemem(),ramTotal:os.totalmem(),session:id&&sessions.items.has(id)?sessions.stats(id):null,transfer:{...files.totals}};
  });
  handle('editor-read',(id,target)=>editor.read(id,target));
  handle('editor-save',(id,target,content,version)=>editor.save(id,target,content,version));
  handle('settings', value => { store.data.settings = settings(value); store.write(); setLanguage(store.data.settings.language); return store.public(); });
  handle('host-forget',async host=>{if(await confirm(tr('Kayıtlı sunucu kimliği unutulsun mu?'),host+tr('\n\nSonraki bağlantıda yeni parmak izini bağımsız olarak doğrulamalısın.'))){delete store.data.hosts[host];store.write();}return store.public();});
  handle('profile-save', input => store.saveProfile(input));
  handle('profile-delete', id => { store.data.profiles = store.data.profiles.filter(p => p.id !== id); store.write(); return store.public(); });
  handle('pick-key', async () => (await dialog.showOpenDialog(win,{ title: tr('SSH özel anahtarı'), properties: ['openFile'] })).filePaths[0]);
  handle('pick-directory', async () => (await dialog.showOpenDialog(win,{ properties: ['openDirectory','createDirectory'] })).filePaths[0]);
  handle('pick-upload', async folders => (await dialog.showOpenDialog(win,{ properties: [folders ? 'openDirectory' : 'openFile','multiSelections'] })).filePaths);
  handle('session-open', spec => sessions.open(spec,true));
  handle('session-close', id => sessions.close(id));
  handle('cwd-enable', id => sessions.integration(id));
  for(const [name, fn] of [['terminal-input',(id,data)=>sessions.input(id,data)],['terminal-resize',(id,c,r)=>sessions.resize(id,c,r)],['terminal-ready',id=>sessions.attach(id)],['terminal-ack',(id,count)=>sessions.acknowledge(id,count)]]) ipcMain.on(name,(event,...args)=>{ try { trusted(event); fn(...args); } catch {} });
  handle('files-list',(id,dir)=>files.list(id,dir));
  handle('files-upload',(id,sources,dest)=>files.upload(id,sources,dest));
  handle('files-download',async(id,sources,dest)=> { dest ||= (await dialog.showOpenDialog(win,{ properties: ['openDirectory','createDirectory'] })).filePaths[0]; if(dest) return files.download(id,sources,dest); });
  for(const op of ['mkdir','rename','delete']) handle('files-'+op,(id,target,name)=>files.mutate(id,op,target,name));
  handle('files-drag',async(id,remote)=>{
    const dir = await fs.mkdtemp(path.join(app.getPath('temp'),'lumaterm-drag-'));
    await files.download(id,[remote],dir,true);
    const local = path.join(dir,safeName(path.posix.basename(remote)));
    const icon = await app.getFileIcon(local,{ size: 'normal' });
    const token = require('node:crypto').randomUUID();
    stagedFiles.set(token,{file:local,icon});
    return { token, local };
  });
  ipcMain.on('native-drag',(event,token)=>{trusted(event);const item=stagedFiles.get(token);if(item)event.sender.startDrag(item);});
  handle('workspace-save', value => {
    if(!value.name?.trim()) throw new Error(tr('Çalışma alanı adı gerekli.'));
    store.data.workspaces = [...store.data.workspaces.filter(w=>w.name!==value.name), { name: value.name.trim(), sessions: value.sessions.map(s=>s.kind==='ssh'?{kind:'ssh',profileId:s.profileId}:{kind:'local',shell:s.shell,cwd:s.cwd}) }];
    store.write(); return store.public();
  });
  handle('workspace-delete', name => { store.data.workspaces = store.data.workspaces.filter(w=>w.name!==name); store.write(); return store.public(); });
  handle('export-config', async()=> {
    const { filePath } = await dialog.showSaveDialog(win,{ defaultPath: 'LumaTerm-settings.json', filters:[{name:'JSON',extensions:['json']}] });
    if(filePath) await fs.writeFile(filePath,JSON.stringify({ ...store.public(), profiles: store.public().profiles.map(({hasSecret,...p})=>p) },null,2));
  });
  handle('import-config', async()=> {
    const { filePaths } = await dialog.showOpenDialog(win,{ filters:[{name:'JSON',extensions:['json']}], properties:['openFile'] });
    if(!filePaths[0]) return store.public();
    const parsed = JSON.parse(await fs.readFile(filePaths[0],'utf8'));
    const profiles = (parsed.profiles || []).map(profile);
    if(!await confirm(tr('Ayarlar ve bağlantılar içe aktarılsın mı?'), tr('Aynı kimlikli bağlantılar güncellenir. İçe aktarılan dosyadan parola veya sunucu güveni alınmaz.'))) return store.public();
    store.data.settings = settings(parsed.settings);
    setLanguage(store.data.settings.language);
    for(const p of profiles) store.data.profiles = [...store.data.profiles.filter(x=>x.id!==p.id),p];
    if(Array.isArray(parsed.workspaces)) store.data.workspaces = parsed.workspaces.filter(w=>typeof w.name==='string' && Array.isArray(w.sessions)).map(w=>({name:w.name,sessions:w.sessions.map(s=>s.kind==='ssh'?{kind:'ssh',profileId:String(s.profileId)}:{kind:'local',shell:String(s.shell||'powershell.exe'),cwd:String(s.cwd||'')})}));
    store.write(); return store.public();
  });
  handle('terminal-save',async text=>{ const { filePath }=await dialog.showSaveDialog(win,{ defaultPath:'terminal.txt' }); if(filePath) await fs.writeFile(filePath,text); });
  handle('clipboard-read',()=>clipboard.readText());
  handle('clipboard-write',text=>clipboard.writeText(String(text)));
  handle('window-action',action=>{ if(action==='minimize') win.minimize(); if(action==='maximize') win.isMaximized()?win.unmaximize():win.maximize(); if(action==='close') win.close(); });
}
app.whenReady().then(async()=>{
  try {
    store = new Store(app.getPath('userData'),safeStorage);
    setLanguage(store.data.settings.language);
    sessions = new Sessions(store,emit,(host,fingerprint)=>confirm(tr('Sunucu kimliğini doğrula'),host+'\n\n'+fingerprint+tr('\n\nBu parmak izini sunucu yöneticinle doğruladıktan sonra onayla.')));
    files = new Files(sessions,emit,confirm);
    editor = new Editor(sessions);
    win = new BrowserWindow({ width:1450,height:920,minWidth:980,minHeight:620,frame:false,backgroundColor:'#101218',show:!smoke&&!packageCheck,icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{ preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false,offscreen:smoke||packageCheck } });
    Menu.setApplicationMenu(null);
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',event=>event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((wc,permission,callback)=>callback(false));
    win.on('close',event=> {
      if(!allowClose && sessions.items.size && store.data.settings.confirmClose && !smoke) { event.preventDefault(); confirm(tr('LumaTerm kapatılsın mı?'), tr('Açık oturumlar ve devam eden aktarımlar kapanacak.')).then(ok=>{ if(ok) { allowClose=true; win.close(); } }); }
      else sessions.closeAll();
    });
    register(); await win.loadFile(page); startAutoUpdater();
    if(packageCheck){await require('./verify.cjs')({app,win,sessions,store});allowClose=true;app.exit(0);}
    if(smoke) { await require('../tests/smoke.cjs')({app,win,sessions,files,store}); allowClose=true; console.log('All smoke checks completed; exiting 0'); app.exit(0); }
  } catch(e) { console.error(e); if(smoke||packageCheck) app.exit(1); else { dialog.showErrorBox(tr('LumaTerm başlatılamadı'),e.message); app.quit(); } }
});
app.on('window-all-closed',()=>{if(updateTimer)clearInterval(updateTimer);app.quit();});
