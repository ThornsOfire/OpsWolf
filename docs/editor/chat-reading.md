# Chat reading

The candidate reading adapter protects the visible paragraph, code block, list item or file table after scrolling upward in a qualified conversation. Streaming below it and resizing/collapsing earlier content should preserve that block's viewport offset. **Jump to latest** above the composer releases the anchor and moves to the end. Returning to the bottom through ordinary scrolling also releases it. Codex retains ownership of normal follow-at-bottom behavior.

The adapter uses public conversation/composer identity and thread-scroll markers. Conflicting identities, inactive pages and unknown layouts retain native behavior. It does not move native message nodes, change message text, alter drafts or access private framework state. Anchors are live element references in memory, discarded on chat changes/disposal. If an anchored block disappears, another captured visible block is used; removed text cannot itself be preserved.

`features/chat/reading-anchor.ts` owns the reading state and geometry. `host/native-surfaces/chat-reading.ts` qualifies the current native viewport and owns the small Jump control. Future activity following must use the same reading state, rather than add a competing scroll controller.

Local verification: `node scripts/test-chat-reading.mjs` uses actual browser wheel/keyboard input and tests streaming, reflow, native scroll displacement, collapse, fractional zoom, lifecycle and draft preservation. These synthetic checks are not proof of native-version compatibility. Live Codex verification, simultaneous input/output stress, and within-paragraph wrapping changes remain part of candidate evaluation.
