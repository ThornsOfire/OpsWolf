# Citation status and remaining work

The core is working. The composer still needs some love ;3

## Implemented

- Select source text and right-click to cite in chat, copy a reference, or queue a group. Applies to supported complete text files, including code and ordinary documents.
- Group up to 32 ranges within/across files. Insert one group link plus individual references without sending a message.
- Links supplied by either the user or the agent open normal editor source tabs, reveal the target range and highlight it. Dirty-file save/discard/cancel protection still applies.
- Whole-line quotes up to 4,096 characters support unique relocation. Missing/ambiguous matches are explicit. Longer selections use line anchors, which cannot follow moved text. Draft references are labelled.
- Pending groups/highlights stay in session memory. Sent references contain paths and bounded source quotes and follow ordinary chat retention. There is no separate permanent citation archive.

Full controls, file-size limits and source/rendered-preview behavior are in the [user guide](README.md#citing-source-in-chat). Protocol and ownership details are in the [architecture guide](architecture.md#source-citations).

## What has actually been checked

Live checks below were confirmed by the maintainer on **2026-10-29**, using Codex desktop **26.1023.6123.0**. They describe that setup, not every host version or language.

| Behavior | Evidence |
| --- | --- |
| Editor selection reaches chat with path, range, quote and draft flag | Live user-inserted references were received correctly |
| Group transport | A three-range group from one Markdown file, plus its individual references, reached the agent correctly |
| Agent to editor | Three assistant-generated quoted references opened and highlighted the intended sections; maintainer confirmed |
| Sent-message rendering | Maintainer confirmed the raw draft resolves into a clickable label after sending |
| Cross-file grouping, quote relocation/failure, virtual large-text anchors and context boundaries | Synthetic browser fixture coverage; not all individually confirmed in the live session |
| Save/cancel/conflict protection around citation navigation | Full explorer browser fixture coverage |

Run `node scripts/test-citations.mjs`, `node scripts/test-citations-host.mjs`, and `node scripts/test-complete-text.mjs` for the relevant synthetic checks. Follow the [development guide](development.md) for dependencies and host verification. Test counts are evidence for a particular run, not a permanent guarantee.

## Known rough edges

**Raw payload in the draft.** The insertion adapter appends literal Markdown. Because the URL carries paths, ranges and bounded quote text, it can become a large encoded block in the composer. Group insertion repeats data in the group and individual links. The data is valid; the draft presentation is unfinished.

**Raw URL in hover tooltips.** Sent links render as readable labels, but the native hover presentation can show the encoded destination instead of a useful file-and-lines summary.

**Rich paste isn't a proven shortcut.** A short synthetic HTML-link paste was tested in an empty native composer and undone without sending. The inspected host retained literal Markdown. A compact chip must preserve the reference through editing and send serialization; looking compact in the DOM alone doesn't prove that.

## Follow-up work, not shipped behavior

1. Investigate a compact composer reference with a readable filename/range and accessible full-path/draft information. Preserve surrounding draft text, native editing/undo, keyboard behavior, group references and exact outgoing citation data. Never submit automatically or manipulate private React stores.
2. Give citation hover UI a concise file/range or group summary while retaining navigation and a way to copy the full reference. Preserve native behavior on unrelated links and unknown host layouts.
3. Verify these additions in fixtures and the real host before marking them complete. Shortening or hiding the URL alone must not silently remove quote relocation, discard references on restart, or introduce a permanent local quote store.

These items are presentation work around the existing citation mechanism. They have not been implemented or promised as compatible with every native composer version.
