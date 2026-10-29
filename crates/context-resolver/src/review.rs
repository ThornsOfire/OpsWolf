//! Project-scoped projection of native fileChange items. No filesystem scan or writes.
use serde_json::{Value,json};
use crate::ResolverError;
const MAX_DIFF_BYTES:usize=1024*1024;
fn relative(path:&str,root:&str)->Option<String>{
    let path=path.replace('\\',"/");let root=root.replace('\\',"/");let root=root.trim_end_matches('/');
    if path.contains(['\0','\r','\n'])||path.len()>4096{return None;}
    let windows=root.as_bytes().get(1)==Some(&b':');
    let prefix=if windows{path.to_lowercase().starts_with(&(root.to_lowercase()+"/"))}else{path.starts_with(&(root.to_owned()+"/"))};
    if !prefix{return None;}
    let value=path.get(root.len()+1..)?;
    if value.is_empty()||value.split('/').any(|p|p.is_empty()||p=="."||p=="..")||value.contains(':'){return None;}
    Some(value.to_owned())
}
fn identifier(value:&str)->bool{!value.is_empty()&&value.len()<=128&&value.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_')}
fn patch(path:&str,kind:&str,diff:&str)->Option<String>{
    if diff.len()>MAX_DIFF_BYTES||diff.contains('\0'){return None;}
    if kind=="update"{
        if !diff.starts_with("@@")&&!diff.contains("\n@@"){return None;}
        return Some(if diff.starts_with("diff --git ")||diff.starts_with("--- "){diff.to_owned()}else{format!("--- a/{path}\n+++ b/{path}\n{diff}")});
    }
    let lines=diff.lines().count();
    let mut result=if kind=="add"{format!("--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{lines} @@\n")}else{format!("--- a/{path}\n+++ /dev/null\n@@ -1,{lines} +0,0 @@\n")};
    for line in diff.split_inclusive('\n'){result.push(if kind=="add"{'+'}else{'-'});result.push_str(line);}
    if !diff.is_empty()&&!diff.ends_with('\n'){result.push_str("\n\\ No newline at end of file\n");}
    Some(result)
}
pub fn native_review_page(result:&Value,root:&str)->Result<Value,ResolverError>{
    let turns=result.get("data").and_then(Value::as_array).filter(|t|t.len()<=1).ok_or(ResolverError::Protocol)?;
    let cursor=result.get("nextCursor").and_then(Value::as_str);
    if cursor.is_some_and(|s|s.len()>4096){return Err(ResolverError::Protocol);}
    let Some(turn)=turns.first()else{return Ok(json!({"review":null,"nextCursor":cursor,"turnId":null}));};
    let id=turn.get("id").and_then(Value::as_str).filter(|s|identifier(s)).ok_or(ResolverError::Protocol)?;
    let status=turn.get("status").and_then(Value::as_str).ok_or(ResolverError::Protocol)?;
    if !matches!(status,"completed"|"interrupted"|"failed"|"inProgress"){return Ok(json!({"review":null,"nextCursor":cursor,"turnId":id}));}
    let items=turn.get("items").and_then(Value::as_array).ok_or(ResolverError::Protocol)?;
    let mut files:Vec<Value>=Vec::new();let mut message_ids=Vec::new();let mut bytes=0usize;let mut omitted=0usize;
    for item in items{
        if item["type"]=="agentMessage"{if let Some(id)=item["id"].as_str().filter(|s|identifier(s)){if message_ids.len()<128{message_ids.push(id);}}}
        if item["type"]!="fileChange"||item["status"]!="completed"{continue;}
        for change in item["changes"].as_array().ok_or(ResolverError::Protocol)?{
            let original=change["path"].as_str().ok_or(ResolverError::Protocol)?;
            let moved=change["kind"]["move_path"].as_str();
            let Some(path)=relative(moved.unwrap_or(original),root)else{omitted+=1;continue;};
            if relative(original,root).is_none(){omitted+=1;continue;}
            let kind=change["kind"]["type"].as_str().filter(|k|matches!(*k,"add"|"update"|"delete")).ok_or(ResolverError::Protocol)?;
            let raw=change["diff"].as_str().ok_or(ResolverError::Protocol)?;
            let diff=patch(&path,kind,raw);let index=files.iter().position(|f|f["relativePath"]==path);
            let retained=diff.as_ref().is_some_and(|d|bytes.saturating_add(d.len())<=MAX_DIFF_BYTES);
            if !retained{omitted+=1;}
            if index.is_none()&&files.len()>=128{omitted+=1;continue;}
            if retained{bytes+=diff.as_ref().map_or(0,String::len);}
            if let Some(index)=index{
                let file=&mut files[index];file["kind"]=json!("multiple patches");
                if retained&&file["content"].is_string(){let previous=file["content"].as_str().unwrap_or_default();file["content"]=json!(format!("{previous}\n{}",diff.unwrap_or_default()));}else{file["content"]=Value::Null;}
            }else{files.push(json!({"relativePath":path,"kind":if moved.is_some(){"renamed"}else{kind},"content":if retained{diff}else{None}}));}
        }
    }
    let review=if files.is_empty()&&omitted==0{Value::Null}else{json!({"id":id,"completedMs":turn["completedAt"].as_i64().map(|s|s.saturating_mul(1000)),"status":status,"messageIds":message_ids,"omitted":omitted,"files":files})};
    Ok(json!({"review":review,"nextCursor":cursor,"turnId":id}))
}
#[cfg(test)]mod tests{
    use super::*;
    fn page(changes:Value)->Value{json!({"data":[{"id":"turn-1","status":"completed","completedAt":100,"items":[{"id":"msg-1","type":"agentMessage"},{"type":"fileChange","status":"completed","changes":changes}]}],"nextCursor":null})}
    #[test]fn native_patch_projection_preserves_data_and_rejects_escape(){
        let source=page(json!([{"path":"C:\\Workspace\\notes.md","kind":{"type":"add"},"diff":"hello\nworld"},{"path":"C:/Elsewhere/secret.txt","kind":{"type":"add"},"diff":"secret"},{"path":"C:/Workspace/../secret","kind":{"type":"add"},"diff":"secret"}]));
        let result=native_review_page(&source,"c:/workspace").unwrap();
        assert_eq!(result["review"]["files"].as_array().unwrap().len(),1);
        assert_eq!(result["review"]["messageIds"],json!(["msg-1"]));
        assert!(result["review"]["files"][0]["content"].as_str().unwrap().contains("+hello\n+world\n\\ No newline"));
        assert_eq!(result["review"]["omitted"],2);assert!(!result.to_string().contains("secret"));
    }
    #[test]fn native_update_delete_and_incomplete_diff_are_explicit(){
        let source=page(json!([{"path":"/work/file.rs","kind":{"type":"update"},"diff":"@@ -1 +1 @@\n-old\n+new\n"},{"path":"/work/deleted.txt","kind":{"type":"delete"},"diff":"removed\n"},{"path":"/work/big.txt","kind":{"type":"add"},"diff":"a".repeat(MAX_DIFF_BYTES+1)}]));
        let result=native_review_page(&source,"/work").unwrap();let files=result["review"]["files"].as_array().unwrap();
        assert!(files[0]["content"].as_str().unwrap().contains("-old\n+new"));assert!(files[1]["content"].as_str().unwrap().contains("-removed"));
        assert!(files[2]["content"].is_null());assert_eq!(result["review"]["omitted"],1);
    }
    #[test]fn pending_and_command_only_turns_do_not_invent_changes(){
        let mut value=page(json!([]));assert!(native_review_page(&value,"/work").unwrap()["review"].is_null());
        value["data"][0]["status"]=json!("inProgress");assert!(native_review_page(&value,"/work").unwrap()["review"].is_null());
    }
    #[test]fn active_response_exposes_only_successfully_applied_patches(){
        let mut value=page(json!([{"path":"/work/live.txt","kind":{"type":"add"},"diff":"live\n"}]));
        value["data"][0]["status"]=json!("inProgress");
        let review=native_review_page(&value,"/work").unwrap();
        assert_eq!(review["review"]["status"],"inProgress");
        assert!(review["review"]["files"][0]["content"].as_str().unwrap().contains("+live"));
        value["data"][0]["items"][1]["status"]=json!("inProgress");
        assert!(native_review_page(&value,"/work").unwrap()["review"].is_null());
    }
}
