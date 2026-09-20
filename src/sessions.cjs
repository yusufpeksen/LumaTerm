const { tr, msg } = require('./i18n.cjs');
const { Client } = require('ssh2');
const pty = require('node-pty');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { CwdParser, quoteShell } = require('./core.cjs');
const { localShell, remoteShellCommand } = require('./shell-integration.cjs');
const { OutputFlow } = require('./output-flow.cjs');
class Sessions {
  constructor(store, emit, verify) { this.store = store; this.emit = emit; this.verify = verify; this.items = new Map(); }
  get(id) { const s = this.items.get(id); if (!s) throw new Error(tr('Oturum kapalı.')); return s; }
  async open(spec, managedOutput = false) {
    const id = crypto.randomUUID();
    const s = { id, kind: spec.kind, spec, closed: false, ready: false };
    this.items.set(id, s);
    if(managedOutput)s.output=new OutputFlow(value=>this.emit({type:'data',id,data:value}),()=>{s.pty?.pause();s.stream?.pause();s.stream?.stderr.pause();},()=>{s.pty?.resume();s.stream?.resume();s.stream?.stderr.resume();});
    const parser = new CwdParser(cwd => {
      if (s.kind === 'local' && /^\/[a-z]:\//i.test(cwd)) cwd = cwd.slice(1).replace(/\//g, '\\');
      if (s.kind === 'local' && !require('node:path').win32.isAbsolute(cwd)) return;
      if (s.closed || s.cwd === cwd) return;
      s.cwd = cwd; this.emit({ type: 'cwd', id, cwd });
    });
    const data = chunk => { if(s.closed)return;const value = chunk.toString(); parser.push(value); if(s.output)s.output.push(value);else this.emit({ type: 'data', id, data: value }); };
    const ended = message => { if (s.closed) return; s.ready = false;s.output?.flush();for(const item of s.forwards||[])try{item.server.close();}catch{}s.forwards=[]; this.emit({ type: 'exit', id, message }); };
    try {
      if (spec.kind !== 'ssh') {
        s.kind = 'local';
        const executable = spec.shell || this.store.data.settings.defaultShell;
        const cwd = spec.cwd || this.store.data.settings.startDirectory || os.homedir();
        const shell = localShell(executable, { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }, this.store.data.settings);
        s.pty = pty.spawn(executable, shell.args, { name: 'xterm-256color', cols: 100, rows: 30, cwd, env: shell.env, useConpty: true, useConptyDll: true });
        s.pty.onData(data); s.pty.onExit(({ exitCode }) => ended(tr('İşlem sonlandı · kod ') + exitCode));
        s.ready = true; s.cwd = cwd;
        return { id, kind: s.kind, title: executable.split(/[\\/]/).pop(), cwd, spec: {kind:'local',shell:executable,cwd} };
      }
      const p = this.store.data.profiles.find(x => x.id === spec.profileId);
      if (!p) throw new Error(tr('SSH bağlantısı bulunamadı.'));
      const secret = spec.password || this.store.decrypt(p.secret);
      s.client = new Client();
      s.client.on('error', e => ended(e.message));
      s.client.on('close', () => ended(tr('SSH bağlantısı kapandı.')));
      await new Promise((resolve, reject) => {
        s.client.once('ready', () => { s.client.setNoDelay(true);resolve(); }); s.client.once('error', reject);
        s.client.once('close', () => reject(new Error(tr('SSH bağlantısı kapandı.'))));
        const config = {
          host: p.host, port: p.port, username: p.username, readyTimeout: 30000,
          keepaliveInterval: this.store.data.settings.keepaliveInterval, keepaliveCountMax: 3,
          hostVerifier: (key, callback) => {
            const fingerprint = 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
            const host = p.host + ':' + p.port, known = this.store.data.hosts[host];
            if (known === fingerprint) return callback(true);
            if (known) { this.emit({ type: 'notice', message: tr('Sunucu kimliği değişti: ') + host + tr('. Bağlantı güvenlik nedeniyle reddedildi.') }); return callback(false); }
            this.verify(host, fingerprint).then(ok => {
              if (ok) { this.store.data.hosts[host] = fingerprint; this.store.write(); }
              callback(ok);
            }).catch(() => callback(false));
          }
        };
        if (p.auth === 'key') { config.privateKey = fs.readFileSync(p.privateKeyPath); if (secret) config.passphrase = secret; }
        else { config.password = secret; }
        s.client.connect(config);
      });
      s.stream = await new Promise((resolve, reject) => s.client.shell({ term: 'xterm-256color', cols: 100, rows: 30 }, (e, stream) => e ? reject(e) : resolve(stream)));
      s.stream.setEncoding('utf8'); s.stream.stderr.setEncoding('utf8');
      s.stream.on('data', data); s.stream.stderr.on('data', data); s.stream.on('close', () => { ended(tr('Uzak kabuk sonlandı.')); s.client.end(); });
      try {
        s.sftp = await new Promise((resolve, reject) => s.client.sftp((e, channel) => e ? reject(e) : resolve(channel)));
        s.cwd = await this.call(s, 'realpath', p.initialDirectory || '.');
      } catch(e) { this.emit({ type: 'notice', message: tr('Terminal açık; SFTP kullanılamıyor: ') + e.message }); s.cwd = '/'; }
      s.forwards = [];
      for (const forward of p.forwards || []) {
        try { await this.startForward(s, forward); }
        catch (e) { this.emit({ type: 'notice', message: tr('Port yönlendirme başlatılamadı: ') + forward.localPort + ' · ' + e.message }); }
      }
      s.ready = true;
      if (p.initialDirectory) s.stream.write('cd -- ' + quoteShell(p.initialDirectory) + '\r');
      return { id, kind: 'ssh', title: p.name, cwd: s.cwd, spec: { kind: 'ssh', profileId: p.id }, color: p.color, sftp: !!s.sftp, forwards: s.forwards.map(item=>item.config) };
    } catch(e) { this.close(id); throw e; }
  }
  call(s, method, ...args) { if (!s.sftp) return Promise.reject(new Error(tr('SFTP kullanılamıyor.'))); return new Promise((resolve,reject) => s.sftp[method](...args, (e, value) => e ? reject(e) : resolve(value))); }
  startForward(s, config) {
    return new Promise((resolve, reject) => {
      const server = net.createServer(socket => {
        try {
          s.client.forwardOut(socket.remoteAddress || '127.0.0.1', socket.remotePort || 0, config.host, config.port, (error, stream) => {
            if (error) { socket.destroy(error); return; }
            socket.pipe(stream).pipe(socket);
            stream.on('error', () => socket.destroy()); socket.on('error', () => stream.destroy());
          });
        } catch (error) { socket.destroy(error); }
      });
      const failed = error => { server.close(); reject(error); };
      server.once('error', failed);
      server.listen(config.localPort, '127.0.0.1', () => {
        server.off('error', failed);
        server.on('error', error => this.emit({ type: 'notice', message: tr('Port yönlendirme başlatılamadı: ') + config.localPort + ' · ' + error.message }));
        const item = { server, config: { ...config } }; s.forwards.push(item); resolve(item);
      });
    });
  }
  input(id, data) { const s = this.get(id); if (s.ready && typeof data === 'string') (s.pty || s.stream).write(data); }
  attach(id){this.get(id).output?.attach();}
  acknowledge(id,count){this.items.get(id)?.output?.acknowledge(count);}
  resize(id, cols, rows) { const s = this.get(id); cols = Math.max(2, Math.min(500, Number(cols) || 80)); rows = Math.max(2, Math.min(300, Number(rows) || 24)); if(s.ready) s.pty ? s.pty.resize(cols, rows) : s.stream.setWindow(rows, cols, 0, 0); }
  integration(id) {
    const s = this.get(id); if(s.kind !== 'ssh') return;
    // Opt-in shell hook. Does not modify the remote shell's configuration files.
    this.input(id, remoteShellCommand(this.store.data.settings));
  }
  close(id) { const s = this.items.get(id); if(!s) return; s.closed = true;s.output?.close(); for(const item of s.forwards||[])try{item.server.close();}catch{} try { s.pty?.kill(); s.client?.end(); } catch {} this.items.delete(id); }
  closeAll() { for (const id of this.items.keys()) this.close(id); }
}
module.exports = { Sessions };
