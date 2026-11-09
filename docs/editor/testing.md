# Testing OpsWolf in three layers

We need a quick way to catch mistakes, a proper check before publishing, and a deeper test before asking people to trust a release. Those are different jobs. Passing one does not pass the others.

## The plan

| Tier | When | What it establishes | Gate |
| --- | --- | --- | --- |
| 1. Post-restart smoke and live acceptance | Each owner-authorized application restart | The exact selected build starts, retains expected state and completes its core workflow on the actual host | Common checks plus checks for the changed feature; unresolved required results stay visible |
| 2. Pre-push regression and CI | Before publication of a meaningful source change, with depth chosen for the changed boundary | The reviewed source passes applicable static checks and isolated regression tests; CI repeats the selected checks on committed revisions | Exact source/range and dependencies recorded; required skipped, blocked or untested coverage is incomplete |
| 3. Release and clean-install qualification | Before a broader release or a significant host/toolchain/installer change | A fresh documented setup works without the maintainer's paths, caches or private state; upgrade and recovery behavior is understood | Owner-approved isolated environment, explicit version/platform matrix and separate release decision |

Existing [focused checks](development.md#choose-checks-for-what-changed), GitHub workflows and the workspace's deployment/post-restart contract remain the starting point. The foundation below coordinates a small selection; it does not replace their assertions or silently run every suite.

## Foundation now

The shared runner is portable Node code in `scripts/run-checks.mjs`. It takes an explicit repository root and reviewed configuration. It uses the installed Node executable, with argument arrays and no command shell. It never installs missing tools, downloads dependencies, builds the app, launches Codex or changes deployment selections.

The first profile is `scripts/checks/fast.json`: version consistency, changelog structure, TypeScript without emission, architecture, localization consistency and the runner's own isolated tests. It is a fast **source** profile, not the full pre-push regression gate. The changelog check is structure-only here; the existing committed-range check still needs the actual publication base/head.

From the repository root, when resources are available:

```powershell
node scripts/run-checks.mjs run --root . --config scripts/checks/fast.json --out artifacts/checks/local-001
```

Use a new output name each time. During a resource hold, keep the required omissions visible:

```powershell
node scripts/run-checks.mjs run --root . --config scripts/checks/fast.json --out artifacts/checks/resource-hold-001 --skip typecheck --skip architecture --reason "Owner resource hold; deferred, not passed"
```

That partial run should exit nonzero because two required checks did not run. Do not use it as a complete pre-push pass. To summarize a previously recorded acceptance receipt, pass its exact manifest and a new ignored report directory:

```powershell
node scripts/run-checks.mjs smoke --receipt PATH_TO_RECEIPT_JSON --manifest PATH_TO_HANDOFF_JSON --out artifacts/checks/smoke-001
```

Replace the placeholders with the reviewed files. This reads them and writes a separate report; it does not edit either input. Run the runner's bounded synthetic tests directly with `node --test --test-reporter=tap scripts/test-check-runner.mjs` when changing the runner itself. They use disposable test data and do not test the live app.

Use only reviewed configurations and scripts. A test runner executes code with your current permissions; this is not a security sandbox. The explicit profile is a scope limit, not proof that arbitrary test code is safe.

### Results you can inspect

Each run writes a new ignored report directory with JSON, a readable summary and bounded command logs. Existing output is not overwritten. Check-level results distinguish `passed`, `failed`, `skipped`, `blocked` and `untested`; receipt-specific `pending` and `not-applicable` retain their meaning. An optional skip needs a reason. Required skips, missing prerequisites, failures and untested required coverage cannot produce a complete green result. No required exception or owner waiver is inferred automatically.

Reviewed static scripts use their exit-code contract. Node test entries also report TAP totals: an empty/incomplete test report, skipped tests, TODOs or cancellation must remain visible rather than being flattened into a pass. Timeouts and output limits produce an explicit incomplete/failure result. A successful command says only what its selected assertions establish.

The report records the Git base and actual tracked/nonignored checkout bytes, configuration and runner identity, tool versions and any detected source changes during the run. This is a dirty-source snapshot, not a claim that HEAD alone describes it. Ignored dependency contents are not fully fingerprinted; package/version or lockfile identities do not make the run hermetic. Reports can contain local paths and diagnostics: keep them ignored and review before sharing.

Source identity and application build identity stay separate. A source-check report does not prove the running app contains those sources. A post-restart summary compares the supplied receipt with the supplied manifest, preserves evidence kinds and reports unresolved common/feature checks. It does not re-observe the screen, validate every payload asset, prove evidence claims, accept a build or promote it to rollback.

### Post-restart reporting

Reuse the existing `post-restart-acceptance` receipt and PR01 through PR08 categories: identity, navigation, retained state, core work round trip, changed feature, cancellation/safe failure, bounded stability and rollback readiness. The workspace deployment standard provides `POST_RESTART.md` and `post-restart.template.json`; no competing receipt is introduced here. Standalone contributors can use their own reviewed compatible receipt and manifest. The workspace tools and personal paths are not runtime prerequisites.

Preserve automated, fixture, prior qualification, agent-live and owner-live evidence separately. Older receipt evidence kinds are retained verbatim; an unspecified kind does not become live evidence. A checksum comparison establishes only the identity of the files supplied. Required applicability exceptions need reasons and review, not a silent pass.

The foundation reporter is deliberately conservative: PR01 through PR08 always remain required, even if a receipt sets `required: false`. A required `not-applicable` row stays incomplete, even with a reason, and a nonempty `pendingOwnerOrBroaderChecks` list remains visible and non-green. A noncommon row explicitly marked optional may be inapplicable with a reason. The reporter does not interpret owner-waiver prose or silently clear other unresolved receipt rows. Exception handling can be designed later; the actual receipt remains unchanged.

Use synthetic files, disposable profiles and app-owned temporary output. Real drafts, client documents and current settings are outside automatic tests. UI actions still require the relevant authorization and app/target checks. Smoke reporting is read-only and performs no desktop input. A failure records evidence and a stable bug; it does not authorize a repair, restart, rollback or publication.

## Later phases and decisions

**Pre-push/CI expansion:** audit the existing workflows, select representative editor/bridge/native/browser suites by changed boundary, make dependency/network requirements explicit, and connect the reviewed profile to CI with retained reports. Establish real base/head changelog coverage, host compatibility fixtures, check ownership, runtime budgets and a visible flake policy. Required failures must not become allowed failures simply to make CI green. Hosted dependency installation, branch protection, workflow changes and component enrollment need their own reviewed scope. Code Rain and Nova Fox keep their existing tests; enrollment is future work rather than an implicit pass from OpsWolf.

**Release/clean-install qualification:** agree the supported Windows/Codex/runtime matrix and an isolated VM or equivalent disposable environment. Test clone/setup from the public instructions, missing dependencies, first launch, settings retention, supported upgrade, recovery and uninstall boundaries. Include representative layout, keyboard/accessibility and resource/performance checks with stated budgets and observation intervals. Keep real credentials, documents and live profiles out. Downloads, VM preparation, installer execution and release publication are separately authorized operations.

Before expanding either phase, choose the required checks, supported environments, CI cost/time budget, evidence retention/redaction and who may approve exceptions. An occasional comprehensive run is bounded qualification, not a promise that every hardware/theme/host combination works. A known failed live save check remains failed even when all source checks pass.

This foundation deliberately adds no automatic pre-push hook, new CI job, clean-machine provisioning, live desktop automation, acceptance enforcement in activation controls or periodic background task. Existing workflows remain unchanged. Those capabilities belong to the later phases, with explicit gates and owner review.
