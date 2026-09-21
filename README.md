# LumaTerm

LumaTerm is an open-source Windows terminal, SSH client, and SFTP workspace. It combines native ConPTY shells, saved SSH connections, remote file management, Git-aware prompts, and reusable workspaces in one desktop application.

The desktop backend currently uses Electron. The evaluated Go/Wails migration, including required parity checks, is documented in [docs/go-migration.md](docs/go-migration.md).

> LumaTerm is currently a preview. It is designed for Windows 10 1809+ and Windows 11 x64 and does not claim full feature parity with Windows Terminal or MobaXterm.

## Install

Download **[LumaTerm-Setup.exe](https://github.com/yusufpeksen/LumaTerm/releases/latest/download/LumaTerm-Setup.exe)** from the latest GitHub Release. The installer creates Start menu and desktop shortcuts; Node.js is not required.

Preview builds are currently unsigned, so Windows SmartScreen may display an unknown-publisher warning. Installed builds check GitHub Releases shortly after startup and every four hours. You choose whether to download an available update; settings and SSH profiles remain under `%APPDATA%/lumaterm`.

## Highlights

- **Native Windows terminals:** Windows PowerShell, PowerShell 7, Command Prompt, WSL, and custom executables run through ConPTY.
- **Modern prompt:** Colored current-directory display with Git branch, clean/dirty state, changed-file count, and upstream ahead/behind indicators.
- **Prompt themes:** Accent, Ocean, Sunset, and Monochrome presets with independent Git and icon toggles.
- **SSH profiles:** Save hosts, ports, usernames, passwords, encrypted key passphrases, colors, groups, and initial directories.
- **Local port forwarding:** Add one or more `localPort:host:port` rules to an SSH profile. LumaTerm binds them to `127.0.0.1` while that session is open.
- **SFTP workspace:** Browse the active remote directory, filter large listings, upload or download files and folders, rename entries, create folders, and delete files.
- **Drag and drop:** Upload from Explorer and prepare remote files for dragging back to Explorer or the desktop.
- **Directory synchronization:** The file panel follows `cd`, `Set-Location`, `Push-Location`, and `Pop-Location` in PowerShell/CMD. Bash and Zsh tracking can be enabled per SSH session.
- **Multiple sessions:** Open many local or SSH tabs, switch quickly, or show two terminals side by side.
- **Built-in text editor:** Open local and SFTP text files directly from the file pane, save with Ctrl+S, and avoid overwriting files changed elsewhere.
- **Session controls:** Rename or pin tabs, resize or hide either sidebar, and monitor CPU, memory, connection age, activity age, and transfer totals in the status bar.
- **Saved workspaces:** Reopen a named collection of local and SSH tabs.
- **English and Turkish UI:** English is the default for new installations; Turkish remains available in Settings.

## Getting started

### Local terminals

Select PowerShell, PowerShell 7, Command Prompt, or WSL from the sidebar. You can configure another executable and a start directory in Settings. LumaTerm does not modify PowerShell profile files; prompt and directory integration exists only for the current session.

### SSH and SFTP

1. Select the **+** button next to **SSH Connections**.
2. Enter the host, port, username, and password or private key.
3. Verify the server's SHA-256 host fingerprint with the server administrator on first connection.
4. Use the file panel to browse and transfer remote files.

If a stored host key changes, LumaTerm refuses the connection. Remove the old key under **Settings → Security** only after independently confirming that the change is legitimate.

### Local port forwarding

Enter one rule per line in an SSH profile:

```text
8080:localhost:80
15432:db.internal:5432
```

These examples expose the remote web service at `127.0.0.1:8080` and the remote database at `127.0.0.1:15432`. Listeners close with the SSH session and never bind to external network interfaces.

### File transfers

- Drop local files or folders onto the remote file panel to upload them.
- Double-click a remote file or use its download action to choose a destination.
- Use the external-drag action to stage a remote file, then drag the prepared copy into Explorer.
- Use the filter above the file panel to narrow large local or remote directories without another server request.

## Default shortcuts

| Action | Shortcut |
|---|---|
| New terminal | `Ctrl+Shift+T` |
| Close tab | `Ctrl+Shift+W` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Search terminal output | `Ctrl+Shift+F` |
| Command palette | `Ctrl+Shift+P` |
| Settings | `Ctrl+,` |
| Copy | `Ctrl+Shift+C` |
| Paste | `Ctrl+V` |
| Save open text file | `Ctrl+S` |

Right-click copies selected terminal text or pastes when nothing is selected. LumaTerm asks before pasting multiple lines.

## Security and privacy

- Passwords and key passphrases are encrypted with Windows DPAPI for the current Windows account.
- Hostnames and usernames remain readable profile metadata.
- Private key files are referenced by path and are never copied into LumaTerm storage.
- The renderer uses Electron context isolation and sandboxing with Node.js access disabled.
- File names received over SFTP are validated against path traversal and Windows reserved names.
- Symbolic links are not transferred automatically, and partial downloads use temporary `.part` files.
- Exported configuration files never contain passwords or trusted-host records.
- Terminal exports can contain secrets printed by commands; review them before sharing.

See [SECURITY.md](SECURITY.md) to report a vulnerability privately.

## Current limitations

- No X11 server, RDP/VNC client, serial terminal, MOSH, or browser-based remote desktop.
- No ProxyJump, SSH agent forwarding, remote port forwarding, dynamic SOCKS proxy, FIDO keys, or interactive MFA flow yet.
- No transfer pause/resume, persistent transfer queue, or automatic recovery of partial remote uploads.
- Bash/Zsh directory tracking can conflict with `tmux`, nested SSH sessions, or prompt frameworks that replace `PROMPT_COMMAND` or `precmd_functions`.
- The file manager does not yet edit remote files, permissions, or ownership and does not follow symbolic links.
- Windows remote shells do not receive automatic directory tracking.
- Builds are unsigned and can trigger SmartScreen.

## Development

Requirements: Windows and Node.js 22.12 or newer.

```powershell
npm ci
npm run build
npm start
```

Validation and packaging:

```powershell
npm test
npm run smoke
npm run package
```

`npm run smoke` launches an isolated Electron instance, a real PowerShell/ConPTY process, and a loopback SSH/SFTP fixture. It verifies rendering, multiple sessions, DPAPI storage, password and key authentication, local port forwarding, host-key protection, transfers, file editing, directory tracking, and output backpressure.

`npm run package` creates `release/LumaTerm-Setup.exe`, its block map, and `latest.yml`. Pushing a matching `vX.Y.Z` tag runs the Windows release workflow and publishes those assets to GitHub Releases.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. LumaTerm is distributed under the [MIT License](LICENSE).

Core projects used by LumaTerm include [node-pty](https://github.com/microsoft/node-pty), [ssh2](https://github.com/mscdex/ssh2), [Electron](https://www.electronjs.org/), and [xterm.js](https://xtermjs.org/).
