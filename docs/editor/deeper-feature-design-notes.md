# Deeper features: ideas and design notes

Captured 2026-10-29. **Discussion notes only — not an implementation plan, approved architecture, or promise of feasibility.** These preserve the intent behind the unfinished features so we can return to them without reconstructing the conversation. No work order, deadline or new task is created by this document.

The current editor remains the foundation. Native Codex still owns its composer, comparisons, tabs and host process. We want clearer workflows, but a tidy-looking interface is only useful if drafts, navigation and native behavior remain reliable. See the [capability investigation](native-capability-research.md) for what we actually observed, rather than treating an unanswered question as proof that something is impossible.

## 1. Open Changes whenever it is useful

**Idea:** give the editor a dependable Changes entry point, without requiring the temporary live changes bubble to be visible.

**Intended flow:** select Changes; focus the existing comparison if it is already open, or open the native comparison for the current chat. Keep the comparison inside our editor layout. Repeated selections should reuse it. If there are no recorded changes, distinguish that from the host being unable to open the view.

**Why:** the bubble is useful during work, but reviewing should not depend on finding an earlier message or waiting for the bubble to appear. Our persistent changes bar and the native comparison serve related purposes; neither should pretend to cover every filesystem edit.

**Unresolved:** a supported way for the extension to open that native view and confirm success. An agent tool being able to request it does not make that tool an extension API. The tested ordinary deeplink did not establish the capability. Starting a new agent review is a different action and should not be substituted.

## 2. Make file destinations understandable

**Idea:** make it obvious whether a Changes file action opens current source in our editor, a native file view, or an external program.

**Intended flow:** the normal source-opening action goes to our editor. Secondary destinations live in a clearly labelled menu; a program-selection action is distinct from merely previewing a file. Keep useful native actions available. The exact button/menu arrangement is still a design choice.

**Why:** one predictable primary action reduces the need to remember which part of the interface opens which kind of tab. Historical comparisons and editable current files must remain visibly different.

**Already present:** the separate current-source editor action and ordinary project-file links from chat. They are not completion of the proposed destination menu.

**Unresolved:** whether a supported native/OS program chooser can receive a validated file destination. Avoid inventing command strings or turning a file-opening menu into a general process runner. Cancelled saves, failed reads and cancelled chooser dialogs should leave the original work available.

## 3. Finish citation presentation

**Idea:** make citations readable both while composing and when hovering over a sent reference, while preserving the useful data already carried by the citation.

**Composer direction:** a compact filename-and-lines reference, with a clear unsaved-draft indicator. Groups should show their range count and allow inspection/removal of individual references. Full paths and reference-copying remain available without filling the draft with an encoded URL.

**Hover direction:** show a concise path/range or group summary. Keep the destination clear and retain the existing click-to-open behavior. Hover polish could be a separate, smaller feature if its native integration proves viable.

**Why:** the core transport works; its current raw representation makes the message box and tooltips harder to use. Presentation must not silently strip quotes, change line ranges, lose references on reload, or require a permanent local quote archive.

**Unresolved:** how a compact composer representation can participate in native selection, undo/redo, paste, IME, draft persistence and outgoing serialization. Rich paste flattened to Markdown in the inspected host. Replacing visible composer DOM would not establish those guarantees. Until a suitable integration exists, retain complete references and explicit user sending. See [citation notes](citations.md).

## 4. Move files between the editor and middle area

**Idea:** let users choose where a file belongs, with an explicit move action and eventually bidirectional drag-and-drop.

**Intended flow:** identify the exact file, resolve any unsaved changes, open and verify the destination, then close the source only when the move has succeeded. Failure or cancellation keeps the original tab and draft. Dragging should call the same transfer behavior as the menu action, with a clear valid/invalid drop target.

**Why:** the editor is the default coding space, but the middle area's native views still have a purpose. Moving a tab should feel predictable rather than creating duplicates or hiding a draft. Chat stays easy to reach, and moving between areas must remain distinct from reordering tabs within one area.

**Already present:** guarded middle-to-editor file transfers. Reverse creation and dragging remain unfinished.

**Unresolved:** a supported native file-opening capability, reliable destination identity, and the treatment of pins and any native unsaved state. Read-only comparison content must not be confused with the current file. Browser, terminal and additional-chat transfers remain separate roadmap ideas; their session ownership makes them more than another file format. No native-node reparenting shortcut is assumed. See [middle-page behavior](middle-pages.md).

## 5. Make the control center feel personal

**Idea:** extend the existing name/logo/color profiles toward supported Windows-facing branding and, separately, optional activity integration such as Discord.

**Windows direction:** investigate which owned surfaces can reliably use a saved profile: launcher or shortcut label/icon, and possibly window/taskbar presentation where the host permits it. Apply startup-dependent choices on the next launch, explain their scope, and make restoring defaults straightforward.

**Activity direction:** treat external presence as its own opt-in feature with clear setup and an explicit choice of what is shared. A personal display name should not imply that every app detector will identify the running host by that name. Do not expose file paths, chat text or project names by default.

**Why:** users should be able to make their workspace feel like their own without changing authentication, storage locations, update identity or compatibility.

**Already present:** local owned menu/settings profiles. They do not rename the signed native application or enable Discord activity.

**Unresolved:** the supported handoff between saved profiles and launcher/shortcut ownership, what the actual host allows, and external registration/setup requirements. Preserve host binaries and stable internal identifiers. Windows and Discord behavior would need owner-assisted verification. See the [identity capability matrix](identity.md).

## Parked: context meter

Keep this as a waiting-on-capability idea rather than an active design task. The inspected setup did not provide our companion with a supported read-only usage snapshot or subscription for the actual active session. That is narrower than saying no usage data exists anywhere in Codex.

Revisit when a documented host capability becomes available. It would need to identify the correct session and distinguish current context occupancy, last-response usage, cumulative totals and model capacity, with honest unavailable/stale states. Account quota and goal totals are not substitutes. No guessed percentage or compaction countdown. The [context-meter research](context-meter-research.md) preserves the evidence and revisit condition.

## When we return to these notes

Choose one feature, confirm its intended interaction, and investigate its missing capability before settling on implementation. A short prototype may answer a question; it is not automatically a shipped feature. Keep unsupported portions visible and preserve the working fallback. These notes deliberately leave technical choices, priority and scheduling open.
