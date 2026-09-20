const path = require('node:path');

// Installed after the normal PowerShell profiles run; leaves profile files untouched.
const powershell = `
$global:__LumaOriginalPrompt = (Get-Item Function:\\prompt).ScriptBlock
function global:prompt {
    $lumaExitCode = $global:LASTEXITCODE
    [Console]::Write(([char]27).ToString() + ']133;A' + [char]7)
    try {
        $lumaLocation = Get-Location
        if ($lumaLocation.Provider.Name -eq 'FileSystem') {
            [Console]::Write(([char]27).ToString() + ']9;9;"' + $lumaLocation.ProviderPath + '"' + [char]7)
        }
    } catch {}
    $global:LASTEXITCODE = $lumaExitCode
    ([string](& $global:__LumaOriginalPrompt)) + ([char]27).ToString() + ']133;B' + [char]7
}
`;

function localShell(executable, environment) {
  const name = path.win32.basename(executable).toLowerCase().replace(/\.exe$/, '');
  const env = { ...environment };
  if (name === 'powershell' || name === 'pwsh') {
    return { args: ['-NoLogo', '-NoExit', '-EncodedCommand', Buffer.from(powershell, 'utf16le').toString('base64')], env };
  }
  if (name === 'cmd') env.PROMPT = '$E]133;A$E\\$E]9;9;"$P"$E\\' + (env.PROMPT || '$P$G') + '$E]133;B$E\\';
  return { args: [], env };
}
module.exports = { localShell };
