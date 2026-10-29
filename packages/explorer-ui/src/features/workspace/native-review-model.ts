import {asRecord} from '../../core/bridge/response-validation';
export interface NativeReviewFile {relativePath:string;kind:string;content:string|null;}
export interface NativeReview {id:string;completedMs:number|null;status:string;messageIds:string[];omitted:number;files:NativeReviewFile[];}
interface NativePage {review:NativeReview|null;nextCursor:string|null;turnId:string|null;}
const identifier=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function normalizeNativePage(raw:unknown):NativePage {
 const page=asRecord(raw);if(!page||!(page.nextCursor===null||typeof page.nextCursor==='string'&&page.nextCursor.length<=4096)||!(page.turnId===null||identifier(page.turnId)))throw Error('Invalid native review page');
 if(page.review===null)return page as unknown as NativePage;
 const r=asRecord(page.review);
 if(!r||!identifier(r.id)||r.id!==page.turnId||!['completed','interrupted','failed','inProgress'].includes(String(r.status))||!(r.completedMs===null||Number.isSafeInteger(r.completedMs))||!Number.isSafeInteger(r.omitted)||Number(r.omitted)<0||!Array.isArray(r.messageIds)||r.messageIds.length>128||!r.messageIds.every(identifier)||!Array.isArray(r.files)||r.files.length>128)throw Error('Invalid native review');
 let bytes=0;
 for(const item of r.files){const file=asRecord(item);if(!file||typeof file.relativePath!=='string'||!file.relativePath||file.relativePath.length>4096||/[\0\r\n:\\]/.test(file.relativePath)||file.relativePath.startsWith('/')||file.relativePath.split('/').some(p=>!p||p==='.'||p==='..')||!['add','delete','update','renamed','multiple patches'].includes(String(file.kind))||!(file.content===null||typeof file.content==='string'))throw Error('Invalid native changed file');if(typeof file.content==='string')bytes+=new TextEncoder().encode(file.content).length;}
 if(bytes>1024*1024)throw Error('Native diff budget exceeded');
 return page as unknown as NativePage;
}
