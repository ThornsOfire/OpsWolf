// Rows are bounded in both dimensions; browser layout limits never hide the tail.
const ROW_UNITS=2048;
const ROW_HEIGHT=20;
const MAX_SCROLL_HEIGHT=8_000_000;

export function indexTextRows(text: string,rowUnits=ROW_UNITS): Uint32Array {
  // Two scans avoid a boxed array with millions of entries for newline-heavy files.
  const scan=(emit:(offset:number)=>void):void=>{
    emit(0);
    let start=0,columns=0;
    for(let i=0;i<text.length;i+=1) {
      const ch=text.charCodeAt(i);
      if(ch===13||ch===10) {
        if(ch===13&&text.charCodeAt(i+1)===10) i+=1;
        start=i+1;columns=0;emit(start);
      } else {
        const pair=ch>=0xd800&&ch<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff;
        const wide=pair||(ch>=0x2e80&&ch<=0xa4cf)||(ch>=0xac00&&ch<=0xd7af)||(ch>=0xff01&&ch<=0xff60);
        let width=ch===9?4-columns%4:wide?2:1;
        if(columns+width>rowUnits&&i>start){start=i;columns=0;emit(start);width=ch===9?4:wide?2:1;}
        if(pair)i+=1;
        columns+=width;
      }
    }
  };
  let count=0; scan(()=>{count+=1;});
  const rows=new Uint32Array(count);
  let index=0; scan(offset=>{rows[index++]=offset;});
  return rows;
}

