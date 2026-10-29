use super::*;
use crate::{EntryKind,ListOptions};
use serde::{Deserialize,Serialize};
use std::collections::{BTreeMap,BTreeSet,VecDeque};
use std::fs;
use std::time::{SystemTime,UNIX_EPOCH};
use std::sync::atomic::{AtomicU64,Ordering};

const SNAPSHOT_BYTES:usize=64*1024*1024;
const RECORD_BYTES:usize=64*1024*1024;
const CONTENT_BYTES:usize=32*1024*1024;
const HISTORY_BYTES:u64=200*1024*1024;
const RETENTION_MS:u64=7*24*60*60*1000;
const MAX_ENTRIES:usize=25_000;
static NEXT_ID:AtomicU64=AtomicU64::new(1);
fn now_ms()->u64 {SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64}
fn io_error(_:std::io::Error)->WorkspaceError {WorkspaceError::Internal}
fn project_key(workspace:&Workspace)->String {content_version(workspace.root_path().to_string_lossy().as_bytes())}
fn thread_key(thread:&str)->String {content_version(thread.as_bytes())}
fn valid_id(id:&str)->bool {id.len()==30&&id.as_bytes()[13]==b'-'&&id[..13].bytes().all(|b|b.is_ascii_digit())&&id[14..].bytes().all(|b|b.is_ascii_hexdigit())}
fn regular(path:&Path)->bool {fs::symlink_metadata(path).is_ok_and(|m| {
 #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if m.file_attributes()&0x400!=0{return false;} }
 m.is_file()&&!m.file_type().is_symlink()
})}
#[derive(Clone)]
struct Entry {fingerprint:String,text:Option<String>,size:u64}
struct Snapshot {entries:BTreeMap<String,Entry>,complete:bool,unavailable:usize}

impl Workspace {
 fn review_entry(&self,path:&str,budget:usize)->Result<Option<Entry>,WorkspaceError> {
  let clean=validate_relative(path)?;
  let name=clean.file_name().and_then(|n|n.to_str()).ok_or(WorkspaceError::InvalidPath)?;
  let policy=preview_policy(name);
  if policy==PreviewPolicy::Unsupported(PreviewUnsupportedReason::Sensitive){return Ok(None);}
  let parent=clean.parent().unwrap_or_else(||Path::new(""));
  let dir=DirectoryCapability::open(self.root_handle(),parent)?;
  let mut file=open_regular_file_nofollow(dir.handle()?,Path::new(name))?;
  let meta=file.metadata().map_err(|e|map_io(&e))?;
  let size=meta.len();
  let stamp=meta.modified().ok().and_then(|m|m.duration_since(UNIX_EPOCH).ok()).map(|d|d.as_nanos()).unwrap_or_default();
  let mut entry=Entry{fingerprint:format!("{size}:{stamp}"),text:None,size};
  if policy==PreviewPolicy::Text&&size<=MAX_TEXT_FILE_BYTES as u64&&size<=budget as u64 {
   let mut bytes=Vec::with_capacity(size as usize);
   Read::by_ref(&mut file).take(MAX_TEXT_FILE_BYTES as u64+1).read_to_end(&mut bytes).map_err(|e|map_io(&e))?;
   let after=file.metadata().map_err(|e|map_io(&e))?;
   if bytes.len() as u64!=size||after.len()!=size||after.modified().ok()!=meta.modified().ok(){return Err(WorkspaceError::Conflict);}
   if !bytes.contains(&0){entry.text=String::from_utf8(bytes).ok();}
  }
  self.ensure_root_valid()?;
  Ok(Some(entry))
 }
 fn review_snapshot(&self)->Result<Snapshot,WorkspaceError> {
  self.ensure_root_valid()?;
  let mut result=Snapshot{entries:BTreeMap::new(),complete:true,unavailable:0};
  let mut queue=VecDeque::from([(String::new(),0usize)]);
  let mut seen=0usize;let mut bytes=0usize;let started=std::time::Instant::now();
  while let Some((path,depth))=queue.pop_front(){
   if started.elapsed()>Duration::from_secs(10){result.complete=false;break;}
   if depth>24 {result.complete=false;continue;}
   let mut cursor=None;
   loop {
    let page=match self.list(ListOptions{relative_path:path.clone(),cursor,limit:500,show_hidden:true,show_ignored:false}) {
     Ok(p)=>p,Err(_)=>{result.complete=false;break;}
    };
    for item in page.entries {
     seen+=1;if seen>MAX_ENTRIES {result.complete=false;self.ensure_root_valid()?;return Ok(result);}
     if item.inaccessible {result.complete=false;continue;}
     if item.kind==EntryKind::Directory {
      let name=item.name.to_ascii_lowercase();
      if !crate::listing::DEFAULT_IGNORED_NAMES.contains(&name.as_str())&&!matches!(name.as_str(),"appdata"|"artifacts"|".opswolf-reviews") {
       queue.push_back((item.relative_path,depth+1));
      }
     }else if item.kind==EntryKind::File {
      match self.review_entry(&item.relative_path,SNAPSHOT_BYTES.saturating_sub(bytes)) {
       Ok(Some(entry))=>{if let Some(text)=&entry.text{bytes+=text.len();}else{result.unavailable+=1;}result.entries.insert(item.relative_path,entry);}
       Ok(None)=>{},Err(_)=>result.complete=false,
      }
     }
    }
    cursor=page.next_cursor;if cursor.is_none(){break;}
   }
  }
  self.ensure_root_valid()?;Ok(result)
 }
}

