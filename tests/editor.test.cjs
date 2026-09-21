const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {Editor}=require('../src/editor.cjs');

test('local text editor saves UTF-8 and rejects stale or binary files',async()=>{
  const dir=path.join(__dirname,'../test-results','editor-'+crypto.randomUUID());
  await fs.mkdir(dir,{recursive:true});
  const name=path.join(dir,'note.txt'),binary=path.join(dir,'binary.dat');
  try{
    const editor=new Editor({});
    await fs.writeFile(name,'before ✓');
    const opened=await editor.read(null,name);
    assert.equal(opened.content,'before ✓');
    await editor.save(null,name,'after ✓',opened.version);
    assert.equal(await fs.readFile(name,'utf8'),'after ✓');
    await assert.rejects(()=>editor.save(null,name,'stale',opened.version),/changed on disk/);
    await fs.writeFile(binary,Buffer.from([0,1,2]));
    await assert.rejects(()=>editor.read(null,binary),/Binary files/);
  }finally{await fs.rm(name,{force:true});await fs.rm(binary,{force:true});await fs.rmdir(dir);}
});
