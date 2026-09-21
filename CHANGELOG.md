# Changelog

All notable changes to LumaTerm are recorded here. Versions follow Semantic
Versioning and are published from matching `vX.Y.Z` Git tags.

## [Unreleased] - 0.6.0-beta.1 local validation

- Added CPU and memory usage, session timers, and transfer totals and speed to the status bar.
- Added a built-in UTF-8 editor for local and SFTP files, with stale-file protection.
- Added tab renaming and pinning, collapsible and resizable sidebars, and a file-open action for the current terminal directory.
- Fixed terminal content clipping beneath its scrollbar and footer.
- Added file-type icon colors and a new horizontal logo and Windows icon.
- Prompt before downloading an available update.
- Removed command suggestions and their code.
- Reduced the Windows setup size by retaining only English and Turkish Electron locales.
- Documented the Go/Wails migration decision and parity gates; the running backend is still Electron.

## [0.5.0] - 2026-09-20

- Made English the default language for new installations while retaining the Turkish locale.
- Rewrote public documentation and community templates for an international audience.
- Added multiple loopback-only local port forwarding rules to SSH profiles.
- Added instant filtering for virtualized local and remote file lists.
- Added sticky navigation to the Settings interface.
- Reduced repeated Git prompt work with a short per-directory status cache.
- Added end-to-end tests for SSH tunneling, file filtering, and the updated Settings UI.

## [0.4.0] - 2026-09-20

- Added a colored two-line prompt with current-directory and icon styling.
- Added Git branch, working-tree change count, and upstream ahead/behind details.
- Added Accent, Ocean, Sunset, and Monochrome prompt themes.
- Added settings to toggle Git details and prompt icons.
- Applied matching prompt styling to PowerShell, CMD, and opt-in SSH Bash/Zsh integration without changing profile files.

## [0.3.0] - 2026-09-20

- Added Turkish and English interfaces.
- Synchronized local file browsing with PowerShell and CMD directories.
- Displayed only the active session's local or remote file context.
- Reduced SSH input latency with output batching and renderer backpressure.
- Virtualized large local and remote directory listings.
- Added safe command, history, subcommand, and file suggestions.
- Refreshed terminal, shell, and file icons.
- Added an NSIS Setup.exe installer and GitHub Releases auto-updates.
- Added MIT licensing and automated GitHub release builds.
