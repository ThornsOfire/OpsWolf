# Code Rain integration candidate

The standalone [OpsWolf Code Rain](https://github.com/ThornsOfire/OpsWolf-Code-Rain) renderer is being prepared as an independent API 1 background package. The package and controller are local candidates, **not an enabled or installed Cursadex feature**. Application registration, controls, surface presentation and native integration checks remain to be completed.

## Source and package identity

`packages/explorer-ui/vendor/opswolf-code-rain/` contains the exact renderer, state module and MIT license from source commit `4d68d1fcdddd458d08be1523497b4f2a7af57f55`. `provenance.json` records the source repository, commit, byte lengths and SHA-256 values. Git preserves these bytes without line-ending conversion. The build verifies them before compiling; it performs no fetch, install or dependency download. A future renderer update must deliberately replace the reviewed source, provenance and independent package identity when the compiled bytes change.

The package builder exports `CodeRain`, its settings normalization, preset/constants and rendering budget through the existing background-module registry. Registration creates no canvas and writes no preferences. `startup(target)` creates a renderer owned by that target; callers must dispose it. The host will own enablement, persistence, configuration controls and surface styles. The standalone app's controls/storage are not bundled.

The local fixture builds candidate version `0.1.1` with a dated candidate release tag. That tag is not a published release or a promise that a download exists. The fixture does not add a production catalog entry, alter the native trusted catalog, change caches or install anything into Codex.

## Verification

Run from the checkout:

```powershell
node scripts/test-code-rain-package.mjs
```

The test uses installed esbuild and an isolated headless Chrome fixture. Twenty-three checks cover pinned source, deterministic compilation, license preservation, tampered source and asset rejection, the existing loader's verification identity, inert registration, startup/pause/settings/reduced-motion/forced-colors behavior, repeat disposal/reactivation, and preserved drafts/storage. Results and generated package bytes stay under ignored `artifacts/code-rain-package/`.

The renderer now accepts an optional `frameScheduler` capability. The fixture connects it to Cursadex's real `requestBackgroundFrame` / `cancelBackgroundFrame` functions and checks startup hold, release and disposal while held. This keeps the standalone renderer independent of Codex and avoids replacing global animation functions. Production activation still needs to supply that scheduler; the generic startup preview deliberately uses its normal window scheduler.

This is a real-browser package test using the project's verification helper and UI loader. It is **not** a native companion import or live-host activation test. The renderer suspends drawing under forced colors; the eventual host surface must also hide its decorative canvas, as the standalone app does. These package tests do not establish contrast for native documents over the effect.

## Background controller

`src/plugin-host/backgrounds/code-rain.ts` owns Rain's session settings, renderer, transition notifications and resource lifetime. Its explicit ports prepare a verified package, acquire/release appearance ownership, mount/release the host surface, construct the renderer and access settings storage. The production bindings are still pending. Cross-background decisions remain in `BackgroundActions`; the controller does not enumerate or disable sibling effects.

Initialize before editing settings. Initialization reads bounded schema-1 settings from `cursadex:code-rain:v1` without loading a plugin or activating animation. Edits, preset blends and reset affect the session; only Save writes the current rain snapshot. Paused state and blend timing are not persisted. Invalid/oversized/unreadable saved state reports an error and uses defaults without overwriting it. Failed saves retain the current settings and dirty indicator. Settings snapshots returned to callers are copies, and transition notifications are limited to phase changes or 150 ms intervals.

Activation has a generation guard so cancelled preparation cannot mount a late renderer. A new activation waits for an unfinished release. Disabling while appearance is pending carries the caller's preserve/restore request through cancellation. Failed renderer construction removes the surface; even a disposal error still attempts surface and appearance cleanup. Appearance release ports must be ownership-aware and idempotent, because error recovery and final disposal may both request release.

```powershell
node scripts/test-code-rain-runtime.mjs
```

Twenty-four browser checks use the actual renderer and existing `BackgroundActions` coordinator with explicit fake host appearance/storage ports. They cover save failure, corrupt state, pending preparation/acquisition/release, cleanup failure, transitions, cancellation and restoration of the previous effect after failed activation. This fixture caught a preserve-theme cancellation bug; the fix and regression remain in the controller. Actual native appearance leases, surface styles and UI controls are not certified by this fixture.

## Remaining integration steps

1. Add the independent source definition and normal builder/catalog registration. Explicitly audit rebuilds: shared builder-input changes can invalidate existing package input fingerprints, even when their generated bytes remain identical. Preserve existing identities when bytes match; never bypass source checks or bump unrelated versions to silence them.
2. Bind the candidate background runtime to verified loading and the native appearance/surface lifecycle; add its settings controller. Register it once with the background and panel coordinators. Use existing preparation, exclusion and rollback; do not create a second background policy.
3. Keep rain and interface colors separate. Preserve shared appearance values, document paper, focus/readability, accessibility, hidden lifecycle and input hit targets. Expose the agreed controls and transition lifecycle with explicit save/reset behavior.
4. Build the matching native companion with the candidate catalog. `plugin_store::import_directory` already accepts only regular files with the exact embedded catalog sizes/hashes and rejects redirected paths. Test that normal offline path against a separately owned candidate cache; do not seed the working cache by hand.
5. Test failed preparation, failed activation, cancellation, switching effects, restoration, settings persistence and native presentation. Leave installation and publication for owner review.

The current working app, launcher, plugin catalog and distribution lock remain unchanged by this preparation checkpoint.
