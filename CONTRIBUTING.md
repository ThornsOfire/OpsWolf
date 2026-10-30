# Working on OpsWolf

Keep changes understandable, keep the tests useful, and tell people what actually changed. We don't need a mountain of release machinery to do that ;3

Use the editor branch named in [README.md](README.md). Read the [project rules](AGENTS.md) and [development guide](docs/editor/development.md) for architecture, synthetic test fixtures, build/install differences and focused checks. Contributors should send proposed source changes to `feature/right-editor-pane` while it remains the implementation branch.

## Keeping the changelog useful

[CHANGELOG.md](CHANGELOG.md) is curated alongside the code. Git preserves exact implementation history; the changelog explains notable behavior changes to someone using the editor.

1. Add an entry under **Unreleased** in the same logical change as a user-facing feature/fix/removal. Use **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, or **Security** as appropriate; omit empty categories.
2. Describe the trigger and result in plain language. “Reopening Changes from hidden chat keeps the comparison selected” is more useful than “move sync call.” Combine related implementation commits into one entry.
3. Include important limits or migration steps. Don't add planned features, private examples, every test adjustment, or a claim that an unreleased development build is a published release.
4. Link useful existing commits/PRs when available. A new entry doesn't need a self-referencing commit link; Git history already contains that change.
5. Update the relevant guide when behavior, controls, defaults or storage changes. Review the staged diff and keep unrelated local files out of the commit.

For example:

```markdown
### Fixed

- Reopening Changes from hidden chat keeps the comparison selected instead of jumping to an old file.
```

## The lightweight check

No package installation is needed for these checks; they use Node's built-in APIs:

```powershell
node scripts/check-changelog.mjs
node --test scripts/test-changelog.mjs
```

The first command validates the working copy's headings, categories, entries and release dates. After committing, check the change range too:

```powershell
node scripts/check-changelog.mjs --base HEAD~1 --head HEAD
```

The range check reads the changelog from the two Git revisions, so staged/unstaged notes don't count until committed. Runtime paths must be accompanied by a change to the Unreleased notes, or a specific no-entry explanation in the final checked commit:

```text
Changelog: none - Refactor private parser helpers without changing behavior or limits.
```

Use that only when the checked range has no notable user-facing change. Docs/tests-only ranges don't need an entry or exemption. Runtime paths are a conservative heuristic; the check can't decide whether wording is complete or a behavior claim is true. It neither changes files nor generates/commits notes. Existing commit-title style remains fine.

The **Changelog** GitHub Actions workflow runs validation, checker tests and the range check for pull requests and pushes to `main`/the editor branch. A failed check reports a CI failure; branch protection is a separate repository setting and isn't installed by this workflow. No scheduled automation or release publishing is involved.

A new branch or manual run without a comparable base gets structural validation only. The normal PR/push path checks committed revisions; the initial import of this system doesn't retroactively demand an entry in every historical commit.

## Cutting a release later

When an actual release is authorized, choose its fork version deliberately, move the relevant Unreleased entries into a versioned section with its `YYYY-MM-DD` release date, and leave Unreleased at the top. Add a comparison link between release tags. Keep upstream 0.5.40 notes separate from fork releases.

Build/test the matching native and UI sources, verify assets and checksums, and use those notes for the release description. GitHub's generated PR notes can be a cross-check; review and edit them before publication. A changelog update alone must not tag, publish, merge, restart an app, or install anything.

## Credit and scope

OpsWolf is the public product default, formerly Cursadex. Keep existing repository URLs, technical filenames, storage/event keys and theme hooks compatible; visible branding is not a bulk technical rename. Retain the original project's license/credit and existing third-party notices. Report fork-specific behavior to this fork's maintainer. Keep examples portable and synthetic. There is no requirement to reproduce a maintainer's personal Desktop or application-data layout.
