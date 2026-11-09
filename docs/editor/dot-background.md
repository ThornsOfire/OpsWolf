# Dot chat over Code Rain

This source candidate covers the native embedded messaging surface used by Dot, including the inner chat-body backing missed by the initial three-wrapper policy. It still needs a separately reviewed build and live acceptance. Editing this source does not change an already running OpsWolf installation; the observed alpha.5 installation retains the earlier policy.

When Code Rain is running in the same document, the chat backing can let it show through while the text, composer and controls keep their normal appearance. Use the existing Code Rain enable/disable controls; this adds no separate window-opacity setting, saved preference or background process.

## What was qualified

Read-only inspection of the Windows host `26.1027.3384.0` found an active Dot page with the OpsWolf menu, the Rain owner marker and exactly one existing Rain layer/canvas in that document's body. The active default main surface already had a translucent mask. Three nested embedded-messaging backings were opaque and covered it. After alpha.5 activation those three backings cleared correctly, but read-only layout inspection and an owner-approved window capture identified an additional opaque direct inner body pane covering the same chat area.

The change belongs in the existing Rain native-surface stylesheet. It clears only four qualified backing roles beneath an active page, default main surface and main focus area, using this structural family:

```text
div.messaging-root.messaging-embedded
  > div.workspace
    > main.thread-pane
      > div.messaging-root.messaging-embedded
        > div.thread-pane
```

This is an adapter to an observed UI structure, not a public Dot styling API. It does not use a dot's name, conversation identifier, hashed CSS class or private framework state. Matching active embedded messaging surfaces receive the same treatment; the rule is not Dot-exclusive and does not claim that there can only be one matching surface. The additional body target is the direct semantic `div.thread-pane` child of the qualified inner messaging root; it does not depend on a `flex-1` utility class or select every `.thread-pane`. Unrelated ordinary Codex chats and unqualified layouts keep their existing styling.

An unrelated `main.bg-surface` was present elsewhere in the document but was not in the Dot ancestry. It is deliberately untouched. The default main mask, message cards, composer, menus, file-drop overlay, text opacity, focus, selection, pointer behavior and geometry retain their native rules. There is no global fade of the window or chat contents.

## Guards and cleanup

- Require the Rain owner marker and an actual owned Rain layer/canvas in the same body. Transparency alone cannot display a background from another document.
- Require the qualified active structural family and exclude cached inactive pages, including nested inactive ancestry and an inactive body target.
- Keep opaque native backings when forced colors or reduced transparency is requested, or when the structural/media capability is unsupported.
- Removing Rain ownership or replacing/removing the matching surface removes the effect through ordinary CSS matching. No new observer, timer, rendering loop or native-window hook is added.
- Preserve Rain's existing appearance lease, renderer budget, manual pause and inactive-window pause policy. This does not change blend persistence or performance behavior.

## Limits and verification

This is same-document backdrop treatment. It does not make a detached native window transparent, turn Rain into desktop wallpaper, create another renderer or modify the official host's binaries, resources, signing or permissions. Nova Fox is a separate application and is not involved.

The [focused test map](development.md#choose-checks-for-what-changed) includes `node scripts/test-rain-embedded-messaging-surfaces.mjs`. Its isolated public-DOM fixture exercises the actual production stylesheet, the realistic extra body wrapper, matching/malformed/inactive structures, accessibility and disabled-state restoration, native backings and interaction. The body regression must fail against the earlier three-wrapper stylesheet before it passes with the source repair. Synthetic screenshots are fixture evidence, not captures proving the candidate has been deployed to a real Dot page.

After an authorized deployment, live acceptance should check Rain-visible chat, readability, ordinary composer input/selection/scroll, navigation and disabling/restoring the background on the intended monitor/zoom layout. Keep those observations separate from fixture results and from the existing alpha.4 save failure. BUG-012's cross-theme editor transparency and F27's blend endpoint clarity are different work.

Official [Dot documentation](https://learn.chatgpt.com/docs/dots) describes character/name customization, and [Appearance settings](https://learn.chatgpt.com/docs/reference/settings) describes theme/color/font controls. The inspected pages do not establish an external Dot window-alpha API. The scope here follows the qualified existing OpsWolf UI appearance boundary rather than assuming such an API. Sources accessed 2026-10-31.