export class LargeTextReader {
  readonly element: HTMLElement;
  readonly viewport: HTMLElement;
  private rows: Uint32Array;
  private wrapped=false;
  private columns=ROW_UNITS;
  private readonly spacer: HTMLElement;
  private readonly visible: HTMLElement;
  private readonly status: HTMLElement;
  private readonly resize: ResizeObserver;
  private frame=0;
  private disposed=false;
  constructor(private readonly document: Document,private readonly text:string,private readonly diff=false) {
    this.rows=indexTextRows(text);
    const root=document.createElement('div');root.className='large-text-reader';this.element=root;
    const tools=document.createElement('div');tools.className='large-text-tools';
    const button=(label:string,action:()=>void):void=>{
      const item=document.createElement('button');item.type='button';item.textContent=label;
      item.addEventListener('click',action);tools.append(item);
    };
    button('Top',()=>this.jump(false));button('End',()=>this.jump(true));
    button('Copy all',()=>{
      void document.defaultView?.navigator.clipboard.writeText(text).then(()=>{this.status.textContent='Complete file copied';},()=>{this.status.textContent='Clipboard unavailable';});
    });
    this.status=document.createElement('span');this.status.setAttribute('role','status');tools.append(this.status);
    const viewport=document.createElement('div');viewport.className='large-text-viewport';viewport.tabIndex=0;
    viewport.setAttribute('aria-label','Read-only complete text; long lines continue on the next row. Use Top and End to navigate.');
    this.viewport=viewport;
    this.spacer=document.createElement('div');this.spacer.className='large-text-spacer';
    this.visible=document.createElement('div');this.visible.className='large-text-visible';
    viewport.append(this.spacer,this.visible);root.append(tools,viewport);
    viewport.addEventListener('scroll',()=>this.schedule());
    viewport.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.shiftKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY)) return;
      event.preventDefault();
      this.move(event.deltaY*(event.deltaMode===1?ROW_HEIGHT:event.deltaMode===2?viewport.clientHeight:1));
    },{passive:false});
    viewport.addEventListener('keydown',event=>{
      const delta=event.key==='ArrowDown'?ROW_HEIGHT:event.key==='ArrowUp'?-ROW_HEIGHT:
        event.key==='PageDown'?viewport.clientHeight:event.key==='PageUp'?-viewport.clientHeight:0;
      if(delta){event.preventDefault();this.move(delta);}

      if(event.key==='End'&&(event.ctrlKey||event.metaKey)){event.preventDefault();this.jump(true);}
      if(event.key==='Home'&&(event.ctrlKey||event.metaKey)){event.preventDefault();this.jump(false);}
    });
    this.resize=new ResizeObserver(()=>{this.reflow();this.schedule();});this.resize.observe(viewport);
    this.schedule();
  }
  setWordWrap(enabled:boolean):void {
    this.wrapped=enabled;this.reflow();
  }
  private reflow():void {
    const canvas=this.document.createElement('canvas');
    const context=canvas.getContext('2d');
    if(context)context.font=this.document.defaultView!.getComputedStyle(this.viewport).font;
    const width=context?.measureText('M').width||8;
    const columns=this.wrapped?Math.max(8,Math.floor((this.viewport.clientWidth-16)/width)-2):ROW_UNITS;
    if(columns===this.columns)return;
    const fraction=this.viewport.scrollTop/Math.max(1,this.viewport.scrollHeight-this.viewport.clientHeight);
    this.columns=columns;this.rows=indexTextRows(this.text,columns);
    this.spacer.style.height=`${Math.max(this.viewport.clientHeight,Math.min(MAX_SCROLL_HEIGHT,this.rows.length*ROW_HEIGHT))}px`;
    this.viewport.scrollTop=fraction*Math.max(0,this.viewport.scrollHeight-this.viewport.clientHeight);
    this.schedule();
  }
  dispose():void {
    this.disposed=true;this.resize.disconnect();
    this.document.defaultView?.cancelAnimationFrame(this.frame);
  }
  private schedule():void {
    if(this.disposed||this.frame) return;
    this.frame=this.document.defaultView!.requestAnimationFrame(()=>{this.frame=0;this.render();});
  }
  private move(delta:number):void {
    const height=this.viewport.clientHeight;
    const logicalTravel=Math.max(0,this.rows.length*ROW_HEIGHT-height);
    const physicalTravel=Math.max(0,Math.min(MAX_SCROLL_HEIGHT,this.rows.length*ROW_HEIGHT)-height);
    this.viewport.scrollTop+=logicalTravel?delta*physicalTravel/logicalTravel:0;
    this.render();
  }
  private jump(end:boolean):void {
    this.viewport.scrollTop=end?this.viewport.scrollHeight:0;this.render();
  }
  private render():void {
    if(this.disposed)return;
    const height=this.viewport.clientHeight||400;
    const total=this.rows.length*ROW_HEIGHT;
    const physical=Math.max(height,Math.min(MAX_SCROLL_HEIGHT,total));
    this.spacer.style.height=`${physical}px`;
    const travel=Math.max(0,physical-height);
    const logical=travel?Math.min(1,this.viewport.scrollTop/travel)*Math.max(0,total-height):0;
    const first=Math.max(0,Math.floor(logical/ROW_HEIGHT)-8);
    const end=Math.min(this.rows.length,Math.ceil((logical+height)/ROW_HEIGHT)+8);
    this.visible.style.top=`${this.viewport.scrollTop+first*ROW_HEIGHT-logical}px`;
    const fragment=this.document.createDocumentFragment();
    for(let index=first;index<end;index+=1){
      const row=this.document.createElement('div');row.className='large-text-row';
      row.dataset.offset=String(this.rows[index]);
      const slice=this.text.slice(this.rows[index],this.rows[index+1]??this.text.length).replace(/[\r\n]+$/,'');
      if(this.diff){if(slice.startsWith('+'))row.dataset.change='add';else if(slice.startsWith('-'))row.dataset.change='remove';}
      row.textContent=slice||' ';fragment.append(row);
    }
    this.visible.replaceChildren(fragment);
    this.status.textContent=`${(this.rows[first]??0).toLocaleString()} / ${this.text.length.toLocaleString()} characters · long lines continue`;
  }
}

export const largeTextStyles=`
.preview-content.large-text-content { display:flex; padding:0; overflow:hidden; min-height:0; }
.large-text-reader { display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; height:100%; }
.large-text-tools { display:flex; flex:none; align-items:center; gap:8px; padding:4px 8px; font-size:11px; }
.large-text-tools button { color:inherit; background:transparent; border:1px solid currentColor; border-radius:4px; cursor:pointer; padding:2px 6px; }
.large-text-tools span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:.7; }
.large-text-viewport { flex:1; min-height:0; position:relative; overflow:auto; overflow-anchor:none; font:12px/20px ui-monospace,Consolas,monospace; tab-size:4; }
.large-text-spacer { width:1px; pointer-events:none; }
.large-text-visible { position:absolute; left:8px; min-width:calc(100% - 16px); }
.large-text-row[data-change="add"] { color:#268b45; }
.large-text-row[data-change="remove"] { color:#cf4a4a; }
.large-text-row { height:20px; white-space:pre; width:max-content; min-width:100%; }
`;
