# Changelog

The useful stuff we've added, changed, fixed, or retired in this editor fork. The full implementation history is in [Git](https://github.com/ThornsOfire/OpsWolf/commits/candidate/planned-development); this file groups that work into changes you can actually skim.

We follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Everything below is **Unreleased**: development builds have been used locally, but we haven't published a versioned editor-fork release. The upstream application version identifies the inherited base, not a release of these additions.

This initial record was reconstructed from the fork's commits and checked implementation through **2026-10-28**. Original project release notes remain in [releases/README.md](releases/README.md). Maintenance instructions are in [CONTRIBUTING.md](CONTRIBUTING.md).

## [Unreleased]

### Added

- An offline startup-status helper summarizes one explicitly selected runtime log when the OpsWolf menu is unavailable. See the [startup status guide](docs/startup-status.md).

- Background settings in the explorer header opens active Rain directly, with the existing panel, draft and Save controls. Other identified supported backgrounds open their existing Preview Market card; unknown, unverified custom or multiple states use an honest browse context. Keyboard/Close/Escape focus returns to the visible opener, and direct Rain settings stay open while resizing.

- Rain blend status shows both captured endpoints, current direction and honest custom/finished/stopped states. Inactive-window/manual pause feedback stays visible, including outside an active blend; Save still stores the current appearance only.

- Qualified native middle tabs show the actual chat title, with compact ellipsis and the complete name in hover/accessibility/dropdown text. Title changes keep navigation and focus stable; ambiguous structures retain native presentation.

- Code Rain can show through the qualified active embedded messaging surface used by Dot when its existing canvas shares that document. Only qualified chat backings are cleared; the main mask, native avatar/message/composer controls and input remain native. Disabled Rain, forced colors, reduced transparency and unknown/inactive layouts retain their original appearance. No extra renderer or native-window opacity hook is added.

- Update review beside footer versions shows upstream availability, check time and validated release/installer identity when available. The native companion blocks upstream setup before download or launch because it can replace OpsWolf; fork deployment still requires a separately reviewed exact build and rollback. Official Codex/Store and external plugin updates are explicitly outside this control.

- Explorer footer identifies the attached Codex host package separately from OpsWolf and upstream Code-Codex, with an explicit unavailable state. Preview Market is accessed through the top application menu instead of a duplicate footer button.

- Code Rain pauses animation and blends while its window is inactive by default, with a Save-controlled opt-out. Returning focus preserves manual Pause; older saved settings default to this behavior.

- Optional Nova Fox Companion restore-logo button in the explorer header, visible by default for fresh preferences; existing saved/legacy preferences and explicit disable remain respected. It opens only Nova’s fixed registered app link after confirmation; Nova remains a separate optional application. The control is integrated in the current host; Nova's separate restore-link failure remains documented in its known issues.

- Separate Cursadex development version in the explorer footer alongside the inherited upstream version. Fork identity starts at `0.1.0-dev.1` in `cursadex-version.json`; the upstream update action, package/plugin versions and protocol identities remain separate. See the [versioning workflow](docs/editor/versioning.md).

- Recognized running activity has a fixture-tested adapter to open available native tool disclosures and follow new entries through the shared reading controller. Owner testing confirms following and scroll-to-pause, but automatic disclosure expansion failed in the owner-tested host. A later source repair covers composer replacement; the original live report still awaits acceptance. Manual collapse and native completion remain owned by Codex; unknown/localized layouts stay native.

- Personal identity profiles in the owned settings panel: local PNG logo, display name and name-badge colors, with draft preview, explicit next-launch save, default/reset and up to eight personal profiles. Saved changes leave the current renderer identity intact. Windows names/icons, shortcuts and Discord identity remain unchanged; see the [scope matrix](docs/editor/identity.md).

- Optional Code Rain background candidate, built from pinned MIT-licensed OpsWolf Code Rain sources through the verified plugin system. Its settings include colors, glyphs, motion, presets, pause and timed/looped blends; only explicit Save persists the rain settings. Native appearance changes stop the effect, disabling restores its prior theme lease, and hidden/reduced-motion/high-contrast behavior limits animation. Startup selection includes Rain. Package import and browser integration are locally tested; the owner uses Rain in the current host with accepted opacity cases. Blend smoothness, cross-theme compatibility and publication remain pending.

