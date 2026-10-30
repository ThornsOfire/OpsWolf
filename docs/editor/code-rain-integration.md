# Code Rain integration candidate

**Current host acceptance, 2026-10-30:** Alpha.3 is activated; the owner confirms Rain startup, Enable/Disable, saved current settings and previous-theme restoration on Codex package 26.1027.3384.0. BUG-017 is resolved for this tested setup. Later restart retention remains a follow-up. Blend-option persistence is not implemented (F29), and blend performance/cross-theme opacity remain separate. The earlier source-only and pending-live statements below are historical for their named checkpoints. No renderer/plugin pin or updater-policy change was part of this repair.

## Current local state — OpsWolf dev.9 baseline / Rain plugin 0.1.2

The owner-used dev.9 baseline retains reviewed renderer commit `c976189e3ec78d0f902a27e5aacf33470c38ebd8`. Plugin 0.1.2 is independently named and pinned: 10,580 bytes, SHA-256 `8e2909de7967c0d1a8432833c45c71320d08a9f3220d0c29a42f2bd84977cdae`. Its fixed 30 FPS deadlines correct the reproduced 20–23 FPS cadence slip without changing appearance, resource caps, persistence or opt-ins. The matching native/UI build passed normal offline import of all 27 locked packages; the other 26 lock entries were unchanged. Source/public plugin releases remain unapproved. Drawing the intended extra frames can increase work; this is a smoothness fix, not a GPU-saving claim.

The current baseline retains dev.5's repairs for the peeking sidebar's overflowing menu and the opaque inner mount/scroll/file layers in hosted Changes. It also includes dev.6's reviewed empty-placeholder repair: in docked/fullscreen layouts it shares the existing Rain main-surface mask, while text stays opaque and forced-colors retains the system backing. Robbie reports editor transparency works with Code Rain but not other themes (BUG-012); this does not establish general theme compatibility. Current Changes/flyout/file-tree opacity and existing inactive-window/manual pause behavior stay intact. The visible OpsWolf rebrand is integrated, with header/menu alignment accepted in the owner's dev.9 checklist.

The owner reports generally smoother Rain, with remaining frame drops during preset → Save → Start blend, resolving after the blend completes (BUG-011). This is newly noticed, not a confirmed regression or measured FPS result. Native Hide tabs/header overlap (BUG-009) is repaired and owner-accepted for tested layouts; unknown future layouts remain a compatibility boundary. Direct active-theme settings in the explorer header is a recorded request (F26); settings still open through Preview Market. See [known issues](known-issues.md).

The integration history below describes the prior 0.1.1 package and its original source pin. Preserve the previous working host/plugin set for rollback. An integrate-only component never activates itself. Current per-repository instructions must work without a maintainer's private workspace layout.

Inactive-window playback and the default-on pause preference are described in [window focus behavior](code-rain-focus.md).

## Host update resilience — source repair, live acceptance pending

The owner reported Rain missing after the host changed from Windows package `26.1023.6621.0` to `26.1027.3384.0`. The appearance modules were loaded but absent from the preload/resource entries the original detector searched. A saved enabled selection also survived the failed start, so Disable incorrectly retried activation. The standalone renderer was not identified as the cause.

The local source repair adds the already preloaded `app-shared` role to existing initial/split-dispatcher discovery. It imports only same-origin, query/fragment/credential-free role URLs, accepts at most one module per role and requires a unique matching host RPC capability across deduplicated exports. Inspection skips unrelated accessor exports and object-method getters while preserving the observed callable RPC-proxy shape. It does not use hash constants, private framework stores, source crawling or a production debugger connection. This is an adapter for observed host capabilities, not a documented guarantee that those capabilities will remain stable.

Discovery has four finite startup attempts and a bounded import wait. Rejected discovery is not permanently cached. Native ES-module evaluation cannot be cancelled once started; a late import result does not authorize an appearance action after our wait fails. Each module and the combined unique-export inspection have an 8,192-export limit; an oversized or ambiguous host fails explicitly instead of guessing. A missing interface retains the compatibility error and leaves unrelated editor work usable.

Rain now labels actual runtime state separately: **Running**, **Selected · Not running**, or **Disabled**. Disable deselects a failed, inactive selection without attempting activation. With no owned theme lease, this requires no appearance read/write. If an acquired lease cannot be restored, cleanup retains an explicit error and ownership for retry rather than silently claiming restoration. Renderer/plugin pins, persisted Rain configurations and update policy are unchanged.

Alpha.2 was activated and failed owner testing on two additional host details: one unrelated callable export throws during function-string inspection, and RPC methods synthesize `.call`/`.apply` properties. Replacement source guards each inspection and uses `Reflect.apply` for invocation while preserving the namespace receiver. A read-only query against the real host confirms the intrinsic invocation returns its actual mode. It does not alter the running bundle.

