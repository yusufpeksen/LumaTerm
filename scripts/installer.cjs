const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');

const slug = process.env.LUMATERM_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY || '';
const [owner, repo] = slug.split('/');
const shouldPublish = process.argv.includes('--publish');

if (shouldPublish && (!owner || !repo)) {
  throw new Error('Publishing requires LUMATERM_GITHUB_REPOSITORY=owner/repository.');
}

const publish = owner && repo ? [{ provider: 'github', owner, repo, releaseType: 'release' }] : undefined;

build({
  targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
  publish: shouldPublish ? 'always' : 'never',
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
