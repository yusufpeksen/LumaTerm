const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { localShell, powershellScript, remoteShellCommand, palette } = require('../src/shell-integration.cjs');

test('PowerShell prompt uses the chosen true-color theme and Git state', () => {
  const script = powershellScript({ promptTheme: 'ocean', promptGit: true, promptIcons: true });
  assert.match(script, /38;2;85;214;232m◆/);
  assert.match(script, /status --porcelain=2 --branch/);
  assert.match(script, /branch\.ab/);
  assert.match(script, /❯/);
});

test('prompt options can hide Git and icons without changing profile files', () => {
  const script = powershellScript({ promptGit: false, promptIcons: false, accent: '#123456' });
  assert.doesNotMatch(script, /git -C/);
  assert.doesNotMatch(script, /◆|⑂|❯/);
  assert.match(script, /38;2;18;52;86m/);
  assert.doesNotMatch(script, /Set-Content|Add-Content|Out-File/);
});

test('CMD and remote Bash/Zsh integration receive the same prompt theme', () => {
  const cmd = localShell('cmd.exe', {}, { promptTheme: 'sunset' });
  assert.match(cmd.env.PROMPT, /38;2;255;157;102m◆ \$P/);
  const remote = remoteShellCommand({ promptTheme: 'mono' });
  assert.match(remote, /BASH_VERSION/);
  assert.match(remote, /ZSH_VERSION/);
  assert.match(remote, /__luma_git_info/);
  assert.match(remote, /#d7dbe7/);
});

test('invalid direct prompt input falls back to safe colors', () => {
  assert.equal(palette({ accent: '$(bad)', promptTheme: 'unknown' }).path, '#8b9cff');
});

test('generated prompt executes in Windows PowerShell', { skip: process.platform !== 'win32' }, () => {
  const script = powershellScript({ promptTheme: 'ocean' }) + '\n[Console]::Write((prompt))\n';
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\x1b\]9;9;/);
  assert.match(result.stdout, /\x1b\[38;2;85;214;232m/);
});
