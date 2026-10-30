# Current limitations and pending work

Updated 2026-10-30. OpsWolf (formerly Cursadex) development builds are local and unreleased. The owner-used baseline is OpsWolf 0.1.0-dev.9 with Rain plugin 0.1.2. The owner accepts header-spacing/product-menu alignment across the reported checklist layouts and dev.9's red explanation where read-only text mode controls were silently unavailable. Passing fixtures alone does not close a reported live failure; other known limitations below remain open.

Mixed CRLF/LF text remains read-only under the existing native save policy. Normalize line endings consistently and reopen to edit; the warning does not bypass that protection. Editing above 512 KiB and unverified versions retain their existing restrictions.

| Item | Observed behavior / status |
| --- | --- |
| BUG-001: activity expansion | Activity disclosures still need manual expansion in the owner's native layout. Following and scroll-to-pause work separately. |
| BUG-009: native header spacing | Repaired from dev.8 and owner-accepted in the tested dev.9 layouts: tabs/Hide/Show, hosted Changes, resizing and zoom. 81 focused checks pass. Unknown future layouts and untested RTL remain compatibility limits. |
| BUG-015: product menu alignment | Repaired from dev.8 and owner-accepted: the wolf sits beside the name. 45 menu checks pass. |
| BUG-011: Rain blending | Playback generally improved after the cadence correction, but preset → Save → Start blend can drop frames until blending completes. Numeric timings and whether it predates dev.5 remain unverified. |
| BUG-004: empty editor backing | The reviewed Rain placeholder repair is included in the activated dev.6 baseline. Robbie reports editor transparency works with Code Rain; broader theme coverage remains separate. |
| BUG-012: cross-theme editor transparency | Robbie reports transparency works with Code Rain but not other themes. Exact theme names/states and cause remain unconfirmed; recorded only, no fix claimed. |
| Citation presentation | Core source citations work; the composer and hover tooltip can still expose the long encoded URL. Compact chips are future work. |
| Native compatibility | Adapters qualify known public layouts and English controls. Unknown layouts retain native presentation; future host versions and physical display configurations are not universally certified. |

Rain's steady-deadline change targets smoothness, not lower GPU usage. It keeps the 30 FPS and pixel/glyph limits; reaching the intended cadence can draw more frames. Fullscreen, zoom, focus/pause, native comparison controls and document readability need checks on the actual host. [Rain integration](code-rain-integration.md) separates current results from historical fixtures.

Direct active-theme settings at the top of the explorer is a recorded request (F26). Settings currently open through Preview Market. Broader tab transfers, context usage, advanced editing and platform identity remain scoped future work in [development](development.md); they are not implicitly enabled by a roadmap entry.

The corrected Open GitHub Repository destination is included from dev.6, and the visible OpsWolf menu/settings/footer rebrand is included in owner-used dev.7. Dev.8 contains the qualified header/menu alignment follow-up; each distinct source build requires its own reviewed handoff.

Keep reports reproducible: include host/fork/plugin versions, exact steps, expected/actual behavior, display scale/zoom and a synthetic example. Avoid posting client documents, chat exports, keys or personal profile files.