#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ReviewFile {
 pub relative_path:String,pub kind:String,pub before_bytes:u64,pub after_bytes:u64,pub text_available:bool,
}
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ReviewSummary {
 pub id:String,pub created_ms:u64,pub complete:bool,pub unavailable:usize,pub files:Vec<ReviewFile>,
}
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
struct Change {info:ReviewFile,before:Option<String>,after:Option<String>}
#[derive(Serialize,Deserialize)]
struct Record {summary:ReviewSummary,thread:String,changes:Vec<Change>}
struct Active {project:String,thread:String,snapshot:Snapshot}
pub struct ChangeTracker {directory:PathBuf,active:Option<Active>,cached:Option<(String,String,Record)>}
impl ChangeTracker {
 pub fn new(directory:PathBuf)->Self {Self{directory,active:None,cached:None}}
 fn prepare(&self)->Result<(),WorkspaceError>{
  crate::application_paths::validate_directory_path(&self.directory).map_err(io_error)?;
  fs::create_dir_all(&self.directory).map_err(io_error)?;Ok(())
 }
 fn cleanup(&mut self,now:u64)->Result<(),WorkspaceError>{
  self.prepare()?;
  let mut all=Vec::new();
  for project in fs::read_dir(&self.directory).map_err(io_error)?.flatten(){
   let name=project.file_name().to_string_lossy().into_owned();
   if name.len()!=64||!name.bytes().all(|b|b.is_ascii_hexdigit()){continue;}
   let directory=project.path();
   if crate::application_paths::validate_directory_path(&directory).is_err(){continue;}
   let mut files=Vec::new();
   for file in fs::read_dir(directory).map_err(io_error)?.flatten(){
    let path=file.path();let Some(id)=path.file_stem().and_then(|s|s.to_str())else{continue;};
    if path.extension().and_then(|s|s.to_str())!=Some("json")||!valid_id(id)||!regular(&path){continue;}
    let created=id[..13].parse::<u64>().unwrap_or_default();
    if now.saturating_sub(created)>RETENTION_MS {fs::remove_file(path).map_err(io_error)?;continue;}
    files.push((created,path.clone(),file.metadata().map_err(io_error)?.len()));
   }
   files.sort_by(|a,b|b.0.cmp(&a.0).then_with(||b.1.cmp(&a.1)));
   for (index,file) in files.into_iter().enumerate(){if index>=10{fs::remove_file(&file.1).map_err(io_error)?;}else{all.push(file);}}
  }
  all.sort_by(|a,b|a.0.cmp(&b.0).then_with(||a.1.cmp(&b.1)));
  let mut bytes:u64=all.iter().map(|f|f.2).sum();
  for (_,path,size) in all {if bytes<=HISTORY_BYTES{break;}fs::remove_file(path).map_err(io_error)?;bytes=bytes.saturating_sub(size);}
  self.cached=None;Ok(())
 }
 pub fn begin(&mut self,workspace:&Workspace,thread:&str)->Result<(),WorkspaceError>{
  self.cleanup(now_ms())?;
  let snapshot=workspace.review_snapshot()?;
  self.active=Some(Active{project:project_key(workspace),thread:thread_key(thread),snapshot});Ok(())
 }
 pub fn mark_partial(&mut self){if let Some(active)=&mut self.active{active.snapshot.complete=false;}}
 pub fn finish(&mut self,workspace:&Workspace,thread:&str)->Result<Option<ReviewSummary>,WorkspaceError>{
  let Some(active)=self.active.take() else{return Ok(None);};
  let project=project_key(workspace);let thread=thread_key(thread);
  if active.project!=project||active.thread!=thread{return Err(WorkspaceError::Conflict);}
  let after=workspace.review_snapshot()?;let before=active.snapshot;
  let mut changes=Vec::new();let mut content=0usize;
  let paths:BTreeSet<_>=before.entries.keys().chain(after.entries.keys()).cloned().collect();
  for path in paths {
   let old=before.entries.get(&path);let new=after.entries.get(&path);
   if old.zip(new).is_some_and(|(a,b)|match (&a.text,&b.text){(Some(x),Some(y))=>x==y,_=>a.fingerprint==b.fingerprint}){continue;}
   if old.is_none()&&!before.complete||new.is_none()&&!after.complete{continue;}
   let size=old.and_then(|e|e.text.as_ref()).map_or(0,String::len)+new.and_then(|e|e.text.as_ref()).map_or(0,String::len);
   let available=old.is_none_or(|e|e.text.is_some())&&new.is_none_or(|e|e.text.is_some())&&content+size<=CONTENT_BYTES;
   if available{content+=size;}
   changes.push(Change{info:ReviewFile{relative_path:path,kind:if old.is_none(){"added"}else if new.is_none(){"deleted"}else{"modified"}.into(),before_bytes:old.map_or(0,|e|e.size),after_bytes:new.map_or(0,|e|e.size),text_available:available},before:if available{old.and_then(|e|e.text.clone())}else{None},after:if available{new.and_then(|e|e.text.clone())}else{None}});
  }
  let created=now_ms();let id=format!("{created:013}-{:016x}",NEXT_ID.fetch_add(1,Ordering::Relaxed));
  let summary=ReviewSummary{id,created_ms:created,complete:before.complete&&after.complete,unavailable:changes.iter().filter(|c|!c.info.text_available).count(),files:changes.iter().map(|c|c.info.clone()).collect()};
  let mut record=Record{summary,thread,changes};
  let mut data=serde_json::to_vec(&record).map_err(|_|WorkspaceError::Internal)?;
  if data.len()>RECORD_BYTES {
   for change in &mut record.changes{change.before=None;change.after=None;change.info.text_available=false;}
   record.summary.unavailable=record.changes.len();record.summary.files=record.changes.iter().map(|c|c.info.clone()).collect();
   data=serde_json::to_vec(&record).map_err(|_|WorkspaceError::Internal)?;
  }
  self.prepare()?;let directory=self.directory.join(&project);
  crate::application_paths::validate_directory_path(&directory).map_err(io_error)?;fs::create_dir_all(&directory).map_err(io_error)?;
  let path=directory.join(format!("{}.json",record.summary.id));
  use std::io::Write as _;
  let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(io_error)?;file.write_all(&data).map_err(io_error)?;
  self.cleanup(created)?;Ok(Some(record.summary))
 }
 pub fn latest(&mut self,workspace:&Workspace,thread:&str)->Result<Option<ReviewSummary>,WorkspaceError>{
  self.cleanup(now_ms())?;let directory=self.directory.join(project_key(workspace));
  if !directory.exists(){return Ok(None);}
  let mut files:Vec<_>=fs::read_dir(directory).map_err(io_error)?.flatten().map(|e|e.path()).filter(|p|regular(p)).collect();files.sort();
  let thread=thread_key(thread);
  for path in files.into_iter().rev(){
   if path.metadata().map_err(io_error)?.len()>RECORD_BYTES as u64{continue;}
   if let Ok(record)=serde_json::from_slice::<Record>(&fs::read(path).map_err(io_error)?){if record.thread==thread{return Ok(Some(record.summary));}}
  }Ok(None)
 }
 pub fn chunk(&mut self,workspace:&Workspace,thread:&str,id:&str,path:&str,side:&str,offset:u64,length:usize)->Result<MediaChunk,WorkspaceError>{
  if !valid_id(id)||length==0||length>MAX_MEDIA_CHUNK_BYTES||!matches!(side,"before"|"after"){return Err(WorkspaceError::InvalidPath);}
  let clean=validate_relative(path)?;
  if preview_policy(clean.file_name().and_then(|s|s.to_str()).ok_or(WorkspaceError::InvalidPath)?)!=PreviewPolicy::Text{return Err(WorkspaceError::NotEditable);}
  let project=project_key(workspace);let thread=thread_key(thread);
  let disk=self.directory.join(&project).join(format!("{id}.json"));
  crate::application_paths::validate_directory_path(disk.parent().ok_or(WorkspaceError::Internal)?).map_err(io_error)?;
  if !regular(&disk)||now_ms().saturating_sub(id[..13].parse::<u64>().unwrap_or_default())>RETENTION_MS{return Err(WorkspaceError::NotFound);}
  if !self.cached.as_ref().is_some_and(|(p,i,_)|p==&project&&i==id){
   if disk.metadata().map_err(io_error)?.len()>RECORD_BYTES as u64{return Err(WorkspaceError::ContentTooLarge);}
   let record:Record=serde_json::from_slice(&fs::read(disk).map_err(io_error)?).map_err(|_|WorkspaceError::Internal)?;
   self.cached=Some((project,id.to_owned(),record));
  }
  let record=&self.cached.as_ref().ok_or(WorkspaceError::Internal)?.2;
  if record.thread!=thread{return Err(WorkspaceError::AccessDenied);}
  let change=record.changes.iter().find(|c|c.info.relative_path==path&&c.info.text_available).ok_or(WorkspaceError::NotFound)?;
  let text=if side=="before"{change.before.as_deref()}else{change.after.as_deref()}.unwrap_or("");
  if offset>=text.len() as u64{return Err(WorkspaceError::InvalidPath);}
  let start=offset as usize;let end=(start+length).min(text.len());
  Ok(MediaChunk{offset,data:text.as_bytes()[start..end].to_vec(),eof:end==text.len()})
 }
 pub fn clear(&mut self,workspace:&Workspace)->Result<(),WorkspaceError>{
  self.prepare()?;let directory=self.directory.join(project_key(workspace));
  crate::application_paths::validate_directory_path(&directory).map_err(io_error)?;
  if directory.exists(){for file in fs::read_dir(directory).map_err(io_error)?.flatten(){let path=file.path();if path.file_stem().and_then(|s|s.to_str()).is_some_and(valid_id)&&regular(&path){fs::remove_file(path).map_err(io_error)?;}}}
  self.cached=None;Ok(())
 }
}

