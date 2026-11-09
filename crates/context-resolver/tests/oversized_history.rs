use std::path::PathBuf;
use std::time::Duration;

use context_resolver::{AppServerClient, ResolverError};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, duplex, split};
use tokio::sync::oneshot;

const THREAD: &str = "fixture-thread-oversized";
const FRAME_LIMIT: usize = 4 * 1024 * 1024;
const WAIT: Duration = Duration::from_secs(3);

#[tokio::test]
async fn oversized_history_is_rejected_without_poisoning_later_workspace_reads() {
    let (client_stream, server_stream) = duplex(64 * 1024);
    let (client_read, client_write) = split(client_stream);
    let (server_read, mut server_write) = split(server_stream);
    let (stop, stopped) = oneshot::channel();
    let mut server = tokio::spawn(async move {
        let mut reader = BufReader::new(server_read);
        let mut line = String::new();

        reader.read_line(&mut line).await.expect("initialize request");
        let initialize: Value = serde_json::from_str(&line).expect("initialize JSON");
        assert_eq!(initialize["method"], "initialize");
        server_write
            .write_all(format!("{}\n", json!({"id":initialize["id"],"result":{}})).as_bytes())
            .await
            .expect("initialize response");
        line.clear();
        reader.read_line(&mut line).await.expect("initialized notification");
        assert_eq!(serde_json::from_str::<Value>(&line).unwrap()["method"], "initialized");

        line.clear();
        reader.read_line(&mut line).await.expect("first workspace request");
        let first: Value = serde_json::from_str(&line).expect("first workspace JSON");
        assert_eq!(first["method"], "thread/read");
        assert_eq!(first["params"], json!({"threadId":THREAD,"includeTurns":false}));
        server_write
            .write_all(format!("{}\n", json!({"id":first["id"],"result":{"thread":{"id":THREAD,"cwd":"C:/Synthetic/Before"}}})).as_bytes())
            .await
            .expect("first workspace response");

        line.clear();
        reader.read_line(&mut line).await.expect("history request");
        let history: Value = serde_json::from_str(&line).expect("history JSON");
        assert_eq!(history["method"], "thread/turns/list");
        assert_eq!(history["params"]["threadId"], THREAD);
        assert_eq!(history["params"]["limit"], 1);
        let oversized = json!({"id":history["id"],"result":{"data":[{"id":"fixture-turn","items":[{"type":"agentMessage","text":"x".repeat(FRAME_LIMIT + 1024)}]}],"nextCursor":null}});
        let encoded = format!("{oversized}\n");
        assert!(encoded.len() > FRAME_LIMIT, "fixture must cross the existing four-MiB cap");
        server_write.write_all(encoded.as_bytes()).await.expect("oversized history response");

        line.clear();
        reader.read_line(&mut line).await.expect("next workspace request on same connection");
        let next: Value = serde_json::from_str(&line).expect("next workspace JSON");
        assert_eq!(next["method"], "thread/read");
        assert_eq!(next["params"], json!({"threadId":THREAD,"includeTurns":false}));
        server_write
            .write_all(format!("{}\n", json!({"id":next["id"],"result":{"thread":{"id":THREAD,"cwd":"C:/Synthetic/After"}}})).as_bytes())
            .await
            .expect("next workspace response");

        // Keep both server halves alive: a failed later read must not be
        // explained by this synthetic server exiting or closing its stdout.
        let _ = stopped.await;
        drop((reader, server_write));
    });

    let observed = async {
        let client = tokio::time::timeout(WAIT, AppServerClient::connect_io(BufReader::new(client_read), client_write))
            .await
            .map_err(|_| "initialize outer timeout")?
            .map_err(|_| "initialize failed")?;
        let first = tokio::time::timeout(WAIT, client.resolve_thread(THREAD))
            .await
            .map_err(|_| "first workspace outer timeout")?
            .map_err(|_| "first workspace failed")?;
        let history = tokio::time::timeout(WAIT, client.review_page(THREAD, None)).await;
        let next = tokio::time::timeout(WAIT, client.resolve_thread(THREAD)).await;
        Ok::<_, &str>((first, history, next))
    }
    .await;

    // Cleanup precedes behavioral assertions, including the expected old-source
    // failure. No real process, workspace, profile or server is involved.
    let _ = stop.send(());
    let server_result = match tokio::time::timeout(WAIT, &mut server).await {
        Ok(result) => result,
        Err(_) => {
            server.abort();
            let _ = server.await;
            panic!("synthetic server cleanup timed out");
        }
    };
    server_result.expect("synthetic server completed without a protocol/setup failure");

    let (first, history, next) = observed.expect("initial successful workspace setup");
    assert_eq!(first.thread_id, THREAD);
    assert_eq!(first.cwd, PathBuf::from("C:/Synthetic/Before"));
    let history = history.expect("oversized history must fail within the outer deadline");
    assert!(
        matches!(&history, Err(error) if matches!(error.kind(), ResolverError::Protocol)),
        "oversized history must be a protocol error, never truncated success"
    );
    let next = next
        .expect("later workspace lookup must complete on the same client after oversized history")
        .expect("later workspace lookup must succeed after oversized history");
    assert_eq!(next.thread_id, THREAD);
    assert_eq!(next.cwd, PathBuf::from("C:/Synthetic/After"));
}
