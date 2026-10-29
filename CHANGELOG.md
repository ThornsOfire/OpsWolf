# Changelog

The useful stuff we've added, changed, fixed, or retired in this editor fork. The full implementation history is in [Git](https://github.com/ThornsOfire/code-codex/commits/feature/right-editor-pane); this file groups that work into changes you can actually skim.

We follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Everything below is **Unreleased**: development builds have been used locally, but we haven't published a versioned editor-fork release. The inherited 0.5.40 application version identifies the upstream baseline, not a release of these additions.

This initial record was reconstructed from the fork's commits and checked implementation through **2026-10-28**. Original project release notes remain in [releases/README.md](releases/README.md). Maintenance instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## [Unreleased]

### Added

- Paused chat reading keeps a visible text block anchored during streaming and earlier-content reflow in qualified native layouts. A Jump to latest action returns to native following; cached chats release their anchors. This candidate still needs live-host verification.

- Shared bubble tooltips for the file explorer’s Refresh, Collapse, Hide, and collapsed-strip expand controls, with keyboard focus, Escape dismissal, theme colors, and viewport-aware positioning.
- A single middle-page strip on qualified native shells, with pinned Chat, native page selection/close proxies, wheel scrolling and an overflow dropdown. Chat and the selected native page use the middle area one at a time instead of competing across an internal divider; native action handlers and sessions stay intact.
- A local file/preview/PDF action to open or move eligible native tabs into the editor through normal workspace reads. The source stays open on cancellation, save/read failure, unsupported previews, or exposed native editing state; no native draft is silently discarded.
- Markdown Preview link navigation with destination/action tooltips. In-project file links open normal editor tabs with existing save/switch protection; heading links stay in the document. Website and supported app-URI handoffs require confirmation, with unchecked per-origin/per-protocol remember choices, Shift-click review, and warning-reset controls. Existing renderer protocol restrictions remain enforced; this adds no shell/process runner.
- Source-text citations across supported text formats: select and right-click to cite in chat, copy a reference, or group ranges across files. Full-path links reopen normal editor tabs with highlights, unique quote relocation, and explicit missing/ambiguous results. Existing chat drafts and normal save/switch protection are preserved; citations never submit a message. The draft composer and hover tooltips can still expose the full encoded URL; compact presentation is not implemented. See [citation status](docs/editor/citations.md).
- A resizable right editor pane beside chat, with a dedicated fullscreen/restore control. The header's **E** button opens or hides it, including when no file is open. Layout and pane width stay local. ([pane](https://github.com/ThornsOfire/code-codex/commit/4438a34), [visibility controls](https://github.com/ThornsOfire/code-codex/commit/64bc327))
- Tab-strip mouse-wheel scrolling, drag-and-drop ordering, an open-files dropdown, up to 64 open tabs, and up to 32 project-specific file pins. Pins restore relative paths and their order for the same project root. ([tabs and pins](https://github.com/ThornsOfire/code-codex/commit/02a0d76))
- **Preview / Edit / Save** and Ctrl+S for supported complete text files up to 512 KiB. Markdown editing uses source text; switching to preview keeps an unsaved draft available. ([editing](https://github.com/ThornsOfire/code-codex/commit/0cacc01), [Markdown source](https://github.com/ThornsOfire/code-codex/commit/1be0110))
- Complete text-file reads up to 10 MiB. Larger-than-inline files default to a virtual plain-text reader; large Markdown files offer explicit full rendering, tables included. ([complete reads](https://github.com/ThornsOfire/code-codex/commit/0cacc01))
- Persistent word wrap with logical source-line numbers and preserved draft/selection. ([wrap](https://github.com/ThornsOfire/code-codex/commit/27fe382), [wrapped gutter](https://github.com/ThornsOfire/code-codex/commit/730027e))
- Save-and-close, save-all-and-close, save-and-switch, discard, and cancel choices. Failed saves leave the draft and dependent close/switch intact. ([close dialogs](https://github.com/ThornsOfire/code-codex/commit/5652937), [switching](https://github.com/ThornsOfire/code-codex/commit/730027e))
- Full local paths in the explorer-to-chat drag payload, so the agent can find the file you're pointing at. ([file paths](https://github.com/ThornsOfire/code-codex/commit/0d4d965))
- A persistent **Native changes** panel above the composer, using native patch records for eligible project files, including ordinary files outside Git. It keeps recent useful reviews, starts individual file diffs collapsed, and forwards Undo/Reapply to matching native controls when available. Shell/manual edits aren't guaranteed coverage. ([native reviews](https://github.com/ThornsOfire/code-codex/commit/2c8642e), [file dropdowns](https://github.com/ThornsOfire/code-codex/commit/083840b))
- Codex's actual native comparison viewer as an editor **Changes** tab. The live files-changed bubble and hover-file list keep native selection and comparison controls, alongside ordinary editable file tabs. ([native viewer](https://github.com/ThornsOfire/code-codex/commit/edcc52f))
- **Open file** on individual recorded diffs: open the current source with its available Preview/Edit/Save controls while keeping the historical patch in its own tab. Combined and deleted-file comparisons have no source action. ([open source](https://github.com/ThornsOfire/code-codex/commit/0f0c906))
- English fork documentation covering setup, controls, architecture, storage, checks and tracker cleanup, with the inherited Chinese overview preserved and upstream credit retained. ([documentation](https://github.com/ThornsOfire/code-codex/commit/2954c44))
- This curated changelog, repository workflow rules, contributor guidance, and a read-only changelog check for future changes.

### Changed

- Shared bubble tooltips now cover the header E and editor controls, including dynamic wrap/fullscreen actions, file-tab controls and Preview/Edit/Save. Each surface supplies its own colors; native comparison controls and document-link tooltips stay with their existing owners.
- The collapsed docked file explorer uses an 18-pixel expand strip instead of 40 pixels, leaving more space for chat while keeping the full-height expand button.
- Hiding the editor with E, or returning through its chat tab/Escape, exits fullscreen. E then reopens the editor docked beside chat at its saved width, keeping open files and session drafts. Cancelled switches leave the current layout intact.
- **E** controls editor visibility; the separate fullscreen button controls layout. Hiding the editor keeps its open tabs and running-session draft. ([controls](https://github.com/ThornsOfire/code-codex/commit/64bc327))
- The editor row's X closes unpinned tabs. Individual pinned-tab closes ask first and retain the pin for next session; Unpin removes the pin without closing the file. ([close behavior](https://github.com/ThornsOfire/code-codex/commit/730027e))
- Chat/native-tab headers are compact, with slimmer editor tab and file-control rows. ([compact headers](https://github.com/ThornsOfire/code-codex/commit/1af10db))
- The native Codex sidebar waits for your first chat selection before collapsing once per launch. Startup, project browsing and automatic chat restoration leave its native state alone. Manually toggling it opts out of further automatic collapse; the explorer has independent controls. ([initial sidebar behavior](https://github.com/ThornsOfire/code-codex/commit/52eeb34))

### Fixed

- Embedded browser pages now follow editor/explorer divider movement even when their size stays unchanged. Qualified browser inner frames fit the available pane width, and geometry changes notify the native resize handler instead of leaving the webpage frozen behind its toolbar.
- Native browser/file panes respect the editor's reserved width instead of overlapping its documents and resize handle. In the qualified shell layout, the native tab bar and right-aligned controls share that boundary, and the docked editor divider extends through the tab-header band. Hiding or expanding the editor restores native sizing.
- Edit-to-Preview now uses the current unsaved source text immediately, without requiring an application rerender to refresh the editor's draft snapshot.
- Resizing the editor with native Changes open no longer hits Codex's competing top-layer workspace divider. The hosted comparison leaves room for the editor handle, restores the native divider on release, and keeps its internal file-list divider. Drag widths and chat-space limits now use layout units so zoomed drags track the pointer accurately.
- The editor's word-wrap control now drives Codex's native Word wrap handler while a Changes tab is active, and reflects changes made through the native control. Unknown native controls disable the custom action instead of showing a wrap state that doesn't affect the comparison.
- Wrapped source-line numbers stay aligned at application UI zoom levels such as 120%, in both Edit and read-only source views. Gutter measurements compare heights in the same CSS units and retain fractional content widths at wrap boundaries.
- Replacing an editor before deferred cleanup finishes can no longer preserve the old editor's hidden-chat attributes or width reservations as native defaults. Restore/E release the chat correctly, and the replacement keeps its header controls.
- Editor controls overlapping native controls or blocking tab-switch/close targets in docked and expanded layouts. ([hit targets](https://github.com/ThornsOfire/code-codex/commit/166efa2), [expanded layout](https://github.com/ThornsOfire/code-codex/commit/ae2ecc3))
- Partial text previews ending before the actual file did. Incomplete/oversized responses are rejected explicitly; syntax-highlighting budgets don't cut off the underlying source. ([complete documents](https://github.com/ThornsOfire/code-codex/commit/1931679), [source coverage](https://github.com/ThornsOfire/code-codex/commit/1f69d8d))
- Open-files dropdown toggle and Escape behavior. ([dropdown](https://github.com/ThornsOfire/code-codex/commit/917e657))
- File-explorer/editor startup failing when word wrap had been saved as enabled. ([startup](https://github.com/ThornsOfire/code-codex/commit/9615b80))
- Known same-chat native composer portals being treated as conflicting context around the Changes viewer. Conflicting chat IDs still fail closed. ([native context](https://github.com/ThornsOfire/code-codex/commit/edcc52f))
- Clicking a changes bubble or recorded review from a hidden conversation selecting the first old file instead of the requested comparison. The requested tab is now published before reopening the editor. ([reopening](https://github.com/ThornsOfire/code-codex/commit/ba3926d))
- The editor's top bar creeping downward when content/reader headers were measured as app chrome. Header reservations now use app-shell headers, with a restricted legacy fallback. ([header drift](https://github.com/ThornsOfire/code-codex/commit/ba3926d))

### Removed

- The first experimental workspace scanner, before/after snapshot archive, capture/chunk bridge routes, and custom snapshot diff generator. Native patch records replaced that design without a second permanent diff archive. See the [cleanup audit](docs/editor/tracker-cleanup.md) for evidence and coverage limits. ([backend replacement](https://github.com/ThornsOfire/code-codex/commit/1e17303), [renderer replacement](https://github.com/ThornsOfire/code-codex/commit/2c8642e))
- The temporary live-popup filename-matching adapter. The native comparison host now preserves Codex's own exact file selection. ([replacement](https://github.com/ThornsOfire/code-codex/commit/edcc52f))

[Unreleased]: https://github.com/ThornsOfire/code-codex/compare/d607eeaf251f38e1a34a9069ad580ef918eaf260...feature/right-editor-pane
