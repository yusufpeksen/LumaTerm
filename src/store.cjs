const { tr, msg } = require('./i18n.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { settings, profile } = require('./core.cjs');
class Store {
  constructor(directory, safeStorage) {
    this.file = path.join(directory, 'lumaterm.json'); this.crypto = safeStorage;
    fs.mkdirSync(directory, { recursive: true });
    this.data = { settings: settings(), profiles: [], hosts: {}, workspaces: [] };
    if (fs.existsSync(this.file)) {
      try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; }
      catch { throw new Error(tr('Ayar dosyası okunamadı. Dosya korunuyor: ') + this.file); }
    }
    this.data.settings = settings(this.data.settings);
    delete this.data.commands;
  }
  write() { fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data, null, 2), { mode: 0o600 }); fs.renameSync(this.file + '.tmp', this.file); }
  encrypt(value) {
    if (!this.crypto.isEncryptionAvailable()) throw new Error(tr('Windows parola şifrelemesi kullanılamıyor. Parola kaydedilmedi.'));
    return this.crypto.encryptString(value).toString('base64');
  }
  decrypt(value) { return value ? this.crypto.decryptString(Buffer.from(value, 'base64')) : ''; }
  public() { return { settings: this.data.settings, profiles: this.data.profiles.map(({ secret, ...p }) => ({ ...p, hasSecret: !!secret })), workspaces: this.data.workspaces, trustedHosts: Object.entries(this.data.hosts).map(([host,fingerprint])=>({host,fingerprint})) }; }
  saveProfile(input) {
    const p = profile(input), old = this.data.profiles.find(x => x.id === p.id);
    p.secret = input.forgetSecret ? undefined : input.password ? this.encrypt(input.password) : old?.secret;
    this.data.profiles = [...this.data.profiles.filter(x => x.id !== p.id), p]; this.write(); return this.public();
  }
}
module.exports = { Store };
