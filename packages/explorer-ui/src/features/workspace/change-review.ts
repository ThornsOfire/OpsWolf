import {WorkspaceBridge} from '../../bridge';
import type {ExplorerContext} from '../../contracts/bridge';
import {asRecord} from '../../core/bridge/response-validation';
import {normalizeMediaChunk} from '../preview/responses';
import {createReviewDiff,type ReviewDiff} from '../preview/review-diff';
import {LargeTextReader,largeTextStyles} from '../preview/large-text-reader';
export interface ReviewFile {relativePath:string;kind:string;beforeBytes:number;afterBytes:number;textAvailable:boolean;}
export interface ReviewSummary {id:string;createdMs:number;complete:boolean;unavailable:number;files:ReviewFile[];}
export function normalizeReview(raw:unknown):ReviewSummary|null {
  if(raw===null)return null;const value=asRecord(raw);
  if(!value||typeof value.id!=='string'||!/^\d{13}-[0-9a-f]{16}$/.test(value.id)||!Array.isArray(value.files)||value.files.length>25_000||typeof value.complete!=='boolean'||!Number.isSafeInteger(value.createdMs))throw Error('Invalid review metadata');
  for(const item of value.files){const file=asRecord(item);if(!file||typeof file.relativePath!=='string'||!file.relativePath||/[\0\r\n:]/.test(file.relativePath)||file.relativePath.startsWith('/')||file.relativePath.includes('\\')||file.relativePath.split('/').some(part=>part==='..')||typeof file.textAvailable!=='boolean'||!['added','modified','deleted'].includes(String(file.kind))||![file.beforeBytes,file.afterBytes].every(size=>typeof size==='number'&&Number.isSafeInteger(size)&&size>=0))throw Error('Invalid review file');}
  return value as unknown as ReviewSummary;
}
export interface ChangeReviewPorts {
 readonly element:HTMLElement;
 readonly bridge:WorkspaceBridge|undefined;
 readonly context:ExplorerContext|undefined;
 readonly enabled:boolean;
 readonly openDiff:(id:string,path:string,content:string)=>void;
}
export class ChangeReviewController {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private key='';private revision=0;private disposed=false;private running:boolean|undefined;
 private capture:Promise<boolean>|undefined;private finishAt=0;private summary:ReviewSummary|null=null;
 private host:HTMLElement|undefined;private shadow:ShadowRoot|undefined;private loaded=false;private expanded=false;
 private readonly diffs=new Map<string,ReviewDiff>();private readers:LargeTextReader[]=[];private lastCleanup=0;
 constructor(private readonly ports:ChangeReviewPorts){}
 start():void {this.disposed=false;if(!this.timer)this.tick();}
 dispose():void {this.disposed=true;clearTimeout(this.timer);this.timer=undefined;this.revision++;this.key='';this.capture=undefined;this.remove();}
 private currentKey():string {const context=this.ports.context;return this.ports.enabled&&context?context.threadId+'\0'+context.rootPath:'';}
 private remove():void {for(const reader of this.readers)reader.dispose();this.readers=[];this.host?.remove();this.host=undefined;this.shadow=undefined;}
 private tick=():void=>{
  this.timer=undefined;if(this.disposed)return;
  const context=this.ports.context,bridge=this.ports.bridge;
  const enabled=this.ports.enabled&&context&&bridge?.available;
  if(enabled){
   const key=context.threadId+'\0'+context.rootPath;
   if(key!==this.key){this.key=key;this.revision++;this.summary=null;this.diffs.clear();this.loaded=false;this.running=undefined;this.capture=undefined;this.finishAt=0;this.expanded=false;this.remove();}
   const anchor=[...this.ports.element.ownerDocument.querySelectorAll<HTMLElement>('[data-above-composer-conversation-id]')].find(e=>e.getAttribute('data-above-composer-conversation-id')===context.threadId&&!e.closest('[data-app-shell-active-page="false"]'));
   if(anchor){
    const composer=anchor.closest('[data-codex-composer-root]');
    const running=!!composer?.querySelector('button[aria-label="Stop"]');
    const revision=this.revision;
    if(!this.loaded){this.loaded=true;this.lastCleanup=Date.now();void this.readLatest(bridge,revision);}
    if(running&&this.running!==true){
     const late=this.running===undefined;this.finishAt=0;this.capture=bridge.request('explorer.changes.capture',{action:'begin',startedLate:late},30_000).then(()=>true,()=>false);
    }else if(!running&&this.running===true){this.finishAt=Date.now()+1200;}
    this.running=running;
    if(!running&&this.finishAt&&Date.now()>=this.finishAt){this.finishAt=0;void this.finish(bridge,revision);}
    if(!running&&Date.now()-this.lastCleanup>60_000){this.lastCleanup=Date.now();if(this.loaded)void this.readLatest(bridge,revision);}
    if(this.summary&&(this.summary.files.length||!this.summary.complete))this.mount(anchor);
   }
  }else if(this.host){this.remove();}
  this.timer=setTimeout(this.tick,400);
 };
 private async readLatest(bridge:WorkspaceBridge,revision:number):Promise<void>{
  try{const summary=normalizeReview(await bridge.request('explorer.changes.capture',{action:'latest'},30_000));if(revision!==this.revision||this.disposed)return;if(summary?.id!==this.summary?.id){this.summary=summary;this.diffs.clear();this.remove();}}catch{/* Older native readers cannot provide change reviews. */}
 }
 private async finish(bridge:WorkspaceBridge,revision:number):Promise<void>{
  const capture=this.capture;if(!capture)return;this.capture=undefined;
  try{if(!await capture)return;if(revision!==this.revision||this.disposed||this.key!==this.currentKey())return;const summary=normalizeReview(await bridge.request('explorer.changes.capture',{action:'finish'},30_000));if(revision!==this.revision||this.disposed)return;if(summary){this.summary=summary;this.diffs.clear();this.expanded=false;this.remove();}}catch{/* Keep the previous completed review on an interrupted capture. */}
 }
 private mount(anchor:HTMLElement):void {
  if(!this.host){this.host=anchor.ownerDocument.createElement('section');this.host.dataset.codeCodexChangeReview='true';this.host.setAttribute('aria-label','Response file changes');this.shadow=this.host.attachShadow({mode:'open'});this.render();}
  if(this.host.parentElement!==anchor)anchor.append(this.host);
 }
 private render():void {
  const shadow=this.shadow,summary=this.summary;if(!shadow||!summary)return;
  for(const reader of this.readers)reader.dispose();this.readers=[];
  shadow.innerHTML=`<style>${largeTextStyles}
   :host{display:block;margin:8px 0;color:inherit;font:12px/1.4 system-ui,sans-serif}section{border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:9px;overflow:hidden;background:transparent}header{display:flex;align-items:center;gap:8px;padding:8px 10px}button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;text-align:left}button:focus-visible{outline:2px solid currentColor;outline-offset:2px}.toggle{flex:1}.files{max-height:min(45vh,420px);overflow:auto;padding:0 10px 10px}.file{border-top:1px solid color-mix(in srgb,currentColor 15%,transparent);padding-top:6px;margin-top:6px}.file-name{overflow-wrap:anywhere;font-weight:600;width:100%;padding:4px 0}.kind,.note{opacity:.65;font-size:11px}.diff{height:170px;min-height:0;margin-top:5px;overflow:hidden}.diff .large-text-reader{height:170px}.diff .large-text-tools{display:none}.diff .large-text-viewport{font-size:11px}.diff .large-text-row{color:inherit}.diff .large-text-row[data-change=add]{color:#268b45}.diff .large-text-row[data-change=remove]{color:#cf4a4a}.clear{font-size:11px;opacity:.7}
  </style><section><header><button class="toggle" type="button" aria-expanded="${this.expanded}"></button><button class="clear" type="button" title="Delete stored review copies for this project; source files are untouched">Clear history</button></header><div class="files" ${this.expanded?'':'hidden'}></div></section>`;
  const toggle=shadow.querySelector<HTMLButtonElement>('.toggle')!;
  toggle.title=new Date(summary.createdMs).toLocaleString();
  toggle.textContent=`${this.expanded?'▾':'▸'} Latest recorded changes · ${summary.files.length} file${summary.files.length===1?'':'s'}`;
  toggle.addEventListener('click',()=>{this.expanded=!this.expanded;this.render();});
  shadow.querySelector('.clear')!.addEventListener('click',()=>{const bridge=this.ports.bridge;if(!bridge||this.key!==this.currentKey())return;const revision=this.revision;void bridge.request('explorer.changes.capture',{action:'clear'}).then(()=>{if(revision===this.revision){this.summary=null;this.diffs.clear();this.remove();}}).catch(()=>{const button=this.shadow?.querySelector('.clear');if(button)button.textContent='Could not clear history';});});
  if(!this.expanded)return;
  const files=shadow.querySelector('.files')!;
  const note=anchorText(shadow.ownerDocument,'note','Workspace changes observed during this response. Private/generated/ignored files excluded. History: 7 days, 10 responses/project, 200 MB total.');files.append(note);
  if(!summary.complete)files.append(anchorText(shadow.ownerDocument,'note','Incomplete coverage: tracking started late, a scan limit was reached, or some paths could not be read.'));
  let queue=Promise.resolve();
  for(const file of summary.files){
   const entry=shadow.ownerDocument.createElement('div');entry.className='file';
   const name=shadow.ownerDocument.createElement('button');name.type='button';name.className='file-name';name.textContent=file.relativePath;
   const status=anchorText(shadow.ownerDocument,'kind',file.kind);entry.append(name,status);files.append(entry);
   if(!file.textAvailable){name.disabled=true;status.textContent+=' · Text diff unavailable (binary, oversized, or snapshot budget)';continue;}
   const area=shadow.ownerDocument.createElement('div');area.className='diff';area.textContent='Loading before/after diff…';entry.append(area);
   const revision=this.revision;const id=summary.id;const key=this.key;
   const current=()=>this.revision===revision&&this.summary?.id===id&&this.currentKey()===key;
   const load=async():Promise<ReviewDiff>=>{
    if(!current())throw Error('Review context changed');
    const cached=this.diffs.get(file.relativePath);if(cached)return cached;
    const bridge=this.ports.bridge;if(!bridge)throw Error('Disconnected');
    const read=async(side:'before'|'after',size:number):Promise<string>=>{
     if(size>10*1024*1024)throw Error('Snapshot too large');const bytes=new Uint8Array(size);let offset=0;
     while(offset<size){if(!current())throw Error('Review changed');const length=Math.min(2*1024*1024,size-offset);
      const raw=await bridge.request('explorer.changes.chunk',{recordId:id,relativePath:file.relativePath,side,offset,length},30_000);
      const chunk=normalizeMediaChunk(raw,offset,length,size);bytes.set(chunk.bytes,offset);offset+=length;}
     return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    };
    const before=await read('before',file.beforeBytes),after=await read('after',file.afterBytes);
    const diff=createReviewDiff(file.relativePath,before,after);if(current())this.diffs.set(file.relativePath,diff);return diff;
   };
   name.addEventListener('click',()=>{name.disabled=true;void load().then(diff=>{if(current())this.ports.openDiff(id,file.relativePath,diff.content);}).catch(()=>{status.textContent='Review expired or unavailable';}).finally(()=>name.disabled=false);});
   queue=queue.then(async()=>{if(!entry.isConnected)return;try{const diff=await load();if(!entry.isConnected||this.revision!==revision)return;status.textContent=`${file.kind} · +${diff.added} −${diff.removed}`;const reader=new LargeTextReader(shadow.ownerDocument,diff.content,true);this.readers.push(reader);area.replaceChildren(reader.element);}catch{area.textContent='Review expired or unavailable. Reopen the file for its current contents.';}});
  }
 }
}
function anchorText(document:Document,className:string,text:string):HTMLElement {const element=document.createElement('div');element.className=className;element.textContent=text;return element;}
