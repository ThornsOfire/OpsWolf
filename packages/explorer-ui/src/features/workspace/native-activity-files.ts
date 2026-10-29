import {normalizeNativePage,type ChangeReviewPorts,type NativeReview} from './change-review';

/** Adapt only the inspected native live-diff tooltip. Its trigger and layout remain native. */
export class NativeActivityFiles {
 private disposed=true;
 private pending=false;
 private generation=0;
 private readonly replaying=new WeakSet<HTMLButtonElement>();
 constructor(private readonly ports:ChangeReviewPorts,private readonly announce:(text:string)=>void){}
 start():void {if(!this.disposed)return;this.disposed=false;this.generation++;this.ports.element.ownerDocument.addEventListener('click',this.onClick,true);}
 dispose():void {this.disposed=true;this.generation++;this.pending=false;this.ports.element.ownerDocument.removeEventListener('click',this.onClick,true);}
 private key():string {const context=this.ports.context;return !this.disposed&&this.ports.enabled&&context?context.threadId+'\0'+context.rootPath:'';}
 private livePill():HTMLButtonElement|undefined {
  const pills=[...this.ports.element.ownerDocument.querySelectorAll<HTMLButtonElement>('button[data-state="open"]')].filter(button=>
   !button.closest('[data-app-shell-active-page="false"]')&&/^\d+ files? changed$/.test(button.querySelector(':scope > .truncate-text')?.textContent?.trim()??''));
  return pills.length===1?pills[0]:undefined;
 }
 private onClick=(event:MouseEvent):void=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey)return;
  const key=this.key(),bridge=this.ports.bridge;if(!key||!bridge?.available)return;
  const button=event.composedPath().find((node):node is HTMLButtonElement=>node instanceof HTMLButtonElement);
  if(!button||this.replaying.has(button))return;
  const list=button.closest('ul.max-h-72.min-w-64'),tooltip=list?.closest<HTMLElement>('[role="tooltip"]'),pill=this.livePill();
  if(!list||!tooltip||tooltip.hidden||tooltip.getAttribute('aria-hidden')==='true'||!pill||button.parentElement?.tagName!=='LI'||!button.querySelector('[data-thread-find-skip]'))return;
  const described=pill.getAttribute('aria-describedby');
  if(described&&(!tooltip.id||!described.split(/\s+/).includes(tooltip.id)))return;
  const buttons=[...list.querySelectorAll<HTMLButtonElement>(':scope > li > button')];
  const labels=buttons.map(b=>b.firstElementChild?.textContent?.trim()??'');const label=button.firstElementChild?.textContent?.trim()??'';
  const count=Number(pill.querySelector(':scope > .truncate-text')?.textContent?.match(/^\d+/)?.[0]);
  if(!label||labels.length!==count||labels.some(s=>!s))return;
  event.preventDefault();event.stopImmediatePropagation();if(this.pending)return;this.pending=true;
  const generation=this.generation,previousBusy=button.getAttribute('aria-busy');button.setAttribute('aria-busy','true');
  const current=()=>this.generation===generation&&this.key()===key;
  const fallback=()=>{
   if(!current()||!button.isConnected)return;
   this.announce('This live file could not be matched uniquely; opening the original native view.');
   this.replaying.add(button);try{button.click();}finally{this.replaying.delete(button);}
  };
  void(async()=>{
   try{
    let cursor:string|null=null;const seen=new Set<string>();let review:NativeReview|undefined;
    for(let pageIndex=0;pageIndex<6;pageIndex++){
     const page=normalizeNativePage(await bridge.request('explorer.changes.native',{cursor},30_000));if(!current())return;
     if(page.review){review=page.review;break;}
     if(!page.nextCursor||seen.has(page.nextCursor))break;seen.add(page.nextCursor);cursor=page.nextCursor;
    }
    if(!current())return;
    const base=(path:string)=>path.split('/').at(-1)??path;
    const files=review?.files??[];
    // A basename alone is not authority: require the complete native tooltip list
    // to match the freshest patch record, and refuse duplicate-name ambiguity.
    if(!review||review.omitted||files.length!==count||labels.some(name=>files.filter(file=>base(file.relativePath)===name).length!==1)){fallback();return;}
    const file=files.find(file=>base(file.relativePath)===label);
    if(!file||file.content===null){fallback();return;}
    this.ports.openDiff(review.id,file.relativePath,file.content);
   }catch{fallback();}
   finally{if(this.generation===generation)this.pending=false;if(previousBusy===null)button.removeAttribute('aria-busy');else button.setAttribute('aria-busy',previousBusy);}
  })();
 };
}
