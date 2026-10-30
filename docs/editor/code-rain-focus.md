# Pause Rain while the window is inactive

In Preview Market → Appearance → Code Rain → settings, **Pause when window is inactive** starts checked. Switching to another application/window freezes decorative Rain and its in-progress blend. Returning to the same window resumes from that point. A manual Pause remains paused after focus returns; Resume while inactive still waits for focus unless this option is unchecked.

Uncheck the option to keep Rain playing while the app window is inactive. Hidden/minimized, offscreen, reduced-motion and forced-color restrictions still apply independently. This controls Rain only, not chat work or other backgrounds. Moving focus between controls within the same window does not pause it.

Changing the option affects this session. **Save** explicitly saves it with the rain snapshot. Old saved settings that lack the option default to on; malformed saved values are rejected without overwriting storage. Failed saves keep the session preference and previous saved data. Focus and manual playback state are session-only. Reset current resets rain appearance/motion settings; it leaves this window preference alone.

The host adapter owns focus/blur/visibility listeners while Rain is enabled and removes them on disable/disposal. It does not poll or alter renderer/package bytes. Blur pauses the existing renderer rather than disabling Rain or releasing its appearance lease. The initial focus component used plugin 0.1.1 unchanged; the owner-used dev.5 host combines it with the separately reviewed 0.1.2 cadence update.

Evidence: synthetic window events and overridden document.hasFocus in isolated Chrome exercise the real host focus adapter/controller and pinned renderer. The production UI fixture uses explicit focus emulation. The owner confirmed that clicking away pauses Rain and removes the reported game impact in the dev.4 reproduction. Multi-window/minimize/restore, manual opt-out and persistence remain separate checks; this does not establish game performance under every workload. The focus component first shipped locally after dev.3; source-ready components cannot activate independently.
