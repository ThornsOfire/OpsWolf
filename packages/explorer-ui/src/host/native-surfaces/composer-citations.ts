import {annotationConsensusThreadId} from '../../adapters/codex-26.715';

/** Append through native editing/input events; never submit, clear, or replace a draft. */
export function appendCitationToComposer(document:Document,threadId:string,text:string):boolean {
  if(!text||text.length>96_000||annotationConsensusThreadId(document,true)!==threadId)return false;
  const roots=[...document.querySelectorAll<HTMLElement>('[data-above-composer-conversation-id]')]
    .filter(e=>e.getAttribute('data-above-composer-conversation-id')===threadId&&!e.closest('[data-app-shell-active-page="false"]'))
    .map(e=>e.closest('[data-codex-composer-root]')).filter((e):e is HTMLElement=>e instanceof HTMLElement);
  const editors=[...new Set(roots.flatMap(root=>[...root.querySelectorAll<HTMLElement>('[contenteditable="true"],textarea')]))]
    .filter(e=>!e.closest('[inert],[hidden],[aria-hidden="true"]')&&e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden');
  if(editors.length!==1)return false;
  const editor=editors[0]!;
  if(editor instanceof HTMLTextAreaElement){
    if(editor.disabled||editor.readOnly)return false;
    const next=editor.value+(editor.value?'\n\n':'')+text+'\n';
    const setter=Object.getOwnPropertyDescriptor(document.defaultView!.HTMLTextAreaElement.prototype,'value')?.set;
    if(!setter)return false;
    setter.call(editor,next);editor.focus({preventScroll:true});editor.setSelectionRange(next.length,next.length);
    editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));return true;
  }
  const previous=editor.textContent??'';
  editor.focus({preventScroll:true});
  const selection=document.getSelection();if(!selection)return false;
  const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);
  try {document.execCommand('insertText',false,(previous?'\n\n':'')+text+'\n');}catch{return false;}
  return (editor.textContent??'')!==previous;
}
