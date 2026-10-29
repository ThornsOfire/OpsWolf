import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const categories=new Set(['Added','Changed','Deprecated','Removed','Fixed','Security']);
const versionPattern=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseChangelog(text){
  const errors=[],sections=[];let section,category,fenced=false;
  const lines=text.replace(/^\uFEFF/,'').replaceAll('\r\n','\n').split('\n');
  if(lines.find(line=>line.trim())!=='# Changelog')errors.push('Start with # Changelog.');
  for(const [index,line] of lines.entries()){
    if(/^\s*```/.test(line)){fenced=!fenced;continue;}if(fenced)continue;
    if(/^## /.test(line)){
      const match=/^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?$/.exec(line);
      if(!match){errors.push(`Line ${index+1}: use ## [Unreleased] or ## [1.2.3] - YYYY-MM-DD.`);section=undefined;category=undefined;continue;}
      const [,name,date]=match;
      if(sections.some(s=>s.name===name))errors.push(`Duplicate section: ${name}.`);
      if(name==='Unreleased'){if(date)errors.push('Unreleased must not have a release date.');}
      else{
        if(!versionPattern.test(name))errors.push(`Invalid release version: ${name}.`);
        if(!date||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)errors.push(`Release ${name} needs a valid YYYY-MM-DD date.`);
      }
      section={name,date,categories:[]};sections.push(section);category=undefined;continue;
    }
    if(/^### /.test(line)){
      const name=line.slice(4).trim();
      if(!section){errors.push(`Category outside a version section at line ${index+1}.`);continue;}
      if(!categories.has(name))errors.push(`Unknown category: ${name}.`);
      if(section.categories.some(c=>c.name===name))errors.push(`Duplicate ${name} category in ${section.name}.`);
      category={name,entries:[]};section.categories.push(category);continue;
    }
    if(/^-\s/.test(line)&&section){
      if(!category){errors.push(`Entry without a category at line ${index+1}.`);continue;}
      const entry=line.slice(2).trim();
      if(!entry||/^(?:TODO|TBD|placeholder)[.!]?$/i.test(entry))errors.push(`Replace the placeholder entry at line ${index+1}.`);
      category.entries.push(entry);
    }else if(/^\s{2,}\S/.test(line)&&category?.entries.length){category.entries[category.entries.length-1]+=' '+line.trim();}
  }
  if(sections[0]?.name!=='Unreleased'||sections.filter(s=>s.name==='Unreleased').length!==1)errors.push('Keep exactly one Unreleased section, before released versions.');
  for(const s of sections)for(const c of s.categories)if(!c.entries.length)errors.push(`Remove empty ${c.name} category in ${s.name}.`);
  return {errors,sections};
}

export function runtimePath(path){
  return /^(?:crates\/|installer\/|resources\/|releases\/plugins\/|packages\/explorer-ui\/(?:src\/|scripts\/|package(?:-lock)?\.json$)|Cargo\.(?:toml|lock)$|scripts\/(?:build|package|generate-installer|msbuild|assert-storage-contract)[^/]*\.(?:mjs|ps1)$)/.test(path);
}
const notes=text=>JSON.stringify(parseChangelog(text).sections.find(s=>s.name==='Unreleased')?.categories.map(c=>({name:c.name,entries:c.entries.map(e=>e.replace(/\s+/g,' ').trim())}))??[]);

export function assessRange({paths,before,after,message=''}){
  const errors=[...parseChangelog(after).errors],runtimePaths=paths.filter(runtimePath);
  let mode='no-runtime-paths';
  if(runtimePaths.length){
    if(notes(before)!==notes(after))mode='notes-updated';
    else if(/^Changelog: none - (\S[^\r\n]{11,})\s*$/m.test(message))mode='maintenance-exemption';
    else{mode='missing-entry';errors.push('Runtime paths changed: update Unreleased notes, or explain non-user-facing maintenance with Changelog: none - <specific reason> in the final commit.');}
  }
  return {errors,mode,runtimePaths};
}

function git(root,...args){return execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trimEnd();}
export function checkGitRange(root,base,head='HEAD'){
  const baseSha=git(root,'rev-parse','--verify','--end-of-options',base+'^{commit}');
  const headSha=git(root,'rev-parse','--verify','--end-of-options',head+'^{commit}');
  const mergeBase=git(root,'merge-base',baseSha,headSha);
  const read=sha=>git(root,'ls-tree','--name-only',sha,'--','CHANGELOG.md')?git(root,'show',sha+':CHANGELOG.md'):'';
  const paths=git(root,'diff','--name-only','--no-renames','-z',mergeBase,headSha,'--').split('\0').filter(Boolean);
  return assessRange({paths,before:read(mergeBase),after:read(headSha),message:git(root,'log','-1','--format=%B',headSha)});
}

export function eventRange(event){
  if(event.pull_request)return {base:event.pull_request.base.sha,head:event.pull_request.head.sha};
  if(event.before&&event.after&&!/^0+$/.test(event.before)&&!/^0+$/.test(event.after))return {base:event.before,head:event.after};
  return null;
}

function main(){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const options={};
  for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(!['--base','--head','--event'].includes(key)||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('Usage: node scripts/check-changelog.mjs [--base REF [--head REF] | --event EVENT_JSON]');options[key.slice(2)]=process.argv[++i];}
  if(options.event&&(options.base||options.head)||options.head&&!options.base)throw Error('Use an event or a base/head pair.');
  const parsed=parseChangelog(readFileSync(resolve(root,'CHANGELOG.md'),'utf8'));
  let result={errors:parsed.errors,mode:'structure-only',runtimePaths:[]};
  const range=options.event?eventRange(JSON.parse(readFileSync(options.event,'utf8'))):options.base?{base:options.base,head:options.head??'HEAD'}:null;
  if(range){result=checkGitRange(root,range.base,range.head);result.errors=[...new Set([...parsed.errors,...result.errors])];}
  if(result.errors.length){for(const error of result.errors)console.error('Changelog: '+error);process.exitCode=1;}
  else console.log(JSON.stringify({passed:true,mode:result.mode,runtimePaths:result.runtimePaths.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main();}catch(error){console.error('Changelog check failed: '+error.message);process.exitCode=1;}}
