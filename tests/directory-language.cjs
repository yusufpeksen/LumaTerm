const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Store}=require('../src/store.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){for(let n=0;n<150;n++){if(await fn())return;await sleep(100);}throw new Error('Timeout: '+message);}
module.exports=async({win,sessions,store,base,firstId})=>{
  const evaluate=code=>win.webContents.executeJavaScript(code);
  const localPath=()=>evaluate('document.getElementById("local-path").value');
  const root=await fs.mkdtemp(path.join(base,'cwd-'));
  const target=path.join(root,"Türkçe %20 ve boşluk's");await fs.mkdir(target);
  await fs.writeFile(path.join(target,'Ayarlar'),'The filename must not be translated.');
  const quote=v=>"'"+v.replace(/'/g,"''")+"'";
  const secondId=[...sessions.items.keys()].find(id=>id!==firstId);
  const secondCwd=sessions.get(secondId).cwd;
  // A background tab changing directory must not hijack the active file pane.
  sessions.input(firstId,'Set-Location -LiteralPath '+quote(target)+'\r');
  await until(()=>sessions.get(firstId).cwd===target,'PowerShell cwd notification');
  await until(async()=>await localPath()===secondCwd,'background directory isolation');
  await evaluate(`document.querySelector('.tab[data-id="${firstId}"]').click()`);
  await until(async()=>await localPath()===target,'tab switches file panel to its actual cwd');
  assert.equal(await evaluate('document.querySelector("#local-files .file-name").textContent'),'Ayarlar');
  sessions.input(firstId,'Push-Location ..\r');await until(async()=>await localPath()===root,'Push-Location sync');
  sessions.input(firstId,'Pop-Location\r');await until(async()=>await localPath()===target,'Pop-Location sync');
  sessions.input(firstId,'cd ..\r');await until(async()=>await localPath()===root,'relative cd sync');
  sessions.input(firstId,'cd '+quote(path.basename(target))+'\r');await until(async()=>await localPath()===target,'relative Unicode directory sync');
  sessions.input(firstId,"Set-Location -LiteralPath 'missing-lumaterm-directory'\r");await sleep(400);assert.equal(await localPath(),target);
  // CMD must report its own cwd without interpreting the text typed by the user.
  const cmd=await sessions.open({kind:'local',shell:'cmd.exe',cwd:root});
  sessions.input(cmd.id,'cd /d "'+target+'"\r');await until(()=>sessions.get(cmd.id).cwd===target,'CMD cwd notification');sessions.close(cmd.id);
  assert.equal(await evaluate('document.querySelectorAll(".feature-cards").length'),0);
  await evaluate('document.getElementById("settings-button").click()');await until(()=>evaluate('Boolean(document.querySelector("select[name=language]"))'),'language control');
  await evaluate('document.querySelector("select[name=language]").value="en"; document.getElementById("settings-submit").click()');
  await until(()=>evaluate('document.documentElement.lang === "en" && !document.getElementById("modal").open'),'English applied');
  assert.match(await evaluate('document.getElementById("new-terminal").textContent'),/New terminal/);
  assert.match(await evaluate('document.getElementById("settings-button").title'),/Settings/);
  await until(async()=>await localPath()===target,'English switch keeps cwd');
  assert.equal(await evaluate('document.querySelector("#local-files .file-name").textContent'),'Ayarlar');
  assert.equal(sessions.items.size,2);
  assert.equal(new Store(path.dirname(store.file),store.crypto).data.settings.language,'en');
  await sleep(300);await fs.writeFile(path.join(base,'english-terminal.png'),(await win.webContents.capturePage()).toPNG());
  await evaluate('document.getElementById("settings-button").click()');await until(()=>evaluate('document.getElementById("modal").open'),'English settings');
  assert.equal(await evaluate('document.querySelector(".modal-header h2").textContent'),'Make it your terminal');
  await sleep(300);await fs.writeFile(path.join(base,'english-settings.png'),(await win.webContents.capturePage()).toPNG());
  await evaluate('document.querySelector("select[name=language]").value="tr"; document.getElementById("settings-submit").click()');
  await until(()=>evaluate('document.documentElement.lang === "tr"'),'switch back to Turkish');
  assert.match(await evaluate('document.getElementById("settings-button").title'),/Ayarlar/);
  // Save English again to check persistence after the subsequent renderer reload.
  await evaluate('document.getElementById("settings-button").click()');await until(()=>evaluate('Boolean(document.querySelector("select[name=language]")) && document.getElementById("modal").open'),'language settings reopened');
  await evaluate('document.querySelector("select[name=language]").value="en"; document.getElementById("settings-submit").click()');
  await until(()=>evaluate('document.documentElement.lang === "en"'),'English restored');
  console.log('REGRESSION PASS: PowerShell/CMD cwd, background tabs, relative paths, language switch and persistence');
};
