import {PRESETS,rainSettings,type RainSettings} from './model';

export interface RainPreset {name:string;rain:RainSettings}
export interface RainBlendPreferences {
  from:RainPreset;to:RainPreset;duration:number;hold:number;loop:boolean;enabled:boolean;
}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function presetName(value:unknown):string {
  return typeof value==='string'?value.trim().replace(/[\p{C}]/gu,'').slice(0,32):'';
}
export function personalPresets(value:unknown):RainPreset[] {
  if(!Array.isArray(value))return [];
  const names=new Set(PRESETS.map(p=>p.name.toLowerCase()));
  const result:RainPreset[]=[];
  for(const item of value.slice(0,8)){
    if(!record(item))continue;
    const name=presetName(item.name);
    if(!name||names.has(name.toLowerCase()))continue;
    names.add(name.toLowerCase());result.push({name,rain:rainSettings(item.rain)});
  }
  return result;
}
function endpoint(value:unknown,fallback:RainPreset):RainPreset {
  return record(value)&&record(value.rain)?{name:presetName(value.name)||'Custom snapshot',rain:rainSettings(value.rain)}:{name:fallback.name,rain:rainSettings(fallback.rain)};
}
export function blendPreferences(value?:unknown):RainBlendPreferences {
  const v=record(value)?value:{};
  return {from:endpoint(v.from,PRESETS[0]!),to:endpoint(v.to,PRESETS[1]!),
    duration:typeof v.duration==='number'&&Number.isFinite(v.duration)?Math.max(.5,Math.min(60,v.duration)):8,
    hold:typeof v.hold==='number'&&Number.isFinite(v.hold)?Math.max(0,Math.min(120,v.hold)):3,
    loop:v.loop===true,enabled:v.enabled===true&&record(v.from)&&record(v.from.rain)&&record(v.to)&&record(v.to.rain)};
}
