const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { settings, profile, childPath, quoteShell, CwdParser } = require('../src/core.cjs');
const { Store } = require('../src/store.cjs');
test('settings clamp untrusted numeric values and validate themes',()=>{const s=settings({fontSize:1000,scrollback:-5,theme:'bad',promptTheme:'bad',accent:'url(x)'});assert.equal(s.fontSize,32);assert.equal(s.scrollback,100);assert.equal(s.theme,'midnight');assert.equal(s.promptTheme,'accent');assert.equal(s.accent,'#8b9cff');assert.equal(s.shortcuts.newTab,'Ctrl+Shift+T');assert.equal(s.promptGit,true);assert.equal(s.promptIcons,true);});
test('SSH profiles require credentials and valid ports',()=>{assert.throws(()=>profile({name:'x',host:'host',username:'user',port:65536}));assert.throws(()=>profile({name:'x',host:'host'}));assert.equal(profile({name:' x ',host:' h ',username:' u '}).host,'h');});
test('SSH profiles validate loopback port forwarding rules',()=>{const p=profile({name:'x',host:'host',username:'user',forwards:'8080:localhost:80\n15432:db.internal:5432'});assert.deepEqual(p.forwards,[{localPort:8080,host:'localhost',port:80},{localPort:15432,host:'db.internal',port:5432}]);assert.throws(()=>profile({name:'x',host:'h',username:'u',forwards:'bad'}));assert.throws(()=>profile({name:'x',host:'h',username:'u',forwards:'80:a:1\n80:b:2'}));});
test('untrusted remote file names cannot escape download directory',()=>{for(const n of ['..','../secret','a/b','a\\b','C:foo','CON','NUL.txt','foo.','foo ','\u0000'])assert.throws(()=>childPath('C:\\Downloads',n),n);assert.equal(childPath('C:\\Downloads','özel dosya.txt'),path.join('C:\\Downloads','özel dosya.txt'));});
test('shell paths escape apostrophes',()=>{assert.equal(quoteShell("/home/a'b"),"'/home/a'\\''b'");});
test('OSC7 works across stream boundaries and ignores malformed URIs',()=>{const values=[],p=new CwdParser(v=>values.push(v));p.push('output\x1b]');p.push('7;file://host/home/a%20b');p.push('\x07prompt');p.push('\x1b]7;file://host/tmp\x1b');p.push('\\');p.push('\x1b]7;file://host/%zz\x07');assert.deepEqual(values,['/home/a b','/tmp']);});
test('Windows directory notifications preserve raw Unicode, percent signs and split terminators',()=>{
  const values=[],parser=new CwdParser(v=>values.push(v));
  const message='\x1b]9;9;"C:\\Users\\Yusuf\\Desktop\\Türkçe %20"\x1b\\';
  for(const char of message)parser.push(char);
  parser.push('\x1b]9;9;"D:\\work"\x07\x1b]9;9;"C:\\unsafe\rpath"\x07');
  assert.deepEqual(values,['C:\\Users\\Yusuf\\Desktop\\Türkçe %20','D:\\work']);
});
test('language setting defaults to English and round-trips',()=>{assert.equal(settings().language,'en');assert.equal(settings({language:'tr'}).language,'tr');assert.equal(settings({language:'invalid'}).language,'en');});
test('stored secrets are never returned to renderer or written as plaintext',()=>{
  const dir=fs.mkdtempSync(path.join(__dirname,'store-'));
  const crypto={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v).reverse(),decryptString:v=>Buffer.from(v).reverse().toString()};
  try { const store=new Store(dir,crypto);store.saveProfile({name:'test',host:'127.0.0.1',username:'tester',password:'unique-secret-42'});assert.ok(!JSON.stringify(store.public()).includes('unique-secret'));assert.ok(!fs.readFileSync(store.file,'utf8').includes('unique-secret'));const p=store.data.profiles[0];assert.equal(store.decrypt(p.secret),'unique-secret-42');store.saveProfile({...p,password:''});assert.equal(store.decrypt(store.data.profiles[0].secret),'unique-secret-42');store.saveProfile({...p,forgetSecret:true});assert.equal(store.public().profiles[0].hasSecret,false); }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('secret persistence fails closed if encryption unavailable',()=>{const dir=fs.mkdtempSync(path.join(__dirname,'store-'));try {const store=new Store(dir,{isEncryptionAvailable:()=>false});assert.throws(()=>store.saveProfile({name:'x',host:'h',username:'u',password:'secret'}));assert.equal(store.data.profiles.length,0);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
