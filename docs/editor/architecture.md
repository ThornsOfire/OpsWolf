# Editor architecture and data lifecycle

This documents the editor fork on `feature/right-editor-pane`. It supplements the repository's [maintenance architecture](../architecture.md), which also covers the inherited plugin suite and installer.

## Component ownership

Paths below are relative to the repository root.

| Responsibility | Owner |
| --- | --- |
| Native-page qualification, injection and remount | `packages/explorer-ui/src/inject.ts`, `packages/explorer-ui/src/adapters/codex-26.715.ts` |
| Native sidebar's one-time startup collapse | `packages/explorer-ui/src/native-sidebar.ts` |
| Application wiring, authenticated workspace lifecycle, dirty-switch orchestration | `packages/explorer-ui/src/app/explorer-element.ts` |
| Editor DOM, tabs, metadata controls, source/preview switching | `packages/explorer-ui/src/app/main-preview-element.ts` |
| Pane geometry and native-header reservation | `packages/explorer-ui/src/features/preview/editor-pane.ts` |
| E control and scoped compact native header | `packages/explorer-ui/src/features/preview/editor-header-control.ts` |
| Tab collection and per-project pins | `packages/explorer-ui/src/features/preview/tab-store.ts`, `pinned-files.ts` |
| Preview requests, full text transfer, stale-result checks | `packages/explorer-ui/src/features/workspace/preview-requests.ts` |
| Tab scheduling, native/recorded diff tabs, opening current source | `packages/explorer-ui/src/features/workspace/preview-workspace.ts` |
| Drafts, save conflicts and UI-refresh recovery | `packages/explorer-ui/src/features/workspace/preview-editing.ts`, `features/preview/draft-store.ts` |
| Save/discard/cancel dialogs | `packages/explorer-ui/src/features/preview/close-dialog.ts` |
| Large plain-text rendering and logical wrapped line numbers | `packages/explorer-ui/src/features/preview/large-text-reader.ts`, `wrapped-line-numbers.ts` |
| Persistent native-record review and chat-card adaptation | `packages/explorer-ui/src/features/workspace/change-review.ts` |
| Native comparison view hosted inside editor layout | `packages/explorer-ui/src/features/preview/native-diff-host.ts` |
| Native text read/save policies and chunk validation | `crates/workspace-service/src/preview.rs`, `preview/text_transfer.rs`, `preview/text_policy.rs` |
| Native review bridge route | `crates/launcher/src/bridge/routes/changes.rs` |
| App Server turn reads and project-scoped patch projection | `crates/context-resolver/src/lib.rs`, `review.rs` |

Abbreviated sibling names in a cell resolve beside the preceding full source path. UI presentation uses capability ports; features don't import application elements or own the authenticated bridge.

Pane top reservations measure marked app-shell headers. Legacy fallback is restricted to headers directly on the main surface or its parent; nested reader/content toolbars aren't app chrome. Including those toolbars creates a layout feedback loop that can push the editor downward.

## Reading and editing source

1. `PreviewWorkspaceController` opens or reuses a tab for a relative project path and assigns a tab instance/revision.
2. `PreviewRequestsController` requests the native preview. Larger supported text uses complete transfer metadata and validated chunks instead of accepting a sliced inline response.
3. Each response is checked against the bridge/context generation, preview session, tab identity, and revision before applying it.
4. The native workspace service owns path permissions, file type/sensitive-file policy, file version, and byte limits. UI size constants must agree with that backend.
5. Editing starts only for a complete editable text/empty view with a version. Save sends the full draft plus the expected version. Conflicts and failed saves keep the draft available.

The inline/edit limit is 512 KiB. The complete text-read limit is 10 MiB. The large-file UI defaults to a virtual plain reader; full Markdown rendering is a separate user action. Rendering and highlighting limits must not silently turn an incomplete document into an editable file.

Textarea drafts use normalized LF line endings. Saving restores CRLF when that convention was recorded in the loaded preview metadata; mixed line endings normalize through the source-editing path.

