import { selectedNativeFileTab } from '../../host/native-file-tabs';
import type { EditorWorkspaceIdentity } from './editor-visibility';
import type { FileCitation } from '../../contracts/citations';

const fieldSelector = '[role="textbox"][contenteditable="true"]:not([aria-readonly="true"]):not([aria-disabled="true"])';

/** Resolve on demand. Codex can replace the panel and its editing surface independently. */
export function selectedNativeFile(host: HTMLElement, workspace: EditorWorkspaceIdentity | undefined, requestedPath?: string) {
  const target = selectedNativeFileTab(host, workspace, requestedPath);
  if (target && target.kind !== 'artifact') return target;
}

function nativeEditingField(panel: HTMLElement | undefined): HTMLElement | undefined {
  if (!panel) return;
  // Markdown preview exposes its native textbox directly. The source editor
  // exposes its textbox in the open shadow root of its file viewer.
  const fields = [...panel.querySelectorAll<HTMLElement>(fieldSelector)];
  for (const viewer of panel.querySelectorAll('diffs-container')) {
    if (viewer.shadowRoot && !viewer.closest('[inert],[hidden],[aria-hidden="true"]')) fields.push(...viewer.shadowRoot.querySelectorAll<HTMLElement>(fieldSelector));
  }
  const editors = fields.filter(rendered);
  if (editors.length === 1) return editors[0];
}

function rendered(element: HTMLElement): boolean {
  return !element.closest('[inert],[aria-hidden="true"],[hidden]') &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
}

/** Ask Markdown's original control to show numbered source. Its handler owns
 * the switch and any pending native edits. */
export function showNativeCitationSource(panel: HTMLElement): boolean {
  if (!panel.dataset.tabId?.startsWith('file:local:')) return false;
  const buttons = [...panel.querySelectorAll('button')].filter(button =>
    !button.disabled && !button.closest('[contenteditable]') && rendered(button) &&
    (button.ariaLabel || button.title || button.textContent || '').trim() === 'View source');
  if (buttons.length !== 1) return false;
  buttons[0]!.click();
  return true;
}

/** Only source rows carry native line numbers. Rich Markdown paragraphs and
 * virtualized gaps cannot establish the source location of a quote. */
export function revealNativeSourceCitation(panel: HTMLElement | undefined, citation: FileCitation): boolean {
  if (!panel) return false;
  const field = nativeEditingField(panel) ?? readOnlySourceRows(panel);
  if (!field) return false;
  const row = (line: number) => field.querySelector<HTMLElement>(
    ':scope > [data-line="' + line + '"][data-line-index="' + (line - 1) + '"]');
  const first = row(citation.startLine), last = row(citation.endLine);
  if (!first || !last) return false;
  const text: string[] = [];
  let next: Element | null = first;
  for (let line = citation.startLine; line <= citation.endLine; line++) {
    if (!(next instanceof HTMLElement) || next.dataset.line !== String(line) ||
        next.dataset.lineIndex !== String(line - 1)) return false;
    if (citation.quote !== undefined) text.push(next.textContent ?? '');
    if (line === citation.endLine && next !== last) return false;
    next = next.nextElementSibling;
  }
  if (citation.quote !== undefined && text.join('\n') !== citation.quote.replace(/\r\n?/g,'\n').replace(/\n$/, '')) return false;
  const selection = field.ownerDocument.getSelection();
  if (!selection) return false;
  const range = field.ownerDocument.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.childNodes.length);
  field.focus({preventScroll:true});
  selection.removeAllRanges();
  selection.addRange(range);
  first.scrollIntoView({block:'nearest', inline:'nearest'});
  return true;
}

function readOnlySourceRows(panel: HTMLElement): HTMLElement | undefined {
  // The read-only source view can expose the same numbered rows without a
  // textbox. Multiple columns (for example Show changes) are ambiguous.
  const parents = new Set<HTMLElement>();
  for (const viewer of panel.querySelectorAll<HTMLElement>('diffs-container')) {
    if (viewer.closest('[inert],[hidden],[aria-hidden="true"]') || !viewer.shadowRoot) continue;
    for (const row of viewer.shadowRoot.querySelectorAll<HTMLElement>('[data-line][data-line-index]')) {
      if (row.parentElement && rendered(row)) parents.add(row.parentElement);
      if (parents.size > 1) return;
    }
  }
  if (parents.size === 1) return parents.values().next().value;
}
