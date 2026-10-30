> Archived upstream overview, translated from [the preserved Chinese original](README.zh-CN.md). This describes the inherited upstream project, not the editor fork. For current fork features and build instructions, see [README.md](README.md). Downloads and version claims below refer to upstream at the time of the original document.

# Code-Codex

[简体中文 original](README.zh-CN.md) | English translation | [Editor fork](README.md)

<p align="center">
  <img src="crates/launcher/resources/code-codex.ico" alt="Code-Codex icon" width="96">
</p>

<p align="center"><em>Add a local project file tree, preview tabs, and limited editing to Codex Desktop.</em></p>

<p align="center">
  <a href="https://github.com/Rice-dog/code-codex/releases"><img alt="Version" src="https://img.shields.io/badge/version-0.5.40-blue"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green"></a>
  <img alt="Windows 10 x64 support" src="https://img.shields.io/badge/platform-Windows%2010%2B%20x64-0078D4?logo=windows&logoColor=white">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-brightgreen">
  <img alt="Rust" src="https://img.shields.io/badge/rust-1.85%2B-orange">
  <img alt="Status" src="https://img.shields.io/badge/status-preview-yellow">
</p>

Code-Codex is an unofficial community project that adds a local project file tree to Codex Desktop. It combines a Windows native companion, a restricted workspace bridge, and an injected TypeScript explorer UI for file previews, editing, navigation, and file operations.

> [!IMPORTANT]
> Code-Codex is not affiliated with OpenAI.

![Code-Codex file tree in Codex](docs/screenshots/file-tree-conversation.png)

![Code-Codex code preview with syntax highlighting](docs/screenshots/code-preview.png)

Version **v0.5.40** brings together improvements since the previous public software release, v0.5.21: explicitly authorized startup recovery, waiting for slow startups, a standalone desktop shortcut, a top menu and login startup, a complete uninstall flow, Chinese plugin names, and a fix for Particle Image automatic rotation. Matching plugin caches continue to be reused. Background activation supports the official app's separated appearance interfaces, automatically applies the required theme, and restores the previous appearance when disabled; manually selecting dark mode first is no longer necessary. See the [release notes](releases/README.md) for the cumulative changes and verification limits.

When an upgrade is available, a subtle green arrow appears beside the version number. No arrow appears when the installed version is current.

## Installation option 1: download the EXE

