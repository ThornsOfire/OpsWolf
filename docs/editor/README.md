# Using OpsWolf

This is the longer version of the [main README](../../README.md): what the buttons do, what stays saved, and where the edges are.

Current development status: **alpha.30**. Read the [migration status](migration-status.md) for implemented behavior, local checks, owner observations and unfinished work. Older-host editor controls are labelled legacy below. A feature description is not blanket native-version acceptance.

## Getting around

The **OpsWolf** top menu's **Open GitHub Repository** link targets [our renamed fork](https://github.com/ThornsOfire/OpsWolf). Alpha source uses the canonical URL; older installed builds can use GitHub's redirect from the previous repository name. The OpsWolf labels and header/menu alignment accepted in dev.9 are retained in alpha.3. Custom identity profiles can retain their own labels.

In alpha.26 and later, chat keeps the main pane. Files and web pages use Codex's native right-hand tabs and divider. OpsWolf reserves space for its left file tree and adds tools inside supported native file tabs. There is no E button. Use Codex's own panel and tab controls.

The native-panel migration is included from alpha.26, with tree remount and Rain follow-ups through alpha.30. Local regression checks have passed; native save/reopen and broader live acceptance remain incomplete. Unknown native layouts keep their original presentation; they do not get an extra OpsWolf editor column.

The native sidebar keeps its normal startup state while you browse projects. After your first chat selection by pointer or keyboard, it waits for that chat to become active and collapses once through the native toggle. Automatically restoring a chat doesn't trigger it. You can reopen it afterward; the extension won't keep snapping it shut. Manually toggling the sidebar before choosing a chat also opts out for that launch. The file explorer has independent controls.

The compact native header targets 32 CSS pixels on qualified layouts. The legacy editor tab/control rows use 28 CSS pixels; native file controls retain their own layout. Display scaling and application zoom change their physical pixel size.

The owned product-menu logo/name use a horizontal row even when native buttons inherit grid styling. In qualified middle-page layouts, the header reserves the measured end controls separately from chat actions and positions New tab by its actual visible bounds; this avoids overlap during Hide/Show tabs and hosted Changes. These source fixes require their matching reviewed build and live acceptance.

Following an accepted message or Jump to latest now continues as ordinary visible reply text grows. Scroll upward to pause and keep reading in place. This uses existing content/layout events; hidden-window catchup without a new event still needs native qualification.

## Opening and managing files

The explorer normally follows the active local chat’s current working directory. Once Codex reports a changed directory, Refresh, app focus or the visible-chat metadata check (every 15 seconds) can update the tree. An empty destination shows the normal empty-project state. A launcher configured with an explicit workspace keeps that override instead.

Project display name, linked folder and an existing chat's working directory are separate. After renaming a folder on disk, correct its project folder through native Edit. In one live check, the existing chat adopted the corrected directory on its next ordinary turn and the explorer followed; immediate or bulk updates to every chat are not guaranteed. The refresher only reads metadata: it does not rename folders, relink other chats, or rewrite paths inside code. Review absolute paths separately. See [folder-link troubleshooting](workspace-root-refresh.md).

If an editor draft is dirty or saving, the automatic root switch waits. Save or discard the edit, then refresh; the draft stays associated with its original workspace until switching is safe. A failed metadata check preserves the existing root rather than guessing a destination. This behavior requires the matching updated native companion and UI; reloading only the UI cannot fix the older companion’s cached root.

Older hosts without the shared native frame retain the [legacy middle-page adapter](middle-pages.md). It is disabled on the current layout. A legacy transfer keeps the original native tab; OpsWolf does not infer that a native buffer is safe to close.

The explorer footer shows the OpsWolf fork, upstream Code-Codex and attached Codex host package versions. Open Preview Market from the top application menu; the duplicate footer link is removed. The upstream button checks upstream releases and shows available/held or failed-check feedback beside the versions. Review identifies the exact upstream release, while native enforcement blocks its installer from replacing OpsWolf. OpsWolf updates require the reviewed deployment process and separate explicit activation; host/Store updates are outside this control. See [manual updates](manual-updates.md). See [versioning](versioning.md) before staging a replacement build or publishing a release.