- Shared tree/editor/settings color roles, public `--cursadex-*` theme hooks and live inherited native colors, with light/dark fallbacks and system high-contrast colors. Explicit light appearance wins over a dark OS preference. The high-contrast source mirror retains geometry for wrapped line numbers; document paper and native viewer rendering stay separate. Arbitrary marketplace themes still need compatibility checks.

- Cursadex settings in the renamed application menu, with shared typing-speed, source-wrap, minimap and first-chat sidebar-collapse preferences. Existing wrap/minimap choices migrate without deleting old keys. Preference reset is separate from saved preview-link warning reset; storage failures remain usable for the session. Inherited Code-Codex tools and credit remain available.

- Recognized native Changes sections start collapsed and show session-only unread markers. Expanding a section or Clear all unread clears markers; subsequently observed native patch records mark files again. Reads pause while hidden, and unavailable updates are explicit. This tracks recorded patches rather than every filesystem edit.

- Recognized native Changes file headers offer an explicit Open file in editor action, using the full native path and normal preview/save guards while preserving the native Open in and File actions controls. External program selection remains native functionality, not a new launcher in this fork.

- Optional composer typing-speed readout with reset, two-second idle handling and gross five-character WPM. Tracking starts off; paste, undo and citation insertion are excluded. Only the on/off preference persists, and no typing history is recorded.

- Paused chat reading keeps a visible text block anchored during streaming and earlier-content reflow in qualified native layouts. A Jump to latest action returns to native following; cached chats release their anchors. This candidate still needs live-host verification.

