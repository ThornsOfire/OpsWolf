# OpsWolf versions

`cursadex-version.json` at the repository root is the fork version's source of truth: currently **0.1.0-alpha.3**, alongside upstream **0.5.40**. Alpha.3 contains the owner-tested Rain host-compatibility repair and Codex version/footer changes. Source publication does not create an installer, tag or release, and it does not activate a build. The local alpha.3 application passed startup, Enable/Disable, saved current settings and prior-theme restoration on Codex Windows package26.1027.3384.0; later restart retention remains a follow-up. Dev.9 remains the confirmed recovery baseline; failed alpha.2 is retained as evidence. The explorer footer reports its own built version, so editing source metadata never updates a running app. The upstream button retains its original update check; no automatic fork updater or update freeze is implemented.

The visible product name is OpsWolf, formerly Cursadex. The owner separately renamed the GitHub repository to `ThornsOfire/OpsWolf`; canonical clone/menu/docs URLs now follow that name. The technical filename `cursadex-version.json`, storage/event names, theme hooks and historical build IDs retain their existing names. The upstream package/Cargo versions, custom-element identities, bridge protocol and plugin verification continue to use their existing upstream identifiers. Do not bump those merely to change our display version. Run `node scripts/check-version.mjs` before building: it rejects an invalid fork version or an upstream identity that disagrees with the UI package. The existing shared build script is pinned by plugin source manifests and remains unchanged; do not silently invalidate/rebuild unrelated plugins to add display metadata.

## Codex host identity

The footer also shows `Codex v…` from the current launcher bootstrap’s `codexVersion`. This identifies the attached Windows package and may differ from Codex’s internal About/updater version. It is separate from the OpsWolf fork and upstream Code-Codex labels. Missing or unrecognized host metadata is shown as “Codex version unavailable”; the UI never substitutes a build-time or upstream version. Reconnecting the native bridge refreshes the label. The footer does not check or install Codex updates. Preview Market remains in the top application menu.

## Development workflow

1. Make a focused change, update its feature/bug status, user guide and Unreleased changelog as appropriate.
2. Before handing off a distinct replacement development build, increment the prerelease number (`0.1.0-dev.2`, then `dev.3`, and so on). One version identifies one reviewed handoff; retries before handoff need not each consume a version.
3. Build/test and record the exact source commit, fork/upstream versions, UI/native hashes and required plugin identities in its artifact manifest. A version alone is not a checksum or proof that tests passed.
4. Stage under a new version/build directory with rollback evidence. Do not overwrite any immutable running or previously reviewed build, or edit its pinned manifest to accommodate new bytes. No activation or restart is automatic.
5. Keep development entries under Unreleased. After owner review and explicit publication approval, choose a release version/date, update the release notes and create any authorized tag/release. A local development version is not a published release.

For stable versions, use patch for compatible fixes, minor for compatible features, and major for incompatible supported contracts. While pre-1.0, document compatibility changes explicitly and advance the minor version for a breaking change. Upstream base upgrades are tracked separately and require their own compatibility checks.

Historical initial-footer checkpoint: development version 0.1.0-dev.1 followed runtime `0b47a7d`, which had no fork footer. That history does not describe the current activated build. Activity auto-expansion and automatic project-folder renaming remain separate unresolved/deferred work.
