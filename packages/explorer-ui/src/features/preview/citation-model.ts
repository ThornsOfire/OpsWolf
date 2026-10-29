import type {FileCitation,ResolvedCitation} from '../../contracts/citations';
export type {FileCitation,ResolvedCitation} from '../../contracts/citations';
export const MAX_CITATION_RANGES=32;
export const MAX_CITATION_LINK=64_000;
export function lineStarts(text:string):Uint32Array {
  // Keep the 10 MiB newline-heavy case bounded without millions of boxed values.
  let count=1;for(let i=0;i<text.length;i++){if(text[i]==='\r'){if(text[i+1]==='\n')i++;count++;}else if(text[i]==='\n')count++;}
  const starts=new Uint32Array(count);let index=1;
  for(let i=0;i<text.length;i++){if(text[i]==='\r'){if(text[i+1]==='\n')i++;starts[index++]=i+1;}else if(text[i]==='\n')starts[index++]=i+1;}return starts;
}
function lineAt(starts:Uint32Array,offset:number):number {let low=0,high=starts.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(starts[mid]!<=offset)low=mid;else high=mid-1;}return low;}
export function citationFromSelection(path:string,text:string,start:number,end:number,draft=false):FileCitation|null {
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>text.length)return null;
  const starts=lineStarts(text),first=lineAt(starts,start),last=lineAt(starts,end-1);
  const quote=text.slice(starts[first],starts[last+1]??text.length).replace(/\r\n?/g,'\n');
  return {path,startLine:first+1,endLine:last+1,...(quote.length<=4096?{quote}:{}),...(draft?{draft:true}:{})};
}
export function resolveCitation(text:string,citation:FileCitation):ResolvedCitation|null {
  return resolveCitations(text,[citation])[0]??null;
}
export function resolveCitations(text:string,citations:readonly FileCitation[]):(ResolvedCitation|null)[] {
  const normalized=text.replace(/\r\n?/g,'\n'),starts=lineStarts(text),normalStarts=normalized===text?starts:lineStarts(normalized);
  return citations.map(citation=>{
  let first=citation.startLine-1,last=citation.endLine-1,status:ResolvedCitation['status']='line-only';
  if(citation.quote!==undefined){
    const expected=normalized.slice(normalStarts[first],normalStarts[last+1]??normalized.length);
    if(expected===citation.quote&&first<starts.length)status='exact';
    else {
      const at=normalized.indexOf(citation.quote);
      if(!citation.quote||at<0||normalized.indexOf(citation.quote,at+1)>=0||at>0&&normalized[at-1]!=='\n')return null;
      first=lineAt(normalStarts,at);
      last=first+citation.endLine-citation.startLine;status='relocated';
      if(normalized.slice(normalStarts[first],normalStarts[last+1]??normalized.length)!==citation.quote)return null;
    }
  }
  if(first<0||last>=starts.length||last<first)return null;
  return {start:starts[first]!,end:starts[last+1]??text.length,startLine:first+1,endLine:last+1,status};
  });
}
function normalizedAbsolute(path:string):string|null {
  if(path.length>4096||/[\0\r\n]/.test(path))return null;
  let value=path.replaceAll('\\','/');if(/^\/[a-z]:\//i.test(value))value=value.slice(1);
  if(!/^(?:[a-z]:\/|\/(?!\/))/i.test(value)||value.split('/').some(p=>p==='..'||p==='.')||/[<>"|?*]/.test(value))return null;
  return value==='/'||/^[a-z]:\/$/i.test(value)?value:value.replace(/\/+$/,'');
}
export function citationRelativePath(path:string,root:string):string|null {
  const absolute=normalizedAbsolute(path),base=normalizedAbsolute(root);if(!absolute||!base)return null;
  const windows=/^[a-z]:/i.test(base),a=windows?absolute.toLowerCase():absolute,b=windows?base.toLowerCase():base;
  const prefix=b.endsWith('/')?b:b+'/';
  return a.startsWith(prefix)?absolute.slice(prefix.length):null;
}
export function validCitation(value:unknown):value is FileCitation {
  if(!value||typeof value!=='object')return false;const c=value as FileCitation;
  return typeof c.path==='string'&&c.path.length>0&&c.path.length<=4096&&!/[\0\r\n]/.test(c.path)&&Number.isSafeInteger(c.startLine)&&Number.isSafeInteger(c.endLine)&&c.startLine>0&&c.endLine>=c.startLine&&c.endLine<=10*1024*1024+1&&(c.quote===undefined||typeof c.quote==='string'&&c.quote.length>0&&c.quote.length<=4096)&&(c.draft===undefined||typeof c.draft==='boolean');
}
export function citationUrl(ranges:readonly FileCitation[]):string {
  if(!ranges.length||ranges.length>MAX_CITATION_RANGES||!ranges.every(validCitation))throw Error('Invalid citation group');
  const url='codex://code-codex/cite?data='+encodeURIComponent(JSON.stringify({v:1,ranges}));
  if(url.length>MAX_CITATION_LINK)throw Error('This citation group is too large. Split it into smaller groups.');
  return url;
}
export function citationMarkdown(ranges:readonly FileCitation[]):string {
  const label=(c:FileCitation)=>`${c.path.replaceAll('\\','/')}:${c.startLine}${c.endLine===c.startLine?'':'–'+c.endLine}${c.draft?' (unsaved draft)':''}`.replace(/[\[\]<>\r\n`]/g,'');
  const individual=ranges.map(c=>`[${label(c)}](${citationUrl([c])})`).join('\n');
  return ranges.length>1?`[Open citation group (${ranges.length} ranges)](${citationUrl(ranges)})\n${individual}`:individual;
}
/** Null means unrelated; [] means a citation was recognized but is invalid/outside this project. */
export function parseCitationLink(raw:string,root:string):FileCitation[]|null {
  if(raw.length>MAX_CITATION_LINK)return raw.startsWith('codex://code-codex/cite')?[]:null;
  if(raw.startsWith('codex://code-codex/cite')){
    try{const url=new URL(raw);if(url.hostname!=='code-codex'||url.pathname!=='/cite'||url.username||url.password||url.port)return null;const data=JSON.parse(url.searchParams.get('data')??'');
      if(!data||data.v!==1||!Array.isArray(data.ranges)||!data.ranges.length||data.ranges.length>MAX_CITATION_RANGES||!data.ranges.every(validCitation))return [];
      return data.ranges.every((c:FileCitation)=>citationRelativePath(c.path,root)!==null)?data.ranges:[];
    }catch{return [];}
  }
  let value=raw;try{value=decodeURIComponent(value);}catch{return null;}
  if(value.startsWith('file:///'))value=value.slice(7);
  const match=value.match(/^(.*?)(?:#L(\d+)(?:-L?(\d+))?|:(\d+)(?:-(\d+))?(?::\d+)?)$/);
  if(!match)return null;
  const c={path:match[1]!,startLine:Number(match[2]??match[4]),endLine:Number(match[3]??match[5]??match[2]??match[4])};
  if(!normalizedAbsolute(c.path))return null;
  return validCitation(c)&&citationRelativePath(c.path,root)!==null?[c]:[];
}
