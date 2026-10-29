use super::{NativeBridge,map_resolver_error,no_context_error};
use cdp_client::BridgeError;
use serde::Deserialize;
use serde_json::{Value,json};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Params {cursor:Option<String>}
impl NativeBridge {
    pub(super) async fn changes_native(&self,params:Value,epoch:u64)->Result<Value,BridgeError>{
        let params:Params=serde_json::from_value(params).map_err(|_|BridgeError::invalid_request())?;
        let context=self.git_context(epoch)?;
        let thread=context.thread_id.as_deref().ok_or_else(no_context_error)?;
        let resolver=self.inner.resolver.as_ref().ok_or_else(no_context_error)?;
        let raw=resolver.review_page(thread,params.cursor.as_deref()).await.map_err(map_resolver_error)?;
        self.ensure_active_context(&context,epoch)?;
        let mut page=context_resolver::native_review_page(&raw,&context.workspace.root_path().to_string_lossy()).map_err(map_resolver_error)?;
        if let Some(review)=page.get_mut("review").filter(|r|r.is_object()){
            if let Some(files)=review.get_mut("files").and_then(Value::as_array_mut){
                let before=files.len();files.retain(|f|f["relativePath"].as_str().is_some_and(workspace_service::permits_recorded_review));
                let removed=before-files.len();let omitted=review["omitted"].as_u64().unwrap_or_default();review["omitted"]=json!(omitted+removed as u64);
            }
        }
        Ok(page)
    }
}
