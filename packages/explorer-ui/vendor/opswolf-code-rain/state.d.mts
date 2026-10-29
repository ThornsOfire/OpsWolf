// Cursadex-authored type boundary for the separately pinned JavaScript source.
export interface RainSettings {
  speed:number; density:number; fontSize:number; trail:number; glow:number;
  brightness:number; opacity:number; rainColor:string; headColor:string;
  glowColor:string; backgroundColor:string; glyphs:string;
}
export const DEFAULT_RAIN:Readonly<RainSettings>;
export function rainSettings(value?:unknown):RainSettings;
export const LIMITS:Readonly<Record<'speed'|'density'|'fontSize'|'trail'|'glow'|'brightness'|'opacity',readonly [number,number]>>;
export const COLORS:readonly ('rainColor'|'headColor'|'glowColor'|'backgroundColor')[];
export const PRESETS:readonly {name:string;rain:RainSettings;ui:{surface:string;text:string;accent:string}}[];
