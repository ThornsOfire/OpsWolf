/** Measures only lines that may wrap; the gutter remains one compact text node. */
export class WrappedLineNumbers {
  private readonly observer:ResizeObserver;
  private frame=0;
  private disposed=false;
  constructor(private readonly source:HTMLElement,private readonly gutter:HTMLElement,private readonly text:()=>string) {
    this.observer=new ResizeObserver(()=>this.update());this.observer.observe(source);this.update();
  }
  update():void {
    if(this.disposed||this.frame)return;
    this.frame=this.source.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=0;this.render();});
  }
  dispose():void {this.disposed=true;this.observer.disconnect();this.source.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);}
  private render():void {
    if(this.disposed||!this.source.isConnected)return;
    const document=this.source.ownerDocument,style=document.defaultView!.getComputedStyle(this.source);
    const width=this.source.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    if(width<=0)return;
    const lineHeight=parseFloat(style.lineHeight),lines=this.text().split(/\r\n|\r|\n/);
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if(context)context.font=style.font;
    const cell=context?.measureText('M').width||8;
    const measure=document.createElement('div');
    measure.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:${width}px;font:${style.font};letter-spacing:${style.letterSpacing};tab-size:${style.tabSize};white-space:pre-wrap;overflow-wrap:anywhere;contain:layout style paint`;
    const candidates:{index:number;node:HTMLElement}[]=[];
    const heights=new Uint32Array(lines.length);heights.fill(1);
    for(let index=0;index<lines.length;index++){
      const line=lines[index]!;
      if(line.length<Math.floor(width/cell/4))continue;
      if(line.length<width/cell&&context&&context.measureText(line.replaceAll('\t','    ')).width<=width)continue;
      const node=document.createElement('div');node.textContent=line||'\u200b';measure.append(node);candidates.push({index,node});
    }
    this.source.parentElement!.append(measure);
    for(const candidate of candidates)heights[candidate.index]=Math.max(1,Math.round(candidate.node.getBoundingClientRect().height/lineHeight));
    measure.remove();
    const numbers:string[]=[];
    for(let index=0;index<lines.length;index++)numbers.push(String(index+1)+'\n'.repeat(heights[index]!-1));
    this.gutter.textContent=numbers.join('\n')+'\u200b';
    this.gutter.dataset.lineCount=String(lines.length);
    this.gutter.dataset.wrapped='true';
    this.gutter.scrollTop=this.source.scrollTop;
  }
}
