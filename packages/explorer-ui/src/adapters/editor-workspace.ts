import { activePageElements, MAIN_SURFACE_SELECTOR, qualifiedWorkspaceRowForMain } from "./codex-26.715";

/** Keep the plugin's established adapter intact. Codex 26.1117 also supports
 * a default main wrapped by a page surface in the rail's own workspace. */
export function qualifiedEditorWorkspace(main: Element, root: ParentNode = document) {
  const clipped = qualifiedWorkspaceRowForMain(main, root);
  if (clipped) return clipped;

  const page = main.parentElement?.parentElement;
  if (!page?.matches('[data-app-shell-page-surface="true"]') ||
      !main.matches('main[data-app-shell-main-surface="default"]') ||
      main.closest('[data-app-shell-active-page="false"]') ||
      !root.querySelector('[data-app-shell-sidebar-trigger]')) return null;

  const workspace = page.parentElement;
  const row = workspace?.parentElement;
  const outer = main.closest('[data-app-shell-workspace-row="true"]');
  if (!workspace || !row?.matches('[data-app-shell-workspace="true"]') ||
      !outer || row.parentElement !== outer ||
      outer.querySelectorAll(':scope > [data-app-shell-workspace="true"]').length !== 1 ||
      activePageElements(outer, MAIN_SURFACE_SELECTOR).length !== 1) return null;

  const rails = outer.querySelectorAll('aside.app-shell-left-panel');
  const rail = rails[0];
  const children = Array.from(row.children);
  if (rails.length !== 1 || rail?.parentElement !== row ||
      children.indexOf(rail) >= children.indexOf(workspace)) return null;
  return { row, workspace };
}
