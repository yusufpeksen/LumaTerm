const path = require('node:path');

const THEMES = {
  accent: null,
  ocean: { path: '#55d6e8', git: '#79a8ff', clean: '#63d6ab', dirty: '#f1c75b', prompt: '#b4c8ff' },
  sunset: { path: '#ff9d66', git: '#d6a5ff', clean: '#78d6a3', dirty: '#ffd166', prompt: '#ff7a90' },
  mono: { path: '#d7dbe7', git: '#aab1c3', clean: '#c5cad6', dirty: '#e3e6ed', prompt: '#ffffff' }
};

function rgb(hex) { return hex.slice(1).match(/../g).map(value => parseInt(value, 16)); }
function ansi(hex) { return `38;2;${rgb(hex).join(';')}`; }
function palette(settings = {}) {
  const accent = /^#[a-f0-9]{6}$/i.test(settings.accent || '') ? settings.accent : '#8b9cff';
  const selected = THEMES[settings.promptTheme] || THEMES.accent;
  return selected || { path: accent, git: '#79d4e1', clean: '#63d6ab', dirty: '#e2c485', prompt: accent };
}
function promptOptions(settings = {}) {
  const colors = palette(settings);
  return {
    colors,
    icons: settings.promptIcons !== false,
    git: settings.promptGit !== false,
    folderIcon: settings.promptIcons === false ? '' : '◆ ',
    branchIcon: settings.promptIcons === false ? 'git:' : '⑂',
    cleanIcon: settings.promptIcons === false ? 'clean' : '✓',
    dirtyIcon: settings.promptIcons === false ? 'changed' : '±',
    promptIcon: settings.promptIcons === false ? '>' : '❯'
  };
}

// Installed after normal PowerShell profiles run; user profile files stay untouched.
function powershellScript(settings = {}) {
  const o = promptOptions(settings), c = o.colors;
  return `
$global:__LumaOriginalPrompt = (Get-Item Function:\\prompt).ScriptBlock
function global:prompt {
    $lumaExitCode = $global:LASTEXITCODE
    $lumaEsc = ([char]27).ToString()
    [Console]::Write($lumaEsc + ']133;A' + [char]7)
    $lumaLocation = Get-Location
    $lumaPath = $lumaLocation.Path
    try {
        if ($lumaLocation.Provider.Name -eq 'FileSystem') {
            [Console]::Write($lumaEsc + ']9;9;"' + $lumaLocation.ProviderPath + '"' + [char]7)
            $lumaPath = $lumaLocation.ProviderPath
        }
    } catch {}
    if ($HOME -and $lumaPath.StartsWith($HOME, [System.StringComparison]::OrdinalIgnoreCase)) {
        $lumaPath = '~' + $lumaPath.Substring($HOME.Length)
    }
    $lumaGit = ''
    ${o.git ? `try {
        if ($lumaLocation.Provider.Name -eq 'FileSystem' -and (Get-Command git -ErrorAction Ignore)) {
            $lumaOldLocks = $env:GIT_OPTIONAL_LOCKS
            $env:GIT_OPTIONAL_LOCKS = '0'
            $lumaStatus = @(& git -C $lumaLocation.ProviderPath status --porcelain=2 --branch 2>$null)
            if ($global:LASTEXITCODE -eq 0) {
                $lumaHead = $lumaStatus | Where-Object { $_ -like '# branch.head *' } | Select-Object -First 1
                $lumaBranch = if ($lumaHead) { $lumaHead -replace '^# branch.head ', '' } else { '' }
                if ($lumaBranch -eq '(detached)' -or !$lumaBranch) {
                    $lumaOid = $lumaStatus | Where-Object { $_ -like '# branch.oid *' } | Select-Object -First 1
                    if ($lumaOid) { $lumaBranch = (($lumaOid -replace '^# branch.oid ', '').Substring(0, 7)) }
                }
                $lumaChanged = @($lumaStatus | Where-Object { $_ -notlike '# *' }).Count
                $lumaAb = $lumaStatus | Where-Object { $_ -like '# branch.ab *' } | Select-Object -First 1
                $lumaSync = ''
                if ($lumaAb -match '\\+(\\d+) -(\\d+)') {
                    if ([int]$Matches[1] -gt 0) { $lumaSync += ' ↑' + $Matches[1] }
                    if ([int]$Matches[2] -gt 0) { $lumaSync += ' ↓' + $Matches[2] }
                }
                if ($lumaBranch) {
                    $lumaState = if ($lumaChanged) { '${o.dirtyIcon}' + $lumaChanged } else { '${o.cleanIcon}' }
                    $lumaStateColor = if ($lumaChanged) { '${ansi(c.dirty)}' } else { '${ansi(c.clean)}' }
                    $lumaGit = '  ' + $lumaEsc + '[${ansi(c.git)}m${o.branchIcon} ' + $lumaBranch + $lumaSync + ' ' + $lumaEsc + '[' + $lumaStateColor + 'm' + $lumaState
                }
            }
            if ($null -eq $lumaOldLocks) { Remove-Item Env:GIT_OPTIONAL_LOCKS -ErrorAction Ignore } else { $env:GIT_OPTIONAL_LOCKS = $lumaOldLocks }
        }
    } catch {}` : ''}
    $global:LASTEXITCODE = $lumaExitCode
    $lumaEsc + '[${ansi(c.path)}m${o.folderIcon}' + $lumaPath + $lumaGit + $lumaEsc + '[0m' + [Environment]::NewLine + $lumaEsc + '[${ansi(c.prompt)}m${o.promptIcon} ' + $lumaEsc + '[0m' + $lumaEsc + ']133;B' + [char]7
}
`;
}

