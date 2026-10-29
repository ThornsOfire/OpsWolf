# Reading native Changes

In a recognized native Changes layout, file sections start collapsed. Expand a section to clear its **Unread** marker. A later successfully recorded patch marks it again, including changes with the same added/deleted line counts. If a file is already expanded when another patch arrives, its marker remains until you close/reopen that section or use **Clear all unread**.

Clear all affects markers only. It does not collapse sections, remove comparisons, undo edits, save files, or alter the native changed-files tree. The controls occupy the native viewer's flexible layout above its content, so the bottom remains reachable. Unknown layouts keep their native presentation.

Markers are session state for the open comparison and current chat/workspace. Closing the comparison or changing its identity clears this state. Up to 512 encountered paths are retained for that view; only recognized displayed sections get markers. No file bodies or marker history are saved to disk.

## What a marker means

The source is the existing project-scoped native `fileChange` record endpoint. While Changes is visible, one bounded latest-turn read runs at most once every five seconds, with no overlapping requests. This detects successfully applied patches during an ongoing turn as well as a new turn. Hiding the comparison suspends reads. A failed read reports that markers may be stale and retries at the normal interval.

This is not a filesystem watcher. Shell/manual/external edits absent from native patch records are not guaranteed to appear. The existing endpoint allows at most 128 files and 1 MiB of patch data per response; omitted patch bodies cannot prove a new revision, and the status shows the omission count. Markers also do not identify the historical revision selected in the native viewer: they report newer observed patch activity for that file in this chat. Initial reads establish a baseline; changes before that first observation cannot be ordered against a user's first read reliably.

The renderer immediately discards returned patch bodies after deriving a length and two numeric fingerprints, scoped by native turn ID. These are change-detection fingerprints, not security hashes. The native history remains the only patch archive. The adapter never expands a collapsed section merely to scrape hidden content.

## Ownership and verification

`NativeDiffSections` owns disclosures' initial collapse requests, its added markers/control row, and bounded polling. Original native disclosure handlers perform the collapse/expand operations. `native-review-model` validates the existing response contract for both persistent review and marker consumers; `native-review-revisions` derives transient fingerprints. Application composition supplies the authenticated bridge capability, and `NativeDiffHost` supplies the qualified panel/visibility lifecycle.

`node scripts/test-native-diff-sections.mjs` covers delayed native disclosure updates, read/re-edit/clear, equal-length revisions, hidden/pending reads, stale contexts, errors/recovery, layout flow and observer settling. Native layout and patch contracts were inspected separately; fresh candidate installation and end-to-end live patch polling remain separate checks.
