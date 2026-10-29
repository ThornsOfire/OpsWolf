# Using the editor fork

This is the longer version of the [main README](../../README.md): what the buttons do, what stays saved, and where the edges are.

## Getting around

The file explorer, native Codex sidebar, chat, and editor are separate surfaces. **E** in the chat header opens or hides the editor. Hiding it exits fullscreen, so the next E opens it beside chat at its saved width. Open files and the current draft stay in the running session; hiding doesn't save to disk. Selecting the editor's chat tab or using Escape to return to chat also resets fullscreen after the switch is accepted. Cancelling a dirty-file switch leaves the layout intact.

Use the editor's fullscreen button to expand the editor, and the same button to restore the right pane. Drag the pane's left edge to resize it. The focused resize separator also supports Left/Right arrow keys. The pane preserves a minimum amount of chat space when the window becomes narrow.

In the supported native shell layout, that divider extends through the tab-header band. Native tabs and their controls stay on the middle pane's side, with controls aligned at its right edge. Browser/file panes fit within that middle space rather than covering editor files or the resize handle. Native tab scrolling remains the host's behavior.

The native sidebar keeps its normal startup state while you browse projects. After your first chat selection by pointer or keyboard, it waits for that chat to become active and collapses once through the native toggle. Automatically restoring a chat doesn't trigger it. You can reopen it afterward; the extension won't keep snapping it shut. Manually toggling the sidebar before choosing a chat also opts out for that launch. The file explorer has independent controls.

The compact native header is 32 CSS pixels tall; editor tabs and the file-control row are 28 CSS pixels. Display scaling and application zoom change their physical pixel size.

## Opening and managing files

The explorer normally follows the active local chat’s current working directory. Moving that chat into a different local project updates its root on Refresh, when the app regains focus, or during a visible-chat metadata check (every 15 seconds). An empty destination shows the normal empty-project state. A launcher configured with an explicit workspace keeps that override instead.

If an editor draft is dirty or saving, the automatic root switch waits. Save or discard the edit, then refresh; the draft stays associated with its original workspace until switching is safe. A failed metadata check preserves the existing root rather than guessing a destination. This behavior requires the matching updated native companion and UI; reloading only the UI cannot fix the older companion’s cached root.

The [middle-page strip](middle-pages.md) keeps primary Chat pinned beside native pages, with one page visible at a time. Eligible local file and PDF tabs have an **↗** action to open or move them into the editor. Native editing state and failed/cancelled transfers keep the original tab available.

Collapsing the docked file explorer leaves a slim 18 CSS-pixel strip. Click its arrow or anywhere along the strip to reopen the tree at its saved width.

The explorer’s Refresh, Collapse, Hide, and collapsed-strip expand controls, the header **E**, and our editor controls use rounded bubble tooltips styled after native Codex. Hover briefly or focus a control with the keyboard to show its tooltip; Escape dismisses it. Editor labels follow the current action, such as Expand/Restore and Enable/Disable wrap. Native comparison controls and document links retain their existing tooltips.

Click a file in the explorer to open it. **E** can also open an empty editor before you've chosen a file.

| Control | Behavior |
| --- | --- |
| Mouse wheel over tabs | Scrolls through tabs when they overflow |
| Drag a tab | Moves it before or after another tab |
| Open-files dropdown | Lists open files; arrow keys navigate and Escape dismisses it |
| Pin / Unpin | Changes whether this file reopens for the current project |
| A tab's X | Closes that individual tab, with a warning for a pin or unsaved edit |
| Editor row's X | Closes unpinned tabs; keeps pinned files open |
| E | Hides or reopens the editor without closing its tabs |

The tab budget is 64; when opening more files, the controller attempts to evict an eligible unpinned tab. Up to 32 files can be pinned for each project. Pins use the project's normalized absolute root as their key and keep relative file paths in reopening order. Moving the project to another root gives it a different pin identity.

Recorded and native comparison tabs are read-only and can't be pinned. Ordinary source files opened from those comparisons can be pinned normally.

Closing a pinned tab individually keeps its pin for next session. **Unpin** removes the pin without closing the file. Missing pinned files show a load error and can be unpinned. A pin isn't a backup and doesn't store a draft.

Dragging an explorer file into chat supplies its absolute local path in the text payload. Internal tree moves keep their separate relative-path payload. The drag operation doesn't automatically give the agent the file's contents.

## Preview, edit, save

**Preview** is read-only. **Edit** enables source editing when the native reader marks the file editable. **Save**, or **Ctrl+S**, writes the complete draft using the loaded file version for conflict detection.

For Markdown, editing shows the source text, including the pipe-delimited table rows. Rendered Markdown is provided by the optional preview plugin. Previewing an unsaved draft keeps that draft in memory; it isn't an implicit save.

Word wrap is available from the editor tab row. It preserves the source, draft, selection, and caret while changing layout. Gutter numbers refer to logical source lines rather than each wrapped screen row. The minimap is hidden while wrapping.

| File size | Reading | Editing |
| --- | --- | --- |
| Up to 512 KiB | Complete inline text; optional matching preview plugin | Supported text files the native reader allows |
| Above 512 KiB through 10 MiB | Complete text in a virtual plain reader; Markdown offers explicit full rendering | Read-only |
| Above 10 MiB | Explicit size error; no partial document presented as complete | Unavailable |

