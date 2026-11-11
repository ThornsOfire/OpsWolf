# Reading native Changes

In a recognized native Changes layout, file sections start collapsed. Expand a section to clear its **Unread** marker. A later successfully recorded patch marks it again, including changes with the same added/deleted line counts. If a file is already expanded when another patch arrives, its marker remains until you close/reopen that section or use **Clear all unread**.

**Clear all unread** affects markers only. It does not collapse sections, remove comparisons, undo edits, save files, or alter the native changed-files tree. The controls occupy the native viewer's flexible layout above its content, so the bottom remains reachable. Unknown layouts keep their native presentation.

Markers are session state for the open comparison and current chat/workspace. Closing the comparison or changing its identity clears this state. Up to 512 encountered paths are retained for that view; only recognized displayed sections get markers. No file bodies or marker history are saved to disk.

## Clearing the list

**Clear list** hides the recognized, currently listed file sections. **Show all** restores cleared entries. These controls do not undo edits, save files, discard drafts, mutate Git, delete native history or mark files read. The native changed-files tree and review selector remain native. Only comparison sections are filtered; switching to a different historical review does not establish a separate filter for that review.

Each cleared path keeps a fingerprint of its latest observed native patch. A later different patch reveals the file again and marks it unread. Files added to the list remain visible. Clear list is unavailable until a successful history read establishes a baseline. No patch bodies or filter state are written to disk.

Filters are kept in memory across closing/reopening Changes and ordinary navigation for up to eight recent chat/project pairs, with at most 512 cleared paths per pair. Another chat or project does not inherit them. **Show all**, app reload/restart, or eviction of an older pair restores its full list. Unread markers have the shorter open-comparison lifetime described above.

Unavailable history temporarily shows all entries and disables Clear list; a successful catch-up may safely reapply unchanged filters. Incomplete history, omitted patches or an exceeded catch-up bound clears the filter and reports the limitation. This favors showing extra history over concealing potentially new work.

## What a marker means

The source is the existing project-scoped native `fileChange` record endpoint. While Changes is visible, one bounded history check starts at most once every five seconds after the previous check, with no overlapping checks. The first observation reads only the latest turn. Later checks read from the newest turn through the previous observation, including that boundary turn to detect its ongoing edits. Catch-up stops at sixteen pages, 512 unique paths or a five-second request budget; a missing boundary or exceeded bound is incomplete coverage. This detects successfully applied patches during an ongoing turn as well as a new turn. Hiding the comparison suspends reads. A failed read reports that markers may be stale and retries at the normal interval.

This is not a filesystem watcher. Shell/manual/external edits absent from native patch records are not guaranteed to appear. The existing endpoint allows at most 128 files and 1 MiB of patch data per response; omitted patch bodies cannot prove a new revision, and the status shows the omission count. Markers also do not identify the historical revision selected in the native viewer: they report newer observed patch activity for that file in this chat. Initial reads establish a baseline; changes before that first observation cannot be ordered against a user's first read reliably.

The renderer immediately discards returned patch bodies after deriving a length and two numeric fingerprints, scoped by native turn ID. These are change-detection fingerprints, not security hashes. The native history remains the only patch archive. The adapter never expands a collapsed section merely to scrape hidden content.

## History response limits

A single persisted turn can exceed the App Server transport's four-MiB JSONL frame limit even though the patch response sent to the renderer is smaller. An oversized frame is rejected as an error, never displayed as a complete or silently truncated history result. The transport drains that frame to its newline with bounded memory, then continues reading subsequent replies so a rejected review does not disable later project-folder lookups.

The rejected frame cannot be trusted to supply its request ID. Requests already pending at detection therefore fail explicitly; a concurrent workspace read may also need a retry. There is no automatic request replay. EOF or a terminal read error closes the request registry and later requests fail promptly. This does not increase history limits, add an archive, change context/path authority, or accept every native host/version.

## Ownership and verification

`NativeDiffSections` owns disclosures' initial collapse requests, its added markers/control row, and bounded polling. Original native disclosure handlers perform the collapse/expand operations. `native-review-model` validates the existing response contract for both persistent review and marker consumers; `native-review-revisions` derives transient fingerprints and bounds history catch-up; `cleared-changes` owns the in-memory per-context filters. Application composition supplies the authenticated bridge capability, and `NativeDiffHost` supplies the qualified panel/visibility lifecycle.

`node scripts/test-native-diff-sections.mjs` covers delayed native disclosure updates, read/re-edit/clear, equal-length revisions, hidden/pending reads, stale contexts, errors/recovery, layout flow and observer settling. `node scripts/test-clear-changes.mjs` covers real pointer/keyboard activation, restoring native handlers, chat/root isolation, replacement rows, reload lifetime, stale replies, error/omission recovery, narrow layout, observer settling and history limits. Its shared tooltips opt into dismissal on activation so the restored first row remains clickable. Native layout and patch contracts were inspected separately; fresh candidate installation and end-to-end live patch polling remain separate checks.