The replacement source passes 48 appearance/native-Rain/card checks and 9 full production-explorer checks. The latter reproduce the exact alpha.2 failure in a preserved bundle, then verify startup through the shared callable proxy, persisted selection/owned lease, normal package-market button clicks, repeated Enable/Disable, system-theme restoration and retained unsent drafts with repaired source. Earlier 28 Rain runtime, 18 coordinator/isolation, 20 particle-lifecycle and 20 Rain-layout checks remain in the combined qualification. These are synthetic behavior checks plus a read-only real-host capability observation; a replacement build still needs live acceptance.

The local rollout distinguishes the currently selected test build from the confirmed recovery build and explicit settings donor. Failed alpha.2 is not automatically promoted to known-good rollback. See the coordinator deployment standard where available. Planned manual update holds and their visible status are a separate roadmap item, not part of this repair.

## Historical initial integration and verification

The following initial-checkpoint notes predate dev.5 and are retained as historical evidence. Their old package/runtime identities and pending activation statements are not current launch instructions.

**Initial owner check, 2026-10-29:** Code Rain appeared to work in the activated host. This confirmed initial live use only.

The same owner pass found two appearance mismatches: distracting bleed-through in the collapsed native sidebar's hover flyout, and a fully opaque custom editor including native Changes. The fully expanded native sidebar looks good. These are open integration reports, not a diagnosis that the renderer is at fault. Inspect surface ownership and content readability before adjusting opacity; preserve the expanded-sidebar appearance and do not claim full theme compatibility from animation alone.

