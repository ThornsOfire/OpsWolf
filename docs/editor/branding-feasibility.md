# F21: branding around an existing Codex installation

Research and documentation reconciliation, **2026-10-31**. All external sources below were accessed on that date. No implementation, prototype or live identity test was performed. This is a technical/terms assessment, not a definitive legal ruling.

## Owner intent and conclusion

Users bring their existing official Codex desktop installation. OpsWolf supplies its own add-on, personal UI and potentially its own branded launcher/shortcut. **Redistributing Codex is outside this request.** The existing personal-profile implementation is described in [identity](identity.md).

Owned UI and launcher/shortcut presentation are credible separate work. Changing the installed host's name/logo everywhere is not one setting and is not established as feasible or permitted. OS APIs describe technical mechanisms, not permission to modify another product. Private use, user consent and not redistributing the host do not automatically resolve contractual or trademark restrictions.

## Capabilities and boundaries

| Surface | Evidence / possible direction | Status and limit |
| --- | --- | --- |
| OpsWolf menu/settings name, PNG and badge colors | Existing local profile implementation | Implemented within owned UI; does not change Windows identity |
| Owned launcher executable resources | `crates/launcher/build.rs` compiles ProductName/FileDescription/version and icon resources for six owned executables; `crates/launcher/resources/windows-manifest.rc` supplies the ICO | Rebuilding our own resources is technically distinct from patching Codex. Metadata currently uses Cargo's version. Arbitrary next-launch personal metadata is not implemented; editing a signed executable later would require a new artifact/signing decision |
| Owned shortcut label/icon/target | `crates/launcher/src/bin/code-codex-shortcut.rs`: fixed names at lines 42–45; icon validation around 1189; creation around 2924. Existing standalone shortcut operation has ownership/conflict/rollback checks | A general personal-profile handoff is not implemented. Preserve targets, backup/ownership and stable recovery shortcut; avoid replacing unrelated official links or creating clutter |
| Window caption / window icon | Windows documents [SetWindowTextW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowtextw) and [WM_SETICON](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-seticon) separately from executable resources | No native branding adapter found. Actual Codex window ownership, permissions, custom chrome, reset behavior and lifecycle are untested. API existence is not a supported Codex extension contract. No persistent title-fighting observer is proposed |
| Taskbar grouping / pin / relaunch | [SetCurrentProcessExplicitAppUserModelID](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-setcurrentprocessexplicitappusermodelid) affects the calling process and belongs before its UI. A launcher call would not rename a separate host | Windows also documents [per-window IDs and shortcut/relaunch properties](https://learn.microsoft.com/en-us/windows/win32/shell/appids) and a [window property store](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shgetpropertystoreforwindow). Thus customization is not proven universally impossible. A permitted, reversible host-window integration, property cleanup, matching pin/relaunch behavior and multi-window handling remain unqualified |
| Official package identity, installed logo/name, process metadata | `crates/launcher/src/discovery.rs:514` validates official package name/publisher/family before activation; shortcut integration retains the official AUMID. [Manifest visual elements](https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-visualelements) define packaged name/logo surfaces | Not an owned profile mechanism. A renamed shortcut/window cannot rename the host executable, version resources, publisher or package. Do not change those trust identifiers |
| Discord / other activity consumers | Separate explicit integration, not automatic propagation from a Windows label | No Discord integration found in reviewed source. Passive detectors may use different metadata; behavior is unverified. An optional registered-app presence integration requires its own setup, privacy and lifecycle design |

Source paths are relative to this repository. Read-only review also inspected `platform/windows/compat.rs` and `win10_compat.rs`: existing compatibility code handles transparency, not a general title/icon adapter; the newer native Chromium path skips the Electron patch. Do not assume an Electron-only mechanism works on every host generation.

### Discord correction

Earlier F21 notes were too categorical about names being overwritten. Discord's [Social SDK release notes, 1.6.12170](https://discord.com/developers/docs/social-sdk/release_notes.html) explicitly introduce customizable `activity.name`. The [Client reference](https://discord.com/developers/docs/social-sdk/classdiscordpp_1_1Client.html) retains older conflicting wording about assigned activity fields. Resolve the exact SDK/client combination before selecting an implementation. Registered application identity remains separate from display text. No application registration, SDK download, account connection or presence transmission was attempted. Presence stays opt-in; identity-only sharing is the proposed default, without paths, project names or chat content.

## Terms and licenses are separate questions

| Source | Relevant finding | Consequence for this request |
| --- | --- | --- |
| [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), effective January 1, 2026; Using our Services / Software / Our IP rights | Covers associated applications; restricts modifying Services and reverse engineering, with the stated applicable-law exception for the latter. Software may update automatically; open-source components have their own licenses | Non-redistribution is not a general modification grant. These consumer terms do not establish the terms of every business account |
| [Service Terms](https://openai.com/policies/service-terms/), updated October 16, 2026; section 10 Licensed Materials | Local materials receive a limited use/install license with modification/redistribution restrictions; additional open-source rights apply only to their covered components | Treat downloadable-software licensing separately from owning generated code. Exact applicability to this installed host/account and any additional installer/Store terms is not determined here |
| [OpenAI Services Agreement](https://openai.com/policies/services-agreement/), effective January 1, 2026; scope and section 3.3 | Applies to specified business/developer services rather than all individual use; includes reverse-engineering and protective-measure restrictions | Determine the user's applicable agreement instead of assuming the consumer or business contract automatically controls every surface |
| [OpenAI brand guidelines](https://openai.com/brand/) | Restrict misleading affiliation, unauthorized logo use/modification and incorporation into one's own branding | Use distinct OpsWolf artwork and clear unofficial attribution; accurate upstream credit does not imply endorsement or license the official app |
| This repository's [MIT license](../../LICENSE) and third-party notices | The local Code-Codex/OpsWolf code is MIT licensed subject to its notice/terms; dependencies and assets retain separate licenses | Preserve credit and notices. This does not license the proprietary desktop host or all material installed with it |
| [Official openai/codex license](https://github.com/openai/codex/blob/main/LICENSE) | The referenced open-source project uses Apache-2.0 | Rights attach to that covered code. Do not infer that the whole signed desktop application has the same license from its shared name or included components |

No separate desktop-specific modification permission or complete installed-license inventory was established by this review. Local folder ownership, an add-on MIT license, consent or a legal exception cannot be treated as a blanket answer for another component. Before any host-directed implementation, identify the exact distribution/account terms and a permitted integration route; seek clarification/qualified advice where the intended modification depends on unresolved permission. This review does not certify the entire existing add-on architecture.

## Signing, updates and rollback

Microsoft documents that deployed [package files are protected](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes); enabled [package-integrity enforcement](https://learn.microsoft.com/en-us/windows/msix/desktop/tamper-protection) can trigger repair for tampering. No claim is made that every enforcement option is enabled on this installation. Do not edit official binaries, resources or manifests, take ownership of protected package files, re-sign/repackage the host, alter its registration, or bypass signing/security to achieve a cosmetic result.

Future owned-launcher branding would need a reviewed build/artifact and its own signing policy, if signed. A certificate's publisher is not a freely chosen display-name setting; [Microsoft's MSIX signing overview](https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview) explains package signing and trust requirements. Preserve official discovery/activation identity, authentication, storage, security/update keys, and clearly separate host updates from add-on updates. Runtime/window presentation, if later qualified, must handle new windows, process exit and host updates without fighting the host or leaving stale properties.

Any later approved integration must use the existing immutable handoff and owner activation/rollback pipeline. Record original owned shortcut properties, restore only owned changes, test normal launch and recovery, and keep the stable recovery entry usable. A profile change must not silently migrate storage, replace the official install, activate a new app or force a restart.

## Decisions still needed

- Choose the first limited surface: owned UI only, owned launcher/shortcut branding, or a separately authorized host-window feasibility trial. Host-wide identity is not promised.
- Establish applicable permissions and the exact supported host/build boundary before a trial; API documentation alone is insufficient.
- Decide what profile fields actually affect, restart requirements, icon ownership/disposal and fallback when a requested surface is unsupported.
- Qualify taskbar pin/relaunch, multiple windows, update/uninstall/rollback and external detector behavior with owner-assisted checks. Keep unsupported states explicit.
- Treat Discord as a separate optional integration with exact SDK/client verification and explicit setup/consent.

Only this documentation reconciliation is authorized now. No native install, binary/resource, shortcut, registration, settings, runtime or sealed F32 changes were made.
