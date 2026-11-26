# Current limitations and pending work

Updated November 25, 2026. Local development build: **OpsWolf 0.1.0-alpha.30**, upstream **0.6.0**. The native-panel ownership migration is implemented; workflow polish and broader native acceptance remain unfinished. Deferred regression checks now pass: 73 freshly executed gates plus two matching build gates reused. These are local results, not a new public release or complete native compatibility certification. [Migration status and evidence limits](migration-status.md).

## Current migration gaps

| Area | Current status |
| --- | --- |
| Save and Preview/Edit | Native buffers/saves belong to Codex. Clear visible controls and confirmed save/reopen behavior remain pending; tab-switch persistence is not proof of a disk save. |
| Native tab overflow and closing | Scrolling, open-tabs navigation and Close all/others/right equivalents are planned with dirty-state protection. |
| Project Pins | File tools have bookmarks, but native New Tab → Files lacks the Pins bar. Full integration remains pending. |
| Saved file preview | Auxiliary read-only disk view; may differ from unsaved native text. Reassess once native controls are clearer. |
| BUG-034: Rain transparency | Owner accepts supported file opacity in alpha.30. New Tab and Changes remain opaque; other themes are deferred. |
| BUG-036: tree/sidebar ownership | Alpha.27 owner check confirms sidebar toggling no longer loses reservation. Broader browser/toolbar/layout coverage remains bounded. |
| BUG-017: retained appearance owner | Alpha.28 recovery and modern service discovery enabled Rain again in owner testing. Disable an active background before enabling another. Exact previous native preference restoration and all race combinations remain unverified. |
| Cleanup | Retained legacy code/tests require caller and behavior review before removal. The documentation pass does not certify all obsolete paths removed. |

## Earlier reports and retained limits

The following entries retain earlier evidence. Their version-specific results do not replace the current migration status. Mixed line-ending/edit-size restrictions below belong to the OpsWolf reader/legacy editor, not a universal contract for Codex's editor.

Mixed CRLF/LF text remains read-only under the existing native save policy. Normalize line endings consistently and reopen to edit; the warning does not bypass that protection. Editing above 512 KiB and unverified versions retain their existing restrictions.

| Item | Observed behavior / status |
| --- | --- |
| BUG-017: host appearance discovery | Historical alpha.3 acceptance on Codex package 26.1027.3384.0: guarded export inspection and intrinsic RPC invocation. All 33 combined commands pass, including 48 focused and 9 whole-explorer recovery cases. Owner confirms startup, Enable/Disable, retained saved settings and previous-theme restoration. A later restart check remains a follow-up. Alpha.2 is preserved failed evidence; renderer blend performance and blend-option persistence remain separate. |
| BUG-001: activity expansion | The source includes a current-composer detection repair, but the originally reported native layout still needs live confirmation. Following and scroll-to-pause work separately. |
| BUG-009: native header spacing | Repaired from dev.8 and owner-accepted in the tested dev.9 layouts: tabs/Hide/Show, hosted Changes, resizing and zoom. 81 focused checks pass. Unknown future layouts and untested RTL remain compatibility limits. |
| BUG-015: product menu alignment | Repaired from dev.8 and owner-accepted: the wolf sits beside the name. 45 menu checks pass. |
| BUG-011: Rain blending | After the alpha.15 worker handoff, the owner reports no more frame drops and smooth heavy blending, including changing all sliders. Controls also pass owner checks. This is visual acceptance for that setup, not measured FPS or universal GPU/monitor coverage. |
| BUG-004: empty editor backing | The reviewed Rain placeholder repair is included in the activated dev.6 baseline. Robbie reports editor transparency works with Code Rain; broader theme coverage remains separate. |
| BUG-012: cross-theme editor transparency | Robbie reports transparency works with Code Rain but not other themes. Exact theme names/states and cause remain unconfirmed; recorded only, no fix claimed. |
| Citation presentation | Core source citations work; the composer and hover tooltip can still expose the long encoded URL. Compact chips are future work. |
| Native compatibility | Adapters qualify known public layouts and English controls. Unknown layouts retain native presentation; future host versions and physical display configurations are not universally certified. |

Rain's steady-deadline change targets smoothness, not lower GPU usage. It keeps the 30 FPS and pixel/glyph limits; reaching the intended cadence can draw more frames. Fullscreen, zoom, focus/pause, native comparison controls and document readability need checks on the actual host. [Rain integration](code-rain-integration.md) separates current results from historical fixtures.

The active-background settings button is implemented at the top of the explorer (F26). Active Rain opens directly; other supported backgrounds use their Preview Market card. Unknown or ambiguous selections offer browsing instead. Preview Market remains the install/enable route. Broader tab transfers, context usage, advanced editing and platform identity remain scoped future work in [development](development.md); they are not implicitly enabled by a roadmap entry.

The corrected Open GitHub Repository destination is included from dev.6, and the visible OpsWolf menu/settings/footer rebrand is included in owner-used dev.7. Dev.8 contains the qualified header/menu alignment follow-up; each distinct source build requires its own reviewed handoff.

Keep reports reproducible: include host/fork/plugin versions, exact steps, expected/actual behavior, display scale/zoom and a synthetic example. Avoid posting client documents, chat exports, keys or personal profile files.
