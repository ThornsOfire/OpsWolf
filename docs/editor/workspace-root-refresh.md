# Workspace-root refresh fix

Prepared 2026-10-29 on `fix/workspace-root-revalidation`, from baseline `142c2b8c434a026761a68bd9a0225deccc228c23`. This is a separate candidate; the working installation has not been replaced or reloaded.

## Root selection and failure

The active-thread tracker selects a local chat ID. `CodeCodexElement.#switchThread` requests `explorer.context`; the native bridge calls `AppServerClient.resolve_thread`, then opens a restricted `Workspace` at the returned cwd. The tree lists and watches that workspace. Project name/root labels are derived from it. An explicit launcher workspace is an intentional independent override; normal chat-following mode has no separate folder selection.

Two mechanisms kept a moved chat stale:

1. `context-resolver` cached each thread's cwd for the lifetime of its App Server client. Later resolutions returned that cached path without asking for current metadata. A `thread/started` notification could populate the same cache, but moving an existing chat does not necessarily produce a new-start event.
2. The renderer short-circuited selection updates for the same chat ID. Its Refresh action re-listed the bound workspace, rather than re-resolving its root.

Thus a chat could have updated project/cwd metadata and an updated execution environment while the companion and renderer retained their original root. Opening a folder through a different Codex panel does not rebind this workspace. The reported live metadata was supplied by the owner; no live App Server restart, database inspection, thread move, or reproduction against their active sessions was performed.

## Change

- Resolve cwd from read-only `thread/read` on each resolution, retaining the existing paginated `thread/list` fallback and exact-ID validation. Remove the permanent cwd cache. Notifications still pass through normally.
- Add authenticated `explorer.context.check`, declared read-only in the bridge contract. It reads the currently bound thread's metadata, canonicalizes the destination through the normal Workspace policy, and verifies that its original context is still current. It does not replace the workspace, watcher, or IO destination.
- Revalidate on Refresh, focus/visibility wake, and every 15 seconds while the active chat is visible and its tree is ready or empty. Probes do not overlap. Unchanged roots do not reset the tree.
- Ignore replies from a different chat, generation, bridge, or controller lifetime. Failed/malformed metadata preserves the existing workspace.
- If the root changed, reuse the normal generation-guarded workspace switch and listing/watch setup. Clear old tree selections/filter state. An empty destination remains a valid project.
- Defer automatic switching while an editor draft is dirty or saving. Announce the deferral once per destination. Save/discard then Refresh, or the next eligible check, allows the switch. Old draft content is never silently retargeted to the new root.
- Preserve explicit manual-workspace overrides.

## Validation

- `cargo test -p context-resolver --locked --offline`: 13 passed. The resolver test now resolves one chat at its original cwd, resolves that same ID at its new cwd, switches to another chat, and returns to the moved chat.
- `cargo test -p code-codex --bin code-codex context_ --locked --offline -- --test-threads=1`: 11 passed, including new native tests for read-only checks/manual override and same-chat moves followed by chat switching.
- `node scripts/test-root-revalidation.mjs`: 16 passed, including unattended timer detection, deferred edits, stale replies, errors, overlapping probes, and disposal/restart.
- `node scripts/test-workspace-root-host.mjs`: full explorer fixture passed. It moves a same-ID chat to an empty project, refreshes after files become available, switches to another project and back, and retains existing layout, background, bootstrap, composer-hit-target and no-error assertions.
- TypeScript, UI build, architecture/bridge-contract validation, changelog validation and whitespace review passed.
- Matching native development executables built offline in `target/debug/`; the candidate UI is in `packages/explorer-ui/dist/`. Existing compiler warnings remain. These are development artifacts, not a published or installed release.

The unchanged broader `test-codex-current-ui.mjs` has a conversation-title assertion failure (`Conversation` versus `Current title`). It also fails against the original baseline checkout/bundle. That test was preserved, not weakened; the root-specific full-host fixture does not claim title synchronization coverage. Initial root-fixture revisions also exposed an empty-state eligibility omission and test timing/loading-placeholder assumptions; those were corrected before the passing runs.

No live host acceptance has been claimed. Isolated fixture browsers/servers were closed. No new dependencies were downloaded. No app/backend/session restart, live bundle injection, installation replacement, remote write, merge, or push was performed.

## Activation and current stale panel

The installed companion retains the old cache in process memory. Neither another ordinary directory Refresh nor switching chats is a reliable eviction mechanism; a UI-only reload would still use that companion. There is no verified supported in-place repair for that existing process without altering the live environment.

After running work finishes, integrate/review this local change with the other candidate, deploy a matching native/UI build, and relaunch through the custom companion. A Windows reboot is not required by this fix. The user should choose the restart time; no restart was attempted. Actual metadata availability after a real project move and the native installation/launch remain live verification steps.
