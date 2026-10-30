# Optional Nova Fox Companion restore button

Fresh OpsWolf preferences show the fox logo in the file-tree header by default. Existing saved or legacy preferences retain their prior visibility; explicit disable stays disabled. Toggle **Nova Fox Companion restore button** in settings. New default Nova profiles register the restore link on their first normal launch when no handler already exists; existing Nova profiles still enable it separately in Nova settings. Captures and explicit test profiles never register automatically. These source changes require replacement builds; existing sealed builds remain unchanged. Clicking the logo asks before handing off the fixed `nova-fox-companion://show` URI to the operating system; no project path, chat, text, or credentials are sent.

Nova runs independently, also supports stock Codex, and can hide from its spirit controls. The Windows tray remains a restore option without this fork. The OpsWolf button does not track whether Nova is hidden/running, auto-install it, launch Codex, or access Nova’s memory. Browser/OS protocol permissions still apply. Unknown/unregistered handlers are handled by the host.

The button mounts only in the explorer’s owned header, shares its preference store, and releases listeners on genuine disconnection. It does not inspect native React state or alter chat ownership.

Source validation uses synthetic preference/controller fixtures and TypeScript checks. The fresh-preference behavior is included in the owner-used dev.5 build. It does not activate or update the standalone Nova app. Actual external-protocol restore with a registered Nova handler remains an owner integration check.
