# Context meter: data boundary

Status: researched, not implemented. Inspected on 2026-10-29 against the installed Codex CLI's generated public protocol and desktop 26.1023.6621.0.

The [official App Server documentation](https://learn.chatgpt.com/docs/app-server) defines `thread/tokenUsage/updated`. The installed CLI schema supplies `last` and `total` usage breakdowns, plus nullable `modelContextWindow`. Those are real protocol fields, but their existence does not give our companion access to the running desktop session's events.

Our context resolver owns a separate stdio App Server connection. It uses `thread/read` and `thread/turns/list` without resuming conversations. Their installed response schemas have no usage snapshot. The documented read operation does not subscribe to live events. The installed request schema has no independent read-only thread-token-usage query or subscription method. Its `thread/unsubscribe` operation is not a way to subscribe. No visible composer/header meter or usage-labelled control was found in the inspected active native page.

We did not resume the active conversation in a second server, inspect private UI stores, scan conversation logs, or substitute account allowance or goal totals. None establishes current context occupancy safely. No percentage, compaction countdown or category breakdown has been added.

## Smallest useful next step

Add a meter when the host exposes a supported read-only snapshot or event subscription to the actual active session. Require matching thread identity, explicit unavailable/stale states, and cleanup on thread changes. Preserve the distinction between cumulative usage, last-response usage, model capacity and current context. A nullable capacity must never become a guessed model-specific constant. Compaction and subsequent requests can change occupancy; a last-response count alone is not an exact live context measurement.

Generated schemas and bounded DOM observations are ignored local research artifacts, not runtime dependencies or copied host implementation. Recheck this boundary when the host protocol changes. The existing citation, editing and review features do not depend on a context meter.
