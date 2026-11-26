# Portable package review in GitHub Actions

The **Build custom editor** workflow builds a Windows x64 review package from one exact source commit. It uses the same `scripts/build-portable.mjs` recipe as a local package. It does not publish a release, install OpsWolf, launch Codex or update anyone's machine.

## Starting a reviewed build

After the owner approves publication of the workflow and source, a matching push to `candidate/planned-development` runs it. The historical `feature/right-editor-pane` trigger remains. The workflow also declares **Run workflow** with a positive `package_revision` input, defaulting to `1`; select a source branch that contains the builder and current application sources.

That hosted run installs the locked application dependencies and updates the stable Rust toolchain on GitHub's runner. Review that network/build scope before approving the push or manual run. Editing the workflow locally does not download or install them on your computer.

GitHub only enables manual dispatch when the workflow exists on the repository's default branch. This repository uses `main` for the homepage, so adding the workflow there is a separate reviewed publication decision. The source-branch push trigger does not require that homepage change. See [GitHub's manual-run requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The selected event commit is checked out by full SHA and checked against `HEAD`. There is no arbitrary source URL input, checkout credential retention or write permission. Packaging revisions identify packaging changes separately from the version in `cursadex-version.json`.

## Using the same recipe locally

Start with matching, qualified Windows x64 binaries in `target/release` and UI/plugin output in `packages/explorer-ui/dist`. These commands package existing outputs; they do not compile them or download missing dependencies. Run from the repository root with installed Node. Use a new output path for each attempt.

```powershell
$sourceCommit = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify source commit.' }
node --test scripts/test-build-portable.mjs scripts/test-portable-runtime.mjs
if ($LASTEXITCODE -ne 0) { throw 'Portable regression checks failed.' }
node scripts/check-portable-runtime.mjs --runtime-dir target/release --ui-dir packages/explorer-ui/dist --report artifacts/portable-runtime-review.json
if ($LASTEXITCODE -ne 0) { throw 'Runtime review failed.' }
node scripts/build-portable.mjs `
  --runtime-dir target/release `
  --ui-dir packages/explorer-ui/dist `
  --plugins-dir packages/explorer-ui/dist/plugins `
  --repo-root . `
  --source-commit $sourceCommit `
  --runtime-source-commit $sourceCommit `
  --package-revision 1 `
  --output-dir artifacts/portable-local/package `
  --zip artifacts/portable-local/OpsWolf-portable-windows-x64.zip
```

Stop on a nonzero command exit. `HEAD` is an accurate identity only when the reviewed source is committed and the matching outputs were built from it; these flags cannot prove that provenance by themselves. Preserve the build/check records and verify the final package inventory.

For a previously sealed runtime, the recipe revision and runtime revision may differ. Supply both full commits explicitly and use the sealed UI, native and plugin inputs, without modifying their bundle. If the archived UI directory does not contain `plugins/catalog.json`, pass its matching, verified catalog with `--catalog`:

```powershell
node scripts/build-portable.mjs `
  --runtime-dir reviewed-inputs/native `
  --ui-dir reviewed-inputs/ui `
  --plugins-dir reviewed-inputs/plugin-packages `
  --catalog reviewed-inputs/catalog.json `
  --repo-root . `
  --source-commit RECIPE_FULL_COMMIT `
  --runtime-source-commit RUNTIME_FULL_COMMIT `
  --package-revision 1 `
  --output-dir artifacts/portable-sealed/package `
  --zip artifacts/portable-sealed/OpsWolf-portable-windows-x64.zip
```

Replace the uppercase placeholders with the reviewed 40-character commits and the example input directories with the actual preserved paths. The catalog must be the one compiled into that native/UI pair. The builder verifies locked asset hashes and applies its tracked redistribution policy; a later isolated `plugins` check confirms the native catalog/cache agreement. A new package revision never makes an unrelated runtime/UI combination compatible.

## What the build checks

1. Source identity, fork version and changelog structure; portable builder regression checks.
2. Lockfile-based npm dependencies, renderer build and existing locked plugin input/hash verification.
3. Existing workspace-service, CDP client and context-resolver native tests, followed by the matching release CLI and windowless launcher. Encoded compiler flags request a static C runtime and remap runner profile/repository paths to neutral `/build-home` and `/opswolf` prefixes; release debug information is disabled. The runtime checker inspects PE dependencies and diagnostic strings before packaging; a failure stops the candidate.
4. The reusable portable builder creates the allowlisted package and ZIP using the tracked redistribution policy. Packages without established redistribution permission are excluded and named in the manifest. Generated or unexpected nonignored source changes fail the build.
5. Extract the ZIP into a fresh path with spaces and non-ASCII text. Check its file hashes, run `Launch OpsWolf.cmd --check` plus the CLI's version and offline plugin-inspection commands with developer tools removed from `PATH`, and compare every plugin identity with the portable manifest. Bundled packages must be installed; exclusions must be absent from the fresh cache. These commands never enter the native `run` path.

The relocation probe may create its own native logs and temporary files. Only the original ZIP and explicit review records are retained, never the probe folder. This check does not prove a Windows computer has no developer runtimes installed, and does not test the official Codex host or its UI.

## Reviewing the result

Apply the [publication OPSEC gate](publication-opsec.md) to workflow upload/log scope before triggering artifact publication, then to the exact resulting package before further distribution. The later artifact review does not undo initial exposure.

An Actions artifact is a temporary test download, separate from a GitHub Release. Signed-in users with repository read access can download it. On this public repository it is not restricted to invited testers. Use a separately approved private transfer if a test must be private. [GitHub artifact access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

A successful run retains an artifact named `opswolf-portable-windows-x64-<full-commit>-<attempt>` for 14 days. It contains:

- The portable ZIP, named with the app version, packaging revision, architecture and source prefix.
- `portable-manifest.json`, the distribution file and plugin inventory.
- `build-review.json`, the source/run/toolchain identity, checks and unresolved acceptance limits.
- `runtime-review.json`, the native dependency/privacy check and its limits.
- `SHA256SUMS.txt`, the SHA-256 hashes of those four files.

GitHub's artifact download wraps those files in its own archive. The **inner portable ZIP** is the candidate intended for recipient review. Its SHA-256 is distinct from GitHub's [artifact digest](https://github.com/actions/upload-artifact#outputs). Preserve it before the artifact expires.

The runner image, stable Rust toolchain and existing action major tags can change over time. Lockfiles constrain application dependencies, but this workflow does not claim bit-for-bit reproducible binaries. Review the exact output hash rather than assuming two runs of the same source produce the same bytes. The workflow records runner and compiler versions for comparison.

## Release gate

Passing this build produces a review artifact, not an accepted public release. Review the actual ZIP, licenses, privacy scan and relevant architecture/contract workflow results. Then record a first-user trial against the exact ZIP and observed Windows/Codex version: startup, tree/editor, disposable save, Changes, Rain, settings after restart, normal shutdown and return to official Codex. Keep failures and untested coverage visible.

Only an explicitly approved release may promote the reviewed ZIP. Upload those same bytes and hashes; do not silently rebuild the tested candidate during publication. A rebuild creates a new candidate requiring its own evidence. Release notes must distinguish hosted checks from recipient acceptance and state compatibility limits. There is no downstream automatic updater in this workflow.

Local workflow editing, a passing builder test and source publication are separate from a successful hosted run. Until a run has completed, record hosted CI as **not run**, not passed. No environment approval gate or branch protection is assumed to exist merely because these instructions describe review.