- Shared bubble tooltips for the file explorer’s Refresh, Collapse, Hide, and collapsed-strip expand controls, with keyboard focus, Escape dismissal, theme colors, and viewport-aware positioning.
- A single middle-page strip on qualified native shells, with pinned Chat, native page selection/close proxies, wheel scrolling and an overflow dropdown. Chat and the selected native page use the middle area one at a time instead of competing across an internal divider; native action handlers and sessions stay intact.
- A local file/preview/PDF action to open or move eligible native tabs into the editor through normal workspace reads. The source stays open on cancellation, save/read failure, unsupported previews, or exposed native editing state; no native draft is silently discarded.
- Markdown Preview link navigation with destination/action tooltips. In-project file links open normal editor tabs with existing save/switch protection; heading links stay in the document. Website and supported app-URI handoffs require confirmation, with unchecked per-origin/per-protocol remember choices, Shift-click review, and warning-reset controls. Existing renderer protocol restrictions remain enforced; this adds no shell/process runner.
- Source-text citations across supported text formats: select and right-click to cite in chat, copy a reference, or group ranges across files. Full-path links reopen normal editor tabs with highlights, unique quote relocation, and explicit missing/ambiguous results. Existing chat drafts and normal save/switch protection are preserved; citations never submit a message. The draft composer and hover tooltips can still expose the full encoded URL; compact presentation is not implemented. See [citation status](docs/editor/citations.md).
- A resizable right editor pane beside chat, with a dedicated fullscreen/restore control. The header's **E** button opens or hides it, including when no file is open. Layout and pane width stay local. ([pane](https://github.com/ThornsOfire/OpsWolf/commit/4438a34), [visibility controls](https://github.com/ThornsOfire/OpsWolf/commit/64bc327))
- Tab-strip mouse-wheel scrolling, drag-and-drop ordering, an open-files dropdown, up to 64 open tabs, and up to 32 project-specific file pins. Pins restore relative paths and their order for the same project root. ([tabs and pins](https://github.com/ThornsOfire/OpsWolf/commit/02a0d76))
- **Preview / Edit / Save** and Ctrl+S for supported complete text files up to 512 KiB. Markdown editing uses source text; switching to preview keeps an unsaved draft available. ([editing](https://github.com/ThornsOfire/OpsWolf/commit/0cacc01), [Markdown source](https://github.com/ThornsOfire/OpsWolf/commit/1be0110))
- Complete text-file reads up to 10 MiB. Larger-than-inline files default to a virtual plain-text reader; large Markdown files offer explicit full rendering, tables included. ([complete reads](https://github.com/ThornsOfire/OpsWolf/commit/0cacc01))
- Persistent word wrap with logical source-line numbers and preserved draft/selection. ([wrap](https://github.com/ThornsOfire/OpsWolf/commit/27fe382), [wrapped gutter](https://github.com/ThornsOfire/OpsWolf/commit/730027e))
- Save-and-close, save-all-and-close, save-and-switch, discard, and cancel choices. Failed saves leave the draft and dependent close/switch intact. ([close dialogs](https://github.com/ThornsOfire/OpsWolf/commit/5652937), [switching](https://github.com/ThornsOfire/OpsWolf/commit/730027e))
- Full local paths in the explorer-to-chat drag payload, so the agent can find the file you're pointing at. ([file paths](https://github.com/ThornsOfire/OpsWolf/commit/0d4d965))
- A persistent **Native changes** panel above the composer, using native patch records for eligible project files, including ordinary files outside Git. It keeps recent useful reviews, starts individual file diffs collapsed, and forwards Undo/Reapply to matching native controls when available. Shell/manual edits aren't guaranteed coverage. ([native reviews](https://github.com/ThornsOfire/OpsWolf/commit/2c8642e), [file dropdowns](https://github.com/ThornsOfire/OpsWolf/commit/083840b))
- Codex's actual native comparison viewer as an editor **Changes** tab. The live files-changed bubble and hover-file list keep native selection and comparison controls, alongside ordinary editable file tabs. ([native viewer](https://github.com/ThornsOfire/OpsWolf/commit/edcc52f))
- **Open file** on individual recorded diffs: open the current source with its available Preview/Edit/Save controls while keeping the historical patch in its own tab. Combined and deleted-file comparisons have no source action. ([open source](https://github.com/ThornsOfire/OpsWolf/commit/0f0c906))
- English fork documentation covering setup, controls, architecture, storage, checks and tracker cleanup, with the inherited Chinese overview preserved and upstream credit retained. ([documentation](https://github.com/ThornsOfire/OpsWolf/commit/2954c44))
- This curated changelog, repository workflow rules, contributor guidance, and a read-only changelog check for future changes.

### Changed

- Code Rain draws the background and startup effect in dedicated workers. Stop Blend and Save use the worker's confirmed settings.

- A different renderer build now waits for a fresh app session, preserving the existing document owner and unsaved drafts. Same-build reconnect remains supported. In-app Restart and its hidden worker entry are held until they can preserve the selected OpsWolf launcher and profile; use the reviewed launcher after closing normally.

- The alpha.14 source candidate integrates corrected upstream Code-Codex 0.6.0 while retaining the OpsWolf editor, native changes, citations, settings and Code Rain. Source, plugin and live-host qualification remain separate; see the [integration notes](docs/editor/upstream-integration.md). Upstream installer execution remains blocked in the fork.

- The first alpha source checkpoint is `0.1.0-alpha.1`, explicitly selected for publication preparation. Canonical repository links now use `ThornsOfire/OpsWolf`; compatibility keys and existing local installations retain their identities. Source publication is separate from an alpha installer, tag or deployment.

- The default product name and wolf logo are now OpsWolf in the owned application menu, settings and version footer. Shared branding defaults replace scattered visible name strings; personal identity profiles retain their saved names/logos. Existing settings keys, theme hooks, technical paths, upstream credit and historical deployment IDs remain compatible. Windows executable/taskbar and Discord identity are outside this display-only rebrand.

- The Cursadex menu's Open GitHub Repository link now opens the Cursadex fork repository.

- Shared bubble tooltips now cover the header E and editor controls, including dynamic wrap/fullscreen actions, file-tab controls and Preview/Edit/Save. Each surface supplies its own colors; native comparison controls and document-link tooltips stay with their existing owners.
- The collapsed docked file explorer uses an 18-pixel expand strip instead of 40 pixels, leaving more space for chat while keeping the full-height expand button.
- Hiding the editor with E, or returning through its chat tab/Escape, exits fullscreen. E then reopens the editor docked beside chat at its saved width, keeping open files and session drafts. Cancelled switches leave the current layout intact.
- **E** controls editor visibility; the separate fullscreen button controls layout. Hiding the editor keeps its open tabs and running-session draft. ([controls](https://github.com/ThornsOfire/OpsWolf/commit/64bc327))
- The editor row's X closes unpinned tabs. Individual pinned-tab closes ask first and retain the pin for next session; Unpin removes the pin without closing the file. ([close behavior](https://github.com/ThornsOfire/OpsWolf/commit/730027e))
- Chat/native-tab headers are compact, with slimmer editor tab and file-control rows. ([compact headers](https://github.com/ThornsOfire/OpsWolf/commit/1af10db))
- The native Codex sidebar waits for your first chat selection before collapsing once per launch. Startup, project browsing and automatic chat restoration leave its native state alone. Manually toggling it opts out of further automatic collapse; the explorer has independent controls. ([initial sidebar behavior](https://github.com/ThornsOfire/OpsWolf/commit/52eeb34))

### Fixed

- The explorer retries the initial workspace lookup when a new local chat appears before its folder metadata is ready.

- Code Rain can run on the Dark appearance already applied by Codex when automatic appearance control is unavailable. Choose Dark in Codex first, then Enable Rain. Rain leaves the native setting and any earlier restoration record intact. Its card explains when Dark is needed and when it is using the existing appearance.

- Code Rain waits for the window to finish applying a confirmed Dark setting. It no longer sends a duplicate request while the window catches up.

- Window and tab clicks outside the chat composer skip the send detector transcript scan. Composer clicks still use the current conversation and accepted-message checks.

- Code Rain releases the background controls if Codex never answers an appearance read during Enable or Disable. A late reply cannot resume the failed action. If the previous theme could not be restored, Code Rain keeps its restoration record so Disable can be retried.

- Running activity resolves the current qualified composer after native composer replacement, so new tool disclosures can still open without resetting manual-collapse choices, retired turns or paused reading. Native-host acceptance remains pending.

- Expanded file-tree drawers stay inside the qualified content area in narrow windows, including short windows and zoomed views. The native menu remains accessible; the collapsed arrow and saved panel width keep their existing behavior. Unknown layouts retain their previous fallback.

- The local deployment source inventory includes new Rust modules and integration tests, alongside tracked source, so a staged build retains the regression that qualified its transport repair.

- Oversized native Changes-history replies are rejected without stopping the shared App Server response reader, so later project-folder lookups can still complete. The four-MiB frame limit remains; no partial history is presented as complete. New requests after a closed response stream is detected fail promptly. Concurrent reads present when an uncorrelatable oversized frame is rejected may also need a manual retry.

- Settled Rain progress updates no longer replay unrelated background/settings and package-market controls. Rain feedback stays live; loading/download ownership and changed control state retain full refreshes. This reduces tested UI work without changing renderer quality, settings or claiming a native FPS/hitch fix.

- Following an accepted send or Jump to latest continues through ordinary visible response growth. Scrolling up still pauses reading; no background follow loop is added.

- A chat's explicitly closed editor stays closed during automatic pin restoration in the same window document. Explicit E/file actions reopen it; files, pins and drafts keep their existing ownership. Open/close intent is bounded session state, without restart or cross-window persistence.

- In supported narrow layouts, the collapsed explorer arrow sits on the content side of native navigation instead of covering part of Home. Pointer and keyboard controls retain native handlers; the wide strip is unchanged.

- Editor-divider dragging coalesces intermediate widths at the display frame, then flushes the final width before saving. Other pointers cannot finish the drag, and hiding, suspending, moving or disconnecting the pane cancels pending work. Keyboard resizing stays immediate. Native browser bounds updates retain their notifications without rebuilding unchanged explorer rows; the reported live hitch still needs verification.

- Accepted chat sends can resume following when native rendering reuses a message bubble with a new stable identity. Same-message rerenders, history loads and later user scrolling remain guarded. Rich-editor fixture coverage includes both message/composer commit orders; native-host acceptance remains pending.

- Qualified Dot chat transparency also clears its direct inner body pane, which previously remained solid after the outer wrappers became transparent. Native avatar/cards/composer, active-layout/media guards and Rain-off restoration retain their existing behavior.

- Saving an edited file reconciles delayed notifications for its own write instead of raising a false disk-change warning. Real external changes and failed verification keep the draft and its expected version; a conflict discovered during saving no longer makes a retry silently adopt the external version.

- Appearance discovery skips individual host functions that cannot be inspected, and invokes callable RPC methods through the intrinsic without looking up their synthesized `.call`/`.apply` properties. A whole-explorer regression covers persisted Rain selection, a prior theme lease, normal market clicks and repeated theme restoration. Alpha.2 failed owner testing on these host edge cases; replacement source remains subject to new live acceptance.

- Appearance discovery also recognizes the preloaded host shared module, so Rain and other dark backgrounds can find the existing RPC capability when the host omits separate appearance modules from preload/resource lists. Discovery validates same-origin role URLs, rejects ambiguity, avoids unrelated property getters and uses bounded startup retries. This is capability-based compatibility, not a guarantee for future Codex versions.
- Disable now deselects a saved background that failed to start instead of retrying activation. Rain distinguishes Running from Selected · Not running; a failed theme restoration retains its error and owned lease for a safe retry. Renderer/plugin pins and updater policy remain unchanged.

- Read-only text previews show a red warning in place of unavailable Preview/Edit controls, explaining mixed line endings, size limits or an unverified version. Hover or keyboard focus explains how to proceed; existing workspace save restrictions remain enforced.

- Qualified native tab headers reserve the measured end-control group separately from chat actions, and place New tab using its visible button bounds. E, chat actions, summary and tab controls stay distinct through Hide/Show tabs and hosted Changes layouts; native handlers and style restoration remain intact.

- The owned top-bar product menu keeps its logo beside the name when native button styles use a grid layout, preserving the native bar height, custom identity truncation and menu interaction.

- An empty editor with Code Rain enabled exposes the existing translucent main background instead of painting a solid placeholder. Text, accepted Changes/flyout opacity and system high-contrast presentation are preserved. The owner confirms transparency with Code Rain; compatibility with other themes remains open.

- Rain's 30 FPS limiter keeps a steady deadline instead of slipping to roughly 20–23 FPS at common refresh rates. Plugin 0.1.2 preserves visual settings and pause behavior; smoother playback can draw more frames and does not imply lower GPU cost.
- Rain covers the current collapsed-sidebar hover menu with a readable backing and clears the extra opaque layers inside hosted Changes. Expanded sidebar styling, diff highlights, sticky-header readability and forced-colors behavior are preserved.

- In qualified chat layouts, an accepted user send resumes following the latest conversation. Upward user scrolling pauses again; native layout movements do not establish a reading lock. Multiline/IME confirmation, blocked sends, older history and stale chats retain reading/draft state. This boundary is locally fixture-tested; live queued/delayed-send behavior remains to be verified.

- Code Rain settings constrain their complete panel to the app viewport at inherited zoom, keeping internal scrolling and Save reachable. Rain gives the collapsed native sidebar flyout a solid backing while preserving the expanded sidebar, clears the docked editor shell, and lets hosted Changes use its Rain backing with normal appearance restoration. The owner accepts the reported viewport/opacity cases; broader lifecycle, display and theme coverage remains limited.

- Plain local-file references in the active chat now open in the editor instead of a native middle tab. Recognizes Codex's file-reference buttons and ordinary absolute-file anchors inside the current project, including paths with spaces; preserves save/cancel/conflict handling and keyboard activation. Modified clicks, external destinations and unknown controls retain native behavior.

- The editor's conversation tab tracks the active native chat title while docked as well as expanded, including renames, replacement titles and cached-chat switches. Ambiguous native titles keep the generic label, and docking leaves the native title visible. Unrelated header controls do not trigger a title/layout feedback loop.

- Moving an existing chat into a different local project updates the explorer root after metadata revalidation, including empty destination folders. Resolutions no longer retain a process-lifetime cwd cache. Refresh and visible-chat background checks detect same-chat moves; dirty or saving editor drafts defer the switch, and stale responses cannot retarget another chat. Explicit launcher workspace overrides remain fixed.
- Embedded browser pages now follow editor/explorer divider movement even when their size stays unchanged. Qualified browser inner frames fit the available pane width, and geometry changes notify the native resize handler instead of leaving the webpage frozen behind its toolbar.
- Native browser/file panes respect the editor's reserved width instead of overlapping its documents and resize handle. In the qualified shell layout, the native tab bar and right-aligned controls share that boundary, and the docked editor divider extends through the tab-header band. Hiding or expanding the editor restores native sizing.
- Edit-to-Preview now uses the current unsaved source text immediately, without requiring an application rerender to refresh the editor's draft snapshot.
- Resizing the editor with native Changes open no longer hits Codex's competing top-layer workspace divider. The hosted comparison leaves room for the editor handle, restores the native divider on release, and keeps its internal file-list divider. Drag widths and chat-space limits now use layout units so zoomed drags track the pointer accurately.
- The editor's word-wrap control now drives Codex's native Word wrap handler while a Changes tab is active, and reflects changes made through the native control. Unknown native controls disable the custom action instead of showing a wrap state that doesn't affect the comparison.
- Wrapped source-line numbers stay aligned at application UI zoom levels such as 120%, in both Edit and read-only source views. Gutter measurements compare heights in the same CSS units and retain fractional content widths at wrap boundaries.
- Replacing an editor before deferred cleanup finishes can no longer preserve the old editor's hidden-chat attributes or width reservations as native defaults. Restore/E release the chat correctly, and the replacement keeps its header controls.
- Editor controls overlapping native controls or blocking tab-switch/close targets in docked and expanded layouts. ([hit targets](https://github.com/ThornsOfire/OpsWolf/commit/166efa2), [expanded layout](https://github.com/ThornsOfire/OpsWolf/commit/ae2ecc3))
- Partial text previews ending before the actual file did. Incomplete/oversized responses are rejected explicitly; syntax-highlighting budgets don't cut off the underlying source. ([complete documents](https://github.com/ThornsOfire/OpsWolf/commit/1931679), [source coverage](https://github.com/ThornsOfire/OpsWolf/commit/1f69d8d))
- Open-files dropdown toggle and Escape behavior. ([dropdown](https://github.com/ThornsOfire/OpsWolf/commit/917e657))
- File-explorer/editor startup failing when word wrap had been saved as enabled. ([startup](https://github.com/ThornsOfire/OpsWolf/commit/9615b80))
- Known same-chat native composer portals being treated as conflicting context around the Changes viewer. Conflicting chat IDs still fail closed. ([native context](https://github.com/ThornsOfire/OpsWolf/commit/edcc52f))
- Clicking a changes bubble or recorded review from a hidden conversation selecting the first old file instead of the requested comparison. The requested tab is now published before reopening the editor. ([reopening](https://github.com/ThornsOfire/OpsWolf/commit/ba3926d))
- The editor's top bar creeping downward when content/reader headers were measured as app chrome. Header reservations now use app-shell headers, with a restricted legacy fallback. ([header drift](https://github.com/ThornsOfire/OpsWolf/commit/ba3926d))

### Removed

- The first experimental workspace scanner, before/after snapshot archive, capture/chunk bridge routes, and custom snapshot diff generator. Native patch records replaced that design without a second permanent diff archive. See the [cleanup audit](docs/editor/tracker-cleanup.md) for evidence and coverage limits. ([backend replacement](https://github.com/ThornsOfire/OpsWolf/commit/1e17303), [renderer replacement](https://github.com/ThornsOfire/OpsWolf/commit/2c8642e))
- The temporary live-popup filename-matching adapter. The native comparison host now preserves Codex's own exact file selection. ([replacement](https://github.com/ThornsOfire/OpsWolf/commit/edcc52f))

[Unreleased]: https://github.com/ThornsOfire/OpsWolf/compare/d607eeaf251f38e1a34a9069ad580ef918eaf260...candidate/planned-development
