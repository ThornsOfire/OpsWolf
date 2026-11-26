# Publication OPSEC review

The main purpose of this required agent-operated publication review is preventing keys, credentials and other sensitive or private data from leaving the workspace. Deeper vulnerability audits are separate, need-based work. It complements GitHub secret scanning and the existing testing/deployment workflow. It is a procedural gate, not an installed Git hook, automatic scanner or claim of a comprehensive security audit. A passed review does not authorize a push or release.

## Scope and identity

Identify the intended repository, destination, staged files, outgoing refs/commit range and distribution artifacts before reviewing. Use the current checkpoint and applicable owner authorization. Distinguish a local experimental activation from publication; this gate does not add a full publication audit to every local visual iteration.

For an existing repository, establish the actual remote baseline rather than assuming `HEAD~1` or the current working-tree diff represents everything being sent. If the baseline is unavailable or uncertain, record that limit and resolve it before claiming the outgoing history is reviewed. For an initial publication, include all reachable history being published. Include tags or other refs when they are part of the proposed push. Never dump Git configuration or credentials to discover scope.

## Before commit: staged content

Review the exact index contents, including newly added files, rather than only working-tree changes. Check for:

- Credentials, tokens, private keys, authenticated URLs and sensitive configuration.
- Client documents, chat transcripts, screenshots, recordings, personal identifiers and local paths that disclose private information or make the project nonportable.
- App profiles/state, diagnostic logs, developer probes, native-source extracts, caches and generated artifacts accidentally selected for source publication.
- Binary, image, archive, symlink or submodule changes that an ordinary text diff does not adequately represent.

Use existing approved local scanning tools when available and appropriate; record tool/version, scope and outcome. Do not install tools or upload content to a scanning service without applicable authorization. Pattern searches alone are not proof of absence. Review visuals and archive contents through suitable approved inspection tools. An unavailable inspection or scan is a recorded limitation, not a pass.

Stage explicit files. Fix unintended inclusions in the proposed content without discarding unrelated owner work. Recheck the affected staged bytes after correction; do not broadly unstage or reset a working tree.

## Before push or artifact upload

Review every outgoing commit and newly published content, not just the final tree: a secret removed by a later commit remains in history. Include commit messages and author metadata where they could disclose unintended personal information. Inspect the exact packages, screenshots, reports and release text being published, including generated CI artifacts and logs. Source approval does not automatically approve an arbitrary package built from that source.

Before triggering a workflow that uploads artifacts, review its collection rules and log handling. After it runs, review the actual artifact before broader distribution or promotion; a post-upload review cannot prevent the initial disclosure. Public-repository review artifacts are not assumed private. Check the portable guide for the existing artifact boundaries and runtime privacy checks.

The owner reports GitHub secret scanning enabled. Record that as owner-reported unless settings were independently verified; do not infer push protection or bypass an alert. Local review also covers material that secret detectors do not recognize. Server-side scanning is additional coverage, not a substitute for controlling what leaves the machine.

## Separate, need-based code-security review

Use the appropriate available Codex Security skill for a deeper review when the owner requests it or a concrete change warrants it, such as changes to authentication, permissions, file/path access, command execution, downloads, plugin loading or sensitive logging. Scope that review to the relevant change and affected consumers. A full repository scan is not a routine commit requirement. Follow the selected skill and existing permissions; installing a plugin does not authorize cloud publication of findings or source. This separate review does not replace the sensitive-data publication gate.

## Findings and disposition

- Record findings with redacted descriptions and file/commit references. Do not reproduce secret values, client content or private screenshots in chat, public issues or reports destined for publication.
- Unresolved sensitive-data exposure or material security findings hold the affected publication. Continue independent preparation where useful. Missing evidence remains pending or blocked, with the precise limitation.
- Suspected exposed credentials require containment and an owner decision about revocation/rotation; deleting a line is not remediation. Do not rotate credentials, rewrite published history or force-push without explicit authorization.
- Separate false-positive findings from accepted limitations, and explain dispositions. Never silently waive an unperformed review or convert the existing experimental test waiver into an OPSEC waiver.

## Review record and final handoff

Keep a compact record in the existing ignored review/evidence directory; do not create a competing current plan. Record:

1. Repository and destination; exact index/tree identity or outgoing base/head/refs; package SHA-256 and size when applicable.
2. Reviewer, date, reviewed categories and tools used; automated checks versus manual inspection.
3. Findings and dispositions, unresolved coverage and relevant security checks.
4. Result: `clear within stated scope`, `findings`, `pending` or `blocked`. A limited review never establishes that all code is secure.
5. Owner publication authorization separately from the review result.

Bind approval preparation to the reviewed content. Before commit/push/upload, confirm the content/range/artifact identity has not changed; if it has, review the delta and refresh the record. Retain applicable unchanged evidence rather than repeating everything. Present the concrete result and limits to the owner before the final publication decision.

[Testing and CI](testing.md) · [Portable artifact review](portable-ci.md) · [Development workflow](development.md)
