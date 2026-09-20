const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');

const packageMetadata = require('../package.json');
const repositoryUrl = typeof packageMetadata.repository === 'string' ? packageMetadata.repository : packageMetadata.repository?.url || '';
const repositoryMatch = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);
const slug = process.env.LUMATERM_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY || (repositoryMatch ? `${repositoryMatch[1]}/${repositoryMatch[2]}` : '');
const [owner, repo] = slug.split('/');

const publish = owner && repo ? [{ provider: 'github', owner, repo, releaseType: 'release' }] : undefined;

build({
  targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
  publish: 'never',
  config: {
    appId: 'com.lumaterm.desktop',
    productName: 'LumaTerm',
    copyright: 'Copyright © 2026 LumaTerm contributors',
    asar: true,
    npmRebuild: false,
    asarUnpack: ['node_modules/node-pty/**/*'],
    directories: { output: 'release', buildResources: 'assets' },
    files: [
      'dist/**/*',
      'src/**/*.cjs',
      'assets/**/*',
      'package.json'
    ],
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: path.join('assets','icon.ico')
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowElevation: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: 'always',
      createStartMenuShortcut: true,
      shortcutName: 'LumaTerm',
      uninstallDisplayName: 'LumaTerm',
      deleteAppDataOnUninstall: false,
      installerIcon: path.join('assets','icon.ico'),
      uninstallerIcon: path.join('assets','icon.ico'),
      artifactName: 'LumaTerm-Setup.${ext}'
    },
    publish
  }
}).then(result => result.forEach(file => console.log(file))).catch(error => {
  console.error(error);
  process.exit(1);
});
