# Trying the portable OpsWolf build

This is the Windows x64 pilot route. The package and its build workflow are ready for testing, with no published OpsWolf alpha Release yet. A successful GitHub build keeps a temporary test download. A fresh machine still needs to try that exact ZIP before we call its setup tested.

The idea is simple: you already have Codex, so you should not need a pile of developer tools just to try our editor :3

## What you need

- Windows x64 on an Intel or AMD PC, with official Codex already installed and working.
- The exact reviewed OpsWolf ZIP and its published SHA-256 checksum. An upstream Code-Codex installer is a different product.
- A local folder you can write to. Extract the whole ZIP; do not run it from inside the ZIP or copy just the launcher out of it.

Git, Node, Rust and C++ build tools are for building the package. They are not needed to run the reviewed portable build. Official Codex supplies its own account and chat environment. The ZIP does not include Codex, an account, personal projects or anyone else's settings.

## Getting a test copy

1. Sign into GitHub and open the exact successful **Build custom editor** run supplied for your test. The repository's **Actions** tab lists the runs.
2. Scroll to **Artifacts** and download the OpsWolf Windows x64 bundle. These temporary bundles expire after 14 days.
3. Extract that download. Inside it is the actual **OpsWolf-...-windows-x64-....zip**, plus checksum and build-review files. Keep those together until the package has been reviewed.
4. Extract the inner OpsWolf ZIP into a new folder. Once its source/checksum is verified, the file to open is **Launch OpsWolf.cmd**.

This is a test download, not a published Release. Because the repository is public, any signed-in reader can download its Actions artifacts; they are not private invitations. See [GitHub's download guide](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts). Share only the pristine reviewed ZIP, never a folder that has already been used to run OpsWolf.

## Start and stop

1. Check the ZIP came from the approved source and matches its checksum. A matching hash detects changed bytes; it does not make an unknown download trustworthy.
2. Extract it into its own folder. Keep its files together.
3. Save your work and close Codex normally. Run **Launch OpsWolf.cmd** from the extracted folder. Follow the normal startup checks; do not force-close an active session to get around a warning.
4. Open a disposable project and try the checklist below before trusting it with important work.

To return to ordinary Codex, save, close normally, then open your usual Codex shortcut. Keep the portable folder if you want to retain its local settings. Returning to Codex does not undo file edits or recover unsaved drafts.

The pilot is unsigned unless the release explicitly says otherwise. If Windows blocks it, stop and check the source and warning. Do not turn off security protections. Report startup errors with the package version and exact Codex version, leaving private chat text and credentials out of the report.

## What is included

The matching OpsWolf native launcher, editor bundle and locked preview/background assets, including Code Rain, travel together. Four optional effects are omitted while their redistribution evidence is unresolved: Heavenly Cloud, Aurora Ionosphere, Cloud Train and Milky Way. Their catalog entries may still appear in Preview Market; they are not offline assets in this ZIP. Bundling a plugin does not mean every plugin is enabled. Use Preview Market for those controls. Nova Fox and the Windows Code Rain screen saver are separate applications and are not included.

The portable storage marker tells the native launcher to keep its add-on data, plugin cache, logs and temporary files beside the extracted build. Some editor and Rain preferences live in the official host's browser storage. Official Codex still owns its account/chat environment. This is not a separate Codex account profile or a privacy sandbox. Do not share a folder after using it; it can contain local settings and logs.

There is no automatic OpsWolf updater in this pilot. Keep a new version in a separate folder and follow its reviewed upgrade instructions. Do not overwrite a running build or copy an entire used profile into a distributable ZIP.

## First-machine checklist

Record the package version/revision, ZIP hash, Windows version and actual Codex version. “Latest” can mean something different tomorrow.

| Try this | Expected result |
| --- | --- |
| Start from a newly extracted folder | OpsWolf opens without developer tools or a maintainer's cache; failures explain what is missing |
| Open a disposable project | The file tree follows the selected project |
| Preview, Edit, Save and reopen a sample text file | The saved disk contents match your edit; tabs and word wrap remain usable |
| Open Changes, then Clear list and Show all | Review controls work without changing files or Git history |
| Enable Code Rain, change settings and Save | The background and controls work; disabling restores the previous appearance |
| Save a Rain blend preset, close and reopen normally | Saved settings return; unexpected differences are recorded |
| Close normally and open the usual Codex shortcut | Ordinary Codex remains available; project files are preserved |

An isolated folder on the developer's computer is useful testing, but it is not a clean Windows machine. Record passes, failures and untested items separately. A working pilot does not certify every host version or GPU setup.

## Builder and release reference

The reusable recipe is [build-portable.mjs](../../scripts/build-portable.mjs). It consumes a matching native pair, UI output, locked plugin packages and repository notices; it does not download dependencies, rebuild the app or start Codex. The exact CLI and hosted build procedure are in [portable CI](portable-ci.md).

Local packaging may reuse an already qualified runtime. Its runtime source identity and the packaging recipe identity must remain distinct. CI builds the matching native/UI/plugin inputs from its checked-out commit and then runs the same recipe. A ZIP checksum, recipe fingerprint and per-file inventory identify the artifact; they do not replace tests or source review.

Release order: local checks and privacy/license review → Actions review artifact → approved first-recipient trial → review the exact tested bytes → explicitly approved Release publication. Publish those bytes without rebuilding them during upload. Source push, Actions upload and public Release publication are separate actions.

Use [the testing guide](testing.md) for check selection and [the contribution rules](../../CONTRIBUTING.md) for release notes. Preserve local recovery and user data. Hosted execution and recipient acceptance must be reported honestly when still pending.
