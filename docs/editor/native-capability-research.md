# Native UI capability boundaries

These findings are version-specific. The November 24 native file-opening result supersedes the October finding that no extension-side route had been established. It does not establish a stable public API or finish F58.

## Native right-panel ownership, November 24, 2026

On Codex 26.1120.5083.0, the existing host action service accepts `windows.tabs.open` with the current window, thread identity, a file target and explicit right placement. The source adapter discovers a unique service through the existing semantic module loader; it does not pin minified export names, call arbitrary factories, access React state or copy native implementation code. Discovery itself sends no action. The original tab and matching selected content panel, not a successful RPC response, establish acceptance.

The docked explorer is outside the shared native frame. Its owned workspace-row placement and immediate workspace sibling must qualify against the active main surface and chat before native file identities can be matched. Same-named files use their full workspace-relative path. Seeing a modern frame merely prevents fallback into a competing legacy pane; it is not permission to select or open anything.

A bounded live probe opened two synthetic same-named Markdown files in distinct native right tabs. After the existing OpsWolf preview relinquished its own width through its public visibility method, the actual source controller opened a third synthetic source file. The matching native tab/panel became selected and chat width remained unchanged. This was a narrow route test, not a whole-renderer installation or physical UI acceptance.

The source route now guards explicit tree, chat-anchor, document-link, citation and current-source opens. Existing drafts are released only after matching native acceptance; failed saves, unavailable actions, identity changes and cancelled transactions preserve them. Native discovery/action waits are bounded. Once an action has been sent to Codex it cannot be recalled: timing out stops our transaction and prevents late draft release, but cannot guarantee that the host will never complete its action later.

**Tools source, November 24:** supported native file panels now receive an owned normal-flow row before their flexible native editor body. Pinning uses existing project bookmarks. Saved-file previews reuse the authenticated reader and installed renderer in an explicit read-only mode; they never represent the native unsaved buffer. E is removed. Modern Changes enhancement leaves native layout and controls in charge; recorded response patches remain inline. The old pane remains available only on legacy layouts. A bounded synthetic-file probe observed unchanged chat width, original native nodes/styles, allocated preview space and complete teardown.

**Still required:** exact candidate qualification and owner activation, then mixed browser/file tabs, native editing/save/reopen, previews across supported file types, citations and tree/header geometry. Native source selection is verified only through available contiguous numbered rows; arbitrary native draft capture and native file-wrap/save command ports are not established. Passing `target.line` is dispatch evidence, not proof of line navigation.

## Historical research, October 29, 2026

The sections below describe the older host and prior transfer design. They explain earlier capability limits; they are not instructions to restore middle-page relocation or automatic native-tab closing.

## Independent Changes entry (plan C)

The Codex agent tool accepts `codex://threads/<threadId>?view=review` as a review-panel target. That does not establish an extension-side link handler.

A temporary ordinary anchor with that route was mounted in the qualified active chat header. The native Changes tab was closed through its original, uniquely identified **Close Changes tab** button. A subsequent public-DOM observation confirmed no `diff` tab. Activating the anchor through its normal DOM click, with a browser user-gesture context, did not recreate a `diff` tab in immediate or later observations. The probe was removed. The agent tool was separately asked to restore the existing review view; it returned `queued`, so restoration was not counted as observed success.

Physical input was attempted first, but TaskKit clicks did not produce the intended control changes in the two-monitor layout. Desktop/window captures agreed visually; the apparent input offset is not diagnosed. Computer Use then timed out waiting for a frame. The DOM experiment tests that activation path only, not physical interaction or every possible native opening mechanism. All temporary controls were removed and desktop control released.

The [official command reference](https://learn.chatgpt.com/docs/reference/commands) documents thread navigation but does not establish a public extension API for the review query. The [review guide](https://learn.chatgpt.com/docs/code-review) describes review behavior. Starting an agent review must not be substituted for opening the existing comparison pane.

**Decision:** do not ship a button that depends on this unverified route. Existing bubble/hover and recorded-review actions remain available. A complete implementation still needs a supported native opening capability, observable success and explicit unavailability, independent of a visible bubble.

## Editor-to-middle transfers (plan J)

The existing middle-to-editor adapter has a verified source identity, authenticated reader and native close handler. Reverse transfer additionally needs native file-tab creation and confirmation of its file identity before removing the editor tab.

The inspected installed app-server request schema provides file/turn operations, but no native UI tab-creation or composer-editing API was established. The agent's `open_in_codex` tool can request a file tab; it is not itself callable from the extension. Native **New tab → Files** is a user-facing workflow, not evidence of a stable extension interface for an arbitrary file handoff. No guessed IPC action, private framework store or visual reparenting was added.

**Still required:** a supported file-open route; verified destination identity; save/cancel/read-failure protection; shared menu/drag transfer policy; pinned Chat and existing tab reordering preserved. Existing one-way transfers are not completion of bidirectional transfers.

## Citation presentation (plan H)

See [citation status](citations.md). Rich HTML paste was flattened to Markdown. No verified rich-node editing API was established. Replacing native composer DOM would not prove correct undo, persistence or outgoing serialization and is outside the ownership rules. Sent citation hovers still need an observed, qualified adapter; older virtualized-out links cannot establish that contract.

No shortened, session-only citation protocol or new composer presentation has been shipped. Complete reference data and explicit user sending remain intact.
