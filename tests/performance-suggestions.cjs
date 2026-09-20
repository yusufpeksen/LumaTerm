const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){for(let n=0;n<150;n++){if(await fn())return;await sleep(50);}throw new Error('Timeout: '+message);}
async function focus(win){await win.webContents.executeJavaScript('document.querySelector(".terminal-pane.focused .xterm-helper-textarea").focus()');}
async function local({win,sessions,id,base}){
  const evaluate=code=>win.webContents.executeJavaScript(code);
  await evaluate(`document.querySelector('.tab[data-id="${id}"]').click()`);await focus(win);
  await win.webContents.insertText('Get-Ch');
  await until(()=>evaluate('document.querySelector(".suggestions:not([hidden]) .suggestion span")?.textContent === "Get-ChildItem"'),'PowerShell suggestions');
  await fs.writeFile(path.join(base,'suggestions-powershell.png'),(await win.webContents.capturePage()).toPNG());
  await evaluate('document.querySelector(".suggestions:not([hidden]) .suggestion").click()');
  await until(()=>evaluate('document.querySelector(".terminal-pane.focused .xterm-rows").textContent.includes("Get-ChildItem")'),'PowerShell completion inserted');
  sessions.input(id,'\x03');await sleep(300);
  await evaluate('[...document.querySelectorAll("[data-shell]")].find(el=>el.dataset.shell==="cmd.exe").click()');
  await until(()=>[...sessions.items.values()].some(s=>s.spec.shell==='cmd.exe'),'CMD session');
  const cmd=[...sessions.items.values()].find(s=>s.spec.shell==='cmd.exe');
  await until(()=>evaluate(`document.querySelector('.tab.active')?.dataset.id === ${JSON.stringify(cmd.id)}`),'CMD tab active');await focus(win);
  assert.equal(await evaluate('document.getElementById("remote-explorer").hidden'),true);
  assert.equal(await evaluate('document.getElementById("local-explorer").hidden'),false);
  await win.webContents.insertText('di');await until(()=>evaluate('document.querySelector(".suggestions:not([hidden]) .suggestion span")?.textContent === "dir"'),'CMD suggestions');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Right',modifiers:['control']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Right',modifiers:['control']});
  await until(()=>evaluate('document.querySelector(".terminal-pane.focused .xterm-rows").textContent.includes(">dir")'),'keyboard completion acceptance');
  sessions.input(cmd.id,'\x03');
  await evaluate(`document.querySelector('.tab[data-id="${cmd.id}"] .tab-close').click()`);
  await until(()=>evaluate('document.getElementById("modal").open && Boolean(document.getElementById("ask-yes"))'),'CMD close confirmation');await evaluate('document.getElementById("ask-yes").click()');
  await until(()=>!sessions.items.has(cmd.id),'CMD closed');
  await evaluate(`document.querySelector('.tab[data-id="${id}"]').click()`);
}
async function remote({win,sessions,id,base,root,fixture,files}){
  const evaluate=code=>win.webContents.executeJavaScript(code);
  assert.equal(await evaluate('document.getElementById("local-explorer").hidden'),true);
  assert.equal(await evaluate('document.getElementById("remote-explorer").hidden'),false);
  const previous=files.list.bind(files);let localReads=0;files.list=(id,...args)=>{if(!id)localReads++;return previous(id,...args);};
  try{
    await Promise.all(Array.from({length:1500},(_,i)=>fs.writeFile(path.join(root,'stress-'+String(i).padStart(4,'0')+'.txt'),'')));
    await evaluate('document.getElementById("file-refresh").click()');
    await until(()=>evaluate('document.querySelector("#remote-files .file-spacer:last-child")?.offsetHeight > 10000'),'virtualized remote listing');
    assert.ok(await evaluate('document.querySelectorAll("#remote-files .file-row").length < 70'));
    assert.equal(localReads,0,'SSH refresh must not read the local filesystem');
    await evaluate('document.getElementById("remote-files").scrollTop=1000000');
    await until(()=>evaluate('[...document.querySelectorAll("#remote-files .file-name")].some(el=>el.textContent==="stress-1499.txt")'),'last virtual row reachable');
    await evaluate('document.getElementById("remote-files").scrollTop=0');await focus(win);
    const before=fixture.commands.length;
    await win.webContents.insertText('git st');
    await until(()=>evaluate('document.querySelector(".suggestions:not([hidden]) .suggestion span")?.textContent === "git status"'),'SSH suggestions');
    await sleep(150);await fs.writeFile(path.join(base,'suggestions-ssh.png'),(await win.webContents.capturePage()).toPNG());
    await evaluate('document.querySelector(".suggestions:not([hidden]) .suggestion").click()');await sleep(150);
    assert.equal(fixture.commands.length,before,'accepting suggestion must not execute a command');
    assert.equal(fixture.inputs.slice(-3).join('').includes('atus'),true);
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});
    await until(()=>fixture.commands.at(-1)==='git status','accepted command runs only after Enter');await sleep(150);
    await win.webContents.insertText('git s');await until(()=>evaluate('document.querySelector(".suggestions:not([hidden]) .suggestion small")?.textContent === "History"'),'session history suggestion');
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'C',modifiers:['control']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'C',modifiers:['control']});await sleep(200);
    await win.webContents.insertText('ask-password');win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});await sleep(200);
    await win.webContents.insertText('fixture-private-value');await sleep(200);
    assert.equal(await evaluate('document.querySelector(".suggestions:not([hidden])") === null'),true,'no suggestions in password prompt');
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});await sleep(200);
    await evaluate('document.getElementById("suggestions-button").click()');
    assert.equal(await evaluate('document.querySelector(".suggestions").textContent.includes("fixture-private-value")'),false);
    sessions.input(id,'\x03');await sleep(200);
    // Measure real IPC -> SSH -> parser acknowledgements; no terminal-local echo.
    const times=[];
    for(let n=0;n<12;n++){
      const token='latency-'+n,start=performance.now();
      await evaluate(`window.luma.input(${JSON.stringify(id)},${JSON.stringify(token+'\r')})`);
      await until(()=>evaluate(`document.querySelector('.terminal-pane.focused .xterm-rows').textContent.includes(${JSON.stringify('echo:'+token)})`),'SSH echo rendered');
      times.push(performance.now()-start);
    }
    await evaluate(`window.luma.input(${JSON.stringify(id)},${JSON.stringify('burst\r')})`);
    await until(()=>evaluate('document.querySelector(".terminal-pane.focused .xterm-rows").textContent.includes("echo:burst")'),'bulk output rendered with flow control');
    await until(()=>sessions.get(id).output.pending===0,'all rendered output acknowledged');
    assert.equal(sessions.get(id).output.paused,false);
    assert.equal(localReads,0);
    times.sort((a,b)=>a-b);
    await fs.writeFile(path.join(base,'performance.json'),JSON.stringify({passed:true,remoteEntries:1500,renderedRows:await evaluate('document.querySelectorAll("#remote-files .file-row").length'),sshLocalFileReads:localReads,loopbackEchoMedianMs:Math.round(times[Math.floor(times.length/2)]),loopbackEchoMaxMs:Math.round(times.at(-1)),note:'Loopback fixture and 50ms polling; not a measurement of the user server.',checks:['single active file panel','virtualized files reachable','PowerShell + SSH suggestions','explicit completion acceptance','in-memory history','no password capture','output backpressure drains']},null,2));
    console.log('PERFORMANCE PASS: virtualized files, SSH echo, parsed output ACKs, suggestions and password privacy');
  }finally{files.list=previous;}
}
module.exports={local,remote};
