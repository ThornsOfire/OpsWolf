# OpsWolf settings

Open **OpsWolf → OpsWolf settings…** in the application menu. This is an owned settings dialog, not an injected section of Codex's native Settings page. The inherited market, language, startup, updater, installation, repository and uninstall actions remain available. Code-Codex credit is retained; Open GitHub Repository targets our fork. Older builds or a selected personal identity profile can show a different menu/settings name.

Changes apply in the current window immediately:

- **Typing speed** enables the optional gross WPM meter. No typing history or accuracy score is stored. Changing other preferences does not reset a running measurement.
- **Wrap source text** uses the same preference as the editor's wrap button, without replacing the text area or its draft. Native Changes has its own wrap state and original control.
- **Code minimap** uses the same preference as its editor button. Wrapping temporarily hides the minimap without forgetting that preference.
- **Collapse sidebar after selecting a chat** controls the existing once-per-session behavior. It does not move the current layout immediately or re-arm a collapse already consumed this session.
- **Nova Fox Companion restore button** shows the optional fox control in the explorer header. Fresh preferences default on; saved/legacy preferences keep their prior choice. Nova's registered restore URI is a separate prerequisite. See [Nova restore behavior](nova-companion.md).

**Personal identity** has its own explicit Save for next launch. Profiles customize our menu/settings name, PNG logo and name-badge colors; previewing does not change the active identity. Windows and Discord identity remain unchanged. See the [profile controls and compatibility matrix](identity.md).

**Reset these preferences** restores WPM off, source wrapping off, minimap on, sidebar collapse on and the Nova restore button on. It does not reset files, drafts, pins, pane widths, themes, plugin settings, or permissions. **Reset link warnings** separately removes saved website-origin/application-protocol allowances so subsequent preview clicks ask again; it never launches a link. A failed reset leaves an error in the dialog.

Preferences live in the renderer's local storage under `cursadex:preferences:v1`. This compatibility key retains its original name after the visible OpsWolf rebrand; saved preferences are not migrated or reset. Existing wrap/minimap keys are read as migration defaults when their new fields are absent; the old keys are left intact for older builds. Once saved, the central record takes precedence. This is one live store per renderer window, not account sync or a settings file watched across windows. If storage fails, current choices still work in this session and the dialog reports the persistence limitation. It never exports drafts or client content.

The dialog uses native modal focus handling, supports Escape/Done, restores launcher focus, scrolls at small viewport sizes, and updates English/Chinese labels without reconstructing controls. The menu stays outside native Radix ownership. Unsupported native menu layouts do not get speculative injected menu controls.

## Verification

`scripts/test-preferences.mjs` covers migration, defaults, storage errors, pointer toggles, singleton/disposal, live updates, reset boundaries, failure, localization and a 360×480 viewport. Editor-pane, minimap, typing, sidebar and application-menu fixtures cover the integration. These synthetic Chromium checks do not prove every native version or physical display; the combined native candidate pass is still required.