Collapsing the docked file explorer leaves a slim 18 CSS-pixel strip. Click its arrow or anywhere along the strip to reopen the tree at its saved width. In supported narrow drawer layouts, the compact arrow follows the content boundary and leaves native Home clickable, including at different zoom levels. When expanded, the narrow drawer fits the qualified content area below the native menu, even in short windows or at different zoom levels. Its visible width can shrink to fit without changing your saved width. Bounds refresh on qualified main-size changes and are released on collapse, wide layout, main replacement or disposal. Unrecognized main layouts keep the legacy fallback; native-version acceptance stays separate.

The explorer’s Refresh, Collapse, Hide, and collapsed-strip expand controls, and our editor controls use rounded bubble tooltips styled after native Codex. Hover briefly or focus a control with the keyboard to show its tooltip; Escape dismisses it. Editor labels follow the current action, such as Expand/Restore and Enable/Disable wrap. Native comparison controls and document links retain their existing tooltips.

Click a file in the explorer to open it in the native right panel. Supported chat links and citations use that same destination. Files opened by Codex directly also receive tools when the selected file and panel can be identified safely.

| Control | Behavior on the current native layout |
| --- | --- |
| Native tab and panel controls | Codex owns selection, closing, resizing and native editing |
| Pin / Unpin | Keeps or removes a project file bookmark |
| Pinned files | Opens a remembered path through the native right-panel route |
| Saved file preview | Opens a read-only reader inside the file tab; closing it leaves native editing untouched |
| Wrap preview | Wraps the auxiliary reader without changing native editor settings |
| View retained OpsWolf draft | Shows an existing legacy session draft read-only, when one is retained |

The native New Tab → Files view does not yet show this Pins bar. Full bookmark integration is unfinished. Native tab scrolling, open-tabs navigation and Close all equivalents are also pending; the old OpsWolf tab behavior does not automatically apply to native tabs.

Up to 32 file bookmarks are stored per normalized project root. Existing pins survive this migration, but no longer open a second column or automatically change native tab selection. Native tabs keep their own session behavior. Pins contain filenames, not file contents or unsaved drafts.

The legacy editor still retains session tabs and drafts by workspace on older hosts. On the modern host that state cannot reserve space or display a second writer. A retained dirty draft remains available through the in-app recovery view and existing Save/Discard/Cancel guards when explicitly switching files. Restarting the whole app does not preserve this in-memory recovery state.

Dragging an explorer file into chat supplies its absolute local path in the text payload. Internal tree moves keep their separate relative-path payload. The drag operation doesn't automatically give the agent the file's contents.

## Existing native text and Markdown tabs

F58 moved file tools into Codex's native right panel. Codex owns the tabs, native file buffers and split sizing; chat keeps the main pane. A file and a web page should share that native tab strip. The ownership migration is implemented; the convenience controls and full acceptance are still incomplete.

The current source routes explicit tree opens, supported chat/document links and citations into native right tabs, including files that are not already open. It waits for the matching selected native panel before retiring an old OpsWolf writer. Save, Discard and Cancel protect an existing draft; a failed or unqualified native open keeps the current state and reports the problem. It does not silently open another editor column. Native file-reference chips keep their host click and keyboard behavior.

Tools appear automatically in the qualified native file panel. Native editing and saving remain with Codex. The current UI does not yet expose the planned clear Save/Discard and Preview/Edit controls. An edit surviving a tab switch does not prove a disk save; save/reopen acceptance remains pending. **Saved file preview** uses OpsWolf's normal authenticated reader and installed previewers; it is a snapshot of the saved file and may differ from native unsaved changes. It reserves vertical space within that tab, leaving the native editor visible. Close and reopen the preview to read the saved file again. The reader has no Edit or Save action.

Cross-file heading links open their target file in the native right panel and report that heading navigation is not available yet. Citation selection is verified only where the native source exposes contiguous numbered rows; passing a line to the host alone is not proof that it navigated there.

