const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){for(let n=0;n<150;n++){if(await fn())return;await sleep(50);}throw new Error('Timeout: '+message);}
async function local({win,sessions,id,base}){
  const evaluate=code=>win.webContents.executeJavaScript(code);
  await evaluate(`document.querySelector('.tab[data-id="${id}"]').click()`);
  assert.equal(await evaluate('document.querySelector(".suggestions") === null'),true);
  assert.equal(await evaluate('Boolean(document.getElementById("footer-metrics"))'),true);
  await evaluate(`document.querySelector('.tab[data-id="${id}"] .tab-pin').click()`);
  await evaluate(`document.querySelector('.tab[data-id="${id}"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
  await until(()=>evaluate('Boolean(document.getElementById("prompt-value"))'),'tab rename prompt');
  await evaluate('document.getElementById("prompt-value").value="Local work";document.getElementById("prompt-ok").click()');
  await until(()=>evaluate(`document.querySelector('.tab[data-id="${id}"] > span:nth-of-type(2)').textContent==='Local work'`),'renamed tab');
  assert.equal(await evaluate(`document.querySelector('.tab[data-id="${id}"]').classList.contains('pinned')`),true);
  await evaluate(`document.querySelector('.tab[data-id="${id}"] .tab-pin').click()`);
  await evaluate('if(document.getElementById("left-workspace").hidden)document.getElementById("sidebar-toggle").click();document.getElementById("sidebar-toggle").click()');
  sessions.input(id,"1..120 | ForEach-Object { Write-Output ('LONG-OUTPUT-' + $_ + ('x' * 180)) }\r");
  await until(()=>evaluate('document.querySelector(".terminal-pane.focused .xterm-rows").textContent.includes("LONG-OUTPUT-120")'),'long terminal output');
  const geometry=await evaluate('(() => {const pane=document.querySelector(".terminal-pane.focused"), viewport=pane.querySelector(".xterm-viewport"),screen=pane.querySelector(".xterm-screen"),frame=pane.querySelector(".terminal-frame"),scrollbars=[...pane.querySelectorAll(".scrollbar")].map(el=>({name:el.className,parent:el.parentElement?.className,grandparent:el.parentElement?.parentElement?.className,cssRight:getComputedStyle(el).right,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})),footer=document.querySelector("footer");return {screenRight:screen.getBoundingClientRect().right,frameRight:frame.getBoundingClientRect().right,scrollbarLeft:scrollbars.find(x=>x.name.includes("vertical"))?.left,scrollbars,viewportRight:viewport.getBoundingClientRect().right,viewportBottom:viewport.getBoundingClientRect().bottom,footerTop:footer.getBoundingClientRect().top};})()');
  assert.ok(geometry.scrollbarLeft-geometry.screenRight>=16,'terminal text must end at least 16px before its scrollbar: '+JSON.stringify(geometry));
  assert.ok(geometry.viewportBottom<=geometry.footerTop+2,'terminal viewport must end before footer');
  await fs.writeFile(path.join(base,'long-output.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal(await evaluate('document.getElementById("left-workspace").hidden'),true);
  await evaluate('document.getElementById("sidebar-toggle").click()');
  const source=path.join(base,'editor-local.txt');await fs.writeFile(source,'local before');
  const loaded=await evaluate(`window.luma.editorRead(null,${JSON.stringify(source)})`);
  assert.equal(loaded.content,'local before');
  await evaluate(`window.luma.editorSave(null,${JSON.stringify(source)},'local after',${JSON.stringify(loaded.version)})`);
  assert.equal(await fs.readFile(source,'utf8'),'local after');await fs.rm(source);
}
async function remote({win,sessions,id,base,root,files}){
  const evaluate=code=>win.webContents.executeJavaScript(code);
  assert.equal(await evaluate('document.getElementById("local-explorer").hidden'),true);
  assert.equal(await evaluate('document.getElementById("remote-explorer").hidden'),false);
  const previous=files.list.bind(files);let localReads=0;files.list=(id,...args)=>{if(!id)localReads++;return previous(id,...args);};
  try{
    await fs.writeFile(path.join(root,'editor-ssh.txt'),'hello SSH');
    await evaluate('document.getElementById("file-refresh").click()');
    await until(()=>evaluate('[...document.querySelectorAll("#remote-files .file-row")].some(row=>row.dataset.name==="editor-ssh.txt")'),'editor file listed');
    await evaluate('[...document.querySelectorAll("#remote-files .file-row")].find(row=>row.dataset.name==="editor-ssh.txt").dispatchEvent(new MouseEvent("dblclick",{bubbles:true}))');
    await until(()=>evaluate('document.getElementById("editor-content")?.value==="hello SSH"'),'remote editor UI');
    await evaluate('document.getElementById("modal-close").click()');
    const loaded=await evaluate(`window.luma.editorRead(${JSON.stringify(id)},'/editor-ssh.txt')`);
    assert.equal(loaded.content,'hello SSH');
    await evaluate(`window.luma.editorSave(${JSON.stringify(id)},'/editor-ssh.txt','edited SSH',${JSON.stringify(loaded.version)})`);
    assert.equal(await fs.readFile(path.join(root,'editor-ssh.txt'),'utf8'),'edited SSH');
    await Promise.all(Array.from({length:1500},(_,i)=>fs.writeFile(path.join(root,'stress-'+String(i).padStart(4,'0')+'.txt'),'')));
    await evaluate('document.getElementById("file-refresh").click()');
    await until(()=>evaluate('document.querySelector("#remote-files .file-spacer:last-child")?.offsetHeight > 10000'),'virtualized remote listing');
    assert.ok(await evaluate('document.querySelectorAll("#remote-files .file-row").length < 70'));
    assert.equal(localReads,0);
    await evaluate('document.getElementById("remote-files").scrollTop=1000000');
    await until(()=>evaluate('[...document.querySelectorAll("#remote-files .file-name")].some(el=>el.textContent==="stress-1499.txt")'),'last virtual row reachable');
    await evaluate('document.getElementById("file-filter").value="stress-1499";document.getElementById("file-filter").dispatchEvent(new Event("input"))');
    await until(()=>evaluate('document.querySelectorAll("#remote-files .file-row").length===1'),'file filter');
    await evaluate('document.getElementById("file-filter").value="";document.getElementById("file-filter").dispatchEvent(new Event("input"));document.getElementById("remote-files").scrollTop=0');
    const times=[];
    for(let n=0;n<12;n++){const token='latency-'+n,start=performance.now();await evaluate(`window.luma.input(${JSON.stringify(id)},${JSON.stringify(token+'\r')})`);await until(()=>evaluate(`document.querySelector('.terminal-pane.focused .xterm-rows').textContent.includes(${JSON.stringify('echo:'+token)})`),'SSH echo');times.push(performance.now()-start);}
    await evaluate(`window.luma.input(${JSON.stringify(id)},${JSON.stringify('burst\r')})`);
    await until(()=>evaluate('document.querySelector(".terminal-pane.focused .xterm-rows").textContent.includes("echo:burst")'),'bulk output');
    await until(()=>sessions.get(id).output.pending===0,'output acknowledged');
    assert.equal(sessions.get(id).output.paused,false);assert.equal(localReads,0);
    times.sort((a,b)=>a-b);
    await fs.writeFile(path.join(base,'performance.json'),JSON.stringify({passed:true,remoteEntries:1500,sshLocalFileReads:localReads,loopbackEchoMedianMs:Math.round(times[Math.floor(times.length/2)]),loopbackEchoMaxMs:Math.round(times.at(-1)),checks:['single active file panel','virtualized files','instant file filter','local and SFTP text editing','SSH echo latency','output backpressure']},null,2));
  }finally{files.list=previous;}
}
module.exports={local,remote};
