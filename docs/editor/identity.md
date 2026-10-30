# Personal identity: local candidate

Open **OpsWolf → OpsWolf settings → Personal identity**. A custom display name replaces those two owned labels after a fresh app window loads. OpsWolf is the public default, formerly Cursadex. The visible rebrand keeps existing selected personal profiles and technical storage identities; an explicitly saved custom name remains a custom name. This is the first part of the broader personal control-center work; it does not rename the Windows application.

## Profiles and controls

You can keep eight personal profiles in addition to the permanent OpsWolf default. Load a profile to edit its draft, or choose New profile. Previewing and switching drafts do not save anything. **Save for next launch** saves and selects the displayed profile; a restart notice appears when it differs from the identity this renderer loaded with. There is no automatic restart. A full renderer reload also loads the saved choice; ordinary chat changes, menu remounts and extension reinjection retain the captured identity.

The public default includes the bundled OpsWolf wolf logo, derived from this repository's original vector artwork. Its name/logo come from `core/branding.json` through `core/branding.ts`; it needs no network access. Existing selected personal profiles, including explicitly saved Cursadex names, keep their exact stored values. Choose **Use OpsWolf default** if you want to replace a custom identity with the new default.

**Use OpsWolf default** selects the default for next launch without deleting personal profiles. **Delete saved profile** removes the loaded personal profile; deleting the selected one selects the default. **Reload saved profiles** reads another window's saved choices without replacing this window's active identity. Loading another draft or closing Settings discards edits that have not been saved. Preference reset and preview-link reset are separate operations.

Names use 1–48 visible Unicode characters and are rendered as text. The optional local PNG logo is embedded in the profile, so moving the original image does not break it. Input is limited to 128 KiB and 512×512 pixels, decoded and re-encoded before saving. Remote URLs, SVG markup and file paths are not accepted. An undecodable saved image falls back to the name; invalid replacement uploads retain the previous logo. Personal artwork is never part of public defaults.

Optional background/text/accent colors style the **owned name badge and preview**, not the editor, syntax or native host theme. Text/background contrast must reach 4.5:1; accent/background 3:1. Forced colors use the system palette. The editor's semantic theme controls remain a separate feature.

## Storage and failure behavior

`core/configuration/identity-profiles.ts` owns schema 1 under the fixed renderer preference key `cursadex:identity:v1`. Changing a display name never changes workspace paths, package identifiers, authentication, updates or storage keys. Data is local to that renderer's storage origin; it is not a portable Windows launch configuration yet. Records have a 1.5 million-character limit, eight profiles, fixed field validation and detached snapshots. No document or chat content is stored.

Writes validate first and publish in-memory saved state only after storage accepts the write. A storage failure leaves the previous saved selection intact. A changed record from another window is detected before writing; use Reload saved profiles and review before retrying. This is a stale-write check, not a cross-process database transaction. Malformed/future records report fallback and are not overwritten during reading. Explicit Save or default selection can replace an unreadable record. No personal data is logged by the feature.

## Requested / implemented / observed matrix

| Surface requested | Candidate implementation | Evidence / remaining boundary |
| --- | --- | --- |
| Menu name and icon | Saved profile labels and embedded PNG | Browser fixture; actual fresh Codex window pending |
| Settings name/logo and preview | Same active profile, separate editable draft | Browser file upload, explicit save, narrow viewport and forced colors checked |
| Brand colors | Owned name badge and preview | Browser checked; general editor/theme overrides remain separate |
| Windows window title | Unchanged | No supported host-owned title adapter established; no title-fighting observer added |
| Executable name, version metadata and icon | Unchanged | Launcher resource metadata is compiled, not a dynamic renderer setting |
| Existing shortcut label/icon | Unchanged | Existing integration owns verified names/targets/manifests; a general personal shortcut handoff is not implemented |
| Taskbar application identity | Unchanged | Companion process identity does not rename the separate signed host |
| Discord activity / other app detectors | Not enabled or implemented | Registered application setup and a supported presence bridge would be separate work; no SDK installed or activity sent |
| Public default / personal profile | OpsWolf default, optional locally supplied artwork | No maintainer name, logo or paths in public defaults |

Windows' `SetCurrentProcessExplicitAppUserModelID` sets the **calling process** identity for taskbar grouping and is intended for application startup before UI. Calling it in our launcher would not by itself set the existing host's process identity. [Microsoft documentation](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-setcurrentprocessexplicitappusermodelid).

Discord's documented `UpdateRichPresence` overwrites the activity's name and applicationId; the client identifies a registered application using its application ID. An arbitrary profile name is therefore not a supported substitute for registered-app setup. No registration, publication or real presence activation has been attempted. [Discord Client reference](https://discord.com/developers/docs/social-sdk/classdiscordpp_1_1Client.html).

Local source evidence: `crates/launcher/build.rs` compiles ProductName/FileDescription and the icon resources. `crates/launcher/src/bin/code-codex-shortcut.rs` manages specific shortcuts with ownership, target and rollback manifests; it retains the official host AUMID. Those paths were inspected, not changed. Renderer code has no generic native process-title/identity capability. Deeper launch/shortcut integration remains open rather than being replaced with a cosmetic claim.

## Verification

Run `node scripts/test-identity-profiles.mjs`, plus preferences and application-menu regression fixtures. The identity fixture uses the real store, settings UI and file input in isolated Chrome, with a synthetic logo. It checks failed writes, stale-window saves, corruption, budgets, default/delete preservation, literal name rendering, logo decode/fallback, no autosave, next-document application, contrast, narrow layout and focus cleanup. Output is in ignored `artifacts/identity-profiles/`.

These checks do not verify Windows taskbar names, signed-host metadata, Discord detection, physical monitor scaling or a native app restart. No working installation is replaced for this candidate.
