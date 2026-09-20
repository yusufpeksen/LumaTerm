const { tr, msg } = require('./i18n.cjs');
const path = require('node:path');
const crypto = require('node:crypto');
const DEFAULTS = {
  language: 'tr', theme: 'midnight', accent: '#8b9cff', fontFamily: 'Cascadia Code, Consolas, monospace', fontSize: 14,
  lineHeight: 1.2, cursorStyle: 'bar', cursorBlink: true, scrollback: 10000,
  defaultShell: 'powershell.exe', startDirectory: '', copyOnSelect: false, confirmClose: true,
  showHidden: true, keepaliveInterval: 15000, terminalBell: false, suggestions: true,
  promptTheme: 'accent', promptGit: true, promptIcons: true,
  shortcuts: { newTab: 'Ctrl+Shift+T', closeTab: 'Ctrl+Shift+W', settings: 'Ctrl+,', search: 'Ctrl+Shift+F', palette: 'Ctrl+Shift+P' }
};
function settings(input = {}) {
  const out = { ...DEFAULTS, ...input, shortcuts: { ...DEFAULTS.shortcuts, ...input.shortcuts } };
  for (const [k,min,max] of [['fontSize',9,32],['lineHeight',1,2],['scrollback',100,100000],['keepaliveInterval',5000,120000]]) {
    out[k] = Math.min(max, Math.max(min, Number(out[k]) || DEFAULTS[k]));
  }
  if (!['midnight','light','forest'].includes(out.theme)) out.theme = 'midnight';
  if (!['accent','ocean','sunset','mono'].includes(out.promptTheme)) out.promptTheme = 'accent';
  if (!['tr','en'].includes(out.language)) out.language = 'tr';
  if (!/^#[a-f0-9]{6}$/i.test(out.accent)) out.accent = DEFAULTS.accent;
  if (!['bar','block','underline'].includes(out.cursorStyle)) out.cursorStyle = 'bar';
  return out;
}
function profile(input) {
  const port = Number(input.port || 22);
  if (!input.name?.trim() || !input.host?.trim() || !input.username?.trim()) throw new Error(tr('Ad, sunucu ve kullanıcı adı gerekli.'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(tr('Port 1–65535 arasında olmalı.'));
  if (/[\x00-\x1f\x7f]/.test(input.initialDirectory || '')) throw new Error(tr('Dizin kontrol karakteri içeremez.'));
  return { id: input.id || crypto.randomUUID(), name: input.name.trim(), host: input.host.trim(), port,
    username: input.username.trim(), auth: input.auth === 'key' ? 'key' : 'password',
    privateKeyPath: String(input.privateKeyPath || ''), group: String(input.group || ''),
    initialDirectory: String(input.initialDirectory || ''), color: /^#[a-f0-9]{6}$/i.test(input.color) ? input.color : '#8b9cff' };
}
function safeName(name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/\x00-\x1f<>:"|?*]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) throw new Error(tr('Dosya adı Windows ile uyumlu değil: ') + name);
  return name;
}
function childPath(parent, name) { return path.join(parent, safeName(name)); }
function quoteShell(value) { if (/[\x00-\x1f\x7f]/.test(String(value))) throw new Error(tr('Dizin kontrol karakteri içeremez.')); return "'" + String(value).replace(/'/g, "'\\''") + "'"; }
class CwdParser {
  constructor(callback) { this.buffer = ''; this.callback = callback; }
  push(data) {
    this.buffer += data;
    const re = /\x1b\](7;file:\/\/[^/]*([^\x07\x1b]*)|9;9;([^\x07\x1b]*))(?:\x07|\x1b\\)/g;
    let match;
    while ((match = re.exec(this.buffer))) {
      try {
        const cwd = match[3] !== undefined ? match[3].replace(/^"|"$/g, '') : decodeURIComponent(match[2]);
        if (cwd && !/[\x00-\x1f\x7f]/.test(cwd)) this.callback(cwd);
      } catch {}
    }
    const start = this.buffer.lastIndexOf('\x1b]');
    this.buffer = start >= 0 && !this.buffer.slice(start).includes('\x07') && !this.buffer.slice(start).includes('\x1b\\') ? this.buffer.slice(start).slice(-16384) : this.buffer.slice(-1);
  }
}
module.exports = { DEFAULTS, settings, profile, safeName, childPath, quoteShell, CwdParser };
