import {rainSettings,Transition} from './state.mjs';

export const RENDER_BUDGET = Object.freeze({fps:30,columns:140,glyphs:1200,pixelWidth:2560,pixelHeight:1440,dpr:1.5});
const noise = n => {const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

/** Owns only its canvas and lifecycle. No global styles, network or persisted state. */
export class CodeRain {
  constructor(container,settings,{onTransition=()=>{},onState=()=>{},frameScheduler}={}) {
    this.container=container;this.doc=container.ownerDocument;this.win=this.doc.defaultView;
    if(frameScheduler!==undefined&&(!frameScheduler||typeof frameScheduler.request!=='function'||typeof frameScheduler.cancel!=='function'))throw TypeError('Frame scheduler requires request and cancel functions');
    this.scheduler=frameScheduler??{request:callback=>this.win.requestAnimationFrame(callback),cancel:id=>this.win.cancelAnimationFrame(id)};
    this.settings=rainSettings(settings);this.onTransition=onTransition;this.onState=onState;
    this.canvas=this.doc.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');
    Object.assign(this.canvas.style,{display:'block',width:'100%',height:'100%',pointerEvents:'none'});
    this.ctx=this.canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('Canvas 2D is unavailable');
    container.append(this.canvas);
    this.paused=false;this.offscreen=false;this.disposed=false;this.frame=0;this.previous=0;this.nextDraw=0;this.time=0;
    this.frames=0;this.drawn=0;this.columns=0;this.width=0;this.height=0;this.transition=null;
    this.motion=this.win.matchMedia('(prefers-reduced-motion: reduce)');
    this.contrast=this.win.matchMedia('(forced-colors: active)');this.phases=Array.from({length:RENDER_BUDGET.columns},(_,i)=>noise(i+83));
    this.resizeObserver=new this.win.ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.intersectionObserver=new this.win.IntersectionObserver(entries=>{this.offscreen=!entries[0]?.isIntersecting;this.reconcile();});
    this.intersectionObserver.observe(container);
    this.visibility=()=>this.reconcile();this.motionChange=()=>{this.finishReducedTransition();this.reconcile();};
    this.doc.addEventListener('visibilitychange',this.visibility);this.motion.addEventListener('change',this.motionChange);
    this.contrast.addEventListener('change',this.visibility);
    this.resize();
  }
  get state(){
    return {paused:this.paused,hidden:this.doc.hidden,offscreen:this.offscreen,reducedMotion:this.motion.matches,forcedColors:this.contrast.matches,
      animating:!!this.frame,frames:this.frames,drawnGlyphs:this.drawn,columns:this.columns,
      pixelWidth:this.canvas.width,pixelHeight:this.canvas.height,transition:!!this.transition,disposed:this.disposed};
  }
  notify(){this.onState(this.state);}
  resize(){
    if(this.disposed)return;
    const rect=this.container.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    if(rect.width>0&&rect.height>0){
      const scale=Math.min(this.win.devicePixelRatio||1,RENDER_BUDGET.dpr,RENDER_BUDGET.pixelWidth/rect.width,RENDER_BUDGET.pixelHeight/rect.height);
      this.canvas.width=Math.max(1,Math.round(rect.width*scale));this.canvas.height=Math.max(1,Math.round(rect.height*scale));
      this.ctx.setTransform(this.canvas.width/rect.width,0,0,this.canvas.height/rect.height,0,0);
    }
    this.reconcile();
  }
  canAnimate(){return !this.disposed&&!this.paused&&!this.doc.hidden&&!this.offscreen&&!this.motion.matches&&!this.contrast.matches&&this.width>0&&this.height>0;}
  reconcile(){
    if(this.disposed)return;
    if(!this.canAnimate()){
      this.scheduler.cancel(this.frame);this.frame=0;this.previous=0;this.nextDraw=0;
      if(!this.doc.hidden&&!this.offscreen)this.draw();
    }else if(!this.frame){this.previous=0;this.nextDraw=0;this.frame=this.scheduler.request(time=>this.tick(time));}
    this.notify();
  }
  tick(now){
    this.frame=0;
    // Media state can change before its change event is delivered. Settle the
    // same lifecycle here so the status agrees with the stopped animation.
    if(!this.canAnimate()){this.finishReducedTransition();this.reconcile();return;}
    const interval=1000/RENDER_BUDGET.fps,tolerance=.5;
    if(!this.previous){this.previous=now;this.nextDraw=now+interval;}
    const elapsed=now-this.previous;
    if(now+tolerance>=this.nextDraw){
      // Keep deadlines on their original cadence, but advance motion using
      // actual elapsed time. Skip missed deadlines; never draw catch-up bursts.
      this.nextDraw+=Math.max(1,Math.floor((now-this.nextDraw+tolerance)/interval)+1)*interval;
      const delta=Math.min(elapsed,100);this.previous=now;this.time+=delta/1000;
      if(this.transition){
        const result=this.transition.advance(delta);this.settings=result.rain;
        if(result.done)this.transition=null;
        this.onTransition({...result,rain:{...result.rain}});
      }
      const {cell,trail}=this.layout();const span=this.height+trail*cell;
      for(let column=0;column<this.phases.length;column++)this.phases[column]=(this.phases[column]+delta/1000*this.settings.speed*cell*(0.6+noise(column+2)*0.8)/span)%1;
      this.draw();
    }
    this.frame=this.scheduler.request(time=>this.tick(time));
  }
  layout(){
    const s=this.settings,cell=Math.max(s.fontSize,this.width/RENDER_BUDGET.columns),count=Math.min(RENDER_BUDGET.columns,Math.ceil(this.width/cell));
    const active=[];for(let column=0;column<count;column++)if(noise(column+29)<s.density)active.push(column);
    const trail=Math.min(Math.round(s.trail),Math.max(1,Math.floor(RENDER_BUDGET.glyphs/Math.max(1,active.length))));
    return {cell,active,trail};
  }
  draw(){
    if(this.disposed||this.doc.hidden||this.offscreen||this.contrast.matches||this.width<=0||this.height<=0)return;
    const s=this.settings,ctx=this.ctx,width=this.width,height=this.height;
    ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle=s.backgroundColor;ctx.fillRect(0,0,width,height);
    const {cell,active,trail}=this.layout();
    const glyphs=[...s.glyphs];ctx.font=`${s.fontSize}px ui-monospace, Consolas, monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    this.drawn=0;this.columns=active.length;
    for(const column of active){
      const span=height+trail*cell;
      const y=this.phases[column]*span;
      for(let offset=trail-1;offset>=0;offset--){
        const py=y-offset*cell;if(py < -cell||py > height+cell)continue;
        const index=Math.floor(noise(column*97+offset*13+Math.floor(this.time*3))*glyphs.length);
        ctx.globalAlpha=s.opacity*s.brightness*(offset===0?1:0.8*(1-offset/trail));
        ctx.fillStyle=offset===0?s.headColor:s.rainColor;
        ctx.shadowBlur=offset===0?s.glow:0;ctx.shadowColor=s.glowColor;
        ctx.fillText(glyphs[index],(column+0.5)*cell,py);this.drawn++;
      }
    }
    ctx.shadowBlur=0;ctx.globalAlpha=1;this.frames++;
  }
  setSettings(value){if(this.disposed)return;this.transition=null;this.settings=rainSettings(value);this.draw();this.notify();}
  setPaused(value){if(this.disposed)return;this.paused=value===true;this.reconcile();}
  startTransition(target,options){
    if(this.disposed)return;this.transition=new Transition(this.settings,target,options);
    this.finishReducedTransition();this.reconcile();
  }
  finishReducedTransition(){
    if(this.motion.matches&&this.transition){
      this.settings={...this.transition.to};this.transition=null;this.draw();
      this.onTransition({rain:{...this.settings},done:true,phase:'Applied immediately for reduced motion'});
    }
  }
  stopTransition(){this.transition=null;this.notify();return {...this.settings};}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.scheduler.cancel(this.frame);this.frame=0;this.transition=null;
    this.resizeObserver.disconnect();this.intersectionObserver.disconnect();this.doc.removeEventListener('visibilitychange',this.visibility);
    this.motion.removeEventListener('change',this.motionChange);this.contrast.removeEventListener('change',this.visibility);this.canvas.remove();this.notify();
  }
}