These are byte limits: 1 KiB is 1,024 bytes. Binary, sensitive, unsupported, or unavailable files have their own restrictions. A rendered preview or syntax-highlighting budget doesn't authorize saving incomplete content.

When switching away from a dirty file, choose **Save and switch**, **Discard**, or **Cancel**. Individual close and close-all similarly offer save-and-close choices. A failed save retains the draft and prevents the dependent close or switch. Save-all currently handles the active dirty editor; this isn't a multi-document unsaved-draft system.

Drafts belong to the running session. There is a short, 10-second in-memory recovery handoff for a native UI refresh, subject to matching chat/bootstrap identity. This isn't recovery after quitting or crashing the entire application. Save before restarting.

## Citing source in chat

Markdown Preview document links are also usable: see [link navigation, warnings and saved choices](links.md). Their tooltips describe the destination and action before clicking. This is separate from the unfinished compact presentation of citation links in the chat composer.

Select source text and **right-click** for **Cite in chat**, **Add to citation group**, or **Copy citation**. This works with every supported complete text file, including code, JSON, TOML, logs, plain text and Markdown. It doesn't add editing support to a format the native reader doesn't allow. References cover whole logical lines, so wrapped screen rows still map to the original file.

**Cite in chat** appends a Markdown reference to the current chat draft without replacing your existing text or sending it. The label includes the full path and line range so the agent can find it. If the native composer cannot be identified safely, use Copy citation. You choose when to send.

**Current presentation:** the draft composer can display the entire Markdown link and its long encoded URL. The sent message renders as a clickable label, but hovering can still expose that raw URL. These are known presentation limitations; compact composer chips and readable citation tooltips are not implemented. See [citation status, live verification and remaining work](citations.md).

For several selections, use **Add to citation group** on each range, across files if needed. A small tray above the composer lets you remove ranges, clear the group, copy it, or insert it. A group supports up to 32 ranges. Inserting creates one group link plus individual range links. The queue is session memory and clears when the chat/project changes or the extension stops; it creates no extra disk archive.

Click a citation in chat to open its source in the editor and highlight it. Group links open the referenced files and focus the first one; individual links go straight to that range. The normal Preview / Edit / Save controls and dirty-file Save and switch / Discard / Cancel choices remain available. **Clear** removes the active highlights.

References store a normalized whole-line quote up to 4,096 characters inside the link. If lines move, a unique matching quote relocates the highlight. Missing or ambiguous quotes are reported rather than guessed. Larger selections use explicitly labelled line anchors, which cannot follow moved text. An **unsaved draft** label identifies citations taken from edits that haven't been saved; reopening later may not find that text. Ordinary absolute file links with line anchors also work inside the active project.

Rendered Markdown, CSV and diagram previews don't have reliable source-line positions. Select text and right-click **Show source to cite**, or enter Edit for an editable file. **Rendered preview** returns from that source view. Citation navigation uses source automatically; Clear restores the ordinary preview. The virtual plain reader also supports visible selections and jump-back highlights through the 10 MiB reading limit; it cannot select unmounted rows across an arbitrary offscreen span.

Inserted/copied references contain paths and bounded source quotes. Once sent, they follow the chat's normal retention; the extension keeps no separate permanent citation store. Links are scoped to files inside the current project, so another machine or moved project may need a fresh reference. Existing native file/sensitive-path policy still governs loading.

## Two ways to review changes

### Persistent Native changes panel

The panel sits above the composer. It reads native patch records for the active chat/project and keeps the latest useful review even after conversational replies. Expand the panel to skim filenames, then use each file's arrow to expand its inline diff independently. Readers are created on expansion and released on collapse.

Click a filename to open its recorded patch in a normal editor diff tab. **Open file** then opens the current source in a separate ordinary tab. That source has its own available Preview / Edit / Save controls, while the recorded patch remains available.

A recorded patch doesn't change when you edit the live file. It describes that response's recorded work. Combined diffs and deleted-file comparisons have no source-file button. If the source has disappeared since the response, its ordinary file tab shows the normal load error; the recorded comparison remains.

Use the recent-review selector to inspect an older cached review and **Refresh** to request native records again. **Undo / Reapply** forwards to the matching mounted native control when available. The extension doesn't implement a separate reversal engine.

### Live files-changed bubble

The native bubble can appear during an active response. Clicking it opens Codex's actual comparison viewer as an editor **Changes** tab. Clicking a file in its hover list lets Codex select the exact file, then focuses that tab. Native comparison modes, file navigation, and other comparison controls stay native.

Switching to another file hides the comparison without closing it. Returning to Changes preserves native viewer state where the host permits it. E hides it with the editor; fullscreen and resizing follow the editor layout. Closing Changes uses the original native close control.

Use the editor's left edge to resize Changes beside chat. The extension owns that outer boundary while hosting the comparison; Codex's competing outer workspace handle is temporarily hidden and restored when hosting ends. Internal comparison/file-list dividers remain native. Dragging accounts for application zoom.

In Changes, the editor's word-wrap button reflects the native viewer's actual setting and forwards changes to its original Word wrap control. Using either control updates the editor indicator. Ordinary source tabs retain their separate saved wrap preference. If the native wrap control cannot be recognized safely, the editor button is disabled for Changes; native viewer controls remain available.

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
