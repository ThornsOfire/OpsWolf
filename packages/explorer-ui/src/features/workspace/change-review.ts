import {WorkspaceBridge} from '../../bridge';
import type {ExplorerContext} from '../../contracts/bridge';
import {normalizeNativePage} from './native-review-model';
import type {NativeReview,NativeReviewFile} from './native-review-model';
export {normalizeNativePage} from './native-review-model';
export type {NativeReview,NativeReviewFile} from './native-review-model';
import {LargeTextReader,largeTextStyles} from '../preview/large-text-reader';
export interface ChangeReviewPorts {
 readonly element:HTMLElement;
 readonly bridge:WorkspaceBridge|undefined;
 readonly context:ExplorerContext|undefined;
 readonly enabled:boolean;
 readonly openDiff:(id:string,path:string,content:string,openSourcePath?:string)=>void;
}
interface NativeCard {element:HTMLElement;previousDisplay:string;previousPriority:string;reviewId:string;}
/** The native history remains the source of truth; only the visible presentation is adapted. */
export class ChangeReviewController {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private key='';private revision=0;private disposed=false;private running:boolean|undefined;
 private refreshing=false;private finishAt=0;private lastRead=0;private error='';private bounded=false;private ready=false;
 private reviews:NativeReview[]=[];private selectedId='';private expanded=false;
 private expandedFiles=new Set<string>();
 private host:HTMLElement|undefined;private shadow:ShadowRoot|undefined;private readers:LargeTextReader[]=[];
 private cards=new Map<HTMLElement,NativeCard>();private revealed=new Set<string>();
 constructor(private readonly ports:ChangeReviewPorts){}
 start():void {this.disposed=false;if(!this.timer){this.ports.element.ownerDocument.addEventListener('click',this.onNativeClick,true);this.tick();}}
 dispose():void {this.disposed=true;clearTimeout(this.timer);this.timer=undefined;this.revision++;this.key='';this.ports.element.ownerDocument.removeEventListener('click',this.onNativeClick,true);this.restoreCards();this.remove();this.reviews=[];this.expandedFiles.clear();}
 private currentKey():string {const c=this.ports.context;return this.ports.enabled&&c?c.threadId+'\0'+c.rootPath:'';}
 private remove():void {for(const reader of this.readers)reader.dispose();this.readers=[];this.host?.remove();this.host=undefined;this.shadow=undefined;}
 private restore(card:NativeCard):void {if(card.previousDisplay)card.element.style.setProperty('display',card.previousDisplay,card.previousPriority);else card.element.style.removeProperty('display');card.element.removeAttribute('data-code-codex-native-review-hidden');}
 private restoreCards():void {for(const card of this.cards.values())this.restore(card);this.cards.clear();}
 private selected():NativeReview|undefined {return this.reviews.find(r=>r.id===this.selectedId);}
 private cardReview(element:Element):NativeReview|undefined {
  const context=this.ports.context,annotation=element.closest('[data-response-annotation-target]');
  if(!context||annotation?.getAttribute('data-response-annotation-conversation')!==context.threadId)return;
  const id=annotation.getAttribute('data-response-annotation-target');return this.reviews.find(r=>r.messageIds.includes(id??''));
 }
 private updateCards():void {
  if(!this.ready||this.key!==this.currentKey()){this.restoreCards();return;}
  const found=new Set<HTMLElement>();
  for(const overlay of this.ports.element.ownerDocument.querySelectorAll<HTMLButtonElement>('button[aria-label="View changed files"]')){
   const header=overlay.parentElement,card=header?.parentElement;
   if(!header?.classList.contains('group/turn-diff-header')||!card?.querySelector('.turn-diff-default-subtitle'))continue;
   const review=this.cardReview(card);if(!review||review.omitted||!review.files.length||review.files.some(f=>f.content===null)||this.revealed.has(review.id))continue;
   found.add(card);
   if(!this.cards.has(card))this.cards.set(card,{element:card,reviewId:review.id,previousDisplay:card.style.getPropertyValue('display'),previousPriority:card.style.getPropertyPriority('display')});
   card.dataset.codeCodexNativeReviewHidden='true';card.style.setProperty('display','none','important');
  }
  for(const [element,card] of this.cards){if(!found.has(element)){this.restore(card);this.cards.delete(element);}}
  const undo=this.shadow?.querySelector<HTMLButtonElement>('.undo');const native=this.nativeUndo(this.selectedId);
  if(undo){undo.textContent=native?.textContent?.trim()||'Undo unavailable';undo.disabled=!native||native.disabled;}
 }
 private nativeUndo(id:string):HTMLButtonElement|undefined {
  const card=[...this.cards.values()].find(c=>c.reviewId===id)?.element;
  return card?[...card.querySelectorAll<HTMLButtonElement>('button')].find(b=>['Undo','Reapply'].includes(b.textContent?.trim()??'')):undefined;
 }
 private onNativeClick=(event:MouseEvent):void=>{
  if(!this.ready||this.key!==this.currentKey())return;
  const button=event.composedPath().find((n):n is HTMLButtonElement=>n instanceof HTMLButtonElement);
  if(!button||!(button.getAttribute('aria-label')==='View changed files'||button.textContent?.trim()==='View changes'))return;
  const review=this.cardReview(button);if(!review||!review.files.length||review.omitted||review.files.some(f=>f.content===null))return;
  event.preventDefault();event.stopImmediatePropagation();
  this.open(review);
 };
 private open(review:NativeReview,file?:NativeReviewFile):void {
  if(this.key!==this.currentKey())return;
  const content=file?.content??review.files.map(f=>f.content??'').join('\n');
  const source=file??(review.files.length===1?review.files[0]:undefined);
  if(!content)return;this.ports.openDiff(review.id,source?.relativePath??'All changed files',content,source?.kind==='delete'?undefined:source?.relativePath);
 }
 private tick=():void=>{
  this.timer=undefined;if(this.disposed)return;
  const key=this.currentKey(),bridge=this.ports.bridge;
  if(key&&bridge?.available){
   if(key!==this.key){this.revision++;this.key=key;this.running=undefined;this.reviews=[];this.selectedId='';this.lastRead=0;this.refreshing=false;this.ready=false;this.error='';this.finishAt=0;this.expanded=false;this.expandedFiles.clear();this.revealed.clear();this.restoreCards();this.remove();}
   const context=this.ports.context!;
   const anchor=[...this.ports.element.ownerDocument.querySelectorAll<HTMLElement>('[data-above-composer-conversation-id]')].find(e=>e.getAttribute('data-above-composer-conversation-id')===context.threadId&&!e.closest('[data-app-shell-active-page="false"]')&&e.closest('[data-codex-composer-root]')?.querySelector('[contenteditable="true"],textarea'));
   if(anchor){
    const running=!!anchor.closest('[data-codex-composer-root]')?.querySelector('button[aria-label="Stop"]');
    if(!running&&this.running===true)this.finishAt=Date.now()+1200;
    this.running=running;
    if(!this.lastRead||!running&&Date.now()-this.lastRead>60_000||!running&&this.finishAt&&Date.now()>=this.finishAt){if(!this.refreshing){this.finishAt=0;void this.refresh(bridge);}}
    this.updateCards();
    if(this.selected()||this.error)this.mount(anchor);
   }
  }else {this.restoreCards();this.remove();}
  this.timer=setTimeout(this.tick,500);
 };
 private async refresh(bridge:WorkspaceBridge):Promise<void>{
  this.refreshing=true;this.lastRead=Date.now();const revision=this.revision,key=this.key;
  const current=()=>!this.disposed&&revision===this.revision&&key===this.currentKey();
  try{
   const found:NativeReview[]=[];let cursor:string|null=null;const seen=new Set<string>();let exhausted=false;
   for(let pageIndex=0;pageIndex<40;pageIndex++){
    const page=normalizeNativePage(await bridge.request('explorer.changes.native',{cursor},30_000));if(!current())return;
    if(page.review&&page.review.status!=='inProgress'&&!found.some(r=>r.id===page.review!.id))found.push(page.review);
    // Once we reach our previous newest review, older immutable records are already in memory.
    if(page.turnId===this.reviews[0]?.id){for(const review of this.reviews){if(found.length>=10)break;if(!found.some(r=>r.id===review.id))found.push(review);}exhausted=!this.bounded;break;}
    if(found.length>=10||page.nextCursor===null){exhausted=page.nextCursor===null;break;}
    if(seen.has(page.nextCursor))throw Error('Native history pagination repeated');seen.add(page.nextCursor);cursor=page.nextCursor;
   }
   if(!current())return;
   const previous=this.reviews[0]?.id;this.reviews=found;this.bounded=!exhausted;this.ready=true;this.error='';
   const retained=new Set(found.flatMap(r=>r.files.map(f=>r.id+'\0'+f.relativePath)));
   for(const key of this.expandedFiles)if(!retained.has(key))this.expandedFiles.delete(key);
   if(found[0]&&previous!==found[0].id){this.selectedId=found[0].id;this.expanded=false;}
   else if(!found.some(r=>r.id===this.selectedId))this.selectedId=found[0]?.id??'';
   this.updateCards();this.remove();
  }catch{if(current()){this.ready=false;this.error='Native changes unavailable. The original chat cards remain available.';this.restoreCards();this.remove();}}
  finally{if(revision===this.revision)this.refreshing=false;}
 }
 private mount(anchor:HTMLElement):void {
  if(!this.host){this.host=anchor.ownerDocument.createElement('section');this.host.dataset.codeCodexChangeReview='true';this.host.setAttribute('aria-label','Native response changes');this.shadow=this.host.attachShadow({mode:'open'});this.render();}
  if(this.host.parentElement!==anchor)anchor.append(this.host);
 }
 private render():void {
  const shadow=this.shadow,review=this.selected();if(!shadow)return;
  for(const reader of this.readers)reader.dispose();this.readers=[];
  shadow.innerHTML=`<style>${largeTextStyles}
   :host{display:block;margin:8px 0;color:inherit;font:12px/1.4 system-ui,sans-serif}section{border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:9px;overflow:hidden}header{display:flex;align-items:center;gap:8px;padding:8px 10px}button,select{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible{outline:2px solid currentColor;outline-offset:2px}.toggle{flex:1;text-align:left}.files{max-height:min(45vh,420px);overflow:auto;padding:0 10px 10px}.file{border-top:1px solid color-mix(in srgb,currentColor 15%,transparent);padding-top:6px;margin-top:6px}.file-name{overflow-wrap:anywhere;font-weight:600;width:100%;padding:4px 0;text-align:left}.kind,.note{opacity:.7;font-size:11px}.note{margin:4px 0}.diff{height:170px;min-height:0;margin-top:5px;overflow:hidden}.diff .large-text-reader{height:170px}.diff .large-text-tools{display:none}.diff .large-text-viewport{font-size:11px}.small{font-size:11px}.history{max-width:130px}option{background:Canvas;color:CanvasText}
  </style><section><header><button class="toggle" type="button" aria-expanded="${this.expanded}"></button><select class="history" aria-label="Recent native reviews" title="Recent native reviews"></select><button class="undo small" type="button" disabled>Undo unavailable</button><button class="retry small" type="button">Refresh</button></header><div class="files" ${this.expanded?'':'hidden'}></div></section>`;
  const toggle=shadow.querySelector<HTMLButtonElement>('.toggle')!;
  toggle.textContent=this.error?'Changes unavailable':`${this.expanded?'▾':'▸'} Native changes · ${review?.files.length??0} file${review?.files.length===1?'':'s'}`;
  if(review?.completedMs)toggle.title=new Date(review.completedMs).toLocaleString();
  toggle.addEventListener('click',()=>{this.expanded=!this.expanded;this.render();});
  const history=shadow.querySelector<HTMLSelectElement>('.history')!;history.hidden=this.reviews.length<2;
  for(const [index,item] of this.reviews.entries()){const option=shadow.ownerDocument.createElement('option');option.value=item.id;option.textContent=`${index===0?'Latest':item.completedMs?new Date(item.completedMs).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Earlier'} · ${item.files.length} files`;history.append(option);}history.value=this.selectedId;
  history.addEventListener('change',()=>{this.selectedId=history.value;this.expanded=true;this.render();this.updateCards();});
  shadow.querySelector('.retry')!.addEventListener('click',()=>{if(this.key===this.currentKey()&&!this.refreshing&&this.ports.bridge)void this.refresh(this.ports.bridge);});
  shadow.querySelector('.undo')!.addEventListener('click',()=>{if(this.key!==this.currentKey())return;const native=this.nativeUndo(this.selectedId);if(native&&!native.disabled)native.click();this.updateCards();});
  this.updateCards();if(!this.expanded)return;
  const files=shadow.querySelector('.files')!;
  const note=(text:string)=>{const n=shadow.ownerDocument.createElement('div');n.className='note';n.textContent=text;files.append(n);};
  if(this.error)note(this.error);
  note('Native patch records. Shell/script edits may not appear. No workspace scan or extra diff copies on disk.');
  if(this.bounded)note('Showing recent native reviews; older history remains in chat.');
  if(review?.status!=='completed')note('This response was interrupted or failed; only its completed patches are shown.');
  if(review?.omitted)note('Some patches are outside this project, sensitive, oversized, or unavailable. Their original chat cards remain visible.');
  for(const [index,file] of (review?.files??[]).entries()){
   const entry=shadow.ownerDocument.createElement('div');entry.className='file';
   const heading=shadow.ownerDocument.createElement('div');heading.className='file-heading';heading.style.cssText='display:flex;align-items:center;gap:6px';
   const disclosure=shadow.ownerDocument.createElement('button');disclosure.type='button';disclosure.className='file-toggle';disclosure.disabled=file.content===null;disclosure.style.cssText='flex:none;min-width:24px;min-height:24px';
   const name=shadow.ownerDocument.createElement('button');name.type='button';name.className='file-name';name.textContent=file.relativePath;name.disabled=file.content===null;
   name.title='Open diff in editor';
   const kind=shadow.ownerDocument.createElement('div');kind.className='kind';kind.textContent=file.kind;
   heading.append(disclosure,name);entry.append(heading,kind);files.append(entry);
   if(file.content===null){disclosure.textContent='▸';disclosure.setAttribute('aria-expanded','false');disclosure.setAttribute('aria-label',`Diff unavailable for ${file.relativePath}`);kind.textContent+=' · Diff unavailable';continue;}
   const content=file.content;let added=0,removed=0;for(const line of content.split('\n')){if(line.startsWith('+')&&!line.startsWith('+++ '))added++;else if(line.startsWith('-')&&!line.startsWith('--- '))removed++;}kind.textContent+=` · +${added} −${removed}`;
   name.addEventListener('click',()=>{if(review)this.open(review,file);});
   const area=shadow.ownerDocument.createElement('div');area.className='diff';area.id=`native-file-diff-${index}`;area.setAttribute('role','region');area.setAttribute('aria-label',`${file.relativePath} diff`);entry.append(area);
   disclosure.setAttribute('aria-controls',area.id);
   const key=review!.id+'\0'+file.relativePath;let reader:LargeTextReader|undefined;
   const sync=()=>{
    const open=this.expandedFiles.has(key);area.hidden=!open;disclosure.textContent=open?'▾':'▸';disclosure.setAttribute('aria-expanded',String(open));
    disclosure.title=`${open?'Collapse':'Expand'} diff for ${file.relativePath}`;disclosure.setAttribute('aria-label',disclosure.title);
    if(open&&!reader){reader=new LargeTextReader(shadow.ownerDocument,content,true);this.readers.push(reader);area.append(reader.element);}
    if(!open&&reader){reader.dispose();this.readers=this.readers.filter(r=>r!==reader);reader=undefined;area.replaceChildren();}
   };
   disclosure.addEventListener('click',()=>{if(this.key!==this.currentKey())return;if(this.expandedFiles.has(key))this.expandedFiles.delete(key);else this.expandedFiles.add(key);sync();});sync();
  }
 }
}
