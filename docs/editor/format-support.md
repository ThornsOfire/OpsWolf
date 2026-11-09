# Broader editor format support

Research/roadmap capture, 2026-10-31. Workspace feature **F39** reconciles the previously unnumbered future-work entries in [development](development.md). This is not an implementation plan or a promise that every format can be edited safely.

## What we want

Let people read and work on more kinds of files inside the editor, including spreadsheets. Keep three capabilities explicit for each format: viewing, editing, and saving back to the original format. A preview is useful without being a full editor. Unsupported operations need a clear explanation and an appropriate external-open fallback.

Structured Markdown table-cell editing belongs here too. Source-text editing of a Markdown table already exists; a cell/matrix editing surface would be a new capability. It must preserve the surrounding Markdown and avoid silently rewriting unrelated content.

## Existing evidence, not a live support claim

| Area | Evidence in this checkout | What remains unestablished |
| --- | --- | --- |
| Supported text files | Existing source editor and normal Preview / Edit / Save policy; see [user guide](README.md) | This request does not expand the native permission, encoding, size or conflict policy |
| Markdown tables | Rendered Markdown preview and editable source text | Dedicated cell editing and serialization back to source |
| CSV | Optional CSV preview definition and bounded table renderer | Package installed/enabled/compatible in a particular deployment; structured cell editing and round-trip save. Ordinary source editing, when allowed, is a different capability |
| XLSX spreadsheets | Optional Office preview definition and bounded worksheet rendering source | Installed/enabled/live-verified viewing; structured editing, recalculation and fidelity-preserving workbook save |
| DOCX / PPT / PPTX | Optional Office preview definitions and rendering source | Installed/enabled/live-verified viewing and genuine document/presentation editing and save |
| Other preview formats | Definitions also cover images, PDF, audio/video, diagrams, notebooks and models | Definition presence does not establish an editor integration, package availability or edit/save support; priorities still need selection |

Read-only source inspected: `packages/explorer-ui/src/core/configuration/explorer.ts` (`PREVIEWER_DEFINITIONS` and preview limits), `packages/explorer-ui/src/file-preview/csv-preview.ts`, and `packages/explorer-ui/src/file-preview/office-preview.ts`. These are existing optional preview paths, not newly implemented features. No package installation, enabling, document opening, runtime test or live setting inspection was performed for this review.

Office/XLSX and CSV renderers have explicit row/column/cell/text and resource budgets. A bounded rendered view is not a complete workbook model and must never become the source of a whole-file save. Formula display or cached values do not establish a calculation engine. File byte limits, DOM budgets, sheet limits and edit limits are separate constraints.

## Decisions before implementation

1. Choose the first formats and capability level. Spreadsheet viewing is a smaller request than editing a workbook. CSV cell editing, XLSX editing, Markdown cell editing and Office document editing need separate acceptance criteria; none is selected for implementation yet.
2. Define fidelity. For spreadsheets, decide how formulas, cached results/recalculation, styles, dates/types, multiple sheets, merged cells, charts and unsupported workbook content behave. Preserve unsupported content or explicitly refuse a destructive save. Do not execute macros, external links or embedded content implicitly.
3. Qualify the integration. Establish which verified preview packages are available, how the editor hosts them, and how failures/unsupported versions appear. Existing native plugins do not automatically supply an editable model.
4. Design save and recovery through the normal authenticated workspace bridge: dirty state, conflict checks, verified successful save, cancellation and original-file preservation. A partial view must never overwrite the complete document.
5. Check performance, accessibility and lifecycle with synthetic files: large/malformed inputs, cancellation, keyboard navigation, memory budgets and releasing readers/models when closed. Add dependencies only after separate approval and license/security review.

Browser, terminal and additional-chat transfer remain **F14** session/ownership work in [middle-page behavior](middle-pages.md) and [deeper feature notes](deeper-feature-design-notes.md). Language servers, completion and debugger integration are separate future scope. Neither is bundled into F39 as another file type.

No new format, full spreadsheet engine, implementation order, download or delivery date is promised. Next step, if authorized later: pick a bounded format/capability pair and investigate it before choosing an implementation.
