OpsWolf {{VERSION}} - portable package {{REVISION}} - Windows x64

This is a review/pilot package, not a promise that every Codex version works.
Official Codex must already be installed and working on your Intel/AMD Windows PC.
You do not need Git, Node, Rust or C++ build tools to use this folder.

GET GOING
1. Check the download source and the published ZIP SHA-256 before extracting.
2. Extract the ENTIRE ZIP into a new local folder you can write to, such as Documents.
   Do not run inside the ZIP, Program Files, a network share or an older OpsWolf folder.
3. Save your work and close Codex normally.
4. Double-click Launch OpsWolf.cmd. It checks package files before starting.
   Keep all its neighboring files together.
   If Codex is still running, the native launcher retains its usual consent/error flow.
   This launcher does not force-close it or override compatibility checks.

Windows may warn about an unsigned or downloaded file. Check its source and hash.
Do not disable antivirus, SmartScreen or an organization policy to get it running.
Keep any error message if Windows or Codex refuses to start it.

YOUR FILES AND SETTINGS
This ZIP contains no account, chat history or personal settings. Official Codex
still uses your own account/chat environment. Some editor preferences belong to
that host environment; a new portable folder is not a new or isolated Codex account.
Native add-on state, logs and temporary files are created in data/, logs/ and temp/
beside the launcher. Bundled verified plugins are in plugins/. Keep the folder
in place after use. Do not merge a future ZIP into it or delete its data as an update.
There is no automatic OpsWolf updater in this package.

VERIFY THE EXTRACTED FILES (OPTIONAL)
From a command prompt in this folder, run:
  "Launch OpsWolf.cmd" --check
It checks the manifest's file hashes and sizes without starting Codex or changing
files. Verify-OpsWolf.ps1 contains the same readable verification commands for
manual use. Neither entrypoint changes PowerShell execution policy. If an
organization policy blocks launch, keep that policy and ask for help. The published
ZIP hash can also be checked with Get-FileHash before extracting.
Local checksums detect damage, not a malicious replacement of both files and hashes.

GO BACK TO ORDINARY CODEX
Save your work, close OpsWolf normally, and open official Codex using its usual
shortcut. This package does not replace that shortcut, register startup tasks or
install an app. Keep this folder for its add-on data. Returning to stock Codex
does not undo document edits or restore unsaved work.

FIRST TRY CHECKLIST
Record your exact Codex version and this package version. With a disposable file,
try opening the tree/editor, editing/saving, Changes, Rain enable/settings/save,
and a normal close/reopen. Confirm returning to ordinary Codex works. Report
failures with the step and error text; review logs before sharing private information.

Included: matching native/UI runtime and verified preview/background plugins,
including Code Rain. Excluded: official Codex, Nova Fox, Windows screen saver,
developer tools and personal profiles. Upstream credit and third-party terms are
in LICENSE, THIRD_PARTY_LICENSES.txt, THIRD_PARTY_NOTICES_EN.md and notices/.
Four background packages are deliberately not bundled while their redistribution
permissions remain unresolved: Heavenly Cloud, Aurora Ionosphere, Cloud Train
and Milky Way. They may still appear in the native market catalog; this package
does not install or enable them. portable-manifest.json records the exact selection.
