import { WrappedLineNumbers } from "../features/preview/wrapped-line-numbers";
import {EditorCitations} from '../features/preview/editor-citations';
let nextInstanceId = 0;
// Domain extracted from the original explorer composition; behavior and storage contracts retained.
import type { ParsedPresentation } from "@extend-ai/react-pptx";
import type JSZip from "jszip";
import type { Box3,Object3D } from "three";
import { activePageElements,MAIN_SURFACE_SELECTOR } from "../adapters/codex-26.715";
import { usesClippedMainLayout } from "../adapters/codex-layout-version";
import { getBootstrapConfig } from "../bridge";
import { CODE_MINIMAP_PREFERENCE,CodeMinimap,codeMinimapStyles } from "../code-minimap";
import { mainPreviewStyles } from "../components/styles/main-preview";
import { EditorHeaderControl } from "../features/preview/editor-header-control";
import { EDITOR_PANE_KEY, EditorPaneLayout, nativeHeaderInset, readEditorPanePreference } from "../features/preview/editor-pane";
import { INLINE_TEXT_BYTES } from "../core/preview/text-configuration";
import { LargeTextReader,largeTextStyles } from "../features/preview/large-text-reader";
import { MAX_PREVIEW_TEXT_UNITS } from "../core/configuration/explorer";
import { CONVERSATION_ICON,CSV_PREVIEWER_ID,DIAGRAM_PREVIEWER_ID,MAIN_PREVIEW_ACTIVATE_EVENT,MAIN_PREVIEW_CLOSE_EVENT,MAIN_PREVIEW_DRAFT_EVENT,MAIN_PREVIEW_RELOAD_EVENT,MAIN_PREVIEW_SAVE_EVENT,MAIN_PREVIEW_TAG,MARKDOWN_PREVIEWER_ID } from "../core/preview/configuration";
import { cloneView,firstVisibleLineOffset,formatBytes,isCsvPreviewPath,isDiagramPreviewPath,isMarkdownPreviewPath,isMediaPreviewView,normalizeState,officeDocumentKind,previewerIdForMediaKind,previewMethod,previewPackageId,restoreAttribute,selectionOffsetWithin,sourceLineCount,textPositionAtOffset,unsupportedCopy } from "../features/preview/view-state";
import type { DiagramPreviewJob,DocxBlockSplitResult,DocxPaginationClock,FocusSnapshot,MainPreviewActivateDetail,MainPreviewActivateEvent,MainPreviewCloseDetail,MainPreviewCloseEvent,MainPreviewDraftDetail,MainPreviewDraftEvent,MainPreviewEditorState,MainPreviewEmptyView,MainPreviewFileView,MainPreviewGitDiffView,MainPreviewMediaView,MainPreviewModelView,MainPreviewPathDetail,MainPreviewReloadEvent,MainPreviewSaveEvent,MainPreviewState,MainPreviewTextView,ModelMemoryCacheScope,ModelPreviewJob,ModelPreviewSourceInspection,NotebookCellModel,NotebookMimeBundle,NotebookModel,NotebookOutputModel,NotebookPreviewJob,NotebookRenderBudget,OfficeDomBudget,OfficePreviewJob,ParsedXlsxWorksheet,PdfPreviewJob,SuppressedAttributes,XlsxSharedStrings,XlsxStyleTable,XlsxWorksheetMeta } from "../file-preview/contracts";
import { localizeOwnedUi } from "../i18n";
import { getFileIcon,icons } from "../icons";
import { ensurePluginPackage,isPluginPackageLoaded } from "../plugin-runtime";
import { runtimeEvent } from "../runtime-events";
import { SURFACE_OPACITY_PREVIEW_CSS } from "../surface-opacity";
import { highlightSyntaxForPath,type SyntaxHighlight } from "../syntax-highlight";

export type { CsvModel,DiagramPoint,DiagramPreviewJob,DiagramSourceKind,DiagramSvgBudget,DocxBlockSplitResult,DocxPaginationClock,DrawioCellGeometry,DrawioEdge,DrawioPageSource,DrawioVertex,FocusSnapshot,MainPreviewActivateDetail,MainPreviewActivateEvent,MainPreviewCloseDetail,MainPreviewCloseEvent,MainPreviewDraftDetail,MainPreviewDraftEvent,MainPreviewEditorState,MainPreviewEmptyView,MainPreviewErrorView,MainPreviewFileBase,MainPreviewFileView,MainPreviewGitDiffView,MainPreviewLineEnding,MainPreviewLoadingView,MainPreviewMediaView,MainPreviewModelResource,MainPreviewModelView,MainPreviewPathDetail,MainPreviewReloadEvent,MainPreviewSaveEvent,MainPreviewState,MainPreviewTextView,MainPreviewUnavailableReason,MainPreviewUnsupportedView,ModelPreviewJob,ModelPreviewSourceInspection,NotebookCellModel,NotebookMimeBundle,NotebookModel,NotebookOutputModel,NotebookParseBudget,NotebookPreviewJob,NotebookRenderBudget,OfficeDocumentKind,OfficeDomBudget,OfficePreviewJob,ParsedXlsxWorksheet,PdfPreviewJob,PlantActivityModel,PlantActivityStatement,PlantActivityTheme,PlantBlockLayout,PlantLayoutEdge,PlantLayoutNode,PlantLayoutNodeKind,SuppressedAttributes,XlsxCellStyle,XlsxPreviewCell,XlsxRange,XlsxSharedStrings,XlsxStyleTable,XlsxWorksheetMeta } from "../file-preview/contracts";


/** The shell owns tabs, safe source inspection, editor drafts, and generations.
 * Downloaded first-party viewers operate against this explicit internal context.
 * _ fields are a plugin ABI, not a file-access or permission boundary. */
