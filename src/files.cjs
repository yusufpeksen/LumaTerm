const { tr, msg } = require('./i18n.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { childPath, safeName } = require('./core.cjs');
class Files {
  constructor(sessions, emit, confirm) { this.sessions = sessions; this.emit = emit; this.confirm = confirm;this.progressTimes=new Map(); }
  progress(transferId,name,done,total){const now=Date.now();if(done!==total&&now-(this.progressTimes.get(transferId)||0)<100)return;this.progressTimes.set(transferId,now);this.emit({type:'transfer',transferId,name,done,total});}
  async list(id, dir) {
    if (!id) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results=new Array(entries.length);let index=0;
      await Promise.all(Array.from({length:Math.min(16,entries.length)},async()=>{while(index<entries.length){const i=index++,e=entries[i];let st;try{st=await fs.lstat(path.join(dir,e.name));}catch{}results[i]={name:e.name,directory:e.isDirectory(),symlink:e.isSymbolicLink(),size:st?.size||0,mtime:st?.mtimeMs||0};}}));
      return results;
    }
    const s = this.sessions.get(id);
    const entries = await this.sessions.call(s, 'readdir', dir);
    return entries.filter(e => e.filename !== '.' && e.filename !== '..').map(e => ({ name: e.filename, directory: e.attrs.isDirectory(), symlink: e.attrs.isSymbolicLink(), size: e.attrs.size, mtime: e.attrs.mtime * 1000 }));
  }
  async exists(s, remote) { try { await this.sessions.call(s,'lstat',remote); return true; } catch(e) { if (e.code === 2) return false; throw e; } }
  async upload(id, sources, dest) {
    const s = this.sessions.get(id); let count = 0;
    const transferId = crypto.randomUUID();
    const visit = async (local, remote) => {
      const stat = await fs.lstat(local);
      if (stat.isSymbolicLink()) throw new Error(tr('Sembolik bağlantılar otomatik aktarılmaz: ') + local);
      if (stat.isDirectory()) {
        if (!await this.exists(s, remote)) await this.sessions.call(s, 'mkdir', remote);
        for (const name of await fs.readdir(local)) await visit(path.join(local, name), path.posix.join(remote, name));
      } else {
        if (await this.exists(s,remote) && !await this.confirm(tr('Dosyanın üzerine yazılsın mı?'), remote)) return;
        await this.sessions.call(s, 'fastPut', local, remote, { concurrency:8,step: (done, chunk, total) => this.progress(transferId,path.basename(local),done,total) }); count++;
      }
    };
    try { for (const source of sources) await visit(source, path.posix.join(dest, path.basename(source))); return count; }
    finally { this.progressTimes.delete(transferId);this.emit({ type: 'transfer-end', transferId }); }
  }
  async download(id, sources, dest, quiet = false) {
    const s = this.sessions.get(id); const transferId = crypto.randomUUID(); let count = 0;
    const visit = async (remote, local) => {
      const stat = await this.sessions.call(s, 'lstat', remote);
      if (stat.isSymbolicLink()) throw new Error(tr('Sembolik bağlantılar otomatik aktarılmaz: ') + remote);
      if (stat.isDirectory()) {
        try { if ((await fs.lstat(local)).isSymbolicLink()) throw new Error(tr('Yerel sembolik bağlantıya indirme yapılmaz: ') + local); }
        catch(e) { if(e.code !== 'ENOENT') throw e; }
        await fs.mkdir(local, { recursive: true });
        for (const entry of await this.sessions.call(s,'readdir',remote)) {
          if (['.','..'].includes(entry.filename)) continue;
          await visit(path.posix.join(remote, entry.filename), childPath(local,entry.filename));
        }
      } else {
        let exists = false; try { await fs.lstat(local); exists = true; } catch(e) { if(e.code !== 'ENOENT') throw e; }
        if (exists && !quiet && !await this.confirm(tr('Dosyanın üzerine yazılsın mı?'), local)) return;
        const temporary = local + '.' + crypto.randomUUID() + '.part';
        try {
          await this.sessions.call(s, 'fastGet', remote, temporary, { concurrency:8,step: (done, chunk, total) => this.progress(transferId,path.posix.basename(remote),done,total) });
          await fs.rename(temporary, local); count++;
        } catch(e) { await fs.rm(temporary, { force: true }).catch(()=>{}); throw e; }
      }
    };
    try { for(const remote of sources) await visit(remote, childPath(dest, path.posix.basename(remote))); return count; }
    finally { this.progressTimes.delete(transferId);this.emit({ type: 'transfer-end', transferId }); }
  }
  async mutate(id, op, target, name) {
    const s = this.sessions.get(id);
    if(op === 'mkdir') return this.sessions.call(s, 'mkdir', path.posix.join(target,safeName(name)));
    if(op === 'rename') return this.sessions.call(s, 'rename', target, path.posix.join(path.posix.dirname(target),safeName(name)));
    if (!await this.confirm(tr('Uzak dosya kalıcı olarak silinsin mi?'), target + tr('\nKlasörler yalnızca boşsa silinir.'))) return false;
    const st = await this.sessions.call(s,'lstat',target);
    await this.sessions.call(s,st.isDirectory() ? 'rmdir' : 'unlink',target); return true;
  }
}
module.exports = { Files };
