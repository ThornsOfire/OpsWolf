# Cursadex versions

`cursadex-version.json` at the repository root is the fork version's source of truth. The initial development version is **0.1.0-dev.1**, alongside upstream **0.5.40**. The explorer footer displays both. The upstream button retains its original update-check action; the fork label does not claim an automatic fork updater exists.

The upstream package/Cargo versions, custom-element identities, bridge protocol and plugin verification continue to use their existing upstream identifiers. Do not bump those merely to change our display version. Run `node scripts/check-version.mjs` before building: it rejects an invalid fork version or an upstream identity that disagrees with the UI package. The existing shared build script is pinned by plugin source manifests and remains unchanged; do not silently invalidate/rebuild unrelated plugins to add display metadata.

## Development workflow

1. Make a focused change, update its feature/bug status, user guide and Unreleased changelog as appropriate.
2. Before handing off a distinct replacement development build, increment the prerelease number (`0.1.0-dev.2`, then `dev.3`, and so on). One version identifies one reviewed handoff; retries before handoff need not each consume a version.
3. Build/test and record the exact source commit, fork/upstream versions, UI/native hashes and required plugin identities in its artifact manifest. A version alone is not a checksum or proof that tests passed.
4. Stage under a new version/build directory with rollback evidence. Do not overwrite the immutable running `0b47a7d` test build or edit its pinned manifest to accommodate new bytes. No activation or restart is automatic.
5. Keep development entries under Unreleased. After owner review and explicit publication approval, choose a release version/date, update the release notes and create any authorized tag/release. A local development version is not a published release.

For stable versions, use patch for compatible fixes, minor for compatible features, and major for incompatible supported contracts. While pre-1.0, document compatibility changes explicitly and advance the minor version for a breaking change. Upstream base upgrades are tracked separately and require their own compatibility checks.

The previously activated candidate is identified by runtime commit `0b47a7d` and its existing hashes. It predates this footer; do not retroactively claim its compiled UI displays a fork version. This first versioned source build adds the labels and documentation organization; it does not fix activity auto-expansion or add automatic project renaming.
