use super::{NativeBridge,MediaChunkResult,lock_unpoisoned,map_workspace_error,internal_error};
use cdp_client::BridgeError;
use serde::Deserialize;
use serde_json::{Value,json};
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct CaptureParams {action:String,#[serde(default)]started_late:bool}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct ChunkParams {record_id:String,relative_path:String,side:String,offset:u64,length:usize}
impl NativeBridge {
 pub(super) async fn changes_capture(&self,params:Value,epoch:u64)->Result<Value,BridgeError>{
  let params:CaptureParams=serde_json::from_value(params).map_err(|_|BridgeError::invalid_request())?;
  if !matches!(params.action.as_str(),"begin"|"finish"|"latest"|"clear"){return Err(BridgeError::invalid_request());}
  let context=self.git_context(epoch)?;let workspace=context.workspace.clone();
  let thread=context.thread_id.clone().unwrap_or_else(||"manual".into());let tracker=self.inner.change_tracker.clone();
  let result=tokio::task::spawn_blocking(move||{
   let mut tracker=lock_unpoisoned(&tracker);
   match params.action.as_str(){
    "begin"=>{tracker.begin(&workspace,&thread)?;if params.started_late{tracker.mark_partial();}Ok(json!({"capturing":true}))},
    "finish"=>serde_json::to_value(tracker.finish(&workspace,&thread)?).map_err(|_|workspace_service::WorkspaceError::Internal),
    "latest"=>serde_json::to_value(tracker.latest(&workspace,&thread)?).map_err(|_|workspace_service::WorkspaceError::Internal),
    "clear"=>{tracker.clear(&workspace)?;Ok(Value::Null)},
    _=>Err(workspace_service::WorkspaceError::InvalidPath),
   }
  }).await;
  self.ensure_active_context(&context,epoch)?;
  result.map_err(|_|internal_error())?.map_err(map_workspace_error)
 }
 pub(super) async fn changes_chunk(&self,params:Value,epoch:u64)->Result<Value,BridgeError>{
  let params:ChunkParams=serde_json::from_value(params).map_err(|_|BridgeError::invalid_request())?;
  let context=self.git_context(epoch)?;let workspace=context.workspace.clone();let tracker=self.inner.change_tracker.clone();
  let thread=context.thread_id.clone().unwrap_or_else(||"manual".into());
  let result=tokio::task::spawn_blocking(move||lock_unpoisoned(&tracker).chunk(&workspace,&thread,&params.record_id,&params.relative_path,&params.side,params.offset,params.length)).await;
  self.ensure_active_context(&context,epoch)?;
  let chunk=result.map_err(|_|internal_error())?.map_err(map_workspace_error)?;
  serde_json::to_value(MediaChunkResult{offset:chunk.offset,data_base64:STANDARD.encode(chunk.data),eof:chunk.eof}).map_err(|_|internal_error())
 }
}