Download the installer from the [latest GitHub Release](https://github.com/Rice-dog/code-codex/releases/latest). The corresponding build assets are retained in [`releases`](releases/).

Runtime requirements: Windows 10 version 2004 (build 19041) or later, x64, with the official stable Codex/ChatGPT Desktop app installed.

- Recommended: `CodeCodex-0.5.40-x64-setup.exe`
- Alternative: `CodeCodex-0.5.40-x64.msi`
- Portable package: `CodeCodex-0.5.40-x64.zip`
- Standalone uninstaller: `Uninstall-CodeCodex.exe`

Verify a download with:

```powershell
Get-FileHash .\CodeCodex-0.5.40-x64-setup.exe -Algorithm SHA256
```

Compare the result with [`SHA256SUMS.txt`](releases/SHA256SUMS.txt).

If official Codex Desktop is installed, the installer checks the current user's and public desktop shortcuts. It prefers shortcuts pointing to official Codex, but can also take over user-created `Codex` or `ChatGPT` shortcuts, or renamed shortcuts targeting `Codex.exe` / `ChatGPT.exe`. Original shortcuts are backed up and restored on uninstall. This version always creates a separate `Code-Codex` desktop shortcut: both entries coexist when a native shortcut exists; otherwise the standalone entry is used. Missing native entries with valid records can also be repaired. The completion page shows the primary entry path. Public versions v0.5.21 and earlier created a separate entry only when no native entry was found.

### Centralized directories and custom installation

The EXE uses a compact white branded wizard: a 720-logical-pixel client width, an overall window aspect ratio of 3:1.8, DPI-aware text and buttons, and a proportionally scaled brand image. Its pages are Welcome → License Agreement → Installation Folder → Installing → Finish. Accept the MIT license to reach the folder page; select Custom installation to expand the path field. Install runs continuously in the same window; Finish closes it after success.

The default location is `%LOCALAPPDATA%\Programs\Code-Codex`; a dedicated folder on another fixed local drive is also supported. Updates reuse the installed directory. In-app automatic updates from this version onward show Installing → Finish directly in the same branded window, skipping welcome, license, and folder selection. The first upgrade from old public v0.4.4 shows the full wizard while retaining its existing directory; this is the expected compatibility flow, but that old-version upgrade has not actually been tested. To relocate, uninstall normally while keeping data, then install in the new directory; the installer copies retained data and preserves its source. MSI supports `msiexec /i CodeCodex-0.5.40-x64.msi INSTALLFOLDER="D:\Apps\Code-Codex"`.

- `versions/`: immutable program versions; `integration/`: shortcuts and installation transactions.
- `data/`: file-tree settings, plugin parameters, and user images/videos. Official Codex accounts, chats, and project files remain managed by the official client.
- `plugins/<category>/<plugin-ID>/<version>/`: verified downloaded code and default assets.
- `logs/runtime/`: the latest ten runs, up to 5 MiB each; `logs/diagnostics/`: failure and self-check reports; `logs/install/`: the latest ten installations; `logs/update/`: update logs (update events currently appear mainly in runtime logs).
- `temp/`: post-install updates and temporary processing; `backups/`: migration records. During initial extraction or when the directory is unavailable, the system temporary directory can be used as an emergency location, with an explanation in diagnostics.

Choose a dedicated folder; avoid system directories, drive roots, network directories, and linked directories. Normal uninstall preserves settings, plugins, assets, and logs by default. Explicit cleanup removes this product's known data directories while preserving unrelated files. Plugin assets, installations, and logs can grow independently; the runtime-log limit is not a total folder-size limit.

After a successful EXE installation, the current version and actual previous version are retained, and older program versions are safely cleaned up. Versions that are in use, locked, contain unknown files, or whose paths cannot be confirmed are retained; reasons are recorded under `versionRetention` in the installation log. Sessions are not terminated to reclaim space. MSI continues to use Windows Installer version management.

## Installation option 2: build the EXE from source

Requirements:

- Windows 11 x64.
- Rust with the MSVC toolchain.
- Node.js 20.19 or later.
- Visual Studio Build Tools with Desktop C++.
- The .NET SDK if generating an MSI.

Build release executables:

```powershell
./scripts/build.ps1 -Configuration Release
```

Outputs are written to `target/release/`, including:

- `code-codex.exe`
- `code-codex-launcher.exe`
- `Install-CodeCodex.exe`
- `Uninstall-CodeCodex.exe`
- `code-codex-setup.exe`
- `code-codex-shim.exe`
- `code-codex-shortcut.exe`
- `code-codex-uninstall.exe`

Generate downloadable setup EXE, MSI, and ZIP packages:

```powershell
./scripts/package.ps1 -Version 0.5.40
```

Outputs are written to `releases/`.

## All plugins download on demand

All **25 Preview Market plugins download independently**: 14 Appearance, 10 File Preview, and 1 Tools plugin. The core installer retains the file tree, basic text preview and editing, market and settings framework, permission checks, and runtime logs. Actual plugin rendering, previews, startup playback, and tools are no longer built in.

Open Preview Market and click **Download** first. After download and verification, click **Enable** to use the plugin in the current Codex window without restarting. Downloading neither enables the plugin nor opens settings automatically. Parameter controls become available once the complete package is present. UI Surface Opacity still requires an active background plugin.

Plugin code and required resources come from this project's GitHub Releases. Downloads, caches, and every load are checked for file size and SHA-256 against the catalog embedded in the core. The market cannot install arbitrary third-party scripts. Plugins are organized into three categories:

```text
releases/plugins/
├── appearance/
│   └── particle-image/       # Main JS, manifest, documentation, default images
├── file-preview/
│   └── office-preview/       # Preview code and local Worker/WASM resources
└── developer-tools/
    └── git-history/          # Read-only Git tool implementation
```

Each plugin folder uses a stable English ID and contains its code, styles, and required resources. GitHub Release assets still use unique filenames; `releases/release-assets.json` maps filenames, local category paths, and SHA-256 hashes.

Caches live at `<installation directory>\plugins\<category>\<plugin-ID>\<plugin-version>` (unmigrated older versions use `%LOCALAPPDATA%\CodeCodex\plugin-cache`). Normal upgrades and uninstalls preserve caches; unchanged plugins can be reused offline. Valid older flat or pre-category caches are verified before migration. Existing parameters, enablement preferences, personal image libraries, and user videos are preserved. Installed means only that the cache is complete. Until verified and loaded in the current window, the button reads Enable without clearing saved preferences. Previously built-in previews, tools, and three appearance features require a download when first using their new separate packages. Existing backgrounds download again only if required packages or assets change, are missing, or are corrupt.

Particle Image includes **six original images**, and Pixel Sculpt includes **three**, downloaded with their respective background plugins. They are imported on first use without duplicating existing matching images; personal images and playback selections remain intact. Deleted defaults are not automatically restored on reopening. These images are absent from the core installer.

The Codex Startup Transition player also requires a download. The core retains only a small early-loading entry point that reads the verified startup plugin and selected background cache during the official waiting screen, without networking or waiting for the file tree to mount. Missing or corrupt packages cause the animation to be skipped and the reason logged; Codex continues starting normally. User videos are stored in `<installation directory>\data\media\startup`, with browser IndexedDB as a playback cache. Neither installers nor plugin packages include official promotional videos.

For offline installation, retain the directories above and all plugin resources, then run that version's `code-codex.exe plugins --import-dir "releases-directory"`. You may also specify `plugins`, a category folder, or a single plugin folder. The command imports only complete assets trusted by the built-in catalog and does not enable them automatically. There is currently no separate plugin-update or uninstall management page.

README feature screenshots under `docs/screenshots/` remain on GitHub and are no longer distributed with EXE, MSI, or ZIP packages. They differ from default plugin gallery assets. View the repository README for full screenshots. The installer does not pre-download every plugin. Locally generated packages need matching GitHub assets published before other users can use Download.

### Upgrade notes

EXE/ZIP users can upgrade directly in the existing installation directory without uninstalling first. Settings, original assets, and matching verified plugin caches remain. MSI-owned installations cannot be overwritten by an online standalone EXE; continue using MSI/Windows Installer. If the current official session lacks a trusted debugging port, installation retains its successful result and asks you to reopen through the Code-Codex launcher without automatically closing the chat. If an old menu stops working, manually download the full EXE installer. Direct upgrades from historical versions and real MSI upgrades have not been verified across the full matrix.

## Uninstalling

Every installation method includes an uninstaller built from source:

- After installer or ZIP installation, `Uninstall-CodeCodex.exe` is in `%LOCALAPPDATA%\Programs\Code-Codex`.
- Source builds put `Uninstall-CodeCodex.exe`, `Uninstall-CodeCodex.ps1`, and `Finalize-Uninstall.ps1` in `target/release/`.

Uninstall uses the same branded wizard: confirm removal, then click Finish. Run `Uninstall-CodeCodex.exe` to restore pre-install desktop shortcuts and remove Code-Codex files. Locally maintained builds also remove their own managed `Code-Codex` desktop shortcut. Entries that users have changed to target other programs are neither overwritten nor deleted; conflicts retain restoration state. MSI installations can also be removed through Windows **Installed apps**.

## Features

### Core features

- A Code-Codex menu beside Help at the top of Codex, with file-tree visibility, Preview Market, update checks, and the project's GitHub repository.
- A local workspace file tree in the Codex sidebar.
- Copy files and folders from Windows File Explorer by dragging them into the workspace root or a folder in the tree.
- Context-menu actions for create, rename, delete, copy path, reveal in Explorer, and refresh.
- Move files and folders by dragging within the tree.
- Main-window file tabs beside the conversation.
- Basic text preview, syntax highlighting, and limited editing; Markdown rendering comes from a separate preview plugin.
- Code previews and editing include a syntax-colored minimap, click/drag/wheel/keyboard navigation, and a persistent on/off setting. It hides automatically in narrow windows, sits left of the single rightmost scrollbar, and shows its translucent viewport indicator on hover and scroll activity.
- The local bridge performs only restricted workspace operations.

### Global language and custom backgrounds

The welcome page preselects Chinese or English from the system language. After installation, switch through Code-Codex → Language. Plugin names, parameters, and ordinary UI follow the global language setting; technical errors and diagnostic logs remain English. Custom Background supports importing local images/videos, per-asset position/scale/rotation and appearance parameters, and resetting the current asset. It coexists with UI Surface Opacity. Settings previews follow the current background video's playback position; opening the panel does not reload the background.

### Plugins

- Preview Market has Appearance, File Preview, and Tools categories, opening to Appearance by default.
- File Preview offers independent downloads and enablement for Markdown, CSV, diagrams, images, video, PDF, audio, Jupyter Notebook, Office, and 3D models. Processing stays local.
- Appearance includes ten animated backgrounds, Custom Background, Transparent Background, UI Surface Opacity, and Codex Startup Transition; download each before enabling it.
- Tools includes Git History, which displays the current branch, commits, changed files, and colored per-file diffs read-only, without writing to the repository.

### Updates and compatibility

- Click the version number at the bottom of the file tree, or choose **Check for Updates…** in the Code-Codex menu, to check GitHub for the latest stable release.
- Codex Startup Transition supports a video or any of the ten animated backgrounds, including Particle Image and Pixel Sculpt using local image libraries. Backgrounds show for at least four seconds and fade out over the configured duration once ready.
- Startup failures identify the failed stage, a stable support code, and suggested action, with options to copy or open a local redacted diagnostic report.
- The Codex package version is diagnostic information only. Future versions are checked through live protocol and DOM structure rather than a fixed version allowlist.

## Preview Market plugins

Preview Market is at the bottom of the Code-Codex file tree. Its panel groups plugins into **Appearance**, **File Preview**, and **Tools**, initially showing Appearance. Selecting a category shows only its plugins.

### File preview plugins

![Code-Codex interactive glTF and GLB 3D model preview](docs/screenshots/gltf-preview.png)

File Preview offers on-demand independent downloads and enablement for Markdown, CSV, diagrams, images, video, PDF, audio, Jupyter Notebook, Office documents, and glTF 3D models. All preview processing happens locally on the user's computer.

The 3D model plugin provides interactive `.gltf` and `.glb` views with rotation, panning, zoom, fit/reset, a reference grid, and animation controls.

### Appearance plugins

![Code-Codex Particle Image Background plugin](docs/screenshots/particle-image-background.png)

Particle Image Background converts locally selected images into an animated grayscale particle field covering Codex. The image library supports sequential automatic switching, smooth morphing, per-image position and scale, direct numeric input, and adjustable flow, pointer, Source, and rendering parameters. Transparent Background is a separate appearance plugin. Particle images and settings remain only in the local Codex configuration. The particle-assembly introduction supports enablement, duration, assembly range, and independent replay; the homepage background introduction replays only after the startup overlay ends.

![Code-Codex Black Hole Background plugin](docs/screenshots/black-hole-background.png)

Black Hole Background reuses the full-window background surface, with adjustable ray-marched black-hole, temporal accumulation, and glow effects. Rendering-quality parameters are fixed internally and hidden for consistency. Enabling it automatically changes Codex's actual appearance setting to dark; disabling restores the previous setting.

![Code-Codex Glow Horizon Background plugin](docs/screenshots/glow-horizon-background.png)

Glow Horizon Background displays an interactive glowing horizon throughout the window, with up/down/left/right directions, wheel deformation, inertia and spring-back, an introduction animation, and glow-color controls. Its settings follow the global language. Enabling selects dark appearance; disabling restores the prior appearance.

![Code-Codex Heavenly Cloud Background plugin](docs/screenshots/heavenly-cloud-background.png)

Heavenly Cloud Background displays a texture-free, real-time ray-marched cloud tunnel throughout Codex. Controls include forward speed, mist density, turbulence, tunnel radius, spectral shift, pointer guidance, an introduction animation, and three quality levels. Settings follow the global language, with the same automatic dark-mode and restoration mechanism as other GPU backgrounds.

![Code-Codex Aurora Ionosphere Background plugin](docs/screenshots/aurora-ionosphere-background.png)

Aurora Ionosphere Background displays runtime-generated volumetric aurora curtains and a procedural starfield throughout Codex. It preserves the original effect's three-stage WebGL rendering, adaptive quality, and cinematic reveal. Chinese/English secondary settings panels expose the ionosphere field, introduction sequence, rendering quality, and animation state.

![Milky Way Background](docs/screenshots/milky-way-background.png)

Milky Way Background displays a five-color harmonic light field throughout Codex. Chinese/English secondary settings panels independently control the five colors, flow speed, wave amplitude, frequency, scale, rotation, brightness, and introduction animation. It uses single-stage WebGL rendering, stops drawing while hidden, and supports pause, replay, and reduced motion. Activation selects dark appearance and deactivation restores the prior setting. The supplied effect project was reconstructed from partial reference snippets of Almina (@Code4_11)'s “Milky way.”

![Layered Mountain Background](docs/screenshots/layered-mountain-background.png)

Layered Mountain Background shows animated layered mountains, warm backlighting, and mist throughout Codex. Chinese/English controls cover reverse drift, mountain shape, exposure, render scale, quality, pause, and reset. A soft introduction of about three seconds reveals mountains from far to near; it supports replay and is skipped in reduced-motion mode. It uses two-stage WebGL 2 rendering and a compact ridge atlas, selects dark appearance when enabled, and restores the prior setting when disabled.

![Cloud Train Background](docs/screenshots/cloud-train-background.png)

Cloud Train Background shows a sea of clouds, a steam train, and a bridge throughout Codex. The right-side Chinese/English panel controls travel speed, scale, cloud detail, trails, hue, color temperature, and sky/smoke/train tint, plus pause and reset. The introduction fades layers into their original positions from far to near, with enablement, duration (0.5–10 seconds), feather width, and replay controls. It defaults to three seconds and is skipped for reduced motion. Activation uses native dark appearance; deactivation restores the previous setting.

#### Pixel Sculpt Background

![Pixel Sculpt Background](docs/screenshots/pixel-sculpt-background.png)

Enable it in Preview Market to turn images into an interactive three-dimensional pixel relief. The right-side Chinese/English secondary panel controls pixel shape, relief depth, mouse ripples, color, position, and rotation. It supports a local image library, ordering, and automatic morph transitions. Enabling switches native appearance to dark; disabling restores the previous setting.

#### Blinking Squares Background

![Blinking Squares Background](docs/screenshots/blinking-squares-background.png)

Blinking Squares Background fills Codex with independently blinking squares that become denser from a selected edge. Chinese/English settings control direction, density, blinking, color, mouse trails, click pulses, the maximum number of random keyboard ripples and cooldown at that limit, introduction animation, and quality. Pause and replay are supported. Activation selects dark appearance; deactivation restores the previous setting.

### Tools plugins

Git History is in Tools and shows the current branch and commits read-only. Open a commit to see changed files; clicking a filename opens a diff tab in the main conversation area with green additions, red deletions, and purple hunk-location information.

## Repository structure

```text
crates/
  cdp-client/          Chrome DevTools Protocol client
  context-resolver/    Codex task / workspace context resolution
  launcher/            Windows launcher and Codex integration
  workspace-service/   File listing, preview, modification, settings, watchers

packages/
  explorer-ui/         Injected TypeScript explorer UI

installer/src/         Install/uninstall source templates and shared fragments (generate standalone workers)
resources/             Bridge, language domains, plugin source definitions, immutable distribution locks, managed-asset contracts
scripts/               Build and packaging helpers
releases/              Generated downloadable installers
```

## Notes

If original Codex is already open when launching through Code-Codex, a prompt asks whether to close and reopen it through Code-Codex, warning that running tasks and unsaved work may be interrupted. “Automatically do this in future” can be selected. Canceling or closing the dialog preserves the current session; a normal-exit timeout does not force termination. See [startup conflict recovery](docs/startup-conflict-recovery.md) for authorization revocation and verification limits.

The top **Code-Codex** menu includes “Start Code-Codex when signing in to Windows,” off by default and reversible at any time. It registers only the current user's Code-Codex startup entry, does not modify original Codex autostart, and does not automatically authorize closing original Codex. Upgrades preserve the choice; uninstall removes the entry. See [login startup](docs/login-startup.md) for details and command-line cancellation.

Generated directories such as `target/`, `node_modules/`, `dist/`, and `artifacts/` are ignored by Git. The source includes Rust unit/integration tests, browser and PowerShell checks under `scripts`, and public contract checks in `.github/workflows/architecture.yml`. Native Windows windows, the official client, Office, and similar capabilities require separate acceptance checks in an appropriate environment.

## License

[MIT](LICENSE). See the [third-party notices](THIRD_PARTY_NOTICES_ZH_CN.md) for effect sources, modifications, and license boundaries; an [English notices document](THIRD_PARTY_NOTICES_EN.md) is also available.

During development, UI composition lives in `packages/explorer-ui/src/app/`; type contracts, basic lifecycle, domain controllers, plugin host, and shared components live in `contracts/`, `core/`, `features/`, `plugin-host/`, and `components/`, respectively. Root compatibility exports do not host new features. Independent plugins reuse verified assets according to `resources/plugin-definitions.json` and distribution locks. Updating the app does not automatically change independent plugin versions/tags. Actual plugin source changes require an explicit rebuild and byte-identity review.

Structure check: `node scripts/check-architecture.mjs`; contract tests: `node --test scripts/test-refactor-contracts.mjs scripts/test-plugin-publication.mjs`; native tests: `cargo test --workspace --locked`. For generated workers, run `node scripts/generate-installer.mjs` and `scripts/check-worker-protocol.ps1`; edit generated files through their source templates.

Startup-animation plugin sources also include ASCII Tiles Background and Custom Background; the latter reads only the currently selected image/video and its parameters. Market cards support pinning within a category from their upper-right corner; pin order is saved. The Pin graphic uses 50% opacity. Publish new assets with the exact tag specified in the catalog.
