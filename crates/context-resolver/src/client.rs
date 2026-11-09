use tokio::io::AsyncBufReadExt;

use std::sync::{Arc, Mutex as StdMutex, Weak};

use serde_json::{Value, json};

use tokio::io::AsyncBufRead;

use super::{Inner, MAX_MESSAGE_BYTES, ResolverError, diagnostic};

// A frame is retained only up to the existing wire limit, including its newline.
// Oversize is reported once at detection; the remainder is discarded in bounded
// chunks before reading another frame. No truncated prefix is ever parsed.
struct FrameReader {
    bytes: Vec<u8>,
    discarding: bool,
}

enum Frame {
    Message,
    Oversized { observed_bytes: usize },
    Eof,
}

impl FrameReader {
    fn new() -> Self {
        Self {
            bytes: Vec::with_capacity(MAX_MESSAGE_BYTES),
            discarding: false,
        }
    }

    async fn next<R: AsyncBufRead + Unpin>(&mut self, reader: &mut R) -> std::io::Result<Frame> {
        self.bytes.clear();
        loop {
            let available = reader.fill_buf().await?;
            if available.is_empty() {
                return Ok(if self.bytes.is_empty() {
                    Frame::Eof
                } else {
                    Frame::Message
                });
            }
            let newline = available.iter().position(|byte| *byte == b'\n');
            let count = newline.map_or(available.len(), |position| position + 1);
            if self.discarding {
                reader.consume(count);
                if newline.is_some() {
                    self.discarding = false;
                }
                continue;
            }
            let observed_bytes = self.bytes.len().saturating_add(count);
            if observed_bytes > MAX_MESSAGE_BYTES {
                self.bytes.clear();
                self.discarding = newline.is_none();
                reader.consume(count);
                return Ok(Frame::Oversized { observed_bytes });
            }
            self.bytes.extend_from_slice(&available[..count]);
            reader.consume(count);
            if newline.is_some() {
                return Ok(Frame::Message);
            }
        }
    }
}

