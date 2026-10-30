# Code Rain integration candidate

The standalone [OpsWolf Code Rain](https://github.com/ThornsOfire/OpsWolf-Code-Rain) renderer is integrated as an independent API 1 background package. Its catalog entry, runtime bindings and settings are implemented. The owner has activated the matching test UI/native pair with Rain imported through normal verification. **Live effect interaction, document readability and restart persistence remain unverified.** The original host installation remains preserved; no source or plugin release has been published.

## Source and package identity

`packages/explorer-ui/vendor/opswolf-code-rain/` contains the exact renderer, state module and MIT license from source commit `4d68d1fcdddd458d08be1523497b4f2a7af57f55`. `provenance.json` records the source repository, commit, byte lengths and SHA-256 values. Git preserves these bytes without line-ending conversion. The build verifies them before compiling; it performs no fetch, install or dependency download. A future renderer update must deliberately replace the reviewed source, provenance and independent package identity when the compiled bytes change.

The package builder exports `CodeRain`, its settings normalization, preset/constants and rendering budget through the existing background-module registry. Registration creates no canvas and writes no preferences. `startup(target)` creates a renderer owned by that target; callers must dispose it. The host owns enablement, persistence, configuration controls and surface styles. The standalone app's controls/storage are not bundled.

The candidate catalog builds version `0.1.1` with the dated candidate release tag `plugin-assets-2026-10-29`. That tag is not a published release or a promise that a download exists. Normal Download would require an authorized publication; local candidate testing uses the existing native offline importer, without changing download endpoints or bypassing verification.

## Verification

Run from the checkout:

```powershell
node scripts/test-code-rain-package.mjs
```

The test uses installed esbuild and an isolated headless Chrome fixture. Twenty-three checks cover pinned source, deterministic compilation, license preservation, tampered source and asset rejection, the existing loader's verification identity, inert registration, startup/pause/settings/reduced-motion/forced-colors behavior, repeat disposal/reactivation, and preserved drafts/storage. Results and generated package bytes stay under ignored `artifacts/code-rain-package/`.

The renderer accepts an optional `frameScheduler` capability. Production activation supplies Cursadex's `requestBackgroundFrame` / `cancelBackgroundFrame`, and the fixture checks startup hold, release and disposal while held. This keeps the standalone renderer independent of Codex and avoids replacing global animation functions. The generic startup preview deliberately uses its normal window scheduler.

This is a real-browser package test using the project's verification helper and UI loader. It is **not** a live-host activation test. Native import is checked separately. The renderer suspends drawing under forced colors and the host hides its decorative canvas. These package tests alone do not establish contrast for native documents over the effect.

## Background controller

`src/plugin-host/backgrounds/code-rain.ts` owns Rain's session settings, renderer, transition notifications and resource lifetime. Its explicit ports prepare a verified package, acquire/release appearance ownership, mount/release the host surface, construct the renderer and access settings storage. `code-rain-native.ts` binds those ports to the existing verified loader, native appearance adapter, ownership-aware surface cleanup and host frame scheduler. Cross-background decisions remain in `BackgroundActions`; the controller does not enumerate or disable sibling effects.

Initialize before editing settings. Initialization reads bounded schema-1 settings from `cursadex:code-rain:v1` without loading a plugin or activating animation. Edits, preset blends and reset affect the session; only Save writes the current rain snapshot. Paused state and blend timing are not persisted. Invalid/oversized/unreadable saved state reports an error and uses defaults without overwriting it. Failed saves retain the current settings and dirty indicator. Settings snapshots returned to callers are copies, and transition notifications are limited to phase changes or 150 ms intervals.

Activation has a generation guard so cancelled preparation cannot mount a late renderer. A new activation waits for an unfinished release. Disabling while appearance is pending carries the caller's preserve/restore request through cancellation. Failed renderer construction removes the surface; even a disposal error still attempts surface and appearance cleanup. Appearance release ports must be ownership-aware and idempotent, because error recovery and final disposal may both request release.

```powershell
node scripts/test-code-rain-runtime.mjs
```

Twenty-four browser checks use the actual renderer and existing `BackgroundActions` coordinator with explicit fake host appearance/storage ports. They cover save failure, corrupt state, pending preparation/acquisition/release, cleanup failure, transitions, cancellation and restoration of the previous effect after failed activation. This fixture caught a preserve-theme cancellation bug; the fix and regression remain in the controller. Actual native appearance leases, surface styles and UI controls are checked by the separate production UI fixture below, with native RPC still mocked.

## Controls and application integration

After the verified package is available, enable **Code Rain Background** in Preview Market's Appearance category. Its sliders button opens the settings panel. Seven numeric controls, four rain colors and the character set remain independent of interface colors. Apply selects one of four presets; Start blend interpolates toward it using duration, hold and optional return looping. Pause suspends playback, Stop blend retains the current intermediate settings, Reset current changes the session, and Save persists the current snapshot. Blend timing and paused state are session-only. The existing market closes its panels when the window is resized; reopening preserves unsaved settings.

Activation uses Dark appearance. Disabling restores a prior Light/System preference only while the owned forced preference still applies. A manual native appearance change wins: Rain stops and its enabled preference clears. Its canvas uses the shared particle surface contract, cannot intercept pointer input, and is hidden in forced colors. Settings use the shared semantic interface colors. No files, citation data or composer history are stored by this feature.

## Build and verification

Run `node scripts/check-version.mjs` first for host/fork identity validation. This does not change standalone Rain's package version or the pinned plugin identity.

Run the normal candidate build with `node packages/explorer-ui/scripts/build.mjs`. For a deliberate source/package update, use `--rebuild-plugins=all` and review `dist/plugin-rebuild-report.json` plus the distribution lock. Shared builder input changes require an explicit audit even when asset bytes are unchanged. This integration preserved the exact identities of all 25 unchanged packages. The startup player changed to candidate `1.1.28` because its source list now includes Rain; Rain itself is `0.1.1`.

Two build-portability issues were discovered and corrected: the verbatim ASCII shader must retain LF checkout endings, and esbuild must preserve dependency symlink paths so a worktree's local `node_modules` junction produces checkout-relative input provenance. The existing distribution path/hash checks remain intact. Generated metafiles stay local; the lock records reviewed input hashes.

```powershell
node scripts/test-background-packages.mjs
node scripts/test-startup-sources-pins.mjs
node scripts/test-background-surfaces.mjs
```

The production UI fixture passes 33 checks, including 19 Rain checks for normal package gating, cross-effect exclusion, settings/persistence, pause/blend/reset, narrow layout, focus return, forced colors, Dark acquisition/restoration and external appearance changes. The original pin/source fixture now derives counts from the catalog rather than assuming 26 cards; 31 checks pass. Shared surface tests cover 160 checks. Browser/native-RPC fixtures remain distinct from live Codex interaction.

The matching native release built with `cargo build --offline --locked --release -p code-codex --bin code-codex`. Its ordinary `plugins --import-dir <package-directory>` command imported Rain into a unique fixture folder containing the executable and a schema-1 Code-Codex storage marker. `plugins` then reported only Rain installed, and the cache's 10,422 bytes matched SHA-256 `751c10db39c69748738c36cc8fce3e7cc8afaf1ab8e2dfe6cae08a26861af639`. Evidence remains under ignored `artifacts/code-rain-package/` and `artifacts/code-rain-native-*`.

Remaining: live integrated presentation, real interaction/readability with documents and startup on the owner's actual host. The owner has activated the test host and its imported plugin cache; full effect acceptance is still pending. Publication remains subject to review. Standalone 0.1.0, host plugin 0.1.1 and the later Cursadex fork display 0.1.0-dev.1 identify different artifacts. The public Rain remote remains unpushed; no version tag or downloadable package release is implied by local import.
