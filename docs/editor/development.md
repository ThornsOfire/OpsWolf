# Developing the editor fork

The [main README](../../README.md#getting-it-running) has the fresh-clone commands. Use `feature/right-editor-pane`: `main` currently carries the homepage documentation rather than the editor implementation.

## Source, builds, installation

There are three separate things to keep straight:

| Area | Purpose |
| --- | --- |
| Git checkout | Source, tests, documentation, license and distribution definitions |
| `packages/explorer-ui/dist/`, `target/` | Generated UI and native outputs; ignored by Git |
| An installation/launcher | The particular native executable and UI bundle actually used at runtime |

Changing the checkout doesn't replace a running renderer. A UI-only change needs a rebuilt UI bundle and a launcher that loads it. A backend change needs a matching rebuilt native companion too. The inherited application version remains 0.5.40, so that number by itself doesn't identify the editor-fork revision. Record the source commit and installed asset hashes when diagnosing a mismatch.

Personal launcher paths, relocated app state, test captures, rollback builds and client workspaces aren't prerequisites for cloning this repository. Avoid putting any of those into public documentation or hard-coded defaults.

To rebuild only the UI:

```powershell
npm --prefix packages/explorer-ui ci
npm --prefix packages/explorer-ui run typecheck
npm --prefix packages/explorer-ui run build
```

For the full native/UI build, use `scripts/build.ps1 -Configuration Release` from the repository root. It performs locked dependency installation and the workspace release build. The inherited packaging scripts can produce installation assets, but existing upstream assets should not be relabeled as releases of this fork.

## Choose checks for what changed

These commands run from the repository root after UI dependencies are installed. Tests exercise different boundaries; the goal is useful coverage, not running every appearance/plugin test for a documentation edit.

| Change | Focused check |
| --- | --- |
| E, pane geometry, fullscreen, compact headers, wrap, logical line gutter | `node scripts/test-editor-pane.mjs` |
| Startup sidebar state, delayed readiness, manual reopen | `node scripts/test-native-sidebar.mjs` |
| Tab wheel/drag/dropdown/pins and close behavior | `node scripts/test-tab-navigation.mjs` |
| Save/discard/cancel, failed/stale saves and switching | `node scripts/test-close-dialog.mjs` |
| Complete inline Markdown/editor delivery and rejecting partial responses | `node scripts/test-complete-text.mjs` |
| Large text and explicit large Markdown rendering | `node scripts/test-large-text.mjs` |
| Explorer-to-chat absolute path drag | `node scripts/test-drag-file-path.mjs` |
| Native record history, per-file disclosures, coverage, card restoration | `node scripts/test-change-review.mjs` |
| Hosting actual native comparison DOM in editor layout | `node scripts/test-native-diff-host.mjs` |
| Diff → current source → edit/save/reopen and missing source | `node scripts/test-diff-source.mjs` |
| Module layering, capability ports and import cycles | `node scripts/check-architecture.mjs` |
| Native source policy, complete transfer and file mutations | `cargo test -p workspace-service --locked -- --test-threads=1` |
| Native renderer/transport boundary | `cargo test -p cdp-client --locked -- --test-threads=1` |
| Native history protocol, patch projection and path filtering | `cargo test -p context-resolver --locked -- --test-threads=1` |

Browser checks launch their own headless Chrome with a temporary profile and loopback fixture server. Chrome is expected at its default Windows installation path. The fixture closes its own browser; it must not close the user's Codex, another agent, or a personal browser profile. Some tests write ignored reports/screenshots into `artifacts/`.

`test-complete-text.mjs` optionally accepts `CODE_CODEX_COMPLETE_TEXT_FIXTURE` for a local document. Its normal fixture is synthetic; use that by default so the check is reproducible and doesn't depend on private files.

The [custom editor workflow](https://github.com/ThornsOfire/code-codex/blob/feature/right-editor-pane/.github/workflows/editor-build.yml) runs the three native test packages and builds the native reader/launcher when matching native paths change on the editor branch. Its artifacts are temporary and aren't permanent fork releases. A documentation or UI-only push doesn't trigger that native rebuild under the current path filter.

## Checking the real host

An isolated fixture verifies our contracts, not every future native markup change. When the native adapter changes, check the relevant real-host behavior after using a matching build:

1. Let other active tasks finish before restarting the desktop app.
2. Open synthetic text and Markdown files through the custom explorer. Verify pane layout and normal editing/save behavior.
3. Inspect a native comparison through its live bubble and hover-file list. Verify native selection, mode controls, tab switching, E, fullscreen, resizing and close.
4. Check the chat composer and unsent text are still usable, then verify a cached/other chat doesn't inherit the wrong comparison.
5. Test relevant display sizes/zoom. Restore temporary probes, style overrides and control sessions when finished.

Keep screenshots and native-source inspection artifacts out of the public repository. Don't copy proprietary host source into this fork. Native DOM structure can be inspected to define an adapter; native source code and private React stores aren't our extension API.

## Maintaining documentation

The public documentation is split by purpose:

- [Main README](../../README.md): what this fork does, quick setup, credit and major limits.
- [User guide](README.md): controls, pins, saving, change review and troubleshooting.
- [Editor architecture](architecture.md): owners, protocol flow, budgets, data lifetime and compatibility.
- This guide: build/install distinction and focused verification.
- [Tracker cleanup audit](tracker-cleanup.md): the removed first implementation and current evidence.
- [General architecture](../architecture.md): inherited plugin/application maintenance rules.
- [Startup conflict recovery](../startup-conflict-recovery.md) and [Windows login startup](../login-startup.md): inherited lifecycle details.

Update the documented defaults when behavior changes. For example, the old custom titlebar button, the first 512 KiB-only reader, and the first snapshot tracker's retention settings describe earlier designs, not current behavior.

## What's still future work

| Idea | Current status |
| --- | --- |
| Context meter | Not implemented |
| Selection/right-click citations into chat and jump-back anchors | Not implemented in the committed editor |
| Broader editable-format support | Planned; additional formats and priorities are still to be chosen. Track preview, source/structured editing, and save support separately; don't treat a preview plugin as an editor. |
| Structured Markdown table-cell editing | Source editing exists; a dedicated matrix editor doesn't |
| Configurable name/logo/appearance branding | Not implemented |
| Fork-specific update selection/distribution | Upstream endpoints remain inherited |
| Language servers, completion and debugger integration | Outside the current basic editor |

The public fork should work with ordinary project roots. Personal OpsWolf branding and local application-data organization aren't requirements for contributors.
