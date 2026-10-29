import type {PreviewLink} from './link-policy';
import type {LinkPermissions} from './link-policy';
type ExternalLink=Extract<PreviewLink,{kind:'website'|'application'}>;
export function confirmPreviewLink(document:Document,link:ExternalLink,permissions:LinkPermissions,current:()=>boolean,open:(url:string)=>void,onClose:()=>void=()=>{}):()=>void {
 const host=document.createElement('span');host.dataset.codeCodexLinkDialog='true';const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<style>dialog{color-scheme:light dark;width:min(520px,calc(100vw - 48px));box-sizing:border-box;border:1px solid GrayText;border-radius:12px;padding:22px;background:Canvas;color:CanvasText;font:14px/1.5 system-ui}dialog::backdrop{background:#0007}h2{font-size:18px;margin:0 0 12px}pre{max-height:32vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;border:1px solid GrayText;font:12px/1.5 monospace}label{display:flex;align-items:flex-start;gap:8px;margin:16px 0}footer{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}button{font:inherit;padding:6px 10px;border:1px solid GrayText;border-radius:6px;cursor:pointer;background:Canvas;color:CanvasText}.open{background:Highlight;color:HighlightText}</style><dialog aria-labelledby="link-title" aria-describedby="link-warning link-destination"><h2 id="link-title"></h2><p id="link-warning"></p><pre id="link-destination"></pre><label><input type="checkbox"><span></span></label><footer><button class="forget" type="button">Forget saved permission</button><button class="reset" type="button">Reset all link warnings</button><button class="cancel" type="button" autofocus>Cancel</button><button class="open" type="button"></button></footer></dialog>`;
 const dialog=shadow.querySelector('dialog')!,checkbox=shadow.querySelector('input')!;
 shadow.querySelector('h2')!.textContent=link.kind==='website'?'Open external website?':'Open external application?';
 shadow.querySelector('p')!.textContent=link.kind==='website'?'This leaves the document preview. Check the destination before opening.':'This URI may launch an installed application or process. Only continue if you recognize and trust the destination. No shell command is constructed by the preview.';
 shadow.querySelector('pre')!.textContent=link.destination;
 shadow.querySelector('label span')!.textContent=link.kind==='website'?`Don't ask again for this website (${link.label})`:`Don't ask again for this application protocol (${link.label})`;
 const launch=shadow.querySelector<HTMLButtonElement>('.open')!;launch.textContent=link.kind==='website'?'Open website':'Open application';
 const forget=shadow.querySelector<HTMLButtonElement>('.forget')!;forget.hidden=!permissions.has(link.permission);
 const close=()=>{if(dialog.open)dialog.close();host.remove();};
 dialog.addEventListener('close',()=>{host.remove();onClose();},{once:true});
 shadow.querySelector('.cancel')!.addEventListener('click',close);
 forget.onclick=()=>{try{permissions.revoke(link.permission);}catch{}close();};
 shadow.querySelector('.reset')!.addEventListener('click',()=>{try{permissions.clear();}catch{}close();});
 launch.onclick=()=>{if(!current()){close();return;}if(checkbox.checked){try{permissions.allow(link.permission);}catch{}}open(link.destination);close();};
 document.body.append(host);try{dialog.showModal();}catch{host.remove();}
 return close;
}
