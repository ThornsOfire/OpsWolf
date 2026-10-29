# Middle pages and local-file transfers

On qualified native shells, the middle area has one visible page at a time. A pinned **Chat** button returns to the primary conversation; native browser, file, terminal, and other eligible right-panel pages appear beside it in one strip. The internal chat/page divider is hidden. The file explorer and editor retain their separate boundaries.

Chat remains mounted when a native page is shown. Switching pages preserves its unsent composer draft and scroll position. Native pages keep their original nodes, session owners, selection handlers, and close handlers. The extension changes presentation; it does not recreate browser sessions or terminal processes.

## Controls

- **Chat** is always first and cannot be closed or scrolled away. Selecting it shows the whole middle area. From an expanded editor, selecting a middle page hides the expanded editor so the middle area is visible; E reopens the editor docked.
- Click a page to invoke its native selection handler. Its X invokes the native close handler, including native confirmation behavior.
- Use the mouse wheel over crowded page tabs to scroll them. The arrow dropdown lists Chat and all supported middle pages. Left/Right and Home/End navigate from the custom tab controls.
- The native **New tab**, chat actions, summary, and E controls retain their handlers. The native tab-creation menu stays anchored to its real button. Hide tabs returns to Chat; a page selection can reopen hidden native tabs.
- Changes keeps its existing dedicated editor integration instead of acquiring a second middle-page proxy.

Page selection is running-session UI state. It does not add a new disk archive or promise restoration of unsaved native state after restarting the app.

The editor's separate conversation tab tracks the active native chat title in both docked and expanded layouts, including renames. It uses a generic label if the title cannot be identified uniquely; inactive cached pages do not supply the title.

## Move a local file to the editor

Select an eligible local file/preview/PDF tab, then use the **↗** button beside the middle-page dropdown. Its tooltip describes the action. The adapter recognizes the verified local text-editor and artifact tab identities, validates the full path against the current project, and opens the file through the usual authenticated workspace reader.

The native tab closes only after the editor has loaded a supported view and the same chat, project, and native tab are still current. Cancelled switches, failed saves, unavailable previewers, unsupported formats, read failures, and load timeouts keep the original native tab available. Existing editor drafts use the normal Save and switch / Discard / Cancel flow.

If the native file panel exposes an editor or input surface, the button becomes **Open file in editor and keep native editing state**. This opens the disk version in our editor and retains the original native tab. It does not copy an unsaved native draft or save it automatically. The extension takes this conservative path even when it cannot tell whether that native editor is dirty.

Outside-project, remote, cloud, and unrecognized file identities do not get a transfer action. Browser, terminal, and additional-chat transfers remain roadmap work. Native browser/terminal pages can still be selected in the middle area.

## Compatibility

Reverse editor-to-middle transfers and bidirectional dragging remain unimplemented. The [native capability investigation](native-capability-research.md) records why agent-side file-opening tools do not yet establish a safe extension-side transfer route.

The adapter requires a matching active chat, the known native main/header/action markers, and right-controller tab identities. Unrecognized layouts, conflicting chat identities, and primary/main-controller page placements retain the native presentation. Native nodes are not moved or cloned and private framework stores are not used.

Synthetic checks cover native-handler proxies, pinned Chat hit targets, overflow, drafts and scrolling, file/PDF transfer completion and failures, zoom, editor expansion, and cleanup. The full explorer fixture separately exercises authenticated reads and save/cancel/conflict guards. Real-host behavior must be checked after installing the matching UI bundle; fixtures do not establish compatibility with every future native build.
