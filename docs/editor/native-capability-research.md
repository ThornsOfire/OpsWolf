# Native UI capability boundaries

Research for the local candidate, 2026-10-29. These findings describe the inspected host; they do not establish compatibility with future versions. Requested features remain open where their required capability is missing.

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
