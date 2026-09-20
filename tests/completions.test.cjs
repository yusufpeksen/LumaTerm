const {test}=require('node:test');const assert=require('node:assert/strict');
const {completions,shellKind,safeHistory,replacementInput}=require('../src/completions.cjs');
test('each shell receives the appropriate catalog and subcommand suggestions',()=>{
  for(const [spec,prefix,value] of [[{kind:'local',shell:'powershell.exe'},'Get-Ch','Get-ChildItem'],[{kind:'local',shell:'pwsh.exe'},'Get-Ch','Get-ChildItem'],[{kind:'local',shell:'cmd.exe'},'di','dir'],[{kind:'local',shell:'wsl.exe'},'gr','grep'],[{kind:'ssh'},'git st','git status']])assert.ok(completions(prefix,{kind:shellKind(spec)}).some(x=>x.value===value));
});
test('path completions quote spaces and metacharacters without executing anything',()=>{
  const entries=[{name:'my folder',directory:true},{name:'my file',directory:false},{name:'my$(touch pwn)',directory:true}];
  const items=completions('cd my',{kind:'posix',entries});assert.ok(items.some(x=>x.value==="cd 'my folder'"));assert.ok(!items.some(x=>x.value.includes('my file')));assert.ok(items.some(x=>x.value==="cd 'my$(touch pwn)'"));
  assert.equal(replacementInput('cd my',"cd 'my folder'"),"\x7f\x7f'my folder'");
  assert.ok(items.every(x=>!/[\r\n]/.test(replacementInput('cd my',x.value))));
});
test('secret-like commands never enter history or suggestions',()=>{
  for(const line of ['curl -H "Authorization: Bearer secret"','export API_KEY=secret','mysql -psecret','login --password secret','echo $TOKEN'])assert.equal(safeHistory(line),false,line);
  assert.deepEqual(completions('export API_KEY=',{history:['export API_KEY=secret']}),[]);
  assert.equal(completions('git s',{history:['git status']})[0].type,'history');
});
