use super::*;

impl Workspace {
    /// A text-only range from the complete content snapshot named by the caller.
    /// Each bounded read rechecks the entire content hash, including bytes outside
    /// the requested range. Same-size edits cannot silently mix file revisions.
    pub fn preview_chunk(
        &self,
        relative_path: &str,
        offset: u64,
        length: usize,
        expected_size_bytes: u64,
        expected_version: &str,
    ) -> Result<MediaChunk, WorkspaceError> {
        if length == 0
            || length > MAX_MEDIA_CHUNK_BYTES
            || expected_size_bytes == 0
            || expected_size_bytes > MAX_TEXT_FILE_BYTES as u64
            || offset >= expected_size_bytes
            || offset.checked_add(length as u64).is_none()
        {
            return Err(WorkspaceError::InvalidPath);
        }
        self.ensure_root_valid()?;
        let clean = validate_relative(relative_path)?;
        let name = clean
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or(WorkspaceError::InvalidPath)?;
        if preview_policy(name) != PreviewPolicy::Text {
            return Err(WorkspaceError::NotEditable);
        }
        let parent = clean.parent().unwrap_or_else(|| Path::new(""));
        let directory = DirectoryCapability::open(self.root_handle(), parent)?;
        let mut file = open_regular_file_nofollow(directory.handle()?, Path::new(name))?;
        if file.metadata().map_err(|e| map_io(&e))?.len() != expected_size_bytes {
            return Err(WorkspaceError::Conflict);
        }
        let mut bytes = Vec::with_capacity(expected_size_bytes as usize);
        Read::by_ref(&mut file)
            .take(MAX_TEXT_FILE_BYTES.saturating_add(1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|e| map_io(&e))?;
        let final_size = file.metadata().map_err(|e| map_io(&e))?.len();
        drop(file);
        self.ensure_root_valid()?;
        if bytes.len() as u64 != expected_size_bytes
            || final_size != expected_size_bytes
            || content_version(&bytes) != expected_version
        {
            return Err(WorkspaceError::Conflict);
        }
        if bytes.contains(&0) || std::str::from_utf8(&bytes).is_err() {
            return Err(WorkspaceError::NotEditable);
        }
        let start = offset as usize;
        let end = start.saturating_add(length).min(bytes.len());
        Ok(MediaChunk {
            offset,
            data: bytes[start..end].to_vec(),
            eof: end == bytes.len(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn streamed_text_loads_exactly_ten_mib_and_rejects_one_byte_more() {
        let directory = tempfile::tempdir().unwrap();
        let workspace = Workspace::open(directory.path()).unwrap();
        let mut source = vec![b'x'; MAX_TEXT_FILE_BYTES];
        source[MAX_TEXT_FILE_BYTES - 4..].copy_from_slice(b"END!");
        fs::write(directory.path().join("large.md"), &source).unwrap();
        let preview = workspace.preview("large.md").unwrap();
        assert!(preview.text.is_none());
        assert!(!preview.editable && !preview.truncated);
        let transfer = preview.text_transfer.as_ref().unwrap();
        assert_eq!(transfer.chunk_count, 5);
        let mut complete = Vec::new();
        while complete.len() < source.len() {
            let chunk = workspace.preview_chunk(
                "large.md", complete.len() as u64, transfer.chunk_size,
                preview.size_bytes, preview.version.as_deref().unwrap(),
            ).unwrap();
            complete.extend(chunk.data);
            assert_eq!(chunk.eof, complete.len() == source.len());
        }
        assert_eq!(complete, source);
        source.push(b'y');
        fs::write(directory.path().join("large.md"), source).unwrap();
        assert_eq!(workspace.preview("large.md").unwrap_err().code(), crate::ErrorCode::ContentTooLarge);
    }

    #[test]
    fn streamed_text_rejects_same_size_changes_even_outside_requested_chunk() {
        let directory = tempfile::tempdir().unwrap();
        let workspace = Workspace::open(directory.path()).unwrap();
        let mut source = vec![b'x'; MAX_PREVIEW_BYTES + 1];
        fs::write(directory.path().join("large.txt"), &source).unwrap();
        let preview = workspace.preview("large.txt").unwrap();
        source[MAX_PREVIEW_BYTES] = b'y';
        fs::write(directory.path().join("large.txt"), source).unwrap();
        assert_eq!(workspace.preview_chunk("large.txt", 0, 10, preview.size_bytes, preview.version.as_deref().unwrap()).unwrap_err().code(), crate::ErrorCode::Conflict);
    }

    #[test]
    fn streamed_text_preserves_utf8_bytes_and_denies_binary_sensitive_and_traversal() {
        let directory = tempfile::tempdir().unwrap();
        let workspace = Workspace::open(directory.path()).unwrap();
        let source = "\u{feff}hello \u{1f43a}\r\n".as_bytes();
        fs::write(directory.path().join("valid.txt"), source).unwrap();
        let version = content_version(source);
        let chunk = workspace.preview_chunk("valid.txt", 7, 3, source.len() as u64, &version).unwrap();
        assert_eq!(chunk.data, source[7..10]);
        for name in [".env", "binary.txt", "invalid.txt"] {
            let bytes: &[u8] = match name { ".env" => b"SECRET=value", "binary.txt" => b"a\0b", _ => &[0xff] };
            fs::write(directory.path().join(name), bytes).unwrap();
            assert!(workspace.preview_chunk(name, 0, 1, bytes.len() as u64, &content_version(bytes)).is_err());
        }
        assert!(workspace.preview_chunk("../valid.txt", 0, 1, source.len() as u64, &version).is_err());
        assert!(workspace.preview_chunk("valid.txt", 0, MAX_MEDIA_CHUNK_BYTES + 1, source.len() as u64, &version).is_err());
        assert!(workspace.preview_chunk("valid.txt", source.len() as u64, 1, source.len() as u64, &version).is_err());
    }
}
