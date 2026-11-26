# Native-panel migration status

Updated November 25, 2026. Local development build: **OpsWolf 0.1.0-alpha.30**, based on Code-Codex v0.6.0. This describes the reviewed development source and bounded owner observations. A matching alpha.30 portable package is planned for publication. Its artifact identity and download will be recorded after packaging; local acceptance does not establish universal Codex compatibility.

## What changed

Recent Codex layouts added native file tabs and editing. The former OpsWolf editor could compete for the same space, leaving duplicate panes, overlapping controls and incorrect tree reservations. The migration changes ownership rather than continuing to position two editors beside chat.

| Area | Current responsibility |
| --- | --- |
| Main pane | Chat stays visible; file opens target the right panel |
| Right split, tabs, native buffers and saves | Codex owns them and their original handlers |
| Left explorer | OpsWolf reserves its own space and releases it when collapsed |
| Qualified native file panels | OpsWolf adds a tools row, bookmarks and optional read-only saved-file reader |
| Native Changes | Native layout retained; supported review enhancements stay in place |
| Old editor/session state | Retained for legacy hosts and guarded draft recovery; no second writer on modern layouts |
| Unknown layouts | Preserve native presentation rather than guessing ownership |

Explicit supported tree, chat, document and citation opens use the native right-panel route. Acceptance of the matching native panel, rather than a dispatch response alone, controls retirement of an old OpsWolf draft. The E button is removed. See [architecture](architecture.md) and the [user guide](README.md).

## What has been checked

The deferred alpha.30 regression run passed 73 gates. Two unchanged UI/native build gates reused the earlier matching build evidence, for 75 passing dispositions. The native suite reported 499 passed, zero failed and 24 inherited ignores. A Rain fixture's own inline-style mutation caused a strict ownership assertion to fail; its setup now uses topology-scoped CSS, preserving every assertion. All 17 checks in that fixture pass. No product change was needed for that correction.

These local checks cover routing, ownership, retained drafts, layouts, readers, native review adapters, Appearance and Rain, among other existing regressions. They do not prove every host behavior or all inactive-owner recovery races. Older experimental packages retain their original test-waiver records; later passing tests do not rewrite sealed history. Hosted CI and clean-install qualification are separate.

Owner observations confirm that native sidebar toggling no longer loses tree reservation, Rain can enable again after the inactive-owner repair, several background changes no longer get stuck, and supported file opacity looks right in alpha.30. These observations are bounded to the tested setup. Native edit persistence across a tab switch was observed; that is not verified save-to-disk/reopen behavior.

## What remains

- Clarify native save behavior and provide visible save state and appropriate Save/Discard controls. Keep Codex as the writer; do not infer saved state from tab persistence.
- Expose Preview/Edit and useful file-menu actions in an understandable toolbar, preserving native Show changes.
- Restore usable crowded-tab scrolling, an open-tabs list and Close all/others/right with verified dirty-state safeguards.
- Integrate project Pins with the native New Tab → Files view and check bookmark behavior across entry points.
- Reassess the extra Saved file preview once native file controls are clear; it currently reads disk and cannot represent unsaved native text.
- Complete Rain transparency for New Tab and Changes. Other-theme transparency remains deferred.
- Finish native save/reopen, mixed file/browser, installed-preview and broader layout acceptance. Improve obsolete code/tests/docs in bounded passes while retaining valid compatibility and draft protections.

These are backlog items, not shipped features. No timetable or upstream UI roadmap is assumed. Codex updates can still change the interfaces these adapters qualify.

## Delivery and maintenance

Use the [testing guide](testing.md), [publication OPSEC review](publication-opsec.md) and [portable guide](portable.md). The local OpsFlow skill routes agents through existing procedures; it is not a runtime feature, installed CI system or dependency for contributors. Sensitive-data review precedes publication. A new source push, hosted run and portable artifact each need their own identity and result.

Historical standalone-editor controls and screenshots remain useful for older builds. They must be labelled as legacy, not advertised as current native behavior. The current [limitations](known-issues.md) and this status page take precedence over historical migration plans.
