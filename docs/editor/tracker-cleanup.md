# First tracker cleanup audit

Reviewed on **2026-10-28**, against editor source baseline **`52eeb34`**. This is a scoped cleanup check of the first change-tracker design, not a security audit of the entire application.

## What changed

The first implementation captured bounded workspace before/after snapshots and stored expiring local history. It could miss edits when the master workspace exceeded scan budgets, which made an empty review misleading even when native chat showed a real patch.

The current implementation reads existing native `fileChange` records through `explorer.changes.native`. It doesn't reconstruct changes by scanning the workspace or writing a separate before/after archive.

| Removed part | Evidence in current source |
| --- | --- |
| Workspace snapshot scanner and snapshot/history writer | `crates/workspace-service/src/preview/change_history.rs` is absent |
| `ChangeTracker` export and bridge-owned tracker instance | Removed from workspace-service exports and launcher bridge assembly |
| Capture lifecycle and stored-content chunk routes | `explorer.changes.capture`, `explorer.changes.chunk`, `changes_capture` and `changes_chunk` are absent from runtime source/router/contracts |
| Local before/after diff generator | `packages/explorer-ui/src/features/preview/review-diff.ts` and `createReviewDiff` are absent |
| Temporary live-popup filename/record lookup adapter | `packages/explorer-ui/src/features/workspace/native-activity-files.ts` and `NativeActivityFiles` are absent |
| Snapshot-triggered renderer workflow | The current review controller requests native history; its regression rejects filesystem capture/chunk requests |
| Extra tracker-specific dependencies | The original scanner commit did not add Cargo/npm dependencies requiring separate removal |

The native backend replacement is recorded in commit `1e17303`. The renderer replacement follows in `2c8642e`. The later native comparison host, including removal of the temporary live-file adapter, is in `edcc52f`.

## What remains on purpose

- `change-review.ts` is the active **native-record** controller. Its name doesn't mean the old scanner is still present.
- `LargeTextReader`, ordinary Git/recorded-diff views, native Undo/Reapply proxies and source-opening controls support the replacement design.
- Native text-transfer snapshots, process-enumeration snapshots and installer rollback snapshots serve unrelated features. They weren't removed just because they contain the word “snapshot.”
- Git history retains the old implementation so the design can be understood or recovered. Old commits aren't compiled into the current checkout.
- Ignored developer artifacts and deliberate rollback binaries can retain earlier builds. They aren't imported into the production UI or published by a source-only documentation commit.

The old seven-day/200 MiB history policy belongs to the deleted snapshot tracker. It is not the retention policy of the current native review panel. Current extension review caching is bounded in-memory state; native chat history remains under Codex's lifecycle.

## Verification performed

1. Searched runtime UI/Rust sources, scripts and the bridge contract for the removed tracker types, route identifiers and old diff-generator/adapter names. No remaining runtime references were found.
2. Checked that the three retired modules above are absent and reviewed the removal commits rather than relying only on a text search.
3. Checked the current built `explorer.js` for the removed capture/chunk entry points and helper names. None were found.
4. Ran `node scripts/test-change-review.mjs`: **26 checks passed**, including native-history-only reads, current-source metadata, combined-diff behavior, stale-context protection, failure restoration and disposal.
5. Ran `node scripts/check-architecture.mjs`: **zero runtime import cycles** and no reported layering/port errors.
6. Counted files in the known legacy local history locations without reading their contents. No legacy record files remained. The leftover empty app-owned history directory was subsequently removed.

The native backend wasn't rebuilt solely for this documentation pass. Its removal is in the checked source and the previously built native baseline; this audit doesn't claim a fresh Windows native build or a new whole-program runtime audit.

## Scope of the conclusion

The first tracker's active code paths and legacy local record cache have been cleaned up. Recoverable Git history and deliberate rollback artifacts remain. This does not promise that every ignored experiment or every historical binary has been purged, and it doesn't change updater/plugin behavior.

See the [architecture guide](architecture.md) for the replacement's data flow, limits and storage ownership, and the [development guide](development.md) for the focused checks to run when changing it.
