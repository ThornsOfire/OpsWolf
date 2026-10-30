# OpsWolf

Formerly **Cursadex**. An experimental Codex Desktop editor fork with a file explorer, editing beside chat, source citations, and native diff review. ;3

**Developer alpha — `0.1.0-alpha.1` (build from source).** There is no ready-to-run OpsWolf installer or portable ZIP yet. Setup requires the official Codex desktop app plus the development tools listed in [Getting it running](#getting-it-running). Fresh-machine installation has not been validated yet; a clean Windows VM test is planned. Known limitations and the tested local baseline are documented below.

I wanted a file tree on the left, chat in the middle, and an editor on the right where I could actually work on files. Then I wanted tabs, pins, word wrap, and somewhere useful to look at everything the agent changed.

So yeah, that escalated pretty quickly lol.

Want to see how we got here? The [changelog](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/CHANGELOG.md) tracks the notable changes, and [contributing guide](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/CONTRIBUTING.md) explains how we keep it up to date.

This is an experimental fork of [Rice-dog/code-codex](https://github.com/Rice-dog/code-codex). The original devs built the launcher, workspace bridge, file explorer, and plugin system that made this possible. We've been building an editor workflow on top of that foundation.

**Alpha source branch: [`candidate/planned-development`](https://github.com/ThornsOfire/OpsWolf/tree/candidate/planned-development).** Use that branch for this checkpoint. The older [`feature/right-editor-pane`](https://github.com/ThornsOfire/OpsWolf/tree/feature/right-editor-pane) branch is a historical baseline; `main` carries the homepage overview. Source publication, local deployment and a downloadable release are separate steps.

This is an unofficial community project, independent of OpenAI and the original maintainers. It's a basic source editor inside Codex; language servers, autocomplete, and a debugger aren't part of it.

## Take a look

![OpsWolf explorer, sample conversation and editable Markdown source beside each other](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/33d28895d624ab09f1af83cb4ed9fe0f17a45268/docs/images/editor-demo.png)

*OpsWolf dev.9 production explorer/editor components in the repository's synthetic browser demo. The sample draft and conversation are disposable; this is not a native Codex screenshot. [Capture details](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/images/README.md).*

![OpsWolf default settings with the wolf logo and shared preferences](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/33d28895d624ab09f1af83cb4ed9fe0f17a45268/docs/images/settings-demo.png)

*The real settings panel with disposable default preferences. Personal profiles keep their own names and artwork.*

## What we've added so far

The local development candidate also includes an optional Code Rain background with its own motion, color, preset and transition controls. It uses the normal verified plugin system; no published Rain download is available yet. See the [integration guide and verification limits](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/code-rain-integration.md).

The footer identifies the OpsWolf development version separately from the upstream version. Our [versioning guide](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/versioning.md) explains build handoffs and release rules. This is still an unreleased development fork. Live testing confirms activity following and scroll-to-pause; automatic activity expansion currently has a known compatibility failure. See [reading/activity coverage](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/chat-reading.md).

The current owner-used baseline is **OpsWolf 0.1.0-dev.9**, alongside upstream **0.5.40**, with Rain plugin **0.1.2**. Header spacing, product-menu alignment and explicit read-only text warnings passed the owner's checklist. Rain generally looks smoother, but preset blending can still drop frames, and cross-theme transparency remains open. See [current limitations](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/known-issues.md). No downloadable OpsWolf release is implied.

Dev.7 includes the **OpsWolf** visible rebrand alongside the earlier empty-editor Rain repair and corrected repository link. The repository URL, technical filenames and compatibility keys retain their existing names; changing the product label does not migrate your settings or replace personal profiles. Dev.8 addresses the reported header overlap and stacked logo with owner acceptance for those cases. The synthetic README screenshots were refreshed after dev.9 acceptance; their capture setup and limits are documented.

### Shared settings

Open **OpsWolf → OpsWolf settings…** for typing speed, source wrap, minimap, first-chat sidebar collapse and the optional Nova restore button. Personal identity profiles customize our owned menu/settings name, PNG logo and badge colors for the next launch; Windows and Discord identity are still separate work. See [settings](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/settings.md) and [identity limits](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/identity.md).

### An editor that lives beside the chat

- Files open in a resizable right editor pane, so you can keep talking to the agent while looking at your work.
- Plain local-file links in chat open there too, including Codex's file-reference buttons. Files must be inside the current project; normal save/cancel protection still applies.
- **E** in the chat header opens or hides the editor. Hiding exits fullscreen, so reopening puts it beside chat at your saved width. Your files and session draft stay available. There's a separate fullscreen button when you want the extra room.
- The chat, native tab, editor tab, and file-control headers are more compact. They were taking up way too much vertical real estate haha.
- The native Codex sidebar waits until you choose your first chat before collapsing once per launch. Browse projects first, then get the space back. Manually reopening it stays respected. The file explorer has its own controls.

### Actual file editing

- **Preview / Edit / Save**, plus **Ctrl+S**, for supported text files.
- Complete text-file loading up to **10 MiB**. No silently cutting your document off halfway through a table.
- Above **512 KiB**, files start in a virtual plain-text reader. Large Markdown files get a **Render Markdown** button if you want the whole formatted document, tables included.
- Editing currently supports files up to **512 KiB**. Markdown editing shows the source; the optional Markdown preview renders the formatting and tables.
- Word wrap keeps your draft and selection, with line numbers for the original source lines.
- Save-and-close, save-and-switch, discard, and cancel prompts. If saving fails, your draft stays available.
- Drag a file from the explorer into chat and it supplies the full local path, so the agent can find the thing you're talking about.
- Markdown Preview links open project files in the editor or ask before an external website/app handoff. Hover for the destination and action; remembered choices are scoped and resettable. See [link navigation and warnings](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/links.md).

### Pointing chat at the actual lines

- Select source text, right-click, and **Cite in chat**, **Copy citation**, or **Add to citation group**. This works across supported text formats, not just Markdown.
- Combine up to **32 ranges** within or across files. Links from you or the agent reopen the source in the editor with line highlights.
- References include bounded quotes so unique matching text can be relocated when lines move. Missing or ambiguous matches are reported; unsaved-draft references are labelled.
- The core has been tested both ways in the live app. The composer still shows the raw Markdown/encoded URL before sending, and hover tooltips can expose that URL. Compact chips and readable tooltips are still on the polish list haha. See [citation status and remaining work](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/citations.md).

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

Build this alpha from its source branch:

```powershell
git clone --branch candidate/planned-development https://github.com/ThornsOfire/OpsWolf.git
Set-Location OpsWolf
.\scripts\build.ps1 -Configuration Release
```

That installs the locked UI dependencies, builds the UI, and compiles the Rust workspace. Executables go into `target/release/`; the UI bundle goes into `packages/explorer-ui/dist/explorer.js`.

Save your work, let any active Codex tasks finish, and exit Codex. Then launch the custom build:

```powershell
$uiBundle = (Resolve-Path .\packages\explorer-ui\dist\explorer.js).Path
.\target\release\code-codex-launcher.exe run --ui-bundle $uiBundle
```

Use that companion to launch this fork. The normal Codex shortcut won't load the custom bundle. I learned that one by opening the old shortcut and wondering why nothing changed lol.

OpsWolf is the product name now; you still don't need my Desktop layout, a folder named OpsWolf, or any particular project name. Those are local choices, not requirements baked into the source. The GitHub repository has also been renamed to `ThornsOfire/OpsWolf`; the clone commands above use its canonical URL and default clone directory. Choosing another local directory is fine.

### Optional previews and appearance

The inherited **Preview Market** has optional Markdown, PDF, image, audio, video, CSV, diagram, notebook, Office, 3D, appearance, and Git History plugins. Install and enable the packages for the previews you want.

The update and plugin distribution endpoints currently still point upstream. The built-in updater follows upstream releases; it doesn't maintain this editor branch. Keep a copy of your fork build before applying an upstream update. A separate update workflow for the fork is still future work.

## Checking a change

For the full walkthrough, see the [editor guide](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/README.md), [architecture and data lifecycle](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/architecture.md), [development guide](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/development.md), and [first-tracker cleanup audit](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/docs/editor/tracker-cleanup.md).

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

The context meter, compact citation chips/readable hover tooltips, broader editable-format support, richer Markdown table editing, Windows/Discord identity customization, direct active-theme settings in the explorer header, and a fork-specific update workflow remain future work. Source-text citation routing and owned identity profiles exist; their deeper integrations are separate. We'll document preview, editing, and saving support separately for additional formats.

## Credit and contributing

Big credit to [Rice-dog and the Code-Codex contributors](https://github.com/Rice-dog/code-codex). They built the foundation here. This fork is our take on the editing workflow, maintained independently.

The [inherited Chinese overview](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/README.zh-CN.md) and its [English translation](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/README.upstream.en.md) are preserved for reference. Those describe upstream behavior and downloads; this README describes the fork.

If something breaks in our additions, bring it to this fork's maintainer with your Codex version, what you clicked, what happened, and what you expected. A small example helps a ton. Leave private client documents, credentials, and chat contents out of the report.

Contributions are welcome. Keep paths portable, explain the behavior you're changing, and include how you checked it. If we offer anything upstream, we'll discuss the bigger design with the original maintainers and keep the proposed changes manageable.

Licensed under [MIT](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/LICENSE). Original copyright notices and third-party notices are retained. See [third-party notices](https://github.com/ThornsOfire/OpsWolf/blob/candidate/planned-development/THIRD_PARTY_NOTICES_EN.md) for dependency attribution.