export class CodeCodexMainPreviewElement extends HTMLElement {
  readonly _previewLoads = new Set<string>();
  readonly _previewLoadFailures = new Map<string, string>();
  readonly _onPluginLoaded = (event: Event): void => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (!id?.endsWith('-preview')) return;
    this._previewLoadFailures.delete(id);
    if (this._connected && this._state.activePath !== null) this._render();
  };
  readonly _shadow: ShadowRoot;

  readonly _tabList: HTMLElement;

  readonly _panelMount: HTMLElement;

  readonly _instanceId = ++nextInstanceId;

  readonly _tabIds = new Map<string, string>();

  readonly _suppressedChildren = new Map<Element, SuppressedAttributes>();

  readonly _syntaxCache = new Map<string, { source: string; highlight: SyntaxHighlight }>();

  _codeMinimap: CodeMinimap | null = null;
  _largeTextReader: LargeTextReader | null = null;
  _largeMarkdownKey: string | undefined;
  _draftPreviewPath: string | undefined;

  _minimapEnabled = true;
  readonly _editorPane = new EditorPaneLayout(this);
  readonly _editorHeader: EditorHeaderControl;
  readonly _citationUi:EditorCitations;
  _wrappedLineNumbers: WrappedLineNumbers | null = null;
  _wordWrap = false;
  _editorVisible = false;
  _panePreference = { docked: true, width: 560 };
  _paneResizeCleanup: (() => void) | undefined;
  _draggedTabPath: string | undefined;
  readonly _openFilesMenu: HTMLElement;

  readonly _mediaObjectUrls = new Map<string, {
    readonly bytes: Uint8Array;
    readonly mimeType: string;
    readonly url: string;
    readonly revoke: () => void;
  }>();

  _pdfGeneration = 0;

  _pdfJob: PdfPreviewJob | null = null;

  _notebookGeneration = 0;

  _notebookJob: NotebookPreviewJob | null = null;

  _officeGeneration = 0;

  _officeJob: OfficePreviewJob | null = null;

  _diagramGeneration = 0;

  _diagramJob: DiagramPreviewJob | null = null;

  _modelGeneration = 0;

  _modelJob: ModelPreviewJob | null = null;

  _state: MainPreviewState = { activePath: null, tabs: [] };

  _rovingPath: string | null = null;

  _nextTabId = 0;

  _connected = false;

  _reparenting = false;

  _suspended = false;

  _suppressedParent: Element | null = null;

  _childObserver: MutationObserver | null = null;

  _nativeTitleObserver: MutationObserver | null = null;

  _nativeTitleObserverRoot: Element | null = null;

  _nativeViewportObserver: ResizeObserver | null = null;

  _observedNativeViewport: HTMLElement | null = null;

  _conversationTitle = "Conversation";

  readonly _clippedLayout: boolean;

  constructor() {
    super();
    try { this._panePreference = readEditorPanePreference(this.ownerDocument.defaultView!.localStorage); } catch { /* Storage may be unavailable. */ }
    try { this._minimapEnabled = this.ownerDocument.defaultView?.localStorage.getItem(CODE_MINIMAP_PREFERENCE) !== "false"; }
    catch { runtimeEvent("code-minimap", "preference read", "unavailable"); }
    try { this._wordWrap=this.ownerDocument.defaultView?.localStorage.getItem('code-codex:word-wrap:v1')==='true'; } catch { /* Storage may be unavailable. */ }
    const bootstrap = getBootstrapConfig();
    this._clippedLayout = usesClippedMainLayout(bootstrap.codexVersion ?? bootstrap.version);
    this._shadow = this.attachShadow({ mode: "open" });
    this._shadow.innerHTML = `
      <style>${mainPreviewStyles}${SURFACE_OPACITY_PREVIEW_CSS}${codeMinimapStyles}</style>
      <div class="surface">
        <div class="editor-pane-actions">
          <button type="button" class="tab-pin-toggle" title="Pin this file for this project" aria-pressed="false">Pin</button>
          <button type="button" class="open-files-toggle" popovertarget="open-files-menu" popovertargetaction="toggle" title="All open files" aria-label="All open files" aria-haspopup="menu" aria-expanded="false">▾</button>
          <button type="button" class="editor-pane-toggle" title="Toggle editor pane layout" aria-label="Editor pane" aria-pressed="false">E</button>
          <button type="button" class="word-wrap-toggle" title="Enable word wrap" aria-label="Enable word wrap" aria-pressed="false"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2 3h12M2 7h9a3 3 0 0 1 0 6H8m2-2-2 2 2 2M2 11h3"/></svg></button>
          <button type="button" class="editor-fullscreen-toggle" title="Expand editor" aria-label="Expand editor" aria-pressed="false"></button>
          <button type="button" class="editor-pane-close" title="Close all unpinned tabs" aria-label="Close all unpinned tabs">×</button>
        </div>
        <div class="editor-pane-resizer" role="separator" aria-label="Editor pane width" aria-orientation="vertical" tabindex="0"></div>
        <div class="tab-strip" role="tablist" aria-label="Conversation and file previews"></div>
        <div class="panel-mount"></div>
      </div>
      <div id="open-files-menu" class="open-files-menu" popover="auto" role="menu" aria-label="Open files"></div>
    `;
    this._editorHeader=new EditorHeaderControl(this,this._required<HTMLButtonElement>(".editor-pane-toggle"));
    this._tabList = this._required<HTMLElement>(".tab-strip");
    this._panelMount = this._required<HTMLElement>(".panel-mount");
    const citationOwner=this;
    this._citationUi=new EditorCitations({element:this,shadow:this._shadow,panel:this._panelMount,get state(){return citationOwner._state;},get reader(){return citationOwner._largeTextReader;},renderSource:()=>this._renderPanel()});
    this._openFilesMenu = this._required('.open-files-menu');
    this._openFilesMenu.addEventListener('beforetoggle', event => {
      if((event as ToggleEvent).newState==='open') this._prepareOpenFilesMenu();
    });
    this._openFilesMenu.addEventListener('toggle', () => {
      this._required('.open-files-toggle').setAttribute('aria-expanded', String(this._openFilesMenu.matches(':popover-open')));
    });
    this._openFilesMenu.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...this._openFilesMenu.querySelectorAll<HTMLButtonElement>('.open-file-item')];
      if (!items.length) return;
      const index = items.indexOf(this._shadow.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    this._required('.tab-pin-toggle').addEventListener('click', () => {
      if (this._state.activePath) this._dispatchPathEvent('cle-main-preview-pin', { path: this._state.activePath });
    });
    this._tabList.addEventListener('wheel', event => {
      if (event.ctrlKey || event.metaKey || this._tabList.scrollWidth <= this._tabList.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      this._tabList.scrollLeft += delta * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? this._tabList.clientWidth : 1);
      event.preventDefault();
    }, { passive: false });
    this._tabList.addEventListener('dragstart', event => this._startTabDrag(event));
    this._tabList.addEventListener('dragover', event => this._overTabDrag(event));
    this._tabList.addEventListener('drop', event => this._dropTabDrag(event));
    this._tabList.addEventListener('dragend', () => this._clearTabDrag());
    this._required('.editor-pane-toggle').addEventListener('click', () => {
      this._setEditorVisible(!this._editorVisible);
    });
    this._required('.editor-fullscreen-toggle').addEventListener('click', () => {
      this._panePreference.docked = !this._panePreference.docked;
      this._savePanePreference();this._syncSuppression();
    });
    this._required('.editor-pane-close').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('cle-main-preview-close-all',{bubbles:true,composed:true}));
    });
    this._required('.word-wrap-toggle').addEventListener('click', () => {
      this._wordWrap=!this._wordWrap;this._syncWordWrap();
      try { this.ownerDocument.defaultView?.localStorage.setItem('code-codex:word-wrap:v1',String(this._wordWrap)); } catch { /* Preference remains active for this session. */ }
    });
    const resizeHandle = this._required<HTMLElement>('.editor-pane-resizer');
    resizeHandle.addEventListener('pointerdown', (event) => this._resizePane(event));
    resizeHandle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      this._panePreference.width = Math.max(260, Math.min(1200, this._panePreference.width + (event.key === 'ArrowLeft' ? 20 : -20)));
      this._savePanePreference(); this._syncSuppression();
    });
    this._tabList.addEventListener("click", (event) => this._onTabListClick(event));
    this._tabList.addEventListener("keydown", (event) => this._onTabListKeyDown(event));
    this._shadow.addEventListener("keydown", (event) => this._onShadowKeyDown(event as KeyboardEvent));
    // Host attributes must wait until connection: createElement validates the constructor.
  }

  _languageCleanup: (() => void) | undefined;

  connectedCallback(): void {
    if (this._connected) return;
    this._connected = true;
    this._citationUi.start();
    this._languageCleanup = localizeOwnedUi(this._shadow);
    this.ownerDocument.defaultView?.addEventListener("code-codex:plugin-loaded", this._onPluginLoaded);
    if (this._clippedLayout) this.dataset.clippedLayout = "true";
    this._render();
    this._syncWordWrap();
    this._syncSuppression();
    queueMicrotask(() => {
      if (this._connected) this._scrollSelectedTabIntoView();
    });
  }

  disconnectedCallback(): void {
    if (this._reparenting) return;
    setTimeout(() => {
      if (!this.isConnected) this._disposeDisconnected();
    }, 0);
  }

  _disposeDisconnected(): void {
    this._citationUi.dispose();
    if (this._openFilesMenu.matches(':popover-open')) this._openFilesMenu.hidePopover();
    this._clearTabDrag();
    this._paneResizeCleanup?.();
    this._editorHeader.dispose();
    this._editorPane.restore();
    this._languageCleanup?.();this._languageCleanup = undefined;
    this._connected = false;
    this._wrappedLineNumbers?.dispose();this._wrappedLineNumbers=null;
    this._largeTextReader?.dispose();
    this._largeTextReader = null;
    this._codeMinimap?.dispose();
    this._codeMinimap = null;
    this.ownerDocument.defaultView?.removeEventListener("code-codex:plugin-loaded", this._onPluginLoaded);
    this._cancelPdfPreview();
    this._cancelNotebookPreview();
    this._cancelOfficePreview();
    this._cancelDiagramPreview();
    this._cancelModelPreview();
    this._syntaxCache.clear();
    this._revokeAllMediaObjectUrls();
    this._panelMount.replaceChildren();
    this._restoreSuppressedChildren();
    this._nativeTitleObserver?.disconnect();
    this._nativeTitleObserver = null;
    this._nativeTitleObserverRoot = null;
    this._nativeViewportObserver?.disconnect();
    this._nativeViewportObserver = null;
    this._observedNativeViewport = null;
  }

  setSuspended(suspended: boolean): void {
    this._suspended = suspended;
    this._codeMinimap?.setSuspended(suspended);
    this.toggleAttribute("data-home-suspended", suspended);
    this._syncSuppression();
  }

  reparent(parent: Element): void {
    if (this.parentElement === parent) return;
    this._restoreSuppressedChildren();
    this._reparenting = true;
    try {
      parent.append(this);
    } finally {
      this._reparenting = false;
    }
    this._syncSuppression();
  }

  get state(): MainPreviewState {
    const editor = this._state.editor;
    return {
      activePath: this._state.activePath,
      tabs: this._state.tabs.map((view) => cloneView(view)),
      enabledPreviewers: [...(this._state.enabledPreviewers ?? [])],
      ...(this._state.citations?{citations:{revision:this._state.citations.revision,ranges:this._state.citations.ranges.map(c=>({...c}))}}:{}),
      ...(editor
        ? {
          editor: {
            path: editor.path,
            draft: editor.draft,
            saving: editor.saving,
            ...(editor.error === undefined ? {} : { error: editor.error }),
          },
        }
        : {}),
    };
  }

  set state(state: MainPreviewState) {
    this.setState(state);
  }

  setState(state: MainPreviewState): void {
    const nextState = normalizeState(state);
    if(nextState.activePath!==this._state.activePath) {
      if(nextState.activePath!==null) this._editorVisible=true;
      else if(nextState.tabs.length>0) this._editorVisible=false;
    }
    const previousEditorPath = this._state.editor?.path ?? null;
    const nextEditorPath = nextState.editor?.path ?? null;
    const editorTransition = nextEditorPath !== previousEditorPath;
    if(editorTransition) this._draftPreviewPath=undefined;
    const enteringEditor = nextEditorPath !== null && nextEditorPath !== previousEditorPath;
    const preserveActiveViewport = nextState.activePath !== null && nextState.activePath === this._state.activePath;
    const readerViewport = editorTransition || preserveActiveViewport
      ? (() => {
        const scroller = this._panelMount.querySelector<HTMLElement>(".code-editor") ??
          this._panelMount.querySelector<HTMLElement>(".preview-content");
        return {
          scrollTop: scroller?.scrollTop ?? 0,
          scrollLeft: scroller?.scrollLeft ?? 0,
        };
      })()
      : undefined;
    const retainedPaths = new Set(nextState.tabs.map((view) => view.path));
    for (const path of this._tabIds.keys()) {
      if (!retainedPaths.has(path)) this._tabIds.delete(path);
    }
    for (const path of this._syntaxCache.keys()) {
      const view = nextState.tabs.find((candidate) => candidate.path === path);
      const cached = this._syntaxCache.get(path);
      if (view?.kind !== "text" || cached?.source !== view.text) this._syntaxCache.delete(path);
    }
    this._reconcileMediaObjectUrls(nextState);
    const activeChanged = nextState.activePath !== this._state.activePath;
    if(activeChanged&&this._openFilesMenu.matches(':popover-open'))this._openFilesMenu.hidePopover();
    const rovingStillExists = this._rovingPath === null || nextState.tabs.some((view) => view.path === this._rovingPath);
    this._state = nextState;
    if (activeChanged || !rovingStillExists) this._rovingPath = nextState.activePath;
    this._render();
    this._syncSuppression();
    if (readerViewport) {
      queueMicrotask(() => {
        if (this._connected && this._state.activePath === nextState.activePath) {
          const previewContent = this._panelMount.querySelector<HTMLElement>(".preview-content");
          const markdownEditor = this._panelMount.querySelector<HTMLElement>(".markdown-editor-surface");
          if (markdownEditor) {
            if (previewContent) {
              previewContent.scrollTop = readerViewport.scrollTop;
              previewContent.scrollLeft = readerViewport.scrollLeft;
            }
            return;
          }
          const editor = this._panelMount.querySelector<HTMLTextAreaElement>(".code-editor");
          if (editor) {
            if (enteringEditor) {
              const computed = getComputedStyle(editor);
              const lineHeight = Number.parseFloat(computed.lineHeight);
              const paddingTop = Number.parseFloat(computed.paddingTop);
              const caret = firstVisibleLineOffset(
                editor.value,
                readerViewport.scrollTop,
                Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 20.25,
                Number.isFinite(paddingTop) ? paddingTop : 20,
              );
              editor.setSelectionRange(caret, caret);
              editor.focus({ preventScroll: true });
            }
            editor.scrollTop = readerViewport.scrollTop;
            editor.scrollLeft = readerViewport.scrollLeft;
            this._syncEditorScroll(editor);
            return;
          }
          if (previewContent) {
            previewContent.scrollTop = readerViewport.scrollTop;
            previewContent.scrollLeft = readerViewport.scrollLeft;
          }
        }
      });
    }
  }

  _syncWordWrap(): void {
    this.toggleAttribute('data-word-wrap',this._wordWrap);
    const toggle=this._required<HTMLButtonElement>('.word-wrap-toggle');
    toggle.setAttribute('aria-pressed',String(this._wordWrap));
    toggle.title=this._wordWrap?'Disable word wrap':'Enable word wrap';toggle.setAttribute('aria-label',toggle.title);
    const textarea=this._panelMount.querySelector<HTMLTextAreaElement>('.code-editor');
    if(textarea){textarea.wrap=this._wordWrap?'soft':'off';if(this._wordWrap)textarea.scrollLeft=0;this._syncEditorScroll(textarea);}
    this._codeMinimap?.setEnabled(this._minimapEnabled&&!this._wordWrap);
    const minimap=this._panelMount.querySelector<HTMLButtonElement>('.minimap-toggle');
    if(minimap)minimap.disabled=this._wordWrap;
    this._largeTextReader?.setWordWrap(this._wordWrap);
    const source=textarea??this._panelMount.querySelector<HTMLElement>('.literal-text');
    const gutter=this._panelMount.querySelector<HTMLElement>('.code-line-numbers');
    if(this._wordWrap&&source&&gutter){
      if(!this._wrappedLineNumbers)this._wrappedLineNumbers=new WrappedLineNumbers(source,gutter,()=>textarea?.value??source.textContent??'');
      this._wrappedLineNumbers.update();
    } else if(this._wrappedLineNumbers){
      this._wrappedLineNumbers.dispose();this._wrappedLineNumbers=null;
      if(source&&gutter)this._replaceLineNumbers(gutter,source.parentElement!,textarea?.value??source.textContent??'');
    }
  }

  showEditor(): void { this._setEditorVisible(true); }

  nativeDiffSurface():HTMLElement|undefined {
    if(!this._connected||this._suspended||!this._editorVisible)return;
    return this._panelMount.querySelector<HTMLElement>('.native-diff-mount')??undefined;
  }

  _setEditorVisible(open:boolean):void {
    this._editorVisible=open;
    if(!open && this._openFilesMenu.matches(':popover-open')) this._openFilesMenu.hidePopover();
    if(open && this._state.activePath===null && this._state.tabs[0]) {
      this._dispatchActivate({kind:'file',path:this._state.tabs[0].path});
    }
    // Visibility changes leave the active file, draft, and tab collection intact.
    if(this._state.activePath===null) this._renderPanel();
    this._syncSuppression();
  }

  _render(): void {
    const focus = this._captureFocus();
    this.toggleAttribute("data-has-files", this._state.tabs.length > 0);
    this.toggleAttribute("data-file-active", this._state.activePath !== null);
    this.toggleAttribute("data-editing", Boolean(this._state.editor));
    this._renderTabs();
    this._renderPanel();
    this._restoreFocus(focus);
    this._scrollSelectedTabIntoView();
  }

  _renderTabs(): void {
    const fragment = this.ownerDocument.createDocumentFragment();
    const conversationSlot = this.ownerDocument.createElement("div");
    conversationSlot.className = `tab-slot conversation${this._state.activePath === null ? " active" : ""}`;

    const conversationTab = this.ownerDocument.createElement("button");
    conversationTab.type = "button";
    conversationTab.className = "preview-tab";
    conversationTab.id = `cle-main-preview-${this._instanceId}-conversation-tab`;
    conversationTab.setAttribute("role", "tab");
    conversationTab.setAttribute("aria-selected", String(this._state.activePath === null));
    conversationTab.tabIndex = this._rovingPath === null ? 0 : -1;
    conversationTab.dataset.tabKind = "conversation";
    conversationTab.title = this._conversationTitle;
    conversationTab.append(this._staticIcon(CONVERSATION_ICON, "tab-icon"), this._textSpan(this._conversationTitle, "tab-label"));
    conversationSlot.append(conversationTab);
    fragment.append(conversationSlot);

    for (const view of this._state.tabs) {
      const slot = this.ownerDocument.createElement("div");
      const active = view.path === this._state.activePath;
      slot.className = `tab-slot file${active ? " active" : ""}`;
      slot.dataset.path = view.path;
      slot.draggable = true;

      const tab = this.ownerDocument.createElement("button");
      tab.type = "button";
      tab.className = "preview-tab";
      tab.id = this._tabId(view.path);
      tab.title = view.path;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(active));
      tab.setAttribute("aria-controls", this._panelId(view.path));
      tab.tabIndex = this._rovingPath === view.path ? 0 : -1;
      tab.dataset.tabKind = "file";
      tab.dataset.path = view.path;
      tab.append(this._staticIcon(getFileIcon(view.name).markup, "tab-icon"), this._textSpan(view.name, "tab-label"));
      if (this._state.pinnedPaths?.includes(view.path)) tab.prepend(this._textSpan('◆', 'tab-pin-mark'));

      const close = this.ownerDocument.createElement("button");
      close.type = "button";
      close.className = "tab-close";
      close.title = `Close ${view.name}`;
      close.setAttribute("aria-label", `Close ${view.name}`);
      close.dataset.closePath = view.path;
      close.innerHTML = icons.close;
      slot.append(tab, close);
      fragment.append(slot);
    }

    this._tabList.replaceChildren(fragment);
    const pin = this._required<HTMLButtonElement>('.tab-pin-toggle');
    const pinned = this._state.activePath !== null && this._state.pinnedPaths?.includes(this._state.activePath) === true;
    pin.disabled = this._state.activePath === null || this._state.activePath.startsWith('git-diff://') || this._state.activePath.startsWith('review-diff://') || this._state.activePath.startsWith('native-diff://');
    pin.textContent = pinned ? 'Unpin' : 'Pin';
    pin.title = pinned ? 'Unpin this file (keep it open)' : 'Reopen this file when returning to this project';
    pin.setAttribute('aria-pressed', String(pinned));
    this._required<HTMLButtonElement>('.editor-pane-close').disabled=this._state.tabs.every(tab=>this._state.pinnedPaths?.includes(tab.path))||this._state.editor?.saving===true;
    this._required('.open-files-toggle').setAttribute('aria-label', `All open files (${this._state.tabs.length})`);
    if (this._openFilesMenu.matches(':popover-open')) this._renderOpenFilesMenu();
  }

  _renderOpenFilesMenu(): void {
    const fragment = this.ownerDocument.createDocumentFragment();
    for (const view of this._state.tabs) {
      const button = this.ownerDocument.createElement('button');
      button.type = 'button'; button.className = 'open-file-item';
      button.dataset.path = view.path;
      button.setAttribute('role', 'menuitemradio');
      button.setAttribute('aria-checked', String(view.path === this._state.activePath));
      button.textContent = `${this._state.pinnedPaths?.includes(view.path) ? '◆ ' : ''}${view.path}`;
      button.title = view.path;
      button.addEventListener('click', () => {
        if (this._dispatchActivate({ kind: 'file', path: view.path })) this._openFilesMenu.hidePopover();
      });
      fragment.append(button);
    }
    this._openFilesMenu.replaceChildren(fragment);
  }

  _prepareOpenFilesMenu(): void {
    this._renderOpenFilesMenu();
    const rect = this._required('.open-files-toggle').getBoundingClientRect();
    this._openFilesMenu.style.top = `${rect.bottom + 4}px`;
    this._openFilesMenu.style.right = `${Math.max(4, this.ownerDocument.documentElement.clientWidth - rect.right)}px`;
  }

  _startTabDrag(event: DragEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const slot = target?.closest<HTMLElement>('.tab-slot.file');
    if (!slot?.dataset.path || target?.closest('.tab-close')) { event.preventDefault(); return; }
    this._draggedTabPath = slot.dataset.path;
    slot.classList.add('dragging');
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', slot.dataset.path); }
    event.stopPropagation();
  }

  _tabDropTarget(event: DragEvent): { slot: HTMLElement; after: boolean } | undefined {
    const target = event.target instanceof Element ? event.target : null;
    const slot = target?.closest<HTMLElement>('.tab-slot.file') ?? this._tabList.querySelector<HTMLElement>('.tab-slot.file:last-child');
    if (!slot || !this._tabList.contains(slot)) return;
    const rect = slot.getBoundingClientRect();
    return { slot, after: event.clientX > rect.left + rect.width / 2 };
  }

  _overTabDrag(event: DragEvent): void {
    if (!this._draggedTabPath) return;
    event.preventDefault(); event.stopPropagation();
    const rect = this._tabList.getBoundingClientRect();
    if (event.clientX < rect.left + 30) this._tabList.scrollLeft -= 28;
    if (event.clientX > rect.right - 30) this._tabList.scrollLeft += 28;
    for (const slot of this._tabList.querySelectorAll('[data-tab-drop]')) slot.removeAttribute('data-tab-drop');
    const drop = this._tabDropTarget(event);
    if (drop && drop.slot.dataset.path !== this._draggedTabPath) drop.slot.dataset.tabDrop = drop.after ? 'after' : 'before';
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  _dropTabDrag(event: DragEvent): void {
    if (!this._draggedTabPath) return;
    event.preventDefault(); event.stopPropagation();
    const path = this._draggedTabPath, drop = this._tabDropTarget(event);
    this._clearTabDrag();
    if (drop?.slot.dataset.path) this._dispatchPathEvent('cle-main-preview-reorder', { path, targetPath: drop.slot.dataset.path, after: drop.after });
  }

  _clearTabDrag(): void {
    this._draggedTabPath = undefined;
    for (const slot of this._tabList.querySelectorAll('.dragging,[data-tab-drop]')) { slot.classList.remove('dragging'); slot.removeAttribute('data-tab-drop'); }
  }

  _renderPanel(): void {
    this._citationUi.closeMenu();
    this._citationUi.refresh();
    this._wrappedLineNumbers?.dispose();this._wrappedLineNumbers=null;
    this._largeTextReader?.dispose();
    this._largeTextReader = null;
    this._codeMinimap?.dispose();
    this._codeMinimap = null;
    this._cancelPdfPreview();
    this._cancelNotebookPreview();
    this._cancelOfficePreview();
    this._cancelDiagramPreview();
    this._cancelModelPreview();
    this.removeAttribute('data-native-diff-active');
    if (this._state.activePath === null) {
      if(this._editorVisible) {
        const empty=this.ownerDocument.createElement('div');empty.className='editor-empty';
        empty.textContent='Open a file from the explorer to start editing.';
        this._panelMount.replaceChildren(empty);
      } else this._panelMount.replaceChildren();
      return;
    }

    let view = this._state.tabs.find((candidate) => candidate.path === this._state.activePath);
    if (!view) {
      this._panelMount.replaceChildren();
      return;
    }

    if(view.kind==='native-diff'){
      this.setAttribute('data-native-diff-active','');
      const mount=this.ownerDocument.createElement('div');mount.className='native-diff-mount';
      mount.style.cssText='height:100%;width:100%;min-height:0;background:var(--cle-main-bg);pointer-events:none';
      mount.dataset.threadId=view.threadId;mount.id=this._panelId(view.path);mount.tabIndex=-1;
      mount.setAttribute('role','tabpanel');mount.setAttribute('aria-labelledby',this._tabId(view.path));mount.setAttribute('aria-label','Native Changes comparison');
      this._panelMount.replaceChildren(mount);return;
    }

    const panel = this.ownerDocument.createElement("section");
    panel.className = "preview-panel";
    panel.id = this._panelId(view.path);
    panel.tabIndex = 0;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", this._tabId(view.path));
    if (view.kind === "loading") panel.setAttribute("aria-busy", "true");

    const metaBar = this.ownerDocument.createElement("header");
    metaBar.className = "preview-meta-bar";
    metaBar.append(this._staticIcon(getFileIcon(view.name).markup, "panel-icon"));
    const displayPath = view.kind === "git-diff" ? view.sourcePath : view.path;
    const location = this._textSpan(displayPath, "preview-location");
    location.title = displayPath;
    const draftEditor = this._state.editor?.path === view.path ? this._state.editor : undefined;
    const editor = this._draftPreviewPath === view.path ? undefined : draftEditor;
    if(draftEditor && !editor && (view.kind==='text'||view.kind==='empty')) {
      view={...view,kind:'text',text:draftEditor.draft,sizeBytes:new TextEncoder().encode(draftEditor.draft).length,truncated:false};
    }
    const markdownPreview = view.kind === "text" &&
      !this._citationUi.requiresSource() &&
      this._state.enabledPreviewers?.includes(MARKDOWN_PREVIEWER_ID) === true &&
      isMarkdownPreviewPath(view.path) &&
      !editor;
    const csvPreview = (view.kind === "text" || view.kind === "empty") &&
      !this._citationUi.requiresSource() &&
      this._state.enabledPreviewers?.includes(CSV_PREVIEWER_ID) === true &&
      isCsvPreviewPath(view.path) &&
      !editor;
    const diagramPreview = (view.kind === "text" || view.kind === "empty") &&
      !this._citationUi.requiresSource() &&
      this._state.enabledPreviewers?.includes(DIAGRAM_PREVIEWER_ID) === true &&
      isDiagramPreviewPath(view.path) &&
      !editor;
    const metadata = `${view.kind === "text" && view.sizeBytes > INLINE_TEXT_BYTES ? this._largeMarkdownKey === `${view.path}\0${view.version}` ? "Large file · rendered · read only · " : "Large file · plain text · read only · " : markdownPreview ? "Markdown preview · " : csvPreview ? "CSV preview · " : diagramPreview ? "Diagram preview · " : ""}${this._metadataFor(view)}`;
    metaBar.append(location, this._textSpan(metadata, "preview-metadata"));
    const action=(label:string,title:string,callback:()=>void,disabled=false):HTMLButtonElement=>{
      const button=this.ownerDocument.createElement('button');button.type='button';button.textContent=label;
      button.className='preview-mode-button';button.title=title;button.disabled=disabled;
      button.style.cssText='flex:none;padding:2px 6px;font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:4px;cursor:pointer';
      button.addEventListener('click',callback);metaBar.append(button);return button;
    };
    if(view.kind==='git-diff'&&view.openSourcePath) {
      action('Open file','Open the current file with Preview and Edit controls',()=>{
        this._dispatchPathEvent<MainPreviewPathDetail>('cle-main-preview-open-source',{path:view.path});
      });
    }
    if(view.kind==='text'||view.kind==='empty') {
      const path=view.path;
      if(view.editable || draftEditor) {
        const previewButton=action('Preview','Read only; unsaved draft is retained',()=>{this._draftPreviewPath=path;this._renderPanel();});
        previewButton.setAttribute('aria-pressed',String(!editor));
        const editButton=action('Edit','Enable editing',()=>{
          this._draftPreviewPath=undefined;
          if(draftEditor) this._renderPanel();
          else this._dispatchPathEvent<MainPreviewPathDetail>('cle-main-preview-edit',{path});
        },draftEditor?.saving===true);
        editButton.setAttribute('aria-pressed',String(Boolean(editor)));
        if(draftEditor) action(draftEditor.saving?'Saving':'Save','Save the complete draft to disk',()=>{
          this._dispatchPathEvent<MainPreviewPathDetail>(MAIN_PREVIEW_SAVE_EVENT,{path});
        },draftEditor.saving);
      }
      if(view.kind==='text'&&view.sizeBytes>INLINE_TEXT_BYTES&&isMarkdownPreviewPath(path)&&this._state.enabledPreviewers?.includes(MARKDOWN_PREVIEWER_ID)) {
        const key=`${path}\0${view.version}`;
        const rendered=this._largeMarkdownKey===key;
        action(rendered?'Plain text':'Render Markdown',rendered?'Return to the fast plain-text view':'Render the complete document and tables; large documents may take time',()=>{
          this._largeMarkdownKey=rendered?undefined:key;this._renderPanel();
        });
      }
    }


    const content = this.ownerDocument.createElement("div");
    content.className = "preview-content";
    if (editor) content.classList.add("editor-mode");
    this._renderViewContent(content, view, editor);
    if(draftEditor && !editor) this._appendEditorError(content, view, draftEditor);
    const source = content.querySelector<HTMLElement>(".code-editor,.literal-text");
    if (source && (view.kind === "text" || view.kind === "empty")) {
      const surface = this.ownerDocument.createElement("div");
      surface.className = "code-surface";
      surface.append(content);
      const minimap = new CodeMinimap(surface, editor ? source : content, source, this._minimapEnabled, view.kind === "text" && view.truncated);
      this._codeMinimap = minimap;
      minimap.setSource(editor?.draft ?? (view.kind === "text" ? view.text : ""), this._highlightedSource(view.path, editor?.draft ?? (view.kind === "text" ? view.text : "")));
      minimap.setSuspended(this._suspended);
      const toggle = this.ownerDocument.createElement("button");
      toggle.type = "button";
      toggle.className = "minimap-toggle";
      toggle.title = "Toggle code minimap";
      toggle.setAttribute("aria-label", "Toggle code minimap");
      toggle.setAttribute("aria-pressed", String(this._minimapEnabled));
      toggle.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 3h7M2 6h5M2 9h7M2 12h5M12 2v12M14 3v3m0 2v4"/></svg>';
      toggle.addEventListener("click", () => {
        this._minimapEnabled = !this._minimapEnabled;
        runtimeEvent("code-minimap", "preference", this._minimapEnabled ? "enabled" : "disabled");
        toggle.setAttribute("aria-pressed", String(this._minimapEnabled));
        minimap.setEnabled(this._minimapEnabled);
        try { this.ownerDocument.defaultView?.localStorage.setItem(CODE_MINIMAP_PREFERENCE, String(this._minimapEnabled)); }
        catch { runtimeEvent("code-minimap", "preference save", "unavailable"); }
      });
      metaBar.append(toggle);
      panel.append(metaBar, surface);
    } else panel.append(metaBar, content);
    this._panelMount.replaceChildren(panel);
    this._syncWordWrap();
  }

  _renderViewContent(content: HTMLElement, view: MainPreviewFileView, editor?: MainPreviewEditorState): void {
    const citationSource=this._citationUi.requiresSource();
    if(view.kind === "text" && view.sizeBytes > INLINE_TEXT_BYTES && !(!citationSource&&isMarkdownPreviewPath(view.path) && this._state.enabledPreviewers?.includes(MARKDOWN_PREVIEWER_ID) && this._largeMarkdownKey === `${view.path}\0${view.version}`)) {
      content.classList.add('large-text-content');
      const style=this.ownerDocument.createElement('style');style.textContent=largeTextStyles;
      this._largeTextReader=new LargeTextReader(this.ownerDocument,view.text);
      content.append(style,this._largeTextReader.element);
      return;
    }
    const optionalKind = (view.kind === 'text' || view.kind === 'empty')
      ? !editor && !citationSource && isMarkdownPreviewPath(view.path) ? 'markdown' : !editor && !citationSource && isCsvPreviewPath(view.path) ? 'csv' : !editor && !citationSource && isDiagramPreviewPath(view.path) ? 'diagram' : undefined
      : previewPackageId(view.kind) ? view.kind : undefined;
    const optionalId = optionalKind && previewPackageId(optionalKind);
    if (optionalId && this._state.enabledPreviewers?.includes(`code-codex.${optionalId}`)) {
      if (!isPluginPackageLoaded(optionalId)) {
        const failed = this._previewLoadFailures.get(optionalId);
        content.append(this._statePanel(failed ? 'Preview plugin unavailable' : 'Loading preview plugin', failed || 'Loading the previously downloaded and verified local plugin.', 'unsupported', view));
        if (!failed && !this._previewLoads.has(optionalId)) {
          this._previewLoads.add(optionalId);
          const path = view.path;
          void ensurePluginPackage(optionalId).catch(error => {
            this._previewLoadFailures.set(optionalId, error instanceof Error ? error.message : 'The plugin could not load. Download it in Preview Market.');
          }).finally(() => {
            this._previewLoads.delete(optionalId);
            if (this._connected && this._state.activePath === path) this._render();
          });
        }
        return;
      }
    }
    if (editor && (view.kind === "text" || view.kind === "empty")) {
      const stack = this.ownerDocument.createElement("div");
      stack.className = "code-editor-stack";
      const lineNumbers = this._lineNumberGutter(stack, editor.draft, "code-editor-line-numbers");
      const mirror = this.ownerDocument.createElement("pre");
      mirror.className = "code-editor-highlight";
      mirror.setAttribute("aria-hidden", "true");
      const code = this._highlightedCode(view.path, editor.draft);
      mirror.append(code);

      const textarea = this.ownerDocument.createElement("textarea");
      textarea.className = "code-editor";
      textarea.value = editor.draft;
      textarea.maxLength = MAX_PREVIEW_TEXT_UNITS;
      textarea.wrap = "off";
      textarea.spellcheck = false;
      textarea.autocomplete = "off";
      textarea.setAttribute("autocapitalize", "off");
      textarea.setAttribute("autocorrect", "off");
      textarea.setAttribute("aria-label", `Edit ${view.name}`);
      textarea.setAttribute("aria-busy", String(editor.saving));
      let acceptedDraft = editor.draft;
      textarea.addEventListener("input", () => {
        if (textarea.value.length > MAX_PREVIEW_TEXT_UNITS) {
          const selectionStart = Math.min(textarea.selectionStart, acceptedDraft.length);
          const selectionEnd = Math.min(textarea.selectionEnd, acceptedDraft.length);
          textarea.value = acceptedDraft;
          textarea.setSelectionRange(selectionStart, selectionEnd, textarea.selectionDirection);
          return;
        }
        acceptedDraft = textarea.value;
        this._replaceHighlightedSource(code, view.path, textarea.value);
        this._replaceLineNumbers(lineNumbers, stack, textarea.value);
        if (this._panelMount.contains(textarea)) this._codeMinimap?.setSource(textarea.value, this._highlightedSource(view.path, textarea.value));
        this._syncEditorScroll(textarea);
        this._dispatchPathEvent<MainPreviewDraftDetail>(MAIN_PREVIEW_DRAFT_EVENT, { path: view.path, text: textarea.value });
      });
      textarea.addEventListener("scroll", () => this._syncEditorScroll(textarea), { passive: true });
      textarea.addEventListener("compositionstart", () => stack.classList.add("composing"));
      textarea.addEventListener("compositionend", () => {
        this._replaceHighlightedSource(code, view.path, textarea.value);
        if (this._panelMount.contains(textarea)) this._codeMinimap?.setSource(textarea.value, this._highlightedSource(view.path, textarea.value));
        stack.classList.remove("composing");
        this._syncEditorScroll(textarea);
      });
      stack.append(lineNumbers, mirror, textarea);
      content.append(stack);
      this._appendEditorError(content, view, editor);
      return;
    }
    switch (view.kind) {
      case "loading":
        content.append(this._statePanel("Loading preview", "Reading this file from the local workspace.", "loading", view));
        return;
      case "text":
        if (view.text.length === 0) {
          content.append(this._statePanel("Empty file", "This file is empty.", "empty", view));
          return;
        }
        if (!citationSource && this._state.enabledPreviewers?.includes(MARKDOWN_PREVIEWER_ID) && isMarkdownPreviewPath(view.path)) {
          content.append(this._markdownReader(view));
          return;
        }
        if (!citationSource && this._state.enabledPreviewers?.includes(CSV_PREVIEWER_ID) && isCsvPreviewPath(view.path)) {
          content.append(this._csvReader(view));
          return;
        }
        if (!citationSource && this._state.enabledPreviewers?.includes(DIAGRAM_PREVIEWER_ID) && isDiagramPreviewPath(view.path)) {
          content.append(this._diagramReader(view));
          return;
        }
        {
          const reader = this.ownerDocument.createElement("div");
          reader.className = "code-reader";
          const lineNumbers = this._lineNumberGutter(reader, view.text);
          const pre = this.ownerDocument.createElement("pre");
          pre.className = "literal-text";
          pre.setAttribute("aria-label", `${view.name} contents`);
          const code = this._highlightedCode(view.path, view.text);
          pre.append(code);
          reader.append(lineNumbers, pre);
          content.append(reader);
        }
        return;
      case "git-diff":
        if(view.content.length>512*1024){
          content.classList.add('large-text-content');
          const style=this.ownerDocument.createElement('style');style.textContent=largeTextStyles;
          this._largeTextReader=new LargeTextReader(this.ownerDocument,view.content,true);
          content.append(style,this._largeTextReader.element);return;
        }
        content.append(this._gitDiffReader(view));
        return;
      case "image":
      case "video":
      case "pdf":
      case "audio":
      case "office":
      case "notebook":
      case "model":
        content.append(this._mediaPreview(view));
        return;
      case "empty":
        if (this._state.enabledPreviewers?.includes(CSV_PREVIEWER_ID) && isCsvPreviewPath(view.path)) {
          content.append(this._statePanel("Empty CSV file", "This CSV file has no rows.", "empty", view));
          return;
        }
        if (this._state.enabledPreviewers?.includes(DIAGRAM_PREVIEWER_ID) && isDiagramPreviewPath(view.path)) {
          content.append(this._statePanel("Empty diagram file", "This diagram file has no content.", "empty", view));
          return;
        }
        content.append(this._statePanel("Empty file", "This file is empty.", "empty", view));
        return;
      case "unsupported":
        content.append(this._statePanel("Preview unavailable", unsupportedCopy(view.reason), "unsupported", view));
        return;
      case "error":
        content.append(
          this._statePanel("File preview failed", view.message || "The file could not be loaded. Select it again to retry.", "error", view),
        );
    }
  }

  _mediaPreview(view: MainPreviewMediaView | MainPreviewModelView): HTMLElement {
    const id = previewPackageId(view.kind); if (!id || !this._state.enabledPreviewers?.includes(previewerIdForMediaKind(view.kind))) return this._statePanel('Preview unavailable', 'Enable this file preview extension in Preview Market.', 'unsupported', view);
    const methods: Record<string, string> = { pdf: '_pdfPreview', office: '_officePreview', notebook: '_notebookPreview', model: '_modelPreview', image: '_mediaPreview', video: '_mediaPreview', audio: '_mediaPreview' }; const method = previewMethod(id, methods[view.kind]!); if (!method) return this._statePanel('Preview unavailable', 'Download this file preview extension in Preview Market.', 'unsupported', view); return method.call(this, view);
  }

  _modelPreview(view: MainPreviewModelView): HTMLElement {
    const method = previewMethod("model-preview", "_modelPreview");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  _prepareModelResources(
    view: MainPreviewModelView,
    inspection: ModelPreviewSourceInspection,
    memoryScope: ModelMemoryCacheScope,
  ): ReadonlyMap<string, string> {
    const method = previewMethod("model-preview", "_prepareModelResources");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, inspection, memoryScope);
  }

  _decodeModelDataBufferUri(uri: string, window: Window): Uint8Array {
    const method = previewMethod("model-preview", "_decodeModelDataBufferUri");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, uri, window);
  }

  _decodeModelDataImageUri(
    uri: string,
    window: Window,
  ): { readonly bytes: Uint8Array; readonly mimeType: string } {
    const method = previewMethod("model-preview", "_decodeModelDataImageUri");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, uri, window);
  }

  _decodeModelDataUri(
    uri: string,
    window: Window,
    maxBytes: number,
  ): { readonly bytes: Uint8Array; readonly mimeType: string } {
    const method = previewMethod("model-preview", "_decodeModelDataUri");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, uri, window, maxBytes);
  }

  _modelResourceLookupKeys(uri: string): readonly string[] {
    const method = previewMethod("model-preview", "_modelResourceLookupKeys");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, uri);
  }

  _arrayBufferFor(bytes: Uint8Array): ArrayBuffer {
    const method = previewMethod("model-preview", "_arrayBufferFor");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bytes);
  }

  _visibleModelGeometryCount(root: Object3D): number {
    const method = previewMethod("model-preview", "_visibleModelGeometryCount");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  _visibleModelBounds(root: Object3D): Box3 {
    const method = previewMethod("model-preview", "_visibleModelBounds");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  _modelPreviewErrorMessage(error: unknown): string {
    const method = previewMethod("model-preview", "_modelPreviewErrorMessage");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, error);
  }

  _notebookPreview(view: MainPreviewMediaView): HTMLElement {
    const method = previewMethod("notebook-preview", "_notebookPreview");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  async _renderNotebookModel(
    view: MainPreviewMediaView,
    model: NotebookModel,
    container: HTMLElement,
    job: NotebookPreviewJob,
    isCurrent: () => boolean,
  ): Promise<void> {
    const method = previewMethod("notebook-preview", "_renderNotebookModel");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, model, container, job, isCurrent);
  }

  _notebookCell(
    cell: NotebookCellModel,
    index: number,
    languagePath: string,
    budget: NotebookRenderBudget,
    job: NotebookPreviewJob,
  ): HTMLElement | null {
    const method = previewMethod("notebook-preview", "_notebookCell");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, cell, index, languagePath, budget, job);
  }

  _notebookOutput(
    output: NotebookOutputModel,
    cellIndex: number,
    outputIndex: number,
    budget: NotebookRenderBudget,
    job: NotebookPreviewJob,
  ): HTMLElement {
    const method = previewMethod("notebook-preview", "_notebookOutput");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, output, cellIndex, outputIndex, budget, job);
  }

  _notebookMimeOutput(
    bundle: NotebookMimeBundle,
    budget: NotebookRenderBudget,
    job: NotebookPreviewJob,
    alt: string,
    startIndex = 0,
  ): HTMLElement | null {
    const method = previewMethod("notebook-preview", "_notebookMimeOutput");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bundle, budget, job, alt, startIndex);
  }

  _takeNotebookRenderText(value: unknown, budget: NotebookRenderBudget): string | null {
    const method = previewMethod("notebook-preview", "_takeNotebookRenderText");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, value, budget);
  }

  _notebookMarkdown(
    source: string,
    attachments: ReadonlyMap<string, NotebookMimeBundle>,
    budget: NotebookRenderBudget,
    job: NotebookPreviewJob,
  ): HTMLElement {
    const method = previewMethod("notebook-preview", "_notebookMarkdown");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, source, attachments, budget, job);
  }

  _notebookAttachmentImage(
    bundle: NotebookMimeBundle,
    budget: NotebookRenderBudget,
    job: NotebookPreviewJob,
    alt: string,
    startIndex = 0,
  ): HTMLImageElement | null {
    const method = previewMethod("notebook-preview", "_notebookAttachmentImage");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bundle, budget, job, alt, startIndex);
  }

  _notebookHtml(value: unknown, budget: NotebookRenderBudget): HTMLElement | null {
    const method = previewMethod("notebook-preview", "_notebookHtml");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, value, budget);
  }

  _notebookRasterImage(
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
    value: unknown,
    budget: NotebookRenderBudget,
    alt: string,
  ): HTMLImageElement | null {
    const method = previewMethod("notebook-preview", "_notebookRasterImage");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, mimeType, value, budget, alt);
  }

  _notebookSvgImage(value: unknown, budget: NotebookRenderBudget, alt: string): HTMLImageElement | null {
    const method = previewMethod("notebook-preview", "_notebookSvgImage");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, value, budget, alt);
  }

  _bindNotebookImageFallback(
    image: HTMLImageElement,
    job: NotebookPreviewJob,
    renderFallback: () => HTMLElement | null,
  ): void {
    const method = previewMethod("notebook-preview", "_bindNotebookImageFallback");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, image, job, renderFallback);
  }

  _isNotebookJobCurrent(job: NotebookPreviewJob): boolean {
    const method = previewMethod("notebook-preview", "_isNotebookJobCurrent");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, job);
  }

  _notebookNodeCost(root: Node): number {
    const method = previewMethod("notebook-preview", "_notebookNodeCost");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  _consumeNotebookDomNodes(budget: NotebookRenderBudget, count: number): boolean {
    const method = previewMethod("notebook-preview", "_consumeNotebookDomNodes");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, budget, count);
  }

  async _yieldNotebookRender(signal: AbortSignal): Promise<void> {
    const method = previewMethod("notebook-preview", "_yieldNotebookRender");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, signal);
  }

  _cancelNotebookPreview(): void {
    const method = previewMethod("notebook-preview", "_cancelNotebookPreview");
    if (!method) return;
    return method.call(this);
  }

  _pdfPreview(view: MainPreviewMediaView): HTMLElement {
    const method = previewMethod("pdf-preview", "_pdfPreview");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  _cancelPdfPreview(): void {
    const method = previewMethod("pdf-preview", "_cancelPdfPreview");
    if (!method) return;
    return method.call(this);
  }

  _officePreview(view: MainPreviewMediaView): HTMLElement {
    const method = previewMethod("office-preview", "_officePreview");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  async _renderDocxOffice(
    view: MainPreviewMediaView,
    container: HTMLElement,
    stage: HTMLElement,
    job: OfficePreviewJob,
    isCurrent: () => boolean,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_renderDocxOffice");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, container, stage, job, isCurrent);
  }

  async _prepareDocxPreviewBytes(bytes: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
    const method = previewMethod("office-preview", "_prepareDocxPreviewBytes");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bytes, signal);
  }

  _captureDocxPreviewMarkers(root: HTMLElement): void {
    const method = previewMethod("office-preview", "_captureDocxPreviewMarkers");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  async _settleDocxLayout(root: HTMLElement, signal: AbortSignal): Promise<void> {
    const method = previewMethod("office-preview", "_settleDocxLayout");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, signal);
  }

  async _waitForDocxImages(root: HTMLElement, signal: AbortSignal): Promise<void> {
    const method = previewMethod("office-preview", "_waitForDocxImages");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, signal);
  }

  async _waitOfficeDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
    const method = previewMethod("office-preview", "_waitOfficeDelay");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, milliseconds, signal);
  }

  async _yieldOfficeAnimationFrame(signal: AbortSignal): Promise<void> {
    const method = previewMethod("office-preview", "_yieldOfficeAnimationFrame");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, signal);
  }

  _renumberDocxCachedPageFooters(
    root: HTMLElement,
    className: string,
    domBudget: OfficeDomBudget,
  ): void {
    const method = previewMethod("office-preview", "_renumberDocxCachedPageFooters");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, className, domBudget);
  }

  _observeLateDocxLayout(
    root: HTMLElement,
    className: string,
    job: OfficePreviewJob,
    domBudget: OfficeDomBudget,
  ): void {
    const method = previewMethod("office-preview", "_observeLateDocxLayout");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, className, job, domBudget);
  }

  async _checkpointDocxPagination(
    clock: DocxPaginationClock,
    signal: AbortSignal,
    forceYield = false,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_checkpointDocxPagination");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, clock, signal, forceYield);
  }

  async _paginateDocxOverflowPages(
    root: HTMLElement,
    className: string,
    signal: AbortSignal,
    domBudget: OfficeDomBudget,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_paginateDocxOverflowPages");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, className, signal, domBudget);
  }

  _docxPageOverflows(page: HTMLElement): boolean {
    const method = previewMethod("office-preview", "_docxPageOverflows");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, page);
  }

  _stripDocxCloneIds(root: HTMLElement): void {
    const method = previewMethod("office-preview", "_stripDocxCloneIds");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  async _splitDocxParagraphForPage(
    block: HTMLElement,
    article: HTMLElement,
    page: HTMLElement,
    signal: AbortSignal,
    clock: DocxPaginationClock,
    domBudget: OfficeDomBudget,
  ): Promise<DocxBlockSplitResult> {
    const method = previewMethod("office-preview", "_splitDocxParagraphForPage");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, block, article, page, signal, clock, domBudget);
  }

  async _splitDocxTableForPage(
    block: HTMLElement,
    article: HTMLElement,
    page: HTMLElement,
    signal: AbortSignal,
    clock: DocxPaginationClock,
    domBudget: OfficeDomBudget,
    requireFittingFragment = false,
  ): Promise<DocxBlockSplitResult> {
    const method = previewMethod("office-preview", "_splitDocxTableForPage");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, block, article, page, signal, clock, domBudget, requireFittingFragment);
  }

  _officeAbortError(): Error {
    const method = previewMethod("office-preview", "_officeAbortError");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this);
  }

  _throwIfOfficeAborted(signal: AbortSignal): void {
    const method = previewMethod("office-preview", "_throwIfOfficeAborted");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, signal);
  }

  _parseXlsxXml(bytes: Uint8Array, label: string): Document {
    const method = previewMethod("office-preview", "_parseXlsxXml");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bytes, label);
  }

  async _readXlsxXmlEntry(
    entry: JSZip.JSZipObject,
    maximumBytes: number,
    signal: AbortSignal,
    label: string,
  ): Promise<Document> {
    const method = previewMethod("office-preview", "_readXlsxXmlEntry");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, entry, maximumBytes, signal, label);
  }

  _xlsxArchiveEntries(archive: JSZip): ReadonlyMap<string, JSZip.JSZipObject> {
    const method = previewMethod("office-preview", "_xlsxArchiveEntries");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, archive);
  }

  async _xlsxWorksheetMetadata(
    entries: ReadonlyMap<string, JSZip.JSZipObject>,
    signal: AbortSignal,
  ): Promise<{ readonly worksheets: readonly XlsxWorksheetMeta[]; readonly total: number }> {
    const method = previewMethod("office-preview", "_xlsxWorksheetMetadata");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, entries, signal);
  }

  async _xlsxSharedStrings(
    entries: ReadonlyMap<string, JSZip.JSZipObject>,
    signal: AbortSignal,
  ): Promise<XlsxSharedStrings> {
    const method = previewMethod("office-preview", "_xlsxSharedStrings");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, entries, signal);
  }

  async _xlsxStyles(
    entries: ReadonlyMap<string, JSZip.JSZipObject>,
    signal: AbortSignal,
  ): Promise<XlsxStyleTable> {
    const method = previewMethod("office-preview", "_xlsxStyles");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, entries, signal);
  }

  async _parseXlsxWorksheet(
    entry: JSZip.JSZipObject,
    sharedStrings: XlsxSharedStrings,
    styles: XlsxStyleTable,
    signal: AbortSignal,
  ): Promise<ParsedXlsxWorksheet> {
    const method = previewMethod("office-preview", "_parseXlsxWorksheet");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, entry, sharedStrings, styles, signal);
  }

  async _renderXlsxOffice(
    view: MainPreviewMediaView,
    container: HTMLElement,
    stage: HTMLElement,
    job: OfficePreviewJob,
    isCurrent: () => boolean,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_renderXlsxOffice");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, container, stage, job, isCurrent);
  }

  async _renderNativePptOffice(
    view: MainPreviewMediaView,
    container: HTMLElement,
    stage: HTMLElement,
    job: OfficePreviewJob,
    isCurrent: () => boolean,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_renderNativePptOffice");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, container, stage, job, isCurrent);
  }

  async _renderLegacyPptOffice(
    view: MainPreviewMediaView,
    container: HTMLElement,
    stage: HTMLElement,
    job: OfficePreviewJob,
    isCurrent: () => boolean,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_renderLegacyPptOffice");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, container, stage, job, isCurrent);
  }

  async _parseLegacyPpt(bytes: Uint8Array, job: OfficePreviewJob): Promise<ParsedPresentation> {
    const method = previewMethod("office-preview", "_parseLegacyPpt");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bytes, job);
  }

  _sanitizeLegacyPptPresentation(parsed: ParsedPresentation): ParsedPresentation {
    const method = previewMethod("office-preview", "_sanitizeLegacyPptPresentation");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, parsed);
  }

  async _renderPptxOffice(
    view: MainPreviewMediaView,
    container: HTMLElement,
    stage: HTMLElement,
    job: OfficePreviewJob,
    isCurrent: () => boolean,
  ): Promise<void> {
    const method = previewMethod("office-preview", "_renderPptxOffice");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, container, stage, job, isCurrent);
  }

  async _assertPptxHasNoExternalRelationships(bytes: Uint8Array, signal: AbortSignal): Promise<void> {
    const method = previewMethod("office-preview", "_assertPptxHasNoExternalRelationships");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, bytes, signal);
  }

  _cancelOfficePreview(): void {
    const method = previewMethod("office-preview", "_cancelOfficePreview");
    if (!method) return;
    return method.call(this);
  }

  _observeOfficeResources(root: HTMLElement, job: OfficePreviewJob): void {
    const method = previewMethod("office-preview", "_observeOfficeResources");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, job);
  }

  _takeSanitizedDocxStyles(host: HTMLElement, className: string): HTMLStyleElement[] {
    const method = previewMethod("office-preview", "_takeSanitizedDocxStyles");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, host, className);
  }

  _sanitizeDocxCss(cssText: string, className: string): string {
    const method = previewMethod("office-preview", "_sanitizeDocxCss");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, cssText, className);
  }

  _isScopedDocxSelector(selectorList: string, className: string): boolean {
    const method = previewMethod("office-preview", "_isScopedDocxSelector");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, selectorList, className);
  }

  _sanitizeOfficeStyleDeclaration(style: CSSStyleDeclaration): void {
    const method = previewMethod("office-preview", "_sanitizeOfficeStyleDeclaration");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, style);
  }

  _sanitizeOfficeCssUrls(value: string): string {
    const method = previewMethod("office-preview", "_sanitizeOfficeCssUrls");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, value);
  }

  _sanitizeDetachedDocx(root: HTMLElement): void {
    const method = previewMethod("office-preview", "_sanitizeDetachedDocx");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  _sanitizeOfficeTree(root: Element): void {
    const method = previewMethod("office-preview", "_sanitizeOfficeTree");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  _sanitizeOfficeElement(element: Element): void {
    const method = previewMethod("office-preview", "_sanitizeOfficeElement");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, element);
  }

  _isLocalOfficeResource(value: string): boolean {
    const method = previewMethod("office-preview", "_isLocalOfficeResource");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, value);
  }

  _officeDomCost(root: Node, includeRoot = true): { nodes: number; textUnits: number } {
    const method = previewMethod("office-preview", "_officeDomCost");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root, includeRoot);
  }

  _reserveOfficeDomClones(domBudget: OfficeDomBudget, roots: readonly Node[]): boolean {
    const method = previewMethod("office-preview", "_reserveOfficeDomClones");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, domBudget, roots);
  }

  _boundOfficeDom(root: HTMLElement): boolean {
    const method = previewMethod("office-preview", "_boundOfficeDom");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, root);
  }

  async _yieldOfficeRender(): Promise<void> {
    const method = previewMethod("office-preview", "_yieldOfficeRender");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this);
  }

  _mediaObjectUrl(view: MainPreviewMediaView): string | null {
    if (!this._connected) return null;
    const cached = this._mediaObjectUrls.get(view.path);
    if (cached?.bytes === view.bytes && cached.mimeType === view.mimeType) return cached.url;
    if (cached) this._revokeMediaObjectUrl(view.path);

    const urlApi = this.ownerDocument.defaultView?.URL ?? globalThis.URL;
    const BlobType = this.ownerDocument.defaultView?.Blob ?? globalThis.Blob;
    if (typeof urlApi?.createObjectURL !== "function" || typeof BlobType !== "function") return null;
    try {
      const underlying = view.bytes.buffer;
      let buffer: ArrayBuffer;
      if (
        underlying instanceof ArrayBuffer &&
        view.bytes.byteOffset === 0 &&
        view.bytes.byteLength === underlying.byteLength
      ) {
        buffer = underlying;
      } else if (underlying instanceof ArrayBuffer) {
        buffer = underlying.slice(view.bytes.byteOffset, view.bytes.byteOffset + view.bytes.byteLength);
      } else {
        buffer = new ArrayBuffer(view.bytes.byteLength);
        new Uint8Array(buffer).set(view.bytes);
      }
      const blob = new BlobType([buffer], { type: view.mimeType });
      const url = urlApi.createObjectURL(blob);
      this._mediaObjectUrls.set(view.path, {
        bytes: view.bytes,
        mimeType: view.mimeType,
        url,
        revoke: () => urlApi.revokeObjectURL(url),
      });
      return url;
    } catch {
      return null;
    }
  }

  _reconcileMediaObjectUrls(state: MainPreviewState): void {
    for (const [path, cached] of this._mediaObjectUrls) {
      const view = state.tabs.find((candidate) => candidate.path === path);
      const enabled = isMediaPreviewView(view) &&
        state.enabledPreviewers?.includes(previewerIdForMediaKind(view.kind)) === true;
      if (
        !isMediaPreviewView(view) ||
        view.bytes !== cached.bytes ||
        view.mimeType !== cached.mimeType ||
        !enabled
      ) {
        this._revokeMediaObjectUrl(path);
      }
    }
  }

  _revokeMediaObjectUrl(path: string): void {
    const cached = this._mediaObjectUrls.get(path);
    if (!cached) return;
    this._mediaObjectUrls.delete(path);
    try {
      cached.revoke();
    } catch {
      // The document may already be torn down; dropping the cache is sufficient.
    }
  }

  _revokeAllMediaObjectUrls(): void {
    for (const path of [...this._mediaObjectUrls.keys()]) this._revokeMediaObjectUrl(path);
  }

  _statePanel(
    title: string,
    copy: string,
    kind: "loading" | "empty" | "unsupported" | "error",
    view: MainPreviewFileView,
  ): HTMLElement {
    const panel = this.ownerDocument.createElement("div");
    panel.className = `view-state ${kind}`;
    if (kind === "loading") panel.setAttribute("role", "status");
    else if (kind === "error") panel.setAttribute("role", "alert");

    const card = this.ownerDocument.createElement("div");
    card.className = "state-card";
    if (kind === "loading") {
      const spinner = this.ownerDocument.createElement("div");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      card.append(spinner);
    } else {
      const icon = kind === "error" ? icons.warning : getFileIcon(view.name).markup;
      card.append(this._staticIcon(icon, "state-icon"));
    }
    const heading = this.ownerDocument.createElement("h2");
    heading.className = "state-title";
    heading.textContent = title;
    const paragraph = this.ownerDocument.createElement("p");
    paragraph.className = "state-copy";
    paragraph.textContent = copy;
    card.append(heading, paragraph);
    panel.append(card);
    return panel;
  }

  _csvReader(view: MainPreviewTextView): HTMLElement {
    const method = previewMethod("csv-preview", "_csvReader");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  _startDiagramPreview(): DiagramPreviewJob {
    const method = previewMethod("diagram-preview", "_startDiagramPreview");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this);
  }

  _isDiagramPreviewCurrent(job: DiagramPreviewJob): boolean {
    const method = previewMethod("diagram-preview", "_isDiagramPreviewCurrent");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, job);
  }

  _cancelDiagramPreview(): void {
    const method = previewMethod("diagram-preview", "_cancelDiagramPreview");
    if (!method) return;
    return method.call(this);
  }

  _cancelModelPreview(): void {
    const method = previewMethod("model-preview", "_cancelModelPreview");
    if (!method) return;
    return method.call(this);
  }

  _disposeModelJob(job: ModelPreviewJob): void {
    const method = previewMethod("model-preview", "_disposeModelJob");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, job);
  }

  _disposeModelObjects(roots: readonly Object3D[]): void {
    const method = previewMethod("model-preview", "_disposeModelObjects");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, roots);
  }

  _diagramReader(view: MainPreviewTextView): HTMLElement {
    const method = previewMethod("diagram-preview", "_diagramReader");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  _metadataFor(view: MainPreviewFileView): string {
    switch (view.kind) {
      case 'native-diff': return 'Native comparison';
      case "loading":
        return "Loading";
      case "text":
        return view.truncated ? `${formatBytes(view.sizeBytes)} \u00b7 Preview truncated` : formatBytes(view.sizeBytes);
      case "git-diff":
        return `${view.path.startsWith("review-diff://")?"Response changes":`Commit ${view.shortHash}`}${view.truncated ? " \u00b7 Diff truncated" : ""}`;
      case "empty":
        return formatBytes(view.sizeBytes);
      case "image":
        return `Image \u00b7 ${formatBytes(view.sizeBytes)}`;
      case "video":
        return `Video \u00b7 ${formatBytes(view.sizeBytes)}`;
      case "pdf":
        return `PDF \u00b7 ${formatBytes(view.sizeBytes)}`;
      case "audio":
        return `Audio \u00b7 ${formatBytes(view.sizeBytes)}`;
      case "office": {
        const kind = officeDocumentKind(view.mimeType);
        return `${kind?.toUpperCase() ?? "Office"} \u00b7 ${formatBytes(view.sizeBytes)}`;
      }
      case "notebook":
        return `Notebook \u00b7 ${formatBytes(view.sizeBytes)}`;
      case "model":
        return `3D model \u00b7 ${formatBytes(view.sizeBytes)}`;
      case "unsupported":
        return formatBytes(view.sizeBytes);
      case "error":
        return view.code || "Preview error";
    }
  }

  _gitDiffReader(view: MainPreviewGitDiffView): HTMLElement {
    const reader = this.ownerDocument.createElement("pre");
    reader.className = "git-diff-reader";
    reader.setAttribute("aria-label", view.path.startsWith("review-diff://")?`${view.name} recorded response changes`:`${view.name} changes in commit ${view.shortHash}`);
    for (const line of view.content.split("\n")) {
      const row = this.ownerDocument.createElement("span");
      row.className = "git-diff-line";
      if (line.startsWith("+") && !line.startsWith("+++")) row.classList.add("git-diff-line-add");
      else if (line.startsWith("-") && !line.startsWith("---")) row.classList.add("git-diff-line-remove");
      else if (line.startsWith("@@")) row.classList.add("git-diff-line-hunk");
      else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
        row.classList.add("git-diff-line-header");
      }
      row.textContent = line || " ";
      reader.append(row);
    }
    return reader;
  }

  _highlightedSource(path: string, source: string): SyntaxHighlight {
    const cached = this._syntaxCache.get(path);
    if (cached?.source === source) return cached.highlight;
    const highlight = highlightSyntaxForPath(path, source);
    this._syntaxCache.set(path, { source, highlight });
    return highlight;
  }

  _highlightedCode(path: string, source: string): HTMLElement {
    const code = this.ownerDocument.createElement("code");
    code.className = "syntax-code";
    this._replaceHighlightedSource(code, path, source);
    return code;
  }

  _markdownReader(view: MainPreviewTextView): HTMLElement {
    const method = previewMethod("markdown-preview", "_markdownReader");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view);
  }

  _markdownEditor(view: MainPreviewTextView | MainPreviewEmptyView, editor: MainPreviewEditorState): HTMLElement {
    const method = previewMethod("markdown-preview", "_markdownEditor");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, editor);
  }

  _createMarkdownSurface(
    view: MainPreviewTextView | MainPreviewEmptyView,
    source: string,
    editable: boolean,
  ): HTMLElement {
    const method = previewMethod("markdown-preview", "_createMarkdownSurface");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, view, source, editable);
  }

  _populateMarkdownArticle(article: HTMLElement, source: string, editable: boolean): void {
    const method = previewMethod("markdown-preview", "_populateMarkdownArticle");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, article, source, editable);
  }

  _decorateMarkdownTaskLists(article: HTMLElement, editable: boolean): void {
    const method = previewMethod("markdown-preview", "_decorateMarkdownTaskLists");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, article, editable);
  }

  _pastePlainText(event: ClipboardEvent, article: HTMLElement): void {
    const method = previewMethod("markdown-preview", "_pastePlainText");
    if (!method) throw new Error("Download this file preview plugin in Preview Market first.");
    return method.call(this, event, article);
  }

  _appendEditorError(content: HTMLElement, view: MainPreviewFileView, editor: MainPreviewEditorState): void {
    if (!editor.error) return;
    const error = this.ownerDocument.createElement("div");
    error.className = "editor-error";
    error.setAttribute("role", "alert");
    const copy = this._textSpan(editor.error, "editor-error-copy");
    copy.title = editor.error;
    const reload = this.ownerDocument.createElement("button");
    reload.type = "button";
    reload.className = "editor-reload";
    reload.textContent = "Reload file";
    reload.addEventListener("click", () => {
      this._dispatchPathEvent<MainPreviewPathDetail>(MAIN_PREVIEW_RELOAD_EVENT, { path: view.path });
    });
    error.append(copy, reload);
    content.append(error);
  }

  _replaceHighlightedSource(code: HTMLElement, path: string, source: string): void {
    const highlighted = this._highlightedSource(path, source);
    code.dataset.language = highlighted.language;
    code.toggleAttribute("data-highlight-limited", highlighted.limited);
    const fragment = this.ownerDocument.createDocumentFragment();
    for (const run of highlighted.runs) {
      const tokenText = source.slice(run.start, run.end);
      if (run.kind === "plain") {
        fragment.append(this.ownerDocument.createTextNode(tokenText));
      } else {
        const token = this.ownerDocument.createElement("span");
        token.className = `tok-${run.kind}`;
        token.textContent = tokenText;
        fragment.append(token);
      }
    }
    code.replaceChildren(fragment);
  }

  _lineNumberGutter(surface: HTMLElement, source: string, extraClass = ""): HTMLElement {
    const gutter = this.ownerDocument.createElement("pre");
    gutter.className = `code-line-numbers ${extraClass}`.trim();
    gutter.setAttribute("aria-hidden", "true");
    this._replaceLineNumbers(gutter, surface, source);
    return gutter;
  }

  _replaceLineNumbers(gutter: HTMLElement, surface: HTMLElement, source: string): void {
    const lineCount = sourceLineCount(source);
    gutter.dataset.lineCount = String(lineCount);
    if(!this._wordWrap||!this._wrappedLineNumbers) gutter.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
    this._wrappedLineNumbers?.update();
    const digits = Math.max(2, String(lineCount).length);
    surface.style.setProperty("--cle-line-number-width", `calc(${digits}ch + 24px)`);
  }

  _syncEditorScroll(editor: HTMLTextAreaElement): void {
    const mirror = editor.parentElement?.querySelector<HTMLElement>(".code-editor-highlight");
    if (!mirror) return;
    mirror.scrollTop = editor.scrollTop;
    mirror.scrollLeft = editor.scrollLeft;
    const lineNumbers = editor.parentElement?.querySelector<HTMLElement>(".code-editor-line-numbers");
    if (lineNumbers) lineNumbers.scrollTop = editor.scrollTop;
  }

  _onTabListClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const close = target.closest<HTMLButtonElement>("button[data-close-path]");
    if (close) {
      const path = close.dataset.closePath;
      if (path) this._dispatchClose(path);
      return;
    }
    const tab = target.closest<HTMLElement>("[role='tab']");
    if (tab && this._tabList.contains(tab)) this._activateTab(tab);
  }

  _onTabListKeyDown(event: KeyboardEvent): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[role='tab']") : null;
    if (!target || !this._tabList.contains(target)) return;
    const focusedPath = this._pathForTab(target);
    if (
      focusedPath !== null &&
      (event.key === "Delete" || (event.key.toLowerCase() === "w" && (event.ctrlKey || event.metaKey)))
    ) {
      event.preventDefault();
      event.stopPropagation();
      this._dispatchClose(focusedPath);
      return;
    }
    const tabs = this._tabs();
    const index = tabs.indexOf(target);
    if (index < 0) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    this._setRovingPath(this._pathForTab(next));
    next.focus();
    this._activateTab(next);
  }

  _onShadowKeyDown(event: KeyboardEvent): void {
    if(event.key==='Escape' && this._openFilesMenu.matches(':popover-open')) {
      event.preventDefault();event.stopPropagation();
      this._openFilesMenu.hidePopover();
      this._required<HTMLButtonElement>('.open-files-toggle').focus();
      return;
    }
    if (
      this._state.editor &&
      event.key.toLocaleLowerCase() === "s" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      this._dispatchPathEvent<MainPreviewPathDetail>(MAIN_PREVIEW_SAVE_EVENT, { path: this._state.editor.path });
      return;
    }
    if (event.key !== "Escape" || this._state.activePath === null) return;
    event.preventDefault();
    event.stopPropagation();
    this._rovingPath = null;
    if (!this._dispatchActivate({ kind: "conversation" })) {
      this._setRovingPath(this._state.activePath);
      this._focusActiveTab();
      return;
    }
    this._setRovingPath(null);
    this._tabForPath(null)?.focus();
  }

  _activateTab(tab: HTMLElement): void {
    const path = this._pathForTab(tab);
    this._setRovingPath(path);
    const activated = path === null
      ? this._dispatchActivate({ kind: "conversation" })
      : this._dispatchActivate({ kind: "file", path });
    if (!activated) {
      this._setRovingPath(this._state.activePath);
      this._focusActiveTab();
    }
  }

  _dispatchActivate(detail: MainPreviewActivateDetail): boolean {
    return this.dispatchEvent(
      new CustomEvent<MainPreviewActivateDetail>(MAIN_PREVIEW_ACTIVATE_EVENT, {
        bubbles: true,
        cancelable: true,
        composed: true,
        detail,
      }),
    );
  }

  _dispatchClose(path: string): void {
    this.dispatchEvent(
      new CustomEvent<MainPreviewCloseDetail>(MAIN_PREVIEW_CLOSE_EVENT, { bubbles: true, composed: true, detail: { path } }),
    );
  }

  _dispatchPathEvent<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { bubbles: true, composed: true, detail }));
  }

  _setRovingPath(path: string | null): void {
    this._rovingPath = path;
    for (const tab of this._tabs()) tab.tabIndex = this._pathForTab(tab) === path ? 0 : -1;
  }

  _pathForTab(tab: HTMLElement): string | null {
    return tab.dataset.tabKind === "file" ? (tab.dataset.path ?? null) : null;
  }

  _tabs(): HTMLElement[] {
    return Array.from(this._tabList.querySelectorAll<HTMLElement>("[role='tab']"));
  }

  _tabForPath(path: string | null): HTMLElement | undefined {
    return this._tabs().find((tab) => this._pathForTab(tab) === path);
  }

  _captureFocus(): FocusSnapshot {
    const active = this._shadow.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    if (active instanceof HTMLTextAreaElement && active.matches(".code-editor")) {
      return {
        kind: "editor",
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd,
        selectionDirection: active.selectionDirection,
        scrollTop: active.scrollTop,
        scrollLeft: active.scrollLeft,
      };
    }
    if (active.matches(".markdown-editor-surface")) {
      const article = active;
      const selection = this.ownerDocument.getSelection();
      const anchorOffset = selectionOffsetWithin(article, selection?.anchorNode ?? null, selection?.anchorOffset ?? 0);
      const focusOffset = selectionOffsetWithin(article, selection?.focusNode ?? null, selection?.focusOffset ?? 0);
      const scroller = article.closest<HTMLElement>(".preview-content");
      return {
        kind: "markdown-editor",
        anchorOffset: anchorOffset ?? 0,
        focusOffset: focusOffset ?? anchorOffset ?? 0,
        scrollTop: scroller?.scrollTop ?? 0,
        scrollLeft: scroller?.scrollLeft ?? 0,
      };
    }
    if (active.matches("[role='tab']")) return { kind: "tab", path: this._pathForTab(active) };
    if (active.matches("button[data-close-path]")) {
      const path = active.dataset.closePath;
      return path ? { kind: "close", path } : null;
    }
    if (active.matches(".preview-panel")) return { kind: "panel" };
    return null;
  }

  _restoreFocus(focus: FocusSnapshot): void {
    if (!focus) return;
    if (focus.kind === "editor") {
      const editor = this._panelMount.querySelector<HTMLTextAreaElement>(".code-editor");
      if (editor) {
        editor.focus();
        editor.setSelectionRange(focus.selectionStart, focus.selectionEnd, focus.selectionDirection);
        editor.scrollTop = focus.scrollTop;
        editor.scrollLeft = focus.scrollLeft;
        this._syncEditorScroll(editor);
      } else {
        this._focusActiveTab();
      }
      return;
    }
    if (focus.kind === "markdown-editor") {
      const article = this._panelMount.querySelector<HTMLElement>(".markdown-editor-surface");
      if (!article) {
        this._focusActiveTab();
        return;
      }
      article.focus({ preventScroll: true });
      const selection = this.ownerDocument.getSelection();
      if (selection) {
        const anchor = textPositionAtOffset(article, focus.anchorOffset);
        const selectionFocus = textPositionAtOffset(article, focus.focusOffset);
        try {
          selection.setBaseAndExtent(anchor.node, anchor.offset, selectionFocus.node, selectionFocus.offset);
        } catch {
          const range = this.ownerDocument.createRange();
          range.setStart(anchor.node, anchor.offset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      const scroller = article.closest<HTMLElement>(".preview-content");
      if (scroller) {
        scroller.scrollTop = focus.scrollTop;
        scroller.scrollLeft = focus.scrollLeft;
      }
      return;
    }
    if (focus.kind === "tab") {
      const tab = this._tabForPath(focus.path);
      if (tab) tab.focus();
      else this._focusActiveTab();
      return;
    }
    if (focus.kind === "close") {
      const button = Array.from(this._tabList.querySelectorAll<HTMLButtonElement>("button[data-close-path]")).find(
        (candidate) => candidate.dataset.closePath === focus.path,
      );
      if (button) button.focus();
      else this._focusActiveTab();
      return;
    }
    const panel = this._panelMount.querySelector<HTMLElement>(".preview-panel");
    if (panel) panel.focus();
    else this._focusActiveTab();
  }

  _tabId(path: string): string {
    let id = this._tabIds.get(path);
    if (!id) {
      this._nextTabId += 1;
      id = `cle-main-preview-${this._instanceId}-file-tab-${this._nextTabId}`;
      this._tabIds.set(path, id);
    }
    return id;
  }

  _panelId(path: string): string {
    return `${this._tabId(path)}-panel`;
  }

  _staticIcon(markup: string, className: string): HTMLElement {
    const icon = this.ownerDocument.createElement("span");
    icon.className = className;
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = markup;
    return icon;
  }

  _textSpan(text: string, className: string): HTMLSpanElement {
    const span = this.ownerDocument.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  _focusActiveTab(): void {
    (this._tabForPath(this._state.activePath) ?? this._tabForPath(null))?.focus();
  }

  _scrollSelectedTabIntoView(): void {
    const selected = this._tabForPath(this._state.activePath);
    const slot = selected?.parentElement;
    if (!slot) return;
    const scrollIntoView = (slot as HTMLElement).scrollIntoView;
    if (typeof scrollIntoView === "function") scrollIntoView.call(slot, { block: "nearest", inline: "nearest" });
  }

  _nativeConversationViewport(parent: Element): HTMLElement | null {
    if (!this._clippedLayout) return null;
    const viewports = parent.querySelectorAll<HTMLElement>(
      ':scope > div > [data-app-shell-workspace-layout]',
    );
    const viewport = viewports.length === 1 ? viewports[0] : null;
    return viewport?.parentElement?.parentElement === parent ? viewport : null;
  }

  _syncNativeViewportBounds(parent: Element, viewport: HTMLElement | null): void {
    if (!viewport) {
      this._nativeViewportObserver?.disconnect();
      this._observedNativeViewport = null;
      this.style.removeProperty("left");
      this.style.removeProperty("right");
      return;
    }
    if (this._observedNativeViewport !== viewport) {
      this._nativeViewportObserver?.disconnect();
      this._observedNativeViewport = viewport;
      if (typeof ResizeObserver !== "undefined") {
        this._nativeViewportObserver ??= new ResizeObserver(() => {
          const currentParent = this.parentElement;
          const currentViewport = this._observedNativeViewport;
          if (this._connected && currentParent?.matches(MAIN_SURFACE_SELECTOR) && currentViewport) {
            this._syncNativeViewportBounds(currentParent, currentViewport);
          }
        });
        this._nativeViewportObserver.observe(parent);
        this._nativeViewportObserver.observe(viewport);
      }
    }
    const parentRect = parent.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    if (parentRect.width <= 0 || viewportRect.width <= 0) return;
    const parentStyle = getComputedStyle(parent);
    // Absolute offsets start at the main surface's padding edge, after its border.
    const contentLeft = parentRect.left + (Number.parseFloat(parentStyle.borderLeftWidth) || 0);
    const contentRight = parentRect.right - (Number.parseFloat(parentStyle.borderRightWidth) || 0);
    this.style.left = `${Math.max(0, viewportRect.left - contentLeft)}px`;
    this.style.right = `${Math.max(0, contentRight - viewportRect.right)}px`;
  }

  _syncSuppression(): void {
    const hasNativeSurface = this.parentElement?.matches(MAIN_SURFACE_SELECTOR) === true;
    const paneActive = hasNativeSurface && this._connected && !this._suspended && this._panePreference.docked && this._editorVisible;
    this.toggleAttribute('data-editor-pane', this._panePreference.docked && hasNativeSurface);
    this.toggleAttribute('data-editor-pane-open', paneActive);
    const visible=this._editorVisible && !this._suspended;
    if(!visible)this._citationUi.closeMenu();
    this.toggleAttribute('data-editor-visible',visible);
    const toggle=this._required<HTMLButtonElement>('.editor-pane-toggle');
    toggle.setAttribute('aria-pressed',String(visible));
    toggle.title=visible?'Close editor':'Open editor';toggle.setAttribute('aria-label',toggle.title);
    this._editorHeader.sync(hasNativeSurface && this._connected && !this._suspended,visible);
    const fullscreen=this._required<HTMLButtonElement>('.editor-fullscreen-toggle');
    fullscreen.title=this._panePreference.docked?'Expand editor':'Restore editor to right pane';
    fullscreen.setAttribute('aria-label',fullscreen.title);
    fullscreen.setAttribute('aria-pressed',String(!this._panePreference.docked));
    fullscreen.innerHTML=this._panePreference.docked
      ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 2v4H2m12 0h-4V2M2 10h4v4m4 0v-4h4"/></svg>';
    if (this._panePreference.docked && this.parentElement?.matches(MAIN_SURFACE_SELECTOR)) {
      this._restoreSuppressedChildren();
      this._syncNativeViewportBounds(this.parentElement, null);
      this._nativeTitleObserver?.disconnect(); this._nativeTitleObserverRoot = null;
      if (paneActive) this._editorPane.apply(this.parentElement, this._panePreference.width);
      else {
        this._editorPane.restore();
        this.style.setProperty('--cle-editor-pane-top', `${nativeHeaderInset(this.parentElement)}px`);
      }
      return;
    }
    this._editorPane.restore();
    if (this.parentElement?.matches(MAIN_SURFACE_SELECTOR)) this.style.setProperty('--cle-editor-pane-top', `${nativeHeaderInset(this.parentElement)}px`);
    const parent = this._connected && !this._suspended && this._editorVisible && this.parentElement?.matches(MAIN_SURFACE_SELECTOR)
      ? this.parentElement
      : null;
    if (!parent) {
      this._restoreSuppressedChildren();
      this._syncNativeViewportBounds(this.parentElement ?? this, null);
      this._nativeTitleObserver?.disconnect();
      this._nativeTitleObserver = null;
      this._nativeTitleObserverRoot = null;
      return;
    }
    if (this._suppressedParent !== parent) {
      this._restoreSuppressedChildren();
      this._suppressedParent = parent;
      this._childObserver = new MutationObserver(() => this._syncSuppression());
      this._childObserver.observe(parent, { childList: true, subtree: true });
    }

    const nativeViewport = this._nativeConversationViewport(parent);
    this._syncNativeViewportBounds(parent, nativeViewport);

    const directChildren = Array.from(parent.children);
    const nativeHeader = directChildren.find((child) => child.matches(
      "header[data-app-shell-application-menu-bar], header[data-app-shell-header-edge-scroll]",
    ));
    const nativeHeaderSubject = nativeHeader?.querySelector(
      '[data-testid="app-shell-header-context-menu-surface"]',
    ) ?? nativeHeader;
    const desired = new Set<Element>();
    // A title subject may be hidden, but never suppress the whole native toolbar.
    if (nativeHeaderSubject && nativeHeaderSubject !== nativeHeader) desired.add(nativeHeaderSubject);

    if (this._clippedLayout) {
      const titleRoot = parent.closest('[data-app-shell-active-page="true"]') ?? document;
      const focusedTitles = activePageElements<HTMLElement>(titleRoot,
        'header [data-app-shell-focus-area="main"] [data-app-shell-titlebar-content]',
      );
      const titles = focusedTitles.length ? focusedTitles :
        activePageElements<HTMLElement>(titleRoot, "header [data-app-shell-titlebar-content]");
      const title = titles.length === 1 ? titles[0] : null;
      const header = title?.closest("header") ?? null;
      const observerRoot = header?.parentElement ??
        (this._nativeTitleObserverRoot?.isConnected ? this._nativeTitleObserverRoot : document.body);
      if (observerRoot !== this._nativeTitleObserverRoot) {
        this._nativeTitleObserver?.disconnect();
        this._nativeTitleObserverRoot = observerRoot;
        this._nativeTitleObserver = observerRoot ? new MutationObserver(() => this._syncSuppression()) : null;
        this._nativeTitleObserver?.observe(observerRoot!, {
          childList: true,
          subtree: true,
          characterData: observerRoot !== document.body,
        });
      }
      const titleText = title?.textContent?.trim() || "Conversation";
      if (titleText !== this._conversationTitle) {
        this._conversationTitle = titleText;
        const tab = this._tabList.querySelector<HTMLButtonElement>('[data-tab-kind="conversation"]');
        const label = tab?.querySelector<HTMLElement>(".tab-label");
        if (label) label.textContent = titleText;
        if (tab) tab.title = titleText;
      }
      const titleRect = title?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      if (titleRect && headerRect) {
        this.style.setProperty("--cle-native-header-height", `${headerRect.height}px`);
        const titleStyle = getComputedStyle(title!);
        this.style.setProperty("--cle-native-title-line-height", titleStyle.lineHeight);
        desired.add(title!);
      }
    }

    if (this._state.activePath !== null) {
      if (this._clippedLayout && nativeViewport) {
        desired.add(nativeViewport);
      } else {
        for (const child of directChildren) {
          if (child !== this && child !== nativeHeader) desired.add(child);
        }
      }
    }

    for (const child of Array.from(this._suppressedChildren.keys())) {
      if (!desired.has(child)) this._restoreSuppressedChild(child);
    }
    for (const child of desired) this._suppressChild(child);
  }

  _suppressChild(child: Element): void {
    if (this._suppressedChildren.has(child)) return;
    const style = (child as HTMLElement).style;
    this._suppressedChildren.set(child, {
      inert: child.getAttribute("inert"),
      ariaHidden: child.getAttribute("aria-hidden"),
      opacity: style.getPropertyValue("opacity"),
      opacityPriority: style.getPropertyPriority("opacity"),
    });
    child.setAttribute("inert", "");
    child.setAttribute("aria-hidden", "true");
    style.setProperty("opacity", "0", "important");
  }

  _restoreSuppressedChild(child: Element): void {
    const attributes = this._suppressedChildren.get(child);
    if (!attributes) return;
    restoreAttribute(child, "inert", attributes.inert);
    restoreAttribute(child, "aria-hidden", attributes.ariaHidden);
    const style = (child as HTMLElement).style;
    if (attributes.opacity) style.setProperty("opacity", attributes.opacity, attributes.opacityPriority);
    else style.removeProperty("opacity");
    this._suppressedChildren.delete(child);
  }

  _restoreSuppressedChildren(): void {
    this._childObserver?.disconnect();
    this._childObserver = null;
    for (const child of Array.from(this._suppressedChildren.keys())) this._restoreSuppressedChild(child);
    this._suppressedChildren.clear();
    this._suppressedParent = null;
  }

  _required<T extends Element>(selector: string): T {
    const element = this._shadow.querySelector<T>(selector);
    if (!element) throw new Error(`Missing main preview element: ${selector}`);
    return element;
  }

  _savePanePreference(): void {
    try { this.ownerDocument.defaultView?.localStorage.setItem(EDITOR_PANE_KEY, JSON.stringify(this._panePreference)); } catch { /* Keep the current session usable. */ }
  }

  _resizePane(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this._paneResizeCleanup?.();
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = this.getBoundingClientRect().width;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      this._panePreference.width = Math.max(260, Math.min(1200, startWidth + startX - next.clientX));
      if (this.parentElement) this._editorPane.apply(this.parentElement, this._panePreference.width);
    };
    const finish = () => { cleanup(); this._savePanePreference(); };
    const cleanup = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      handle.removeEventListener('lostpointercapture', finish);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      this._paneResizeCleanup = undefined;
    };
    this._paneResizeCleanup = cleanup;
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  }
}


export function registerMainPreviewElement(): void {
  if (!customElements.get(MAIN_PREVIEW_TAG)) {
    customElements.define(MAIN_PREVIEW_TAG, CodeCodexMainPreviewElement);
  }
}


declare global {
  interface HTMLElementTagNameMap {
    "code-codex-main-preview": CodeCodexMainPreviewElement;
  }

  interface HTMLElementEventMap {
    "cle-main-preview-activate": MainPreviewActivateEvent;
    "cle-main-preview-close": MainPreviewCloseEvent;
    "cle-main-preview-draft": MainPreviewDraftEvent;
    "cle-main-preview-save": MainPreviewSaveEvent;
    "cle-main-preview-reload": MainPreviewReloadEvent;
  }
}