function localShell(executable, environment, settings = {}) {
  const name = path.win32.basename(executable).toLowerCase().replace(/\.exe$/, '');
  const env = { ...environment };
  const o = promptOptions(settings), c = o.colors;
  if (name === 'powershell' || name === 'pwsh') {
    return { args: ['-NoLogo', '-NoExit', '-EncodedCommand', Buffer.from(powershellScript(settings), 'utf16le').toString('base64')], env };
  }
  if (name === 'cmd') {
    env.PROMPT = `$E]133;A$E\\$E]9;9;"$P"$E\\$E[${ansi(c.path)}m${o.folderIcon}$P$E[0m$_$E[${ansi(c.prompt)}m${o.promptIcon} $E[0m$E]133;B$E\\`;
  }
  return { args: [], env };
}

function remoteShellCommand(settings = {}) {
  const o = promptOptions(settings), c = o.colors;
  const git = o.git ? `__luma_git_info(){ command -v git >/dev/null 2>&1 || return; __luma_branch=$(GIT_OPTIONAL_LOCKS=0 git symbolic-ref --quiet --short HEAD 2>/dev/null || GIT_OPTIONAL_LOCKS=0 git rev-parse --short HEAD 2>/dev/null) || return; __luma_changed=$(GIT_OPTIONAL_LOCKS=0 git status --porcelain 2>/dev/null | wc -l); __luma_sync=''; __luma_ab=$(GIT_OPTIONAL_LOCKS=0 git rev-list --left-right --count '@{upstream}...HEAD' 2>/dev/null) && { __luma_behind=\${__luma_ab%%[[:space:]]*}; __luma_ahead=\${__luma_ab##*[[:space:]]}; [ "\${__luma_ahead:-0}" -gt 0 ] && __luma_sync="$__luma_sync ↑$__luma_ahead"; [ "\${__luma_behind:-0}" -gt 0 ] && __luma_sync="$__luma_sync ↓$__luma_behind"; }; if [ "$__luma_changed" -gt 0 ]; then printf '  ${o.branchIcon} %s%s ${o.dirtyIcon}%s' "$__luma_branch" "$__luma_sync" "$__luma_changed"; else printf '  ${o.branchIcon} %s%s ${o.cleanIcon}' "$__luma_branch" "$__luma_sync"; fi; };` : `__luma_git_info(){ :; };`;
  return `${git} __luma_cwd(){ printf '\\033]7;file://localhost%s\\007' "$PWD"; }; if [ -n "$BASH_VERSION" ]; then __luma_prompt(){ __luma_cwd; PS1='\\[\\033[${ansi(c.path)}m\\]${o.folderIcon}\\w\\[\\033[${ansi(c.git)}m\\]$(__luma_git_info)\\[\\033[0m\\]\\n\\[\\033[${ansi(c.prompt)}m\\]${o.promptIcon} \\[\\033[0m\\]'; }; case ";\${PROMPT_COMMAND:-};" in *';__luma_prompt;'*) ;; *) PROMPT_COMMAND="\${PROMPT_COMMAND:+\${PROMPT_COMMAND};}__luma_prompt";; esac; __luma_prompt; elif [ -n "$ZSH_VERSION" ]; then setopt prompt_subst; __luma_prompt(){ __luma_cwd; }; precmd_functions=(__luma_prompt \${precmd_functions:#__luma_prompt}); PROMPT=$'%F{${c.path}}${o.folderIcon}%~%F{${c.git}}$(__luma_git_info)%f\\n%F{${c.prompt}}${o.promptIcon} %f'; __luma_prompt; fi\r`;
}

module.exports = { localShell, powershellScript, remoteShellCommand, palette };
