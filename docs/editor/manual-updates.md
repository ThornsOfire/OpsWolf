# Reviewed updates

The footer's **Update available** button reports a newer **Code-Codex upstream** release. It does not mean a newer OpsWolf build exists. **Review updates** opens the same panel when no newer upstream release has been found; **Update check failed** keeps a failed check distinct from being up to date.

## Review without installing

Open the indicator beside the version labels. The review shows the running upstream base, checked release/tag/link, last successful check time and, when valid metadata supplies it, the setup filename, exact URL, byte count and SHA-256. This identity describes a candidate asset, not proof of compatibility, approval or a completed download. Missing/invalid asset identity is explicit. No installer is downloaded by checking or reviewing.

**Check again** refreshes metadata and keeps the review open. A failed check labels any earlier result as potentially stale. Startup checks share the native launch's cached result, including its original timestamp; manual checks fetch fresh metadata. Closing with **Keep pending / Close** or Escape accepts nothing and does not save an update authorization or preference. The panel restores focus to its usable opening control, with an enabled indicator fallback.

## What is controlled

| Product | What this build can report/control |
| --- | --- |
| OpsWolf | Running fork version. No published installer/update feed is configured. A replacement build requires separately reviewed source/artifact identity, compatibility evidence, preserved rollback and explicit owner-authorized activation. |
| Code-Codex upstream | Stable-release metadata from the existing trusted GitHub endpoint. The matching OpsWolf native companion blocks its installer mutation route before any network download or process launch. This is a real local installation block, not a claim that all external installations are held. |
| Official Codex host / Windows Store | Observed host package version only. Availability and update control are not supplied by this updater. Store/host updates are outside its control and are not held. |
| Plugins | This build's pinned catalog and verified local cache. Existing Preview Market package downloads remain explicit actions; cached startup loading is not an automatic download. There is no independent latest-plugin feed or enforced external plugin hold. |

Upstream Code-Codex setup can replace OpsWolf and enters installation directly. The old one-click installer path is disabled in this fork. No panel action can override the block. An older renderer's direct `explorer.update.install` request is rejected by the updated native route as well.

Reviewing a release or keeping it pending never authorizes an agent to install it. Even explicit acceptance of a version does not authorize a different asset, rebuilt bytes or an automatic restart. Use the project's reviewed deployment workflow with exact hashes and rollback; a source push or metadata check is not an activation. See [versioning](versioning.md).

## Connection and compatibility boundaries

Native policy confirmation belongs to the connection that returned it. Disconnect, cancellation, replacement or a failed latest check invalidates the current-policy claim; historical release information can remain visible with a clear warning. An older companion without policy metadata is shown as unverified, never as enforcing a hold. The renderer itself never requests installation. Use the matching native/UI build before relying on the native block. Preferences, profiles, chats, existing caches and upstream/Store settings are unchanged.

The review uses ordinary selectable text and a trusted release link. Long hashes/URLs wrap; the panel scrolls at narrow widths. Keyboard activation, Escape/focus return and synthetic 180/220/390px layouts at 100%/120% zoom are covered by `node scripts/test-update-policy.mjs`. The historical `test-update-handoff.mjs` command now invokes that fail-closed suite because renderer installer launching was intentionally removed. Legacy native asset/hash/URL and installer-window validation tests remain; none are a live installation test.
