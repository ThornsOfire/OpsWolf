# Composer typing speed

Use **WPM off/on** above the composer to enable the optional typing meter. It starts off. **Reset** clears the current measurement; disabling it clears totals and removes its input listeners. The on/off preference survives reload; measurements do not.

This is **gross WPM**, not accuracy: inserted Unicode code points divided by five, per active minute. Corrected characters remain part of gross typing. Time starts with the first counted input; gaps contribute at most two seconds, so long thinking pauses stop the clock. The display waits for one measured second, refreshes twice a second while enabled, and marks idle measurements. Short bursts and IME input are not directly comparable with a standardized timed typing test.

Only trusted typing events in the qualified current composer count. Existing drafts, paste/drop, replacements, undo/redo and our programmatic citation insertion are excluded. IME intermediate replacements do not count; a trusted commit counts once. No message text or keystroke history is kept, stored or transmitted. Only the boolean preference is saved in `cursadex:preferences:v1`. Clearing the draft, changing chats, resetting or disabling clears the numeric measurement. Sending remains entirely native and user controlled.

`TypingMeasurement` owns numeric timing; `TypingInputSession` applies event policy; `ComposerTypingMeter` observes input without changing it. The host adapter owns the controls and qualifies composer identity. `UserPreferenceStore` is shared with future Settings consumers so toggles do not grow separate preference copies.

Run `node scripts/test-typing-meter.mjs`. It checks real Chromium typing, native editing-command injection exclusion, timing, undo, teardown and preferences, plus numeric policy for paste/drop and IME commits. Chrome's automated IME completion was observed as untrusted; the test verifies that it is ignored and releases composition state. The trusted-commit policy has a separate deterministic check. Actual Windows IME completion and live native composer behavior remain pending owner/native validation; the fixture is not claimed as end-to-end IME coverage.
