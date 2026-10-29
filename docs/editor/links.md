# File links in chat and Markdown Preview

## Opening a chat file reference

Plain absolute local-file references in the active chat open/reuse an editor tab through the authenticated workspace reader. This covers ordinary anchors and the observed native `data-file-reference` button with `data-prompt-link-href`, including encoded spaces, Unicode names and local file URLs. Click the reference, or focus a native reference button and press Enter or Space. Nothing is executed.

The adapter requires matching active chat/project identity and a recognized main chat surface. References outside the project, relative/unknown destinations, external URLs, native tab content, composer content, modified/middle clicks and downloads retain their original handlers. Existing citation/line-anchor routing is separate; this addition does not reinterpret fragments or query parameters. Unknown native markup stays native.

Dirty source files use the existing Save and switch / Discard / Cancel flow. Cancel or a failed save preserves the draft. Read failures remain explicit editor errors; the adapter does not also open a native tab as a fallback. Repeated clicks while a switch is pending announce that it must finish first. The normal file-policy and preview-format limits still apply.

`test-chat-file-links.mjs` checks native-reference markup, actual browser pointer/keyboard input, parsing, scoping, modified clicks, pending requests and disposal. `test-citations-host.mjs` tests the built explorer's reader and save/cancel/conflict flow. The reported native reference's attributes were inspected read-only; live navigation with the new candidate still requires installation and an owner check.

## Markdown Preview

Preview links now have somewhere useful to go ;3 Hover first: the tooltip describes the resolved destination, what clicking does, and whether confirmation is required or previously allowed.

## Staying in the editor

- Relative document links resolve from the current file's folder, including parent-folder references that remain inside the project. They open/reuse ordinary editor tabs through the normal native file policy. Supported local absolute destinations use the same project boundary.
- Opening a file is a preview operation, including a link naming a script or executable. It doesn't execute that file. Outside-project/network file links are unavailable; navigation doesn't silently grant access or change project roots.
- Heading fragments jump within rendered Markdown. Local links to another Markdown document can also jump to its heading after it loads. Repeated headings use slug suffixes such as `section-1`. Unavailable headings report a message instead of guessing.
- Dirty files keep the existing Save and switch / Discard / Cancel flow. Failed saves block the switch. Preview reflects the current unsaved draft without saving it.

The existing renderer still determines which links survive sanitization. Some `file:` and custom app protocols may have no retained destination; those remain unavailable. Raw HTML, executable commands and network file access haven't been enabled. Source/unsupported formats continue to follow normal preview limits.

## Leaving Preview

HTTP(S) links show **Open external website?**, with the full normalized destination and **Open website / Cancel**. Supported application URIs, such as email links, use **Open external application?**, explicitly stating that an installed app/process may launch. Merely hovering or displaying a link doesn't open it or fetch a remote preview.

Confirmation uses Codex's ordinary link handler. The host/OS decides the browser or installed URI handler; this extension doesn't choose an arbitrary executable, compose shell commands or provide a process runner. Script/data/internal/command URL schemes are blocked. An unrecognized or renderer-stripped destination doesn't gain an Open action just because a warning exists.

## Remembering a choice

The checkbox starts **unchecked**. Checking it and confirming remembers only the displayed scope:

| Link kind | Remembered scope |
| --- | --- |
| Website | Exact origin: scheme, hostname and port. Paths on that origin share the choice; a different origin still warns. |
| Application URI | Its application protocol, separate from all website choices. This can skip later prompts for other destinations using that protocol. |

Cancelling never remembers a checked box. Tooltips show **Previously allowed** when a choice will skip confirmation. These choices apply across projects in the same renderer profile. They store permission identifiers, not document contents or link histories, and do not expire automatically. Up to 100 explicit scopes are retained; malformed/unavailable storage falls back to confirmation.

**Shift-click** a link to review its warning even when previously allowed. The warning offers **Forget saved permission** for that scope and **Reset all link warnings** to clear every remembered website/app choice. Forget/reset does not open the destination. These controls are available now; the fuller settings area is still future work.

Keyboard users can focus a link and press Enter; Shift+Enter forces review. Escape or Cancel closes the warning. Switching file/chat/project while the warning is pending cancels it or prevents the stale action from opening anything.

## Verification and scope

`test-preview-links.mjs` uses synthetic Markdown and intercepts outgoing handoffs: no real websites or applications are launched. It checks routing, tooltips, scopes, cancel/remember/reset, keyboard access, stale dialogs and blocked schemes. `test-citations-host.mjs` verifies full explorer wiring for local-file navigation, current drafts, save failure/cancellation and cross-document heading jumps.

Actual browser/application handoff still needs verification in the running desktop host after installing this UI. Existing source/citation tests cover their respective paths; this feature doesn't finish compact citation chips or the native chat citation hover UI.
