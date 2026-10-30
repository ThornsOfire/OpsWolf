import {userPreferences} from '../core/configuration/user-preferences';

/** Optional, one-way fixed app link. No companion dependency, network, or workspace access. */
export function mountNovaRestore(container: HTMLElement, doc: Document = document): () => void {
  const preferences = userPreferences(doc.defaultView!);
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'icon-button nova-companion-restore';
  button.setAttribute('aria-label', 'Show Nova Fox Companion');
  button.title = 'Show Nova Fox Companion';
  button.innerHTML = '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path fill="#333a4e" stroke="#b78050" d="M4 4 13 9 19 9 28 4 26 22 16 29 6 22Z"/><path fill="#65ead3" d="m8 15 6 2-5 2zm16 0-6 2 5 2z"/><path fill="#ffb454" d="m13 22 3 4 3-4-3-2z"/></svg>';
  let confirmed = false;
  button.addEventListener('click', () => {
    if (!confirmed && !doc.defaultView!.confirm('Open the installed Nova Fox Companion? Enable its restore link in Nova settings first.')) return;
    confirmed = true;
    const link = doc.createElement('a'); link.href = 'nova-fox-companion://show';
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.hidden = true;
    doc.body.append(link); link.click(); link.remove();
  });
  const render = () => { button.hidden = !preferences.current.novaCompanion; button.style.display = button.hidden ? 'none' : ''; };
  container.append(button); const unsubscribe = preferences.subscribe(render); render();
  return () => { unsubscribe(); button.remove(); };
}