The standalone [OpsWolf Code Rain](https://github.com/ThornsOfire/OpsWolf-Code-Rain) renderer is integrated as an independent API 1 background package. Its catalog entry, runtime bindings and settings are implemented. The owner has activated the matching test UI/native pair with Rain imported through normal verification. **Live effect interaction, document readability and restart persistence remain unverified.** The original host installation remains preserved; no source or plugin release has been published.

## Rain host repair review — BUG-003/004/005

The following checkpoint supersedes the investigation status in the original owner report above. These are host repairs; standalone 0.1.0 and the verified Rain plugin 0.1.1 remain unchanged.

- **Settings:** the outer content box/border and inherited CSS zoom were not accounted for in viewport positioning. The complete border box now fits the visual viewport, including short/narrow windows and inherited zoom. Internal scrolling remains; Save is reachable by scrolling or Tab. Repositioning does not recreate inputs, save settings or move focus. Visual-viewport listeners use the existing abort scope. Existing market resize-close behavior remains; reopening retains session values.
- **Collapsed native sidebar:** the floating-panel marker previously shared the expanded sidebar's .66 mask. Rain now uses a solid dark backing only for that flyout, even with the optional sidebar opacity control set low. The expanded sidebar keeps its original styling. The exact current live hover container still needs qualification.
- **Editor and Changes:** cleared child layers were still covered by the docked editor host's opaque backing. Rain now clears that host, exposing the existing main readability mask. Hosted native Changes separately used an opaque leased background; it now consumes a Rain-owned backing variable, falling back to the original native theme when Rain stops. Toolbar controls, text colors, document paper and native comparison nodes/handlers are preserved. Unknown native markup retains existing behavior.

The isolated **0.1.0-dev.2 review snapshot** uses base commit `6e010a631c40c5fb59977b53f7324987ad52d319` plus the exact Rain working-file hashes in ignored `artifacts/rain-review/review-manifest.json`. This is not a committed source revision or an activated build. Concurrent Companion/send-follow edits are excluded from the snapshot. The shared checkout's version metadata remains unchanged; coordinate the next combined build version before any activation.

UI SHA-256: `ee74d4bcb54d9d213389cad3ed625807edec502ab531477bfeabe9ddb6bb72c1`. Normal production build verification passed without rebuilding plugins or changing catalog/lock/provenance. Rain remains 10,422 bytes, SHA-256 `751c10db39c69748738c36cc8fce3e7cc8afaf1ab8e2dfe6cae08a26861af639`. The pinned shared native-style helper remains unchanged; Rain-specific rules live in the host-only `code-rain-native-surfaces.ts`.

Evidence: 20 focused layout/sidebar checks (six viewport/zoom cases through 320×240 at 200%, keyboard Save access, focus/unsaved input and disable restoration); 51 native Changes checks; 33 production UI checks including 19 Rain checks; 23 verified package checks; 160 shared surfaces; 24 controller checks; 31 startup/pin checks. TypeScript, version validation, architecture (222 files, 621 runtime edges, zero cycles), changelog structure and diff checks passed. These are separate synthetic suites. Narrow production settings capture reviewed. Baseline failures remain in `artifacts/rain-layout/baseline.json`.

TaskKit returned no visible Cursadex window during this pass. No desktop input, restart, installation replacement or publication occurred. Live hover qualification, appearance over real content and physical window/zoom acceptance remain open. No backend code changed.

Do **not** restart expecting this fix from the current launcher. First review the snapshot and arrange a separate verified, immutable UI/native activation handoff. After that handoff, test: (1) open Rain settings at normal and enlarged zoom, shorten the window, scroll/Tab to Save; (2) compare collapsed hover and fully expanded sidebar readability; (3) compare text Edit/Preview, Markdown and native Changes in docked/fullscreen layouts; (4) disable Rain and verify appearance restoration, document drafts and composer text; (5) explicitly Save a harmless Rain setting and verify it on the next owner-controlled normal restart. Do not restart during other active work.

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

Run the normal candidate build with `node packages/explorer-ui/scripts/build.mjs`. For a deliberate Rain-only source/package update, select `--rebuild-plugins=code-rain` and review `dist/plugin-rebuild-report.json` plus the distribution lock. Use `all` only for an explicitly reviewed all-package update. Shared builder input changes require an audit even when asset bytes stay unchanged. Historically, the initial integration preserved 25 other packages and advanced the startup player to `1.1.28`; dev.5 separately preserves all 26 other entries while advancing Rain to `0.1.2`.

Two build-portability issues were discovered and corrected: the verbatim ASCII shader must retain LF checkout endings, and esbuild must preserve dependency symlink paths so a worktree's local `node_modules` junction produces checkout-relative input provenance. The existing distribution path/hash checks remain intact. Generated metafiles stay local; the lock records reviewed input hashes.

```powershell
node scripts/test-background-packages.mjs
node scripts/test-startup-sources-pins.mjs
node scripts/test-background-surfaces.mjs
```

The production UI fixture passes 33 checks, including 19 Rain checks for normal package gating, cross-effect exclusion, settings/persistence, pause/blend/reset, narrow layout, focus return, forced colors, Dark acquisition/restoration and external appearance changes. The original pin/source fixture now derives counts from the catalog rather than assuming 26 cards; 31 checks pass. Shared surface tests cover 160 checks. Browser/native-RPC fixtures remain distinct from live Codex interaction.

The matching native release built with `cargo build --offline --locked --release -p code-codex --bin code-codex`. Its ordinary `plugins --import-dir <package-directory>` command imported Rain into a unique fixture folder containing the executable and a schema-1 Code-Codex storage marker. `plugins` then reported only Rain installed, and the cache's 10,422 bytes matched SHA-256 `751c10db39c69748738c36cc8fce3e7cc8afaf1ab8e2dfe6cae08a26861af639`. Evidence remains under ignored `artifacts/code-rain-package/` and `artifacts/code-rain-native-*`.

Remaining: live integrated presentation, real interaction/readability with documents and startup on the owner's actual host. The owner has activated the test host and its imported plugin cache; full effect acceptance is still pending. Publication remains subject to review. Standalone 0.1.0, host plugin 0.1.1 and the later Cursadex fork display 0.1.0-dev.1 identify different artifacts. The public Rain remote remains unpushed; no version tag or downloadable package release is implied by local import.

## Historical dev.2 staging record


Owner-authorized staging checkpoint, 2026-10-29: staged candidate-rain-0.1.0-dev.2-ee74d4bc under AppData/CursadexTest/versions. All 50 staged assets passed SHA-256 checks; normal offline import verified 27 plugins, including unchanged Rain 0.1.1. Native executable/launcher are the verified e4fe78b pair from the current candidate; repository native/Cargo sources have no differences from that native commit to this snapshot base. Staging receipt: artifacts/rain-review/staging-receipt.json. The current launcher and active launch-manifest.json were hashed before/after and are unchanged. No running build, live settings, databases or process was changed. No restart, activation or publication.

This staged snapshot contains Rain fixes only, excluding concurrent Companion/send-follow patches. Existing Test Cursadex Update.cmd still selects 0b47a7d. Before restarting for multiple agents' fixes, coordinate a combined reviewed build/activation. Otherwise a separate Rain-only activation handoff is still required. Do not run the old activation helper expecting this staged version.

## Empty editor follow-up / dev.5 owner feedback

Owner accepts the current flyout opacity and, after reconsidering left/right, requests no Changes-opacity adjustment. Empty editor remains solid: its .editor-empty placeholder independently paints the theme background and was omitted by Rain's transparency rules. Component cursadex-code-rain-0.1.0-dev.5-empty.1-sc88facfbf3e0 adds only a Rain-specific placeholder clear inside forced-colors:none; current Changes/tree/flyout levels stay unchanged. Eight focused, 11 existing layered-surface and 160 shared-surface browser checks pass. These are synthetic; no current host/source/plugin/launcher changed. Frozen manifest: Code Rain/artifacts/handoffs/cursadex-code-rain-0.1.0-dev.5-empty.1-sc88facfbf3e0/handoff.json. Coordinator must merge the CSS delta plus supplied Unreleased/guide note and build a new application; owner then checks empty docked/fullscreen editor, restoration and retained controls/drafts. No restart for this component alone.
