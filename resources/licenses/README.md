# Additional portable distribution notices

The portable builder preserves the root LICENSE, THIRD_PARTY_LICENSES.txt and visual-effect notices, plus these package-specific texts:

| Distributed notice | Source and reason |
| --- | --- |
| Three.js 0.128.0 | [three-0.128.0-LICENSE.txt](three-0.128.0-LICENSE.txt), copied verbatim from the lockfile-pinned `three-ocean-r128` npm alias (`three`, version `0.128.0`). MIT, copyright 2010–2021 three.js authors. SHA-256 `7dddf7c5b8fd10ee654db8857d75d104b5557889aa5a91fc4ca545ea7c07062f`. The inherited generated inventory predates this Shallow Ocean dependency. |
| OpsWolf Code Rain | [Vendored renderer license](../../packages/explorer-ui/vendor/opswolf-code-rain/LICENSE). Preserve its Code-Codex and OpsWolf Code Rain contributor copyright notices; the root license alone does not replace this text. |

The [visual-effect notices](../../THIRD_PARTY_NOTICES_EN.md) remain authoritative about known provenance limits. The portable redistribution policy omits Cloud Train and Milky Way (unverified permission), Heavenly Cloud and Aurora Ionosphere (conditional permission without retained work-specific evidence). This is a packaging exclusion, not removal from the upstream catalog or a statement that user-initiated upstream downloads have been audited.

Preserving a license is necessary but does not establish the origin of every byte. Review changed dependencies and assets before a later release; do not mark unresolved permissions complete from an integrity check alone.
