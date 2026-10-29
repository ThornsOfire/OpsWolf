import {citationRelativePath,parseCitationLink} from './citation-model';
import type {FileCitation} from '../../contracts/citations';
export type PreviewLink=
 |{readonly kind:'blocked';readonly destination:string;readonly reason:string}
 |{readonly kind:'heading';readonly destination:string;readonly fragment:string}
 |{readonly kind:'file';readonly destination:string;readonly path:string;readonly fragment:string}
 |{readonly kind:'citation';readonly destination:string;readonly ranges:readonly FileCitation[]}
 |{readonly kind:'website'|'application';readonly destination:string;readonly permission:string;readonly label:string};
const DENIED=new Set(['javascript:','data:','vbscript:','blob:','about:','app:','codex:','codex-sandbox:','command:','cmd:','powershell:','shell:','ms-msdt:']);
export function resolvePreviewLink(href:string,root:string,source:string):PreviewLink {
 const raw=href.trim(),blocked=(reason:string):PreviewLink=>({kind:'blocked',destination:raw,reason});
 if(!raw||raw.length>64_000||/[\u0000-\u0020\u007f]/.test(raw.replaceAll(' ','')))return blocked('Invalid link destination');
 const citation=parseCitationLink(raw,root);
 if(citation!==null)return citation.length?{kind:'citation',destination:raw,ranges:citation}:blocked('Citation is invalid or outside this project');
 if(raw.startsWith('#')){try{return{kind:'heading',destination:raw,fragment:decodeURIComponent(raw.slice(1))};}catch{return blocked('Invalid heading fragment');}}
 const drive=/^[a-z]:[\\/]/i.test(raw);
 const protocol=!drive&&raw.match(/^([a-z][a-z\d+.-]*:)/i)?.[1]?.toLowerCase();
 if(protocol&&protocol!=='file:'||raw.startsWith('//')){
  if(protocol&&DENIED.has(protocol))return blocked('This link type cannot be launched from document preview');
  try{
   const url=new URL(raw.startsWith('//')?'https:'+raw:raw);
   if(url.username||url.password)return blocked('Links with embedded credentials are not supported');
   if(url.protocol==='http:'||url.protocol==='https:')return{kind:'website',destination:url.href,permission:'website:'+url.origin,label:url.origin};
   return{kind:'application',destination:url.href,permission:'application:'+url.protocol,label:url.protocol};
  }catch{return blocked('Invalid external destination');}
 }
 if(!root)return blocked('Project context is unavailable');
 if(raw.startsWith('\\\\'))return blocked('Network file links are not supported');
 try{
  const rootPath=root.replaceAll('\\','/'),normalizedRoot=rootPath.endsWith('/')?rootPath:rootPath+'/',base='file://'+(normalizedRoot.startsWith('/')?'':'/')+normalizedRoot+source.replaceAll('\\','/');
  const destination=drive?'file:///'+raw.replaceAll('\\','/'):raw.replaceAll('\\','/');
  const url=new URL(destination,base);
  if(url.protocol!=='file:'||url.hostname)return blocked('Network file links are not supported');
  const path=decodeURIComponent(url.pathname).replace(/^\/([a-z]:\/)/i,'$1'),relative=citationRelativePath(path,root);
  if(!relative)return blocked('File is outside the current project');
  if(url.search)return blocked('Query parameters are not supported on local file links');
  return{kind:'file',destination:path,path:relative,fragment:decodeURIComponent(url.hash.slice(1))};
 }catch{return blocked('Invalid local file destination');}
}
export const LINK_PERMISSIONS_KEY='code-codex:link-permissions:v1';
export const LINK_PERMISSIONS_CHANGED='cursadex:link-permissions-changed';
/** Explicit choices only; websites are scoped to exact origin, apps to URI scheme. */
export class LinkPermissions {
 constructor(private readonly storage:Storage|undefined){}
 list():string[]{try{const value=JSON.parse(this.storage?.getItem(LINK_PERMISSIONS_KEY)??'null');return value?.v===1&&Array.isArray(value.allow)?[...new Set<string>(value.allow.filter((s:unknown):s is string=>typeof s==='string'&&s.length<2048&&/^(website:https?:\/\/|application:[a-z][a-z\d+.-]*:$)/i.test(s)))].slice(0,100):[];}catch{return[];}}
 has(key:string):boolean{return this.list().includes(key);}
 allow(key:string):void{const values=this.list();if(!values.includes(key))values.push(key);this.storage?.setItem(LINK_PERMISSIONS_KEY,JSON.stringify({v:1,allow:values.slice(-100)}));}
 revoke(key:string):void{this.storage?.setItem(LINK_PERMISSIONS_KEY,JSON.stringify({v:1,allow:this.list().filter(s=>s!==key)}));}
 clear():void{this.storage?.removeItem(LINK_PERMISSIONS_KEY);}
}
export function previewLinkTooltip(link:PreviewLink,allowed=false):string {
 switch(link.kind){
  case 'blocked':return `Unavailable: ${link.reason}\n${link.destination}`;
  case 'heading':return `Jump to heading: ${link.fragment||'top'}\nStays in this document`;
  case 'file':return `Open in editor: ${link.destination}${link.fragment?'\nSection: '+link.fragment:''}\nPreviews the file; does not execute it`;
  case 'citation':return `Open ${link.ranges.length} cited range(s) in the editor\n`+link.ranges.slice(0,5).map(c=>`${c.path}:${c.startLine}–${c.endLine}${c.draft?' (unsaved draft)':''}`).join('\n');
  default:return `${link.kind==='website'?'Open external website':'Open external application — may launch a process'}\n${link.destination}\n${allowed?'Previously allowed; Shift-click to review permission':'Confirmation required'}`;
 }
}
