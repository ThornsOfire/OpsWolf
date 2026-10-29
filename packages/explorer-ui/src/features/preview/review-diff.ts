export interface ReviewDiff {readonly content:string;readonly added:number;readonly removed:number;}
function countLines(text:string):number {
  if(!text)return 0;let count=0;
  for(let i=0;i<text.length;i++)if(text.charCodeAt(i)===10)count++;
  return count+(text.endsWith('\n')?0:1);
}
function* rows(text:string):Generator<string>{
  let start=0;
  while(start<text.length){let end=text.indexOf('\n',start);if(end<0)end=text.length;yield text.slice(start,end);start=end+1;}
}
/** Exact before/after lines; bounded LCS for small hunks, whole-block fallback for large edits. */
export function createReviewDiff(path:string,before:string,after:string):ReviewDiff {
  if(before===after)return {content:'',added:0,removed:0};
  let prefix=0;while(prefix<before.length&&prefix<after.length&&before[prefix]===after[prefix])prefix++;
  let start=before.lastIndexOf('\n',Math.max(0,prefix-1))+1;
  for(let i=0;i<3&&start>0;i++)start=before.lastIndexOf('\n',start-2)+1;
  let suffix=0;while(suffix<before.length-prefix&&suffix<after.length-prefix&&before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
  const end=(text:string):number=>{let offset=text.length-suffix;for(let i=0;i<4&&offset<text.length;i++){const next=text.indexOf('\n',offset);offset=next<0?text.length:next+1;}return offset;};
  const oldText=before.slice(start,end(before)),newText=after.slice(start,end(after));
  const oldCount=countLines(oldText),newCount=countLines(newText),line=countLines(before.slice(0,start))+1;
  const blocks:string[]=[];let chunk:string[]=[];let added=0,removed=0;
  const emit=(prefix:string,text:string):void=>{chunk.push(prefix+text+'\n');if(prefix==='+')added++;if(prefix==='-')removed++;if(chunk.length>=4096){blocks.push(chunk.join(''));chunk=[];}};
  if(oldCount*newCount<=250_000&&oldCount+newCount<10_000){
    const a=[...rows(oldText)],b=[...rows(newText)],width=b.length+1,table=new Uint32Array((a.length+1)*width);
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i*width+j]=a[i]===b[j]?1+table[(i+1)*width+j+1]!:Math.max(table[(i+1)*width+j]!,table[i*width+j+1]!);
    let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){emit(' ',a[i++]!);j++;}else if(i<a.length&&(j===b.length||table[(i+1)*width+j]!>=table[i*width+j+1]!))emit('-',a[i++]!);else emit('+',b[j++]!);}
  }else{for(const row of rows(oldText))emit('-',row);for(const row of rows(newText))emit('+',row);}
  blocks.push(chunk.join(''));
  let content=`--- a/${path}\n+++ b/${path}\n@@ -${oldCount?line:0},${oldCount} +${newCount?line:0},${newCount} @@\n`+blocks.join('');
  if((before&&!before.endsWith('\n'))||(after&&!after.endsWith('\n')))content+='\\ No newline at end of file (before or after)\n';
  return {content,added,removed};
}
