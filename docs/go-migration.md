# Go migration decision

LumaTerm's current release build uses Electron for its desktop shell, xterm.js for terminal rendering, node-pty for Windows ConPTY, ssh2 for SSH/SFTP, and Windows DPAPI through Electron. A language switch alone will not improve xterm.js rendering or network latency. The largest predictable size reduction comes from replacing Electron's bundled browser with a system WebView.

## Decision

Use **Go with Wails v2** for the next native backend and desktop shell, while retaining the existing xterm.js interface. Wails v2 is the stable line; Wails v3 is still beta. The target Windows package uses the installed Microsoft WebView2 runtime and includes a bootstrapper path for machines without it. The Go program will own sessions, files, credentials, settings, and update checks. Frontend changes should stay small so existing workflows survive the migration.

| Option | Strength | Cost for this application |
| --- | --- | --- |
| Go + Wails | Small native executable, straightforward concurrency and SSH APIs, reuse of current web UI | ConPTY, SFTP, DPAPI, and updater integration must be ported and retested |
| Rust + Tauri | Strong memory safety and low runtime overhead; also uses WebView2 | More implementation work for this codebase and a steeper FFI boundary for ConPTY |
| C++ | Direct Windows API access and maximum control | Highest maintenance and security burden for SSH, settings, and update plumbing |
| C | Small runtime | Unsafe and labor intensive for a feature-rich desktop client |

## Parity gates before replacing Electron

1. Build a Go ConPTY adapter using the Windows pseudoconsole API. It must preserve PowerShell, CMD, WSL, resize, Ctrl+C, Unicode, and directory notifications.
2. Build an SSH transport using `golang.org/x/crypto/ssh` with host-key pinning, password/key authentication, keepalive, PTY resize, and loopback-only port forwarding. Add SFTP browsing, transfer progress, drag staging, and text editing.
3. Migrate encrypted secrets with Windows DPAPI without writing plaintext credentials or changing existing saved profiles. Preserve settings and workspace imports.
4. Bridge the existing renderer to Go methods and events. Keep terminal output backpressure and virtualized file lists. Measure loopback echo latency, startup time, idle memory, and installer size against the current test artifacts.
5. Replace the update flow with a signed or verified GitHub release download and an explicit download prompt. Validate installation and rollback before publishing any release.

The existing Electron build remains the runnable local test version until these gates pass. Do not publish a Go-branded release before the new binary passes the same Windows and SSH fixture checks.

References: [Wails architecture](https://wails.io/docs/introduction/), [Wails Windows runtime](https://wails.io/docs/next/guides/windows/), [Windows ConPTY API](https://learn.microsoft.com/en-us/windows/console/createpseudoconsole), [Go SSH package](https://pkg.go.dev/golang.org/x/crypto/ssh), [Tauri Windows prerequisites](https://tauri.app/start/prerequisites/).
