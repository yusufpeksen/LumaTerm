const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 2 * 1024 * 1024;
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const decode = buffer => {
  if(buffer.includes(0))throw new Error('Binary files cannot be opened in the text editor.');
  return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
};
class Editor {
  constructor(sessions){this.sessions=sessions;}
  async stat(id,target){
    if(id)return this.sessions.call(this.sessions.get(id),'stat',target);
    if(!path.isAbsolute(target))throw new Error('An absolute file path is required.');
    return fs.stat(target);
  }
  async read(id,target){
    const stat=await this.stat(id,target);
    if(stat.isDirectory())throw new Error('Open a file, not a directory.');
    if(stat.size>MAX_BYTES)throw new Error('The text editor supports files up to 2 MB.');
    const buffer=id?await this.sessions.call(this.sessions.get(id),'readFile',target):await fs.readFile(target);
    if(buffer.length>MAX_BYTES)throw new Error('The text editor supports files up to 2 MB.');
    return {content:decode(buffer),version:hash(buffer)};
  }
  async save(id,target,content,version){
    if(typeof content!=='string'||Buffer.byteLength(content)>MAX_BYTES)throw new Error('The text editor supports files up to 2 MB.');
    const stat=await this.stat(id,target);
    if(stat.isDirectory()||stat.size>MAX_BYTES)throw new Error('The file changed on disk. Reopen it before saving to avoid overwriting newer work.');
    const existing=id?await this.sessions.call(this.sessions.get(id),'readFile',target):await fs.readFile(target);
    if(hash(existing)!==version)throw new Error('The file changed on disk. Reopen it before saving to avoid overwriting newer work.');
    if(id)await this.sessions.call(this.sessions.get(id),'writeFile',target,Buffer.from(content,'utf8'));
    else {
      const temporary=path.join(path.dirname(target),`.${path.basename(target)}.${crypto.randomUUID()}.tmp`);
      try{await fs.writeFile(temporary,content,'utf8');await fs.rename(temporary,target);}
      finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
    }
    return {version:hash(Buffer.from(content,'utf8'))};
  }
}
module.exports={Editor};
