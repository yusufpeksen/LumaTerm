const commands={
  powershell:['Get-ChildItem','Get-Location','Set-Location','Get-Content','Get-Command','Get-Help','Get-Process','Get-Service','Get-History','Select-String','Select-Object','Where-Object','Write-Output','Test-Path','New-Item','Copy-Item','Move-Item','Rename-Item','Clear-Host','cd','dir','ls','pwd','git','ssh','scp','npm','node','python','docker','winget'],
  cmd:['cd','dir','type','findstr','where','echo','cls','copy','move','ren','mkdir','ipconfig','ping','tasklist','git','ssh','scp','npm','node','python','docker','winget'],
  posix:['cd','ls','pwd','cat','less','head','tail','grep','find','which','echo','clear','cp','mv','mkdir','touch','chmod','chown','df','du','free','ps','top','htop','uname','whoami','hostname','ip','ping','curl','wget','tar','unzip','git','ssh','scp','rsync','sudo','systemctl','journalctl','docker','kubectl','npm','node','python3','apt','dnf','pacman']
};
const subcommands={git:['status','diff','log --oneline','branch','switch','checkout','add','commit','fetch','pull','push','remote -v','stash'],docker:['ps','images','logs','exec -it','compose ps','compose logs','compose up -d','inspect','stats'],npm:['install','run','run dev','run build','test','outdated'],systemctl:['status','list-units','start','stop','restart'],kubectl:['get pods','get services','describe','logs','config get-contexts']};
function shellKind(spec){const shell=String(spec.shell||'').toLowerCase();return spec.kind==='ssh'?'posix':/powershell|pwsh/.test(shell)?'powershell':/cmd(?:\.exe)?$/.test(shell)?'cmd':'posix';}
function safeHistory(command){return command.length<=512&&!/[\x00-\x1f\x7f]/.test(command)&&!/(?:password|passwd|passphrase|secret|token|api[_-]?key|authorization|credential|private[_-]?key|bearer|https?:\/\/[^\s]+:[^\s]+@|\s-p\s*\S+)/i.test(command);}
function quoteName(name,kind){
  if(/[\x00-\x1f\x7f]/.test(name))return null;
  if(kind==='cmd'){if(/["%!?&|<>^]/.test(name))return null;return /\s/.test(name)?'"'+name+'"':name;}
  if(/^[\p{L}\p{N}_./\\:-]+$/u.test(name))return name;
  return "'"+name.replace(/'/g,kind==='powershell'?"''":"'\\''")+"'";
}
function completions(input,{kind='posix',history=[],entries=[]}={}){
  if(typeof input!=='string'||input.length>512||/[\x00-\x1f\x7f]/.test(input)||!safeHistory(input))return [];
  const lower=input.toLowerCase(),items=[],seen=new Set();
  const add=(value,type)=>{if(value!==input&&!seen.has(value)){items.push({value,type});seen.add(value);}};
  for(const value of history)if(value.toLowerCase().startsWith(lower)&&safeHistory(value))add(value,'history');
  if(!/\s/.test(input))for(const value of commands[kind]||commands.posix)if(value.toLowerCase().startsWith(lower))add(value,'command');
  const split=input.match(/^(\S+)\s+(.*)$/);
  if(split){
    for(const part of subcommands[split[1].toLowerCase()]||[])if(part.toLowerCase().startsWith(split[2].toLowerCase()))add(split[1]+' '+part,'command');
    const token=input.match(/(?:^|\s)([^\s]*)$/),fragment=token?.[1]||'',prefix=input.slice(0,input.length-fragment.length);
    // Use only the already-listed cwd. Never issue a filesystem/network request while typing.
    if((!subcommands[split[1].toLowerCase()]||/\s/.test(split[2]))&&!/[\\/'"]/.test(fragment))for(const entry of entries){
      if(/^(cd|set-location|push-location)$/i.test(split[1])&&!entry.directory)continue;
      if(!entry.name.toLowerCase().startsWith(fragment.toLowerCase()))continue;
      const name=quoteName(entry.name,kind);if(name!==null)add(prefix+name,entry.directory?'folder':'file');
      if(items.length>=30)break;
    }
  }
  return items.slice(0,6);
}
function replacementInput(current,value){let common=0;while(common<current.length&&common<value.length&&current[common]===value[common])common++;return '\x7f'.repeat(Array.from(current.slice(common)).length)+value.slice(common);}
module.exports={completions,shellKind,safeHistory,replacementInput,quoteName};