Dirty close/switch actions capture the current workspace, bridge, editor session and target tabs. The deferred action proceeds only if those identities still match after the user's choice and any save. The same path is used by file-tree selection, tab changes, and diff-to-source opening where applicable.

## Persistent native patch reviews

The read-only route is **`explorer.changes.native`**, declared in `resources/bridge-contract.json` and dispatched by the launcher router.

The renderer supplies a cursor, not an arbitrary chat ID. The launcher derives the current authenticated thread/workspace, requests a turn page, then rechecks the active context after awaiting the resolver.

The resolver requests `thread/turns/list` with `limit: 1`, descending order and `itemsView: full`. The Rust projection accepts native completed file-change items, validates identifiers and paths, handles adds/deletes/update hunks and renames, and omits records outside the root. Multiple patches for a file remain sequential patches rather than a reconstructed net file diff. The workspace service's sensitive-file policy filters projected paths again.

The persistent renderer skips in-progress turns. It refreshes after a visible response finishes, on explicit Refresh, and at most once per minute while idle. It looks back through at most 40 pages and caches up to 10 useful reviews; newer refreshes reuse immutable older records. Per-file expansion state is in memory and pruned with retained reviews.

Recorded and native comparison opening publishes the requested active tab to the editor before reopening its surface. Otherwise a hidden editor still showing conversation state can auto-select its first old file and overwrite the intended diff selection. Hiding explicitly resets fullscreen and persists docked mode without changing saved width, files or draft contents. Accepted chat-tab/Escape transitions follow the same rule; cancelled transitions and temporary suspension/reparenting don't reset layout. The regression fixtures cover reopening comparisons after a fullscreen editor is hidden.

| Bound | Current value |
| --- | --- |
| Cursor length | 4,096 characters |
| Native turn page | At most one turn |
| Initial lookup | At most 40 pages |
| Useful reviews cached in UI | Up to 10 |
| Project files projected per review | Up to 128 |
| Diff content budget per review | 1 MiB |
| Existing App Server message budget | 4 MiB |

These are review budgets, not the source-file size limit. Unavailable or omitted content is explicit. Review records carry message IDs so the renderer hides only fully mapped native chat cards; unmatched/partial cards keep their original behavior. Disposal or read failure restores hidden cards. Undo/Reapply proxies the matching mounted native button.

## The native comparison host

The live files-changed bubble and hover-file buttons retain their original native handlers. The adapter observes the click, lets Codex create/select its own comparison, and focuses the custom `native-diff://<thread>` Changes tab. It doesn't guess a file by basename or reconstruct this viewer from stored patches.

The host verifies active-page and same-thread markers, native tab/controller ownership, the containing right-panel aside, and the native close control. Matching normal/fixed composer portals are accepted only in the known layouts with agreeing chat IDs; conflicting identities remain invalid.

The actual comparison stays under its original native DOM parent. Scoped style leases position it over the editor's native-diff mount target. A hidden geometry probe measures native origin/zoom; ResizeObserver follows the editor surface. Native layout writes that would displace the view are reconciled. No native source is copied and no private React store is accessed.

The native tab is hidden while its editor counterpart owns presentation. Other editor tabs and E hide the comparison without destroying its native state. Closing the editor Changes tab forwards to the original native close button. A native full-view comparison returns to split layout to keep chat available. Disposal/context changes restore leased styles and owned markers. Unknown layouts keep their native presentation.

## Opening a diff's current source

`git-diff` views may carry an explicit `openSourcePath` in addition to their display path. Individual eligible native records and Git-history files supply it; combined and deleted native records do not.

The Open file event identifies the current diff tab. Application wiring verifies the sender and active tab, applies existing dirty-switch protection, then asks the workspace controller to open/reuse the ordinary source tab. It uses normal native preview permissions and save behavior. The patch content is never used as an editable file body. Missing source creates the ordinary load error while keeping the recorded diff.

## Source citations

