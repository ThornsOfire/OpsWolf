# OpsWolf

OpsWolf adds a file explorer, an editor and a place to review changes beside your Codex chat. Keep the conversation going while you read, edit and check the actual files.

Built on [Code-Codex](https://github.com/Rice-dog/code-codex), maintained independently. This is an unofficial community project, with no affiliation to OpenAI.

## From a human to a human

**Looking for the code?** Use [the development source](https://github.com/ThornsOfire/OpsWolf/tree/candidate/planned-development). This homepage branch carries the project overview.

I wanted a file tree on the left, chat in the middle, and somewhere on the right where I could actually work on files. Then came tabs, pins, word wrap, citations and a better way to see what the agent had changed.

So yeah, that escalated pretty quickly lol.

**This is still a developer alpha. There isn't a ready-to-download OpsWolf installer yet.** If you're looking for a download button and a normal setup wizard, we're not there. You'll need Windows, the official Codex desktop app and some development tools, or an agent to walk you through the source setup below. A fresh-machine installation hasn't been verified yet.

### Read it, then work on it

Open a file from the explorer and it appears beside chat. **Preview** is for reading; **Edit** lets you change supported text files. **Save**, or **Ctrl+S**, writes the file. Markdown Preview can show headings, links and tables; Edit shows the source that makes them.

![Rendered Markdown and its table beside the conversation](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/images/editor-preview-demo.png)

*Preview: the real explorer, editor and Markdown plugin with a disposable sample file. The surrounding chat is a demo, not a native Codex conversation.*

![The same Markdown sample in Edit with word wrap and source line numbers](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/images/editor-edit-demo.png)

*Edit: the same file as source text, with word wrap and line numbers. No personal files or chats are loaded in this demo.*

The **E** button opens or hides the editor. Drag its left edge to resize it, or use its fullscreen button when you want more room. Hiding a fullscreen editor resets it, so the next E puts it beside chat again.

Tabs can scroll with your mouse wheel, move by dragging, and appear in an open-files dropdown. Pin files to reopen them for that project. **Close all** leaves pins alone, and unsaved edits get a save/discard/cancel choice. Pins remember files, not unsaved drafts.

### See what changed without losing the conversation

Click Codex's live **files changed** bubble and its comparison viewer opens in the editor's **Changes** tab. You keep Codex's review controls, with the comparison beside your chat. Clicking a file in the bubble's hover list takes you to that file's change.

![The native Codex Changes viewer hosted inside an OpsWolf editor tab](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/images/changes-native.png)

*The actual native Changes viewer in OpsWolf alpha.3, showing public screenshot-tool changes. Captured from the live app and cropped to the editor area so chats and the project list stay out of the image.*

There's also a persistent **Native changes** panel above the message box. It stays available after the live bubble has gone. Expand the file list, then open just the changes you want to read. **Open file** takes you from the recorded diff to the current file, where you can edit it.

![The persistent Native changes panel above chat, with a recorded diff open on the right](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/images/native-changes-demo.png)

*Production review controls with a sample patch and demo conversation. The panel above the message box and the recorded diff are separate from the native Changes viewer shown above.*

This uses Codex's recorded patches. It can include ordinary project files outside Git, but it won't catch every shell command or manual edit. It's a way to review work, not a backup or a complete activity log.

### The other little things that help

- **Point at the actual lines.** Select text and right-click to cite it in chat, copy a citation, or collect several ranges. Clicking a reference opens and highlights its source. It works across supported text formats.
- **Keep your reading position.** Scroll up to read without the feed constantly pulling you away. Sending your next message resumes following the conversation.
- **Find the right file.** File links in chat open in the editor when they're inside the current project. Dragging a file from the explorer into chat supplies its full location.
- **Make it comfortable.** Settings include source wrap, a minimap, an optional typing-speed counter and first-chat sidebar collapse. Our menu/settings name and logo can use your own saved identity profile; Windows identity aisn't changed by that (yet).
- **Add some atmosphere.** Optional preview plugins and backgrounds live in Preview Market. [Code Rain](https://github.com/ThornsOfire/OpsWolf-Code-Rain) adds configurable rain; [Nova Fox](https://github.com/ThornsOfire/nova-fox-companion) is a separate companion with optional OpsWolf integration.

Open **OpsWolf → OpsWolf settings…** for our preferences. Open **OpsWolf → Preview Market** for preview plugins and backgrounds. If you've chosen your own app label, look under that menu name instead.

![OpsWolf settings with the default wolf logo and shared preferences](https://raw.githubusercontent.com/ThornsOfire/OpsWolf/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/images/settings-demo.png)

*The production settings panel with disposable default preferences. This is a synthetic capture; your personal profiles keep their own name and artwork. [Screenshot details](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/images/README.md).*

### A few rough edges, because alpha means alpha

- Text reading goes up to **10 MiB**; editing currently stops at **512 KiB**. Bigger Markdown starts as plain text with an explicit full-render option. Files we can't edit show a red explanation. Mixed Windows/Unix line endings are one reason a file stays read-only.
- Citations work, but their long encoded links can still show in the message box and hover tooltip. The compact presentation is unfinished.
- Automatic expansion of the agent's activity details still fails in a reported native layout. Following the latest activity and pausing to read are separate features.
- Rain blending can drop frames, its blend options don't persist yet, and editor transparency isn't consistent across other themes. Saved Rain settings and previous-theme restoration work in the tested alpha.3 host setup.
- This is a basic source editor. Language servers, autocomplete, a debugger, a trustworthy context meter and broader editing support are future work.
- Codex updates can change the layout or integrations we depend on. Updates are **not frozen**. The inherited updater follows upstream Code-Codex; it does not maintain this fork. Keep a working build before applying updates.

See [known issues](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/known-issues.md) and the [user guide](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/README.md) for the details. No claim that every Codex version, theme or monitor setup works perfectly.

<a id="getting-it-running"></a>

### Getting started today

There is no click-only installation path yet. Existing upstream installers and files in `releases/` aren't releases of these editor additions.

The current route is to build this fork's UI and matching native companion, close Codex after saving your work, then launch through that companion. Opening the normal Codex shortcut won't load the custom editor. The exact source commands are in the agent section below; you can give that section to your coding agent.

Your local folder can be anywhere sensible. It doesn't need our workspace layout or a particular project name. Preview plugins such as Markdown and PDF are separate packages. Enable the ones you want in Preview Market. A format having a preview doesn't mean it can be edited.

<a id="credit-and-contributing"></a>

### Credit, bugs and helping out

Big credit to [Rice-dog and the Code-Codex contributors](https://github.com/Rice-dog/code-codex). They built the launcher, workspace bridge, explorer and plugin foundation that made this possible.

If something breaks in our additions, report it to this fork with your versions, what you clicked, what happened and what you expected. A small sample helps a ton. Keep private documents, keys and chats out of public reports.

[Changelog](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/CHANGELOG.md) · [Contributing](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/CONTRIBUTING.md) · [MIT license](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/LICENSE) · [Third-party notices](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/THIRD_PARTY_NOTICES_EN.md)

## For agents, from an agent

<details>
<summary>Source, setup, interfaces and validation</summary>

### Identity and scope

| Item | Contract |
| --- | --- |
| Implementation | `candidate/planned-development`; [source branch](https://github.com/ThornsOfire/OpsWolf/tree/candidate/planned-development). `main` is a documentation landing page; `feature/right-editor-pane` is the historical baseline. |
| Versions | Fork: `cursadex-version.json`, source checkpoint `0.1.0-alpha.3`. Upstream package/protocol `0.5.40`; Rain plugin `0.1.2`. Source, local handoff, activation and public release are separate identities. |
| Host qualification | Alpha.3 appearance repair passed owner startup, Enable/Disable, retained saved settings and previous-theme restoration on Windows Codex package `26.1027.3384.0`. Later restart retention is a follow-up; do not generalize to all hosts/themes. |
| Legacy naming | Formerly Cursadex. Preserve `cursadex-*` metadata, event/storage keys, CSS hooks and technical launch names. Branding changes do not authorize migrations or identifier refactors. |
| Portability | No maintainer Desktop layout, app-state paths, personal identity artwork or external workspace scripts required by a clone. No public installer/fresh-machine certification yet. |

### Build and launch

Requirements: Windows x64 (inherited baseline Windows 10 build 19041+), official Codex desktop host, Git, Node.js **20.19+**/npm, stable Rust MSVC and Visual Studio Desktop C++ Build Tools. Cargo declares Rust 1.85 minimum; use a compatible installed toolchain. MSI packaging additionally requires .NET SDK. Install/download prerequisites only with environment authorization.

```powershell
git clone --branch candidate/planned-development https://github.com/ThornsOfire/OpsWolf.git
Set-Location OpsWolf
.\scripts\build.ps1 -Configuration Release
```

`build.ps1`: installer/protocol generation and checks → `npm ci` + UI build → locked Cargo workspace build → local installer payload assembly. Native outputs: `target/release/`; bundle: `packages/explorer-ui/dist/explorer.js`. Upstream packaging assets are not published OpsWolf installers.

After saving work, completing active agents and closing Codex normally:

```powershell
$uiBundle = (Resolve-Path .\packages\explorer-ui\dist\explorer.js).Path
.\target\release\code-codex-launcher.exe run --ui-bundle $uiBundle
```

Pair UI/backend versions. This command uses mutable build outputs, not an immutable reviewed deployment. Do not kill the live host, relocate profiles or register hooks as a setup side effect.

### Runtime contracts

- Modules: UI `packages/explorer-ui/src/`; native workspace/transport/context under `crates/`. [Architecture](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/architecture.md), [editor ownership/data flow](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/architecture.md), [development/check matrix](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/development.md).
- File I/O: authenticated workspace bridge, current-project path/type/sensitive-file policy, complete content, loaded-version conflict checks. Inline/edit limit 512 KiB; complete read limit 10 MiB; larger text virtualized; large Markdown rendering explicit. Preserve dirty drafts/caret through view changes and save failure/cancel.
- Tabs: 64 open, 32 project pins; pins store normalized-root-relative paths/order, never draft contents. Recorded diffs read-only; **Open file** resolves current source through normal reader policy.
- Review: native patch history, not filesystem snapshots; no permanent duplicate diff archive. Native comparison remains owned by Codex, positioned through qualified adapters without cloning/reparenting React nodes. Unknown layouts retain native behavior; English/observed-layout limits apply.
- Citations: supported text, up to 32 grouped ranges, bounded quotes and explicit draft markers. [Routing/presentation limits](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/citations.md). No compact composer chips claimed.
- Preferences/identity local to renderer storage. [Settings](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/settings.md), [identity/restart scope](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/identity.md), [link permissions/reset](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/links.md). No Windows/Discord identity claim; profiles, chat/auth and documents remain separate.
- Rain: [integration/pins/provenance](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/code-rain-integration.md). Verified package cache/import; host controls enablement/settings/appearance lease, independent renderer controls work budgets. Guard uninspectable host exports, qualify unique same-origin capabilities, invoke RPC methods intrinsically. Missing capabilities fail explicitly; selected/off remains disableable. Blend-option persistence and manual updater controls are unimplemented.
- Project relinking: [metadata refresh](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/workspace-root-refresh.md); follows reported chat cwd, defers dirty drafts, explicit workspace override wins. Does not rename folders or refactor absolute source paths.

<a id="checking-a-change"></a>

### Validation and handoff

```powershell
node scripts/check-version.mjs
npm --prefix packages/explorer-ui run typecheck
npm --prefix packages/explorer-ui run build
node scripts/check-architecture.mjs
node scripts/check-changelog.mjs
```

Use installed locked dependencies; fresh dependency setup is `npm --prefix packages/explorer-ui ci`. Choose behavior checks from [development](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/development.md). Editor/review boundaries: `test-editor-pane`, `test-change-review`, `test-native-diff-host`, `test-diff-source` (`node scripts/<name>.mjs`). Appearance repair: `test-appearance-adapter`, `test-rain-host-recovery`, `test-code-rain-runtime`. Browser fixtures use installed Chrome, disposable profiles and synthetic data; fixture passes are not native certification. Historical counts are evidence for their exact source, not checks rerun by a docs edit.

Native boundaries: `cargo test -p workspace-service --locked -- --test-threads=1`; repeat for `cdp-client` / `context-resolver` when relevant. [Versioning](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/versioning.md), [tracker removal audit](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/docs/editor/tracker-cleanup.md).

Follow [AGENTS.md](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/AGENTS.md) / [CONTRIBUTING.md](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/CONTRIBUTING.md). Scoped change → relevant checks → exact commit/snapshot → immutable SHA-256/size inventory + runtime/dependency evidence → coordinator review → owner activation → live acceptance/rollback. Never rewrite a sealed/running build. Keep profiles, keys, chats, client data and probes out of commits. Documentation editing does not authorize downloads, activation, publication or upstream-update changes.

Upstream [Chinese README](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/README.zh-CN.md) and [English translation](https://github.com/ThornsOfire/OpsWolf/blob/17a3494f5a241a223d560bba2c7e503d79e5ab6a/README.upstream.en.md) describe the inherited project, not guarantees about this fork. Preserve upstream copyright and third-party licenses.

</details>
