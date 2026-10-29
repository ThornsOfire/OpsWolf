# Editor-fork workflow rules

These rules apply inside this repository. They supplement workspace/user instructions; direct user instructions take precedence. Start with [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the relevant [editor documentation](docs/editor/).

## Scope and ownership

- Inspect the current branch and working-tree diff before editing. Preserve unrelated uncommitted changes, local experiments, and drafts. Stage explicit task files; don't sweep everything into a commit or discard changes you didn't make.
- The editor implementation lives on `feature/right-editor-pane`. `main` currently carries the fork's homepage documentation. Keep publication deliberate; don't merge all source into `main`, change the default branch, tag a release, or publish installers as a side effect of routine work.
- Keep this public fork portable. Derive paths from the workspace/installation; don't bake in a maintainer's Desktop, username, OpsWolf branding, app-state paths, or project names.
- Keep credentials, client documents, screenshots, native-source extracts, app state and developer probes out of public commits. Use synthetic examples in tests and reports. `artifacts/`, `dist/` and `target/` are local/generated areas.
- Preserve upstream credit, license and third-party notices. Document which behavior belongs to this fork. Do not copy proprietary native-app source into the repository.

## Completing a change

- For a meaningful user-facing addition, behavior change, fix, removal, compatibility limit, or dependency/security change, update the appropriate `CHANGELOG.md` **Unreleased** section in the same logical change. Describe the resulting behavior; group implementation commits instead of dumping Git subjects.
- Keep future ideas in the roadmap, not as shipped changelog entries. Use version/date release sections only for an actual authorized release. The inherited 0.5.40 version is not a new editor-fork release number.
- Documentation-only, tests-only and internal maintenance with no user-visible effect may omit an entry. If the runtime-path check flags such a change, document the reason with `Changelog: none - <specific reason>` in the final commit message for that checked range. No extra approval is required for a justified exemption.
- Update user/developer documentation when controls, defaults, limits, data lifetime, build steps or compatibility change. Keep the casual README voice readable; technical instructions and claims must remain precise.
- Reproduce reported bugs in the smallest meaningful fixture where practical, verify the fix, then run checks appropriate to the changed boundary. Don't add tests that only repeat implementation details or run unrelated suites without a reason.
- Before handing off, review the diff, run the changelog check and relevant checks, and report what changed, what was verified, what is still unverified, and whether a restart is required. Keep commits focused and check what is being pushed.

## Editor and native layout

- Keep chat, the explorer, editor visibility, editor fullscreen and native tabs as separate capabilities. E hides/shows; fullscreen changes layout; close-all keeps pins. Avoid broad overlay/CSS changes that steal native hit targets.
- Measure app chrome using qualified app-shell markers. Nested file/diff/content headers must not contribute to the editor's top inset. Check repeated layout updates, zoom, docked/fullscreen transitions, narrow windows, 1080p and 4K when relevant.
- Native DOM adapters must verify active-page and matching chat identity, preserve native handlers and ownership, restore leased styles/listeners on disposal, and leave unknown layouts in their native presentation. Don't access private React stores or reparent/clone native comparison nodes.
- Publish the requested active tab before reopening a hidden editor. Check E, conversation state, native bubble/hover selection, recorded-review opening and fullscreen restore when changing activation.
- Feature controllers own their state and use small capability ports. Follow `docs/architecture.md`; don't import application elements into feature/core modules or silently duplicate policies across layers.

## Files, drafts and history

- Preserve dirty drafts and caret/selection through supported preview, wrap and layout changes. Save-dependent closes/switches must wait for a verified successful save; failures/cancellation keep the draft and tabs. Validate the current editor/workspace identity after asynchronous work.
- Use the normal authenticated workspace bridge, native path/type/sensitive-file policy, expected versions and conflict detection for file operations. Historical diff bodies are read-only; Open file loads the current source through normal preview permissions.
- Never silently present a truncated document as complete or save partial content. Keep native/UI byte limits aligned and document them: currently 10 MiB complete text reads, 512 KiB editing/inline text, and an explicit large-Markdown render action.
- Keep review coverage honest. The persistent panel reads native patch records; it isn't guaranteed to include shell/manual edits and isn't a backup. Don't reintroduce filesystem snapshot capture or a permanent duplicate archive without an explicitly requested design change.
- Keep pins/preferences, running-session drafts, native history and installation assets distinct. Don't imply pins restore unsaved contents after an app restart. Remove only confirmed app-owned temporary/obsolete state, preserving intentional rollback builds unless cleanup is requested.

## Build, installation and live verification

- Pair backend changes with a matching native build and UI; an old native binary plus a new UI can be incompatible. Verify the source/artifact identity and installed hash, and keep a rollback copy when replacing installed assets.
- Never restart/kill live Codex or relocate live app state as a routine test step. Other chats may be working. Install for the next launch and leave restarts to the user unless a restart is explicitly authorized.
- Prefer TaskKit for Windows UI work where available. Use bounded inspection and synthetic test documents; preserve unsent chat and open files, and end control sessions/clean up temporary probes when finished.
- A fixture pass isn't proof of every native app version, language or Windows/GPU configuration. State real-host and CI verification separately from local tests, and don't label checksum matching as a whole-program safety audit.
- Upstream updater/plugin endpoints remain inherited. This project's previous decision to defer hardening still applies; don't silently change distribution trust, updater policy, plugin assets, or unrelated app settings during editor work.
