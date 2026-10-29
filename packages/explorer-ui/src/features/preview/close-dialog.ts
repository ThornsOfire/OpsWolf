export type CloseChoice='save'|'discard'|'cancel';

export interface CloseDialogOptions { readonly switching?:boolean; readonly pinned?:boolean; readonly dirty?:boolean; }

export function chooseEditorClose(document:Document,all:boolean,fileName:string,options:CloseDialogOptions={}):Promise<CloseChoice> {
  return new Promise(resolve=>{
    const host=document.createElement('span');host.dataset.codeCodexCloseDialog='true';
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      dialog{color-scheme:light dark;width:min(420px,calc(100vw - 48px));box-sizing:border-box;border:1px solid GrayText;border-radius:12px;padding:22px;background:Canvas;color:CanvasText;font:14px/1.5 system-ui,sans-serif;box-shadow:0 16px 64px #0005}
      dialog::backdrop{background:#0007}h2{font-size:17px;margin:0 0 10px}p{margin:0 0 20px;overflow-wrap:anywhere}
      footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}button{font:inherit;padding:6px 11px;border:1px solid GrayText;border-radius:6px;cursor:pointer;background:Canvas;color:CanvasText}
      button[data-choice="save"]{background:Highlight;color:HighlightText;border-color:Highlight}button:focus-visible{outline:2px solid Highlight;outline-offset:2px}
    </style><dialog aria-labelledby="close-title" aria-describedby="close-description"><h2 id="close-title"></h2><p id="close-description"></p><footer><button type="button" data-choice="cancel" autofocus>Cancel</button><button type="button" data-choice="discard">Discard</button><button type="button" data-choice="save"></button></footer></dialog>`;
    const dialog=shadow.querySelector('dialog')!;
    const dirty=options.dirty!==false;
    shadow.querySelector('h2')!.textContent=!dirty?'Close pinned tab?':options.switching?'Save changes before switching files?':all?'Save changes before closing unpinned tabs?':'Save changes before closing?';
    const warning=options.pinned?' This tab is pinned. Closing it keeps the project pin, so it can reopen next session.':'';
    shadow.querySelector('p')!.textContent=(dirty?`${fileName} has unsaved changes. Cancel keeps your current file and draft.`:fileName)+warning;
    const save=shadow.querySelector<HTMLButtonElement>('[data-choice="save"]')!;
    save.textContent=options.switching?'Save and switch':all?'Save all and close':'Save and close';save.hidden=!dirty;
    if(!dirty)shadow.querySelector('[data-choice="discard"]')!.textContent='Close pinned tab';
    let choice:CloseChoice='cancel';
    for(const button of shadow.querySelectorAll<HTMLButtonElement>('button'))button.addEventListener('click',()=>{
      choice=button.dataset.choice as CloseChoice;dialog.close();
    });
    dialog.addEventListener('close',()=>{host.remove();resolve(choice);},{once:true});
    document.body.append(host);
    try {dialog.showModal();} catch {host.remove();resolve('cancel');}
  });
}

export interface EditorCloseRequest {
  readonly document:Document;
  readonly all:boolean;
  readonly switching?:boolean;
  readonly pinned?:boolean;
  readonly fileName:string;
  readonly isCurrent:()=>boolean;
  readonly save:()=>Promise<boolean>;
  readonly discard:()=>void;
  readonly close:()=>void;
}

/** Only a successful save may proceed to close; stale requests never close a new workspace. */
export async function requestDirtyEditorClose(request:EditorCloseRequest):Promise<void> {
  const choice=await chooseEditorClose(request.document,request.all,request.fileName,{switching:Boolean(request.switching),pinned:Boolean(request.pinned)});
  if(choice==='cancel'||!request.isCurrent())return;
  if(choice==='save') {
    if(!await request.save()||!request.isCurrent())return;
  } else {
    request.discard();
    if(!request.isCurrent())return;
  }
  request.close();
}
