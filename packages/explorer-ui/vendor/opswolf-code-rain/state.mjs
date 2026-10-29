export const LIMITS = Object.freeze({speed:[1,40],density:[0.05,1],fontSize:[10,40],trail:[3,40],glow:[0,20],brightness:[0.1,1],opacity:[0,1]});
export const COLORS = Object.freeze(['rainColor','headColor','glowColor','backgroundColor']);
export const DEFAULT_RAIN = Object.freeze({speed:12,density:0.6,fontSize:18,trail:18,glow:7,brightness:0.8,opacity:0.8,rainColor:'#39d878',headColor:'#ddffe8',glowColor:'#52ff93',backgroundColor:'#07100c',glyphs:'01アイウエオカキクケコサシスセソタチツテト'});
export const DEFAULT_UI = Object.freeze({surface:'#121b20',text:'#e5eef2',accent:'#76e5bd'});
export const PRESETS = Object.freeze([
  {name:'Woodland signal',rain:{...DEFAULT_RAIN},ui:{...DEFAULT_UI}},
  {name:'Arctic relay',rain:{...DEFAULT_RAIN,speed:7,density:0.45,trail:24,rainColor:'#63c9f5',headColor:'#e9fbff',glowColor:'#60a8ff',backgroundColor:'#07111f'},ui:{surface:'#101c2b',text:'#edf6ff',accent:'#87cfff'}},
  {name:'Amber terminal',rain:{...DEFAULT_RAIN,speed:9,glow:3,rainColor:'#efaa42',headColor:'#fff5d6',glowColor:'#ff812e',backgroundColor:'#1a1008',glyphs:'0123456789ABCDEF'},ui:{surface:'#241b13',text:'#fff1dc',accent:'#ffc56b'}},
  {name:'Daylight circuit',rain:{...DEFAULT_RAIN,speed:5,density:0.3,glow:0,opacity:0.65,rainColor:'#166752',headColor:'#053428',glowColor:'#16805c',backgroundColor:'#e8f3ee'},ui:{surface:'#f1f7f4',text:'#14271e',accent:'#186744'}}
]);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const color=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function rainSettings(value){
  const source=record(value)?value:{},out={...DEFAULT_RAIN};
  for(const [key,[min,max]] of Object.entries(LIMITS))if(typeof source[key]==='number'&&Number.isFinite(source[key]))out[key]=clamp(source[key],min,max);
  for(const key of COLORS)if(color(source[key]))out[key]=source[key].toLowerCase();
  if(typeof source.glyphs==='string'&&source.glyphs.length<=128&&!/[\s\p{C}]/u.test(source.glyphs)){
    const glyphs=[...new Set([...source.glyphs])];if(glyphs.length&&glyphs.length<=64)out.glyphs=glyphs.join('');
  }
  return out;
}
export function uiSettings(value){
  const source=record(value)?value:{},out={...DEFAULT_UI};
  for(const key of Object.keys(out))if(color(source[key]))out[key]=source[key].toLowerCase();return out;
}
const channel=(hex,i)=>parseInt(hex.slice(i,i+2),16);
export function mixColor(a,b,t){return '#'+[1,3,5].map(i=>Math.round(channel(a,i)+(channel(b,i)-channel(a,i))*t).toString(16).padStart(2,'0')).join('');}
export function blendRain(from,to,progress){
  const a=rainSettings(from),b=rainSettings(to),t=clamp(Number.isFinite(progress)?progress:0,0,1),out={};
  for(const key of Object.keys(LIMITS))out[key]=a[key]+(b[key]-a[key])*t;
  for(const key of COLORS)out[key]=mixColor(a[key],b[key],t);
  out.glyphs=t<0.5?a.glyphs:b.glyphs;return out;
}
/** Time advances only when the renderer is actively animating; no wall-clock catch-up. */
export class Transition {
  constructor(from,to,{duration=8,hold=3,loop=false}={}){
    this.from=rainSettings(from);this.to=rainSettings(to);this.duration=clamp(Number.isFinite(duration)?duration:8,0.5,60)*1000;
    this.hold=clamp(Number.isFinite(hold)?hold:3,0,120)*1000;this.loop=loop===true;this.elapsed=0;
  }
  advance(ms){
    const delta=Math.max(0,Number.isFinite(ms)?ms:0),cycle=2*(this.duration+this.hold);
    this.elapsed=this.loop?(this.elapsed+delta%cycle)%cycle:Math.min(this.duration,this.elapsed+Math.min(delta,this.duration));
    if(!this.loop)return {rain:blendRain(this.from,this.to,Math.min(1,this.elapsed/this.duration)),done:this.elapsed>=this.duration,phase:this.elapsed>=this.duration?'Finished':'Transitioning'};
    const t=this.elapsed%(2*(this.duration+this.hold));
    const progress=t<this.duration?t/this.duration:t<this.duration+this.hold?1:t<2*this.duration+this.hold?1-(t-this.duration-this.hold)/this.duration:0;
    return {rain:blendRain(this.from,this.to,progress),done:false,phase:t<this.duration?'Forward':t<this.duration+this.hold?'Holding target':t<2*this.duration+this.hold?'Returning':'Holding start'};
  }
}
export const STORAGE_KEY='opswolf:code-rain:v1';
export function loadSettings(storage){
  const base={rain:rainSettings(),ui:uiSettings(),presets:[],status:'No saved settings'};
  try{
    const raw=storage?.getItem(STORAGE_KEY);if(!raw)return base;if(raw.length>32768)return {...base,status:'Saved settings too large; defaults loaded'};
    const parsed=JSON.parse(raw);if(!record(parsed)||parsed.version!==1)return {...base,status:'Unsupported saved settings; defaults loaded'};
    const presets=Array.isArray(parsed.presets)?parsed.presets.slice(0,8).filter(p=>record(p)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=32).map(p=>({name:p.name.trim(),rain:rainSettings(p.rain),ui:uiSettings(p.ui)})):[];
    return {rain:rainSettings(parsed.rain),ui:uiSettings(parsed.ui),presets,status:'Saved settings loaded'};
  }catch{return {...base,status:'Settings unavailable; using session defaults'};}
}
export function saveSettings(storage,{rain,ui,presets=[]}){
  try{if(!storage)return false;const payload={version:1,rain:rainSettings(rain),ui:uiSettings(ui),presets:presets.slice(0,8).map(p=>({name:String(p.name).trim().slice(0,32),rain:rainSettings(p.rain),ui:uiSettings(p.ui)}))};storage.setItem(STORAGE_KEY,JSON.stringify(payload));return true;}catch{return false;}
}
export function contrast(a,b){
  const luminance=hex=>[1,3,5].map(i=>{const n=channel(hex,i)/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