The same contained reader can display a recorded Git comparison. That patch remains read-only and is labelled separately from the current file. A file that no longer exists may have no attachable native surface; opening its comparison then reports unavailability and keeps existing tabs and drafts.

Current source checks cover text-reader composition, retained drafts, deferred reads and native Changes ownership. A bounded actual-host probe verified attachment, space reservation and cleanup on one synthetic text file without changing chat width or native nodes/styles. Alpha.30 is active on the owner's setup. Installed previewers across file types, native save/reopen and the complete mixed browser/file matrix still need live acceptance.

The left file tree reserves its own space; Codex sizes chat and the right panel within the remainder. See [native capability evidence and limits](native-capability-research.md#native-right-panel-ownership-november-24-2026) for what has been verified on the current host.

## Background settings

The sliders button at the top of the explorer opens the active Rain settings directly. It uses the same settings panel and explicit Save as Preview Market; opening it does not enable an effect or save anything. Escape or Close returns focus to the header. Direct Rain settings stay open and reposition while resizing; collapsing/hiding the explorer closes the panel.

Other identified supported backgrounds open their existing card in Preview Market so you can use its normal settings button. No hidden Enable action is clicked. Applying states wait for completion; multiple, unknown, failed or unverified custom states use an honest browse/selection context. Full direct opening of every legacy panel is outside this first version. These source/synthetic results need their matching reviewed build and native acceptance.

## Rain blend status

Single preset applies or manages personal presets. Position #1 and Position #2 separately select captured blend endpoints. Changing a selection leaves the running blend on its current route until Start blend is clicked again. Status shows that route, direction, holds and pause reason. Save keeps the current appearance, personal presets, both endpoints and playback options. A saved startup blend begins at Position #1 next time. See the [settings guide](code-rain-integration.md#presets-and-blend-settings) for snapshot and compatibility details. These source changes still require the matching combined build and native acceptance.

## Dot background

Code Rain also supports the qualified embedded messaging surface used by Dot when the Rain canvas is already in that document. It clears the chat backing while keeping the composer, messages and controls readable. Use the existing Rain enable/disable controls; forced colors and reduced transparency keep opaque native backings. Detached windows and unknown layouts need separate qualification. See [scope and verification limits](dot-background.md).

## Preview, edit, save

The controls below describe the retained **legacy editor on older hosts**. Current native tabs use Codex editing and save behavior; the auxiliary OpsWolf reader is read-only. Its complete-read limits and installed preview plugins still apply.

**Preview** is read-only. **Edit** enables source editing when the native reader marks the file editable. **Save**, or **Ctrl+S**, writes the complete draft using the loaded file version for conflict detection. Delayed file notifications are checked against that version, so the editor can distinguish its own completed save from a real external change. If verification fails or the file changed elsewhere, your draft stays intact and the conflicting version is not silently accepted for the next save.

Read-only text shows a red warning in place of the unavailable mode buttons. Hover or focus it for the reason and next step. A file mixing Windows CRLF and Unix LF line endings is read-only to avoid silently rewriting its formatting. Normalize its line endings consistently in an external editor, then close/reopen it here. Larger files and unverified versions retain their existing restrictions; this UI does not override the workspace reader's save policy. The warning follows the theme's error/deletion color and system high-contrast colors.

For Markdown, editing shows the source text, including the pipe-delimited table rows. Rendered Markdown is provided by the optional preview plugin. Previewing an unsaved draft keeps that draft in memory; it isn't an implicit save.

Word wrap is available from the editor tab row. It preserves the source, draft, selection, and caret while changing layout. Gutter numbers refer to logical source lines rather than each wrapped screen row. The minimap is hidden while wrapping.

| File size | Reading | Editing |
| --- | --- | --- |
| Up to 512 KiB | Complete inline text; optional matching preview plugin | Supported text files the native reader allows |
| Above 512 KiB through 10 MiB | Complete text in a virtual plain reader; Markdown offers explicit full rendering | Read-only |
| Above 10 MiB | Explicit size error; no partial document presented as complete | Unavailable |

These are byte limits: 1 KiB is 1,024 bytes. Binary, sensitive, unsupported, or unavailable files have their own restrictions. A rendered preview or syntax-highlighting budget doesn't authorize saving incomplete content.

**Refresh file** is the circular-arrow button beside Preview/Edit in the file row. Use it after another program or agent changes the file. It reloads the current file from disk into Preview; it does not refresh the tree, chat or recorded Changes. If you have unsaved edits, the existing dialog offers **Save and refresh**, **Discard and refresh**, or **Cancel**. A failed or conflicting save keeps your draft and stops the refresh. Cancel makes no disk changes. Missing or inaccessible files show an error, and Refresh remains available to retry. Pins and other tabs stay in place.

When switching away from a dirty file, choose **Save and switch**, **Discard**, or **Cancel**. Individual close and close-all similarly offer save-and-close choices. A failed save retains the draft and prevents the dependent close or switch. Save-all currently handles the active dirty editor; this isn't a multi-document unsaved-draft system.

Drafts belong to the running session. There is a short, 10-second in-memory recovery handoff for a native UI refresh, subject to matching chat/bootstrap identity. This isn't recovery after quitting or crashing the entire application. Save before restarting.

## Citing source in chat

Markdown Preview document links are also usable: see [link navigation, warnings and saved choices](links.md). Their tooltips describe the destination and action before clicking. This is separate from the unfinished compact presentation of citation links in the chat composer.

In the saved-file reader or legacy editor, select source text and **right-click** for **Cite in chat**, **Add to citation group**, or **Copy citation**. This works with every supported complete text file, including code, JSON, TOML, logs, plain text and Markdown. It doesn't add editing support to a format the native reader doesn't allow. References cover whole logical lines, so wrapped screen rows still map to the original file.

**Cite in chat** appends a Markdown reference to the current chat draft without replacing your existing text or sending it. The label includes the full path and line range so the agent can find it. If the native composer cannot be identified safely, use Copy citation. You choose when to send.

**Current presentation:** the draft composer can display the entire Markdown link and its long encoded URL. The sent message renders as a clickable label, but hovering can still expose that raw URL. These are known presentation limitations; compact composer chips and readable citation tooltips are not implemented. See [citation status, live verification and remaining work](citations.md).

For several selections, use **Add to citation group** on each range, across files if needed. A small tray above the composer lets you remove ranges, clear the group, copy it, or insert it. A group supports up to 32 ranges. Inserting creates one group link plus individual range links. The queue is session memory and clears when the chat/project changes or the extension stops; it creates no extra disk archive.

Click a citation in chat to open its source in the editor and highlight it. Group links open the referenced files and focus the first one; individual links go straight to that range. Native buffers remain owned by Codex. Retained legacy drafts use their existing Save and switch / Discard / Cancel guard. **Clear** removes the active highlights.

References store a normalized whole-line quote up to 4,096 characters inside the link. If lines move, a unique matching quote relocates the highlight. Missing or ambiguous quotes are reported rather than guessed. Larger selections use explicitly labelled line anchors, which cannot follow moved text. An **unsaved draft** label identifies citations taken from edits that haven't been saved; reopening later may not find that text. Ordinary absolute file links with line anchors also work inside the active project.

Rendered Markdown, CSV and diagram previews don't have reliable source-line positions. Select text and right-click **Show source to cite**, or enter Edit for an editable file. **Rendered preview** returns from that source view. Citation navigation uses source automatically; Clear restores the ordinary preview. The virtual plain reader also supports visible selections and jump-back highlights through the 10 MiB reading limit; it cannot select unmounted rows across an arbitrary offscreen span.

Inserted/copied references contain paths and bounded source quotes. Once sent, they follow the chat's normal retention; the extension keeps no separate permanent citation store. Links are scoped to files inside the current project, so another machine or moved project may need a fresh reference. On modern hosts, opening a native tab delegates file access to Codex. OpsWolf checks the active project and relative destination, but does not apply its own reader policy to the native tab. The optional Saved file preview and legacy editor still use the authenticated OpsWolf reader and its sensitive-file and redirected-path restrictions. Equivalent restrictions in the native Codex reader have not been independently verified.

## Two ways to review changes

### Persistent Native changes panel

The panel sits above the composer. It reads native patch records for the active chat/project and keeps the latest useful review even after conversational replies. Expand the panel to skim filenames, then use each file's arrow to expand its inline diff independently. Readers are created on expansion and released on collapse.

On the modern layout, clicking a filename expands its recorded patch inline. **Open current file** opens the current source in a native right-hand tab. Deleted-file patches remain readable inline. Older hosts retain the editor diff-tab presentation.

A recorded patch doesn't change when you edit the live file. It describes that response's recorded work. Combined diffs and deleted-file comparisons have no source-file button. If the source has disappeared since the response, its ordinary file tab shows the normal load error; the recorded comparison remains.

Use the recent-review selector to inspect an older cached review and **Refresh** to request native records again. On the modern layout, use the original native **Undo / Reapply** controls. The legacy panel forwards to the matching mounted control when available. The extension doesn't implement a separate reversal engine.

### Live files-changed bubble

The native bubble can appear during an active response. Clicking it opens Codex's actual comparison viewer as an editor **Changes** tab. Clicking a file in its hover list lets Codex select the exact file, then focuses that tab. Native comparison modes, file navigation, and other comparison controls stay native.

Switching to another file hides the comparison without closing it. Returning to Changes preserves native viewer state where the host permits it. Panel visibility, fullscreen and resizing use native controls. Closing Changes uses the original native close control.

**Clear list** beside **Clear all unread** hides the currently listed file sections for this running session. New recorded patches reveal those files again; **Show all** restores cleared entries. Clearing a list does not clear unread state, undo edits, discard drafts or delete native history. The filter stays separate for each chat/project and resets on app reload. If history coverage cannot be verified, entries are shown instead of hiding possibly new work. See [Changes coverage and lifetime](native-diff-sections.md).

On the modern layout, OpsWolf adds file actions and list tools to the existing native comparison. It does not move the comparison, hide its tab or divider, dispatch fullscreen changes, or allocate an OpsWolf Changes pane. Native Word wrap remains the original control. Older hosts retain their qualified legacy comparison adapter.

### Coverage and retention

The persistent panel covers completed native patch items for eligible files inside the active project, including ordinary files outside Git. Shell commands and manual edits aren't guaranteed to appear. Sensitive, oversized, unsupported, and outside-project records can be omitted or unavailable. Unknown native cards remain in chat instead of being hidden without a working replacement.

History lookup examines at most 40 one-turn pages and keeps up to 10 useful reviews in memory. The backend projects at most 128 files and 1 MiB of diff content per review; the existing App Server transport has a 4 MiB message limit. These review limits are separate from the 10 MiB source-file reader.

The extension doesn't keep a second permanent snapshot archive. Codex's native chat history has its own lifecycle. This panel isn't a filesystem audit trail or a backup.

## If something looks wrong

| Symptom | First check |
| --- | --- |
| Custom controls missing after launch | Use the custom companion launcher and matching UI/native build |
| PDF or Markdown preview unavailable | Install and enable its verified Preview Market package |
| Diff has no Edit control | Use **Open file** for the current source; recorded patches are read-only |
| Open file missing | Combined/deleted comparisons don't have a current source action |
| Big file readable but not editable | Editing stops at 512 KiB; reading supports 10 MiB |
| Expected edit absent from Native changes | Check whether it was a native patch, shell command, manual edit, or outside the project |
| Changes opens in native location | The host layout may be unrecognized; report the Codex version and UI language |
| Pins disappeared after moving a folder | Pin identity follows the project root |

Please include what you clicked, what happened, and what you expected in a report. Synthetic examples are ideal. The [development guide](development.md) explains how to reproduce the behavior without client documents.