#[cfg(test)]mod tests {
 use super::*;
 #[test]fn ordinary_file_review_is_exact_and_bounded_to_its_thread(){
  let area=tempfile::tempdir().unwrap();let root=area.path().join("workspace");fs::create_dir(&root).unwrap();
  let workspace=Workspace::open(&root).unwrap();let mut history=ChangeTracker::new(area.path().join("history"));
  fs::write(root.join("IDEAS.md"),"before\r\n").unwrap();fs::write(root.join(".env"),"SECRET=x").unwrap();
  history.begin(&workspace,"thread-a").unwrap();fs::write(root.join("IDEAS.md"),"after\r\n").unwrap();
  fs::write(root.join("new.txt"),"new").unwrap();let summary=history.finish(&workspace,"thread-a").unwrap().unwrap();
  assert!(summary.complete);assert_eq!(summary.files.len(),2);
  assert_eq!(history.chunk(&workspace,"thread-a",&summary.id,"IDEAS.md","before",0,100).unwrap().data,b"before\r\n");
  assert!(history.chunk(&workspace,"thread-b",&summary.id,"IDEAS.md","before",0,10).is_err());
  assert!(history.chunk(&workspace,"thread-a","../escape","IDEAS.md","before",0,10).is_err());
  assert!(history.latest(&workspace,"thread-b").unwrap().is_none());
  history.clear(&workspace).unwrap();assert!(history.latest(&workspace,"thread-a").unwrap().is_none());
  assert_eq!(fs::read(root.join("IDEAS.md")).unwrap(),b"after\r\n");
 }
 #[test]fn retention_keeps_ten_reviews_and_expires_old_content(){
  let area=tempfile::tempdir().unwrap();let root=area.path().join("workspace");fs::create_dir(&root).unwrap();let workspace=Workspace::open(&root).unwrap();
  let mut history=ChangeTracker::new(area.path().join("history"));fs::write(root.join("file.txt"),"0").unwrap();
  for i in 0..12{history.begin(&workspace,"thread").unwrap();fs::write(root.join("file.txt"),i.to_string()).unwrap();history.finish(&workspace,"thread").unwrap();}
  let project=history.directory.join(project_key(&workspace));assert_eq!(fs::read_dir(&project).unwrap().count(),10);
  history.cleanup(now_ms()+RETENTION_MS+1).unwrap();assert_eq!(fs::read_dir(project).unwrap().count(),0);
 }
}
