# Code-Codex — Editor Fork

Or, as we've started calling it: **Cursadex** ;3

I wanted a file tree on the left, chat in the middle, and an editor on the right where I could actually work on files. Then I wanted tabs, pins, word wrap, and somewhere useful to look at everything the agent changed.

So yeah, that escalated pretty quickly lol.

This is an experimental fork of [Rice-dog/code-codex](https://github.com/Rice-dog/code-codex). The original devs built the launcher, workspace bridge, file explorer, and plugin system that made this possible. We've been building an editor workflow on top of that foundation.

**The actual editor code lives on [`feature/right-editor-pane`](https://github.com/ThornsOfire/code-codex/tree/feature/right-editor-pane).** The GitHub homepage on `main` has this overview; the build commands below select the right branch for you.

This is an unofficial community project, independent of OpenAI and the original maintainers. It's a basic source editor inside Codex; language servers, autocomplete, and a debugger aren't part of it.

## What we've added so far

### An editor that lives beside the chat

- Files open in a resizable right editor pane, so you can keep talking to the agent while looking at your work.
- **E** in the chat header opens or hides the editor. Your files stay open. There's a separate fullscreen button when you want the extra room.
- The chat, native tab, editor tab, and file-control headers are more compact. They were taking up way too much vertical real estate haha.
- The native Codex sidebar starts collapsed once per launch. Open it yourself and it stays open for that session. The file explorer has its own controls.

### Actual file editing

- **Preview / Edit / Save**, plus **Ctrl+S**, for supported text files.
- Complete text-file loading up to **10 MiB**. No silently cutting your document off halfway through a table.
- Above **512 KiB**, files start in a virtual plain-text reader. Large Markdown files get a **Render Markdown** button if you want the whole formatted document, tables included.
- Editing currently supports files up to **512 KiB**. Markdown editing shows the source; the optional Markdown preview renders the formatting and tables.
- Word wrap keeps your draft and selection, with line numbers for the original source lines.
- Save-and-close, save-and-switch, discard, and cancel prompts. If saving fails, your draft stays available.
- Drag a file from the explorer into chat and it supplies the full local path, so the agent can find the thing you're talking about.

### Tabs, pins, and all the little things

- Mouse-wheel scrolling through crowded tabs, drag-and-drop ordering, and a dropdown listing every open file.
- Up to **64 open tabs** and **32 pinned files per project**.
- Pins reopen files when you return to that project. They save relative paths, not copies of the files or unsaved drafts.
- **Close all** leaves pinned tabs alone. Closing a pinned tab with its own X asks first and keeps the pin for next time.

### Seeing what the agent actually changed

There's a persistent **Native changes** panel just above the chat box. It keeps the latest useful review around, including while you're just chatting.

- Files start collapsed, with their own dropdowns. Skim the list, then expand what you want to read.
- Click a filename to open its recorded diff in the editor.
- Want to work on it? **Open file** takes you to the current source with its available Preview / Edit / Save controls. The recorded diff stays in its own tab.
- The native live **files changed** bubble opens Codex's actual comparison viewer in an editor **Changes** tab. Click a filename in its hover list and it selects that file in the same comparison.
- Native comparison controls still work. The extension positions the existing viewer without moving or cloning its React nodes.
- **Undo / Reapply** uses the matching native chat control when it's available.

The persistent panel reads native patch records, including eligible files outside Git repositories. It doesn't scan the workspace or keep extra on-disk before-and-after copies forever. Shell commands, manual edits, unavailable patches, and files outside the current project may be missing. It's a review aid, not a complete filesystem audit or backup.

## Getting it running

This is a development build for now. The existing installers in `releases/` and the upstream downloads shouldn't be treated as releases of our editor additions.

Build the native companion and the UI from this branch together. Putting the new UI on an old upstream binary won't give you the complete reader and review backend.

You'll need:

- Windows x64 and the official Codex/ChatGPT desktop app. The inherited runtime baseline is Windows 10 build 19041 or later.
- Node.js **20.19+** and npm.
- Current stable Rust with the MSVC toolchain, and Visual Studio Build Tools with Desktop C++ support.
- Git. MSI packaging also needs the .NET SDK.

```powershell
git clone --branch feature/right-editor-pane https://github.com/ThornsOfire/code-codex.git
Set-Location code-codex
.\scripts\build.ps1 -Configuration Release
```

That installs the locked UI dependencies, builds the UI, and compiles the Rust workspace. Executables go into `target/release/`; the UI bundle goes into `packages/explorer-ui/dist/explorer.js`.

Save your work, let any active Codex tasks finish, and exit Codex. Then launch the custom build:

```powershell
$uiBundle = (Resolve-Path .\packages\explorer-ui\dist\explorer.js).Path
.\target\release\code-codex-launcher.exe run --ui-bundle $uiBundle
```

Use that companion to launch this fork. The normal Codex shortcut won't load the custom bundle. I learned that one by opening the old shortcut and wondering why nothing changed lol.

You don't need my Desktop layout, an OpsWolf folder, or any particular project name. Those are local choices, not requirements baked into the source.

### Optional previews and appearance

The inherited **Preview Market** has optional Markdown, PDF, image, audio, video, CSV, diagram, notebook, Office, 3D, appearance, and Git History plugins. Install and enable the packages for the previews you want.

The update and plugin distribution endpoints currently still point upstream. The built-in updater follows upstream releases; it doesn't maintain this editor branch. Keep a copy of your fork build before applying an upstream update. A separate update workflow for the fork is still future work.

## Checking a change

For the full walkthrough, see the [editor guide](docs/editor/README.md), [architecture and data lifecycle](docs/editor/architecture.md), [development guide](docs/editor/development.md), and [first-tracker cleanup audit](docs/editor/tracker-cleanup.md).

```powershell
npm --prefix packages/explorer-ui ci
npm --prefix packages/explorer-ui run typecheck
npm --prefix packages/explorer-ui run build
node scripts/test-editor-pane.mjs
node scripts/test-native-sidebar.mjs
node scripts/test-change-review.mjs
node scripts/test-native-diff-host.mjs
node scripts/test-diff-source.mjs
cargo test -p workspace-service --locked -- --test-threads=1
cargo test -p cdp-client --locked -- --test-threads=1
cargo test -p context-resolver --locked -- --test-threads=1
```

The browser checks use isolated Chrome fixtures with synthetic data. They expect Chrome in its default Windows installation location and don't need your real documents or live chats. The native comparison layout checks cover 1080p, 4K, zoom, fullscreen, resizing, and tab switching.

## A few things to know

This hooks into the native desktop layout, so Codex updates can break parts of the integration. Some adapters target the inspected English UI. If the comparison layout isn't recognized, its viewer stays in the native location.

Project pins and UI preferences stay local. Native chat history is the source of recorded patches; we don't add a separate permanent diff archive. **Open file** loads the current file, which might have changed since that patch was recorded. Deleted-file and combined comparisons don't get a source-file button.

The context meter, selection-to-chat citations, richer Markdown table editing, configurable branding, and a fork-specific update workflow are on the wishlist. They aren't shipped features yet.

## Credit and contributing

Big credit to [Rice-dog and the Code-Codex contributors](https://github.com/Rice-dog/code-codex). They built the foundation here. This fork is our take on the editing workflow, maintained independently.

The [inherited Chinese overview](README.zh-CN.md) is preserved for reference. This README describes what the fork currently does.

If something breaks in our additions, bring it to this fork's maintainer with your Codex version, what you clicked, what happened, and what you expected. A small example helps a ton. Leave private client documents, credentials, and chat contents out of the report.

Contributions are welcome. Keep paths portable, explain the behavior you're changing, and include how you checked it. If we offer anything upstream, we'll discuss the bigger design with the original maintainers and keep the proposed changes manageable.

Licensed under [MIT](LICENSE). Original copyright notices and third-party notices are retained. See [third-party notices](THIRD_PARTY_NOTICES_EN.md) for dependency attribution.