`features/preview/citation-model.ts` owns logical line ranges, CR/LF normalization, bounded quote anchors, root checks and the versioned `codex://code-codex/cite?data=...` payload. `contracts/citations.ts` shares the data shape without importing application elements. Each link carries at most 32 ranges and 64,000 encoded characters; a composed insertion is limited to 96,000 characters. Quotes are limited to 4,096 characters per range. Longer selections explicitly fall back to line-only references. Typed line indexes are shared within a grouped resolution, including the newline-heavy 10 MiB case.

`EditorCitations` maps textarea, literal-source or mounted virtual-row selection to full logical lines. Its right-click popover uses normal buttons and keyboard focus. Rendered document selections offer an explicit source transition rather than pretending rendered positions are source lines. Highlights use the CSS Highlight API for inline source and bounded marks for virtual rows. Unique quotes can relocate; changed/missing or ambiguous quotes never receive a guessed highlight. Refresh, hiding and disposal dismiss popovers and release highlights.

`features/workspace/citations.ts` owns the session-only group and user-initiated link handling. It verifies the event's preview owner/path, active context and project root, then delegates navigation to `PreviewWorkspaceController`. Application wiring reuses dirty-switch protection before opening another source. Group activation publishes the requested first source before revealing a hidden editor. File contents still load through the existing authenticated bridge and native policy; citation payloads never replace loaded file bodies.

`host/native-surfaces/composer-citations.ts` requires agreeing active-chat annotations and exactly one visible same-chat composer. Textareas use their native setter/input event; contenteditable uses the browser editing command at the end of the existing draft. No submit action or private React store is used. Unknown/ambiguous layouts fail with Copy citation available. This adapter needs real-host verification after relevant native markup changes.

Queue/highlight state is memory-only. References inserted into a message include absolute paths and bounded quotes, and then follow ordinary chat retention. This feature doesn't add disk snapshots, retention jobs or a new backend route. Moved project roots aren't automatically rewritten; cross-project links are rejected.

## Storage and ownership

| State | Location/lifetime |
| --- | --- |
| Pane width and docked/fullscreen preference | Local renderer storage, `code-codex:editor-pane:v1` |
| Word-wrap preference | Local renderer storage, `code-codex:word-wrap:v1` |
| Project pins and ordering | Local renderer storage, `code-codex:pinned-files:v1`; relative paths keyed by normalized root |
| Open unpinned tabs and current draft | In memory in the running editor session |
| Detached dirty draft handoff | In memory, 10-second TTL with matching chat/bootstrap identity |
| Native review cache and expansion state | In memory; bounded reviews and readers disposed with the feature |
| Pending citation group and active highlights | In memory; queue cleared on chat/project change or disposal; active ranges clear with tabs/context |
| Sent citation paths and bounded quotes | Part of the user's ordinary chat message; no separate extension archive |
| Original patch history | Codex's existing native history, outside a new extension snapshot archive |
| Sidebar startup decision | Document-local Symbol; repeated bundle injection doesn't collapse it again |
| Build outputs, local test captures and developer probes | Ignored `dist/`, `target/`, `artifacts/`; not public source features |

The fork's normal installation/settings/plugin/log storage follows the inherited application paths. A personal launcher may relocate supported data, but no personal Desktop path is required by this editor source.

The removed snapshot tracker's old retention settings are not current feature policy. See the [cleanup audit](tracker-cleanup.md).

## Compatibility and scope

Editor disconnect releases native layout reservations, hidden-chat attributes and header controls synchronously. Expensive reader/media cleanup may remain deferred, but a replacement must never capture another editor's leased styles as original native state. A same-element reconnect reapplies its layout; intentional `reparent()` moves preserve the existing editor session.

This is a Windows desktop integration dependent on native markup. Several adapter labels target the inspected English shell. UI changes require checking new/empty chats, normal source tabs, native comparisons, fullscreen, cached inactive pages and current chat identity.

Upstream update/plugin endpoints remain inherited. This documentation pass doesn't change distribution, install policy, or network behavior, and it isn't a new security audit. Existing license and third-party notices remain applicable.
