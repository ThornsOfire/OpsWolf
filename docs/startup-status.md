# Read startup status

When the OpsWolf menu is visible, open **OpsWolf → Runtime Information → Current run**. That view shows retained events from the run connected to the logging bridge. **Run Checks** collects fresh support observations. For an already visible startup diagnostic dialog, the support code, stage and reason describe the attempt that opened it.

If the menu is unavailable, use the offline helper with a runtime JSONL file you have explicitly chosen and can read. The source helper uses Node's built-in modules and runs directly from this checkout.

```powershell
node scripts/startup-status.mjs --file "path/to/runtime.jsonl"
node scripts/startup-status.mjs --file "path/to/runtime.jsonl" --json
node scripts/startup-status.mjs --help
```

The installation layout determines the log location. With an identified install root, runtime logs are under its `logs/runtime` directory. Legacy layouts put them under `runtime-logs` in the legacy application data root. Use an authorized, readable, already-local stable copy from one known run. Node cannot determine whether a mapped drive is network-backed. If access is denied, stop at that boundary. [Log path contract](../crates/workspace-service/src/application_paths.rs#L193)

The reader requires a supported schema-1 runtime log of at most 5 MiB. Events lack per-event run IDs, so a well-ordered splice without a second header can pass structural checks. The SHA-256 identifies the selected bytes. Establish their provenance separately.

The helper reads the single supplied file and prints its summary to stdout. It requires no install or app restart and performs no default path scan, process probe, polling, file write or export. Review the output before sharing it.

The summary describes a recorded snapshot. It includes the run ID, source file hash and timestamps, and the last retained launcher, startup and explorer observations the reader recognizes. Missing, trimmed or unfamiliar events can limit what it says about startup. The native upstream version in the log header identifies the native companion's upstream base. The OpsWolf fork build, the currently selected installation, the host and AppServer identities, and current UI health require separate evidence.

## Source verification

The targeted profile runs the parser checks on synthetic input and checks the changelog structure. Choose a fresh output directory each time.

```powershell
node scripts/run-checks.mjs run --root . --config scripts/checks/startup-status.json --out artifacts/checks/startup-status-001
```
