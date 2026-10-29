# Changelog

The useful stuff we've added, changed, fixed, or retired in this editor fork. The full implementation history is in [Git](https://github.com/ThornsOfire/code-codex/commits/feature/right-editor-pane); this file groups that work into changes you can actually skim.

We follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Everything below is **Unreleased**: development builds have been used locally, but we haven't published a versioned editor-fork release. The inherited 0.5.40 application version identifies the upstream baseline, not a release of these additions.

This initial record was reconstructed from the fork's commits and checked implementation through **2026-10-28**. Original project release notes remain in [releases/README.md](releases/README.md). Maintenance instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## [Unreleased]

### Added

- Source-text citations across supported text formats: select and right-click to cite in chat, copy a reference, or group ranges across files. Full-path links reopen normal editor tabs with highlights, unique quote relocation, and explicit missing/ambiguous results. Existing chat drafts and normal save/switch protection are preserved; citations never submit a message.
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

- **E** controls editor visibility; the separate fullscreen button controls layout. Hiding the editor keeps its open tabs and running-session draft. ([controls](https://github.com/ThornsOfire/code-codex/commit/64bc327))
- The editor row's X closes unpinned tabs. Individual pinned-tab closes ask first and retain the pin for next session; Unpin removes the pin without closing the file. ([close behavior](https://github.com/ThornsOfire/code-codex/commit/730027e))
- Chat/native-tab headers are compact, with slimmer editor tab and file-control rows. ([compact headers](https://github.com/ThornsOfire/code-codex/commit/1af10db))
- The native Codex sidebar collapses once per launch. Manually reopening it keeps it open for that session; the explorer has independent controls. ([sidebar default](https://github.com/ThornsOfire/code-codex/commit/52eeb34))

### Fixed

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
