# Upstream 0.6.0 integration

OpsWolf alpha.14 is an integration candidate based on corrected Code-Codex **0.6.0**, commit `96d58788f8b90661095e33fe562d5f2e7149cf5c`. The upstream release was replaced under the same version, so the version label alone is insufficient to identify its source. The prior OpsWolf alpha.13 source, including its uncommitted fixes and offline startup-status helper, was preserved before integration.

This source change does not update a running app. Use a matching rebuilt native companion and renderer, an exact artifact manifest, preserved rollback, and separately authorized activation. Source and synthetic test results do not establish compatibility with the currently installed official Codex host or its packaged AppServer.

## Preserved fork behavior

The integration retains the editor and draft/save ownership, complete-text read limits, citations, native change review, workspace-root checks, branding/preferences, Code Rain source identity, and manual-Dark appearance fallback. Upstream layout and appearance changes must pass those regression checks before the candidate is accepted. Keep native account, restart, inventory, installer and plugin activation behavior separate from static capability detection.

The native upstream installer RPC remains blocked before download or launch because stock Code-Codex setup can replace OpsWolf. Release metadata remains available. This block does not freeze Microsoft Store, official Codex or independent plugin updates.

## Restart and renderer ownership

In-app Restart is held in OpsWolf because the upstream helper cannot preserve the selected launcher, renderer and profile. Close OpsWolf normally and reopen the reviewed OpsWolf launcher. Both the renderer request and the hidden restart worker entry refuse before scheduling or closing an application.

A different renderer build must start in a fresh document. Hot replacement is deferred while an existing or unverified renderer owns the document, preserving its module-local drafts and services. This does not save drafts to disk or promise draft recovery after a normal app restart. Same-build reconnect remains supported. This renderer guard does not qualify native hot activation or cancel effects that happen before the renderer is evaluated. Unknown clipped-shell layouts retain the safe drawer fallback instead of mounting inside an overflow-clipped conversation.

## Build and evidence

- Use the exact source revision and lockfiles. The renderer now includes a build-specific custom-element identity, recorded beside its bundle in `dist/ui-build.json`; compiled fixture selectors must match that actual bundle.
- Upstream adds the pinned `three-ocean-r128` alias for `three@0.128.0`. Its archive and module input must match the lock. It is a build dependency even when Shallow Ocean uses a prebuilt plugin.
- Shared build scripts are recorded plugin inputs. Reconcile plugin locks through an explicit reviewed rebuild and byte comparison. Never replace fingerprints merely to make checks pass. Changed artifact bytes require a new independent package identity; unchanged bytes retain their identity.
- Run source/type/architecture/localization checks, offline locked Rust checks, and affected synthetic regressions. A source test that launches browser/native processes, changes Windows state or provisions tools needs its actual execution boundary reviewed first.
- Preserve the first failure logs. Missing dependencies, required unrun browser/native cases, runtime versions and live acceptance stay explicit in the handoff.

The source version is reserved for this local candidate. No installer, release publication, live deployment or current-host restoration is established by these notes.

## New upstream startup effects and remaining qualification

The official host-update ledger observes once per supervisor startup. A first or changed-version observation can scan installed package files and write local status/reports. Same-version startup skips traversal, so the version label cannot prove that package bytes are unchanged. Reports describe static dependencies and explicitly leave functional compatibility untested. An incomplete observation preserves the prior complete baseline and needs explicit retry.

Multi-account execution and quota continuation default off for fresh settings. Existing enablement can resume account routing and quota checks. Account authorization, profile state, native send handling and installed-host behavior require separately scoped live qualification; the isolated source tests use synthetic data.

Before deployment, qualify the rebuilt application against the actual official host/AppServer pair, including draft/save/reconnect, workspace-root changes, editor and native tabs, Rain/Mountain appearance ownership, and the native F32 refusal. Installed inventory, account operations and UI tests were not implied by source acquisition. Generic plugin resource-only rebuilds also need separate full-asset identity review; this candidate's resource bytes were independently checked and did not change.