pub(super) async fn read_loop<R>(
    inner: Weak<Inner>,
    mut reader: R,
    _lifetime_guard: Arc<StdMutex<Option<Box<dyn Send + Sync>>>>,
) where
    R: AsyncBufRead + Unpin,
{
    let mut frames = FrameReader::new();
    let mut terminal = ResolverError::Io.context(
        "reading App Server stdout",
        "stream ended (EOF); child exit code not observed here",
    );
    loop {
        match frames.next(&mut reader).await {
            Ok(Frame::Eof) => {
                diagnostic("transport read", "closed", json!({"reason":"EOF"}));
                break;
            }
            Ok(Frame::Oversized { observed_bytes }) => {
                let error = ResolverError::Protocol.context(
                    "reading App Server frame",
                    format!("observedBytes={observed_bytes}; maxBytes={MAX_MESSAGE_BYTES}"),
                );
                diagnostic(
                    "protocol frame",
                    "failed",
                    json!({"observedBytes":observed_bytes,"maxBytes":MAX_MESSAGE_BYTES}),
                );
                // The frame ID is unavailable without parsing an untrusted prefix.
                // Fail current requests once, but keep the transport usable after
                // the oversized frame's delimiter. Never replay requests.
                if let Some(inner) = inner.upgrade() {
                    let mut pending = inner.pending.lock().await;
                    for (_, sender) in pending.entries.drain() {
                        let _ = sender.send(Err(error.clone()));
                    }
                } else {
                    break;
                }
                continue;
            }
            Ok(Frame::Message) => {}
            Err(error) => {
                terminal = ResolverError::Io.context(
                    "reading App Server stdout",
                    format!(
                        "ioKind={:?}; osCode={:?}; cause={error}",
                        error.kind(),
                        error.raw_os_error()
                    ),
                );
                diagnostic(
                    "transport read",
                    "failed",
                    json!({"ioKind":format!("{:?}",error.kind()),"osErrorCode":error.raw_os_error()}),
                );
                break;
            }
        }
        // Preserve read_line's terminal invalid-UTF-8 behavior for bounded frames.
        if std::str::from_utf8(&frames.bytes).is_err() {
            terminal = ResolverError::Io.context(
                "reading App Server stdout",
                "ioKind=InvalidData; invalid UTF-8 frame",
            );
            diagnostic(
                "transport read",
                "failed",
                json!({"ioKind":"InvalidData","osErrorCode":null}),
            );
            break;
        }
        let message = match serde_json::from_slice::<Value>(&frames.bytes) {
            Ok(message) => message,
            Err(error) => {
                diagnostic(
                    "protocol frame",
                    "rejected",
                    json!({"code":"APP_PROTOCOL","reason":"Invalid JSON","observedBytes":frames.bytes.len(),"parseLocation":format!("line={}, column={}, category={:?}",error.line(),error.column(),error.classify())}),
                );
                continue;
            }
        };
        let Some(inner) = inner.upgrade() else {
            break;
        };
        if let Some(id) = message.get("id").and_then(Value::as_u64) {
            if let Some(sender) = inner.pending.lock().await.entries.remove(&id) {
                let result = if let Some(error) = message.get("error") {
                    Err(ResolverError::Remote {
                        code: error.get("code").and_then(Value::as_i64).unwrap_or(-1),
                    })
                } else {
                    message
                        .get("result")
                        .cloned()
                        .ok_or(ResolverError::Protocol)
                };
                let _ = sender.send(result);
            }
            continue;
        }
        let _ = inner.notifications.send(message);
    }

    if let Some(inner) = inner.upgrade() {
        let mut pending = inner.pending.lock().await;
        diagnostic(
            "transport pending requests",
            "released",
            json!({"pendingCount":pending.entries.len()}),
        );
        pending.terminal = Some(terminal.clone());
        for (_, sender) in pending.entries.drain() {
            let _ = sender.send(Err(terminal.clone()));
        }
        drop(pending);
        if let Some(child) = inner.child.lock().await.as_mut() {
            let exit = child.try_wait();
            diagnostic(
                "stdout terminal child state",
                "observed",
                json!({"exitCode":exit.as_ref().ok().and_then(|v|v.as_ref()).and_then(|v|v.code()),"stillRunning":matches!(exit,Ok(None)),"exitObservationError":exit.err().map(|e|e.to_string()),"causeNotInferred":true}),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::{AppServerClient, DEFAULT_REQUEST_TIMEOUT, PendingRequests};
    use super::*;
    use std::{collections::HashMap, sync::atomic::AtomicU64, time::Duration};
    use tokio::{
        io::{AsyncWriteExt, BufReader},
        sync::{Mutex, broadcast, oneshot},
    };

    #[tokio::test]
    async fn fragmented_oversize_resumes_at_next_frame_without_retaining_body() {
        let mut wire = vec![b'x'; MAX_MESSAGE_BYTES + 31];
        wire.extend_from_slice(b"\n{\"id\":7,\"result\":true}\n");
        let mut reader = BufReader::with_capacity(7, std::io::Cursor::new(wire));
        let mut frames = FrameReader::new();
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Oversized { .. }
        ));
        assert!(frames.bytes.is_empty());
        assert_eq!(frames.bytes.capacity(), MAX_MESSAGE_BYTES);
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Message
        ));
        assert_eq!(
            serde_json::from_slice::<Value>(&frames.bytes).unwrap()["id"],
            7
        );
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Eof
        ));
    }

    #[tokio::test]
    async fn unterminated_oversize_is_rejected_at_limit_and_eof_is_not_a_message() {
        let wire = vec![b'x'; MAX_MESSAGE_BYTES + 1];
        let mut reader = std::io::Cursor::new(wire);
        let mut frames = FrameReader::new();
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Oversized { .. }
        ));
        assert!(frames.bytes.is_empty());
        assert_eq!(frames.bytes.capacity(), MAX_MESSAGE_BYTES);
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Eof
        ));
    }

    #[tokio::test]
    async fn wire_limit_includes_delimiter_and_bounded_final_frame_is_preserved() {
        let mut wire = vec![b' '; MAX_MESSAGE_BYTES - 2];
        wire.extend_from_slice(b"0\n1");
        let mut reader = std::io::Cursor::new(wire);
        let mut frames = FrameReader::new();
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Message
        ));
        assert_eq!(frames.bytes.len(), MAX_MESSAGE_BYTES);
        assert_eq!(serde_json::from_slice::<Value>(&frames.bytes).unwrap(), 0);
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Message
        ));
        assert_eq!(frames.bytes, b"1");
        assert!(matches!(
            frames.next(&mut reader).await.unwrap(),
            Frame::Eof
        ));
    }

    fn synthetic_client() -> (AppServerClient, tokio::io::DuplexStream) {
        let (client_io, server) = tokio::io::duplex(65536);
        let (reader, writer) = tokio::io::split(client_io);
        let (notifications, _) = broadcast::channel(16);
        let guard = Arc::new(StdMutex::new(None));
        let inner = Arc::new(Inner {
            writer: Mutex::new(Box::new(writer)),
            pending: Mutex::new(PendingRequests {
                entries: HashMap::new(),
                terminal: None,
            }),
            next_id: AtomicU64::new(100),
            timeout: DEFAULT_REQUEST_TIMEOUT,
            notifications,
            child: Mutex::new(None),
            _lifetime_guard: guard.clone(),
        });
        tokio::spawn(read_loop(
            Arc::downgrade(&inner),
            BufReader::new(reader),
            guard,
        ));
        (AppServerClient { inner }, server)
    }

    async fn reply(
        receiver: oneshot::Receiver<Result<Value, ResolverError>>,
    ) -> Result<Value, ResolverError> {
        tokio::time::timeout(Duration::from_secs(3), receiver)
            .await
            .unwrap()
            .unwrap()
    }

    #[tokio::test]
    async fn oversized_frame_releases_concurrent_requests_once_and_ignores_late_ids() {
        let (client, mut server) = synthetic_client();
        let (one, first) = oneshot::channel();
        let (two, second) = oneshot::channel();
        {
            let mut pending = client.inner.pending.lock().await;
            pending.entries.insert(1, one);
            pending.entries.insert(2, two);
        }
        let (resume, resumed) = oneshot::channel();
        let (finish, finished) = oneshot::channel();
        let server_task = tokio::spawn(async move {
            // Deliberately pause before the delimiter: rejection must not wait
            // for the complete oversized frame, or reject fresh requests again.
            server
                .write_all(&vec![b'x'; MAX_MESSAGE_BYTES + 1])
                .await
                .unwrap();
            resumed.await.unwrap();
            server.write_all(b"\n{\"id\":1,\"result\":false}\n{\"id\":2,\"result\":false}\n{\"id\":3,\"result\":true}\n").await.unwrap();
            finished.await.unwrap();
        });
        assert!(matches!(
            reply(first).await.unwrap_err().kind(),
            ResolverError::Protocol
        ));
        assert!(matches!(
            reply(second).await.unwrap_err().kind(),
            ResolverError::Protocol
        ));
        let (three, third) = oneshot::channel();
        client.inner.pending.lock().await.entries.insert(3, three);
        resume.send(()).unwrap();
        assert_eq!(reply(third).await.unwrap(), true);
        assert!(client.inner.pending.lock().await.terminal.is_none());
        finish.send(()).unwrap();
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn invalid_utf8_preserves_terminal_read_error_behavior() {
        let (client, mut server) = synthetic_client();
        let (sender, receiver) = oneshot::channel();
        client.inner.pending.lock().await.entries.insert(1, sender);
        server.write_all(&[0xff, b'\n']).await.unwrap();
        assert!(matches!(
            reply(receiver).await.unwrap_err().kind(),
            ResolverError::Io
        ));
        assert!(client.inner.pending.lock().await.terminal.is_some());
    }

    #[tokio::test]
    async fn eof_closes_registration_and_future_requests_fail_before_writer_lock() {
        let (client, server) = synthetic_client();
        let (sender, receiver) = oneshot::channel();
        client.inner.pending.lock().await.entries.insert(1, sender);
        drop(server);
        assert!(matches!(
            reply(receiver).await.unwrap_err().kind(),
            ResolverError::Io
        ));
        assert!(client.inner.pending.lock().await.terminal.is_some());
        // Holding the writer proves a future request does not reach writing.
        let _writer = client.inner.writer.lock().await;
        let result = tokio::time::timeout(
            Duration::from_secs(1),
            client.request("thread/read", json!({})),
        )
        .await
        .unwrap();
        assert!(matches!(result.unwrap_err().kind(), ResolverError::Io));
        assert!(client.inner.pending.lock().await.entries.is_empty());
    }
}
