// constants responsibility; original state keys, defaults and lifecycle retained.
import { CODEX_DARK_APPLY_TIMEOUT_MS } from "../../core/configuration/explorer";



export function isCodexRpcNamespace(value: unknown): value is Record<string,unknown> {
  // Stable Codex exposes RPC namespaces as callable proxies; older builds used objects.
  return value!==null&&(typeof value==="object"||typeof value==="function");
}



const appearanceRoles = [
  /\/app-initial-[A-Za-z0-9_-]+\.js$/,
  /\/app-shared-[A-Za-z0-9_-]+\.js$/,
  /\/run-app-action-in-primary-window-[A-Za-z0-9_-]+\.js$/,
];
const numberedRuntime = /^\.\/assets\/[0-9]+\.[A-Za-z0-9_-]+\.js$/;
const numberedAccountRole = /^(\.\/assets\/[0-9]+\.[A-Za-z0-9_-]+\.js)#cc-host=(initial|appearance)$/;

function qualifiedModuleUrl(candidate: string): URL | undefined {
  try {
    const url = new URL(candidate, location.href);
    if (url.protocol === location.protocol && url.host === location.host &&
        !url.username && !url.password && !url.href.includes('?') && !url.href.includes('#')) return url;
  } catch { /* The caller distinguishes declared hints from observed resources. */ }
  return undefined;
}

function readAppearanceHints() {
  const slots = window as unknown as Record<symbol, unknown>;
  const native = slots[Symbol.for('code-codex:appearance-module-hints:v1')];
  const account = slots[Symbol.for('code-codex:account-host-profile:v1')];
  let malformed = false;

  function field(record: unknown, key: string): unknown {
    if (record === undefined) return undefined;
    try {
      if (record !== null && typeof record === 'object') {
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        if (!descriptor || 'value' in descriptor) return descriptor?.value;
      }
    } catch { /* Malformed hint objects are independent of DOM discovery. */ }
    malformed = true;
    return undefined;
  }

  function paths(value: unknown, limit = 256): string[] {
    if (value === undefined) return [];
    let length: unknown;
    try {
      if (Array.isArray(value)) length = field(value, 'length');
    } catch { /* A revoked proxy cannot supply candidate paths. */ }
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > 4) {
      malformed = true;
      return [];
    }
    const entries: string[] = [];
    for (let index = 0; index < length; index++) {
      const entry = field(value, String(index));
      if (typeof entry === 'string' && entry.length > 0 && entry.length <= limit) entries.push(entry);
      else malformed = true;
    }
    return entries;
  }

  const named: string[] = [];
  let numbered: string[] = [];
  function addNamed(path: string, accountRole?: 'initial' | 'appearance') {
    const internal = accountRole && numberedAccountRole.exec(path);
    if (internal && internal[2] === accountRole) {
      // The account profile describes a role within a runtime. It never
      // authorizes an import without the independent native inventory.
      if (!numbered.includes(internal[1]!)) malformed = true;
      return;
    }
    const url = qualifiedModuleUrl(path);
    if (url && appearanceRoles.some(role => role.test(url.pathname))) named.push(url.href);
    else malformed = true;
  }

  if (native !== undefined) {
    if (field(native, 'schema') === 1) {
      const runtimes = paths(field(native, 'runtimes'), 200);
      numbered = runtimes.filter(path => numberedRuntime.test(path));
      if (numbered.length !== runtimes.length) malformed = true;
      for (const path of [...paths(field(native, 'initial')), ...paths(field(native, 'appearance'))]) addNamed(path);
    } else malformed = true;
  }
  for (const path of paths(field(account, 'appearance'))) addNamed(path, 'appearance');
  const accountInitial = field(account, 'initial');
  if (accountInitial !== undefined) {
    if (typeof accountInitial === 'string' && accountInitial.length > 0 && accountInitial.length <= 256) addNamed(accountInitial, 'initial');
    else malformed = true;
  }
  return { named, numbered: [...new Set(numbered)], malformed, independentHints: native !== undefined };
}

function appearanceModuleCandidates() {
  const hints = readAppearanceHints();
  const candidates = [
    ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]'), link => link.href),
    ...Array.from(document.querySelectorAll<HTMLScriptElement>("script[type=module][src]"), script => script.src),
    ...performance.getEntriesByType("resource").map(entry => entry.name),
  ];
  const urls = [...new Set([...hints.named, ...candidates.flatMap(candidate => {
    const url = qualifiedModuleUrl(candidate);
    return url ? [url.href] : [];
  })])];
  return { urls, numbered: hints.numbered, malformed: hints.malformed, independentHints: hints.independentHints };
}

/** Qualified host role modules, including a shared namespace on newer hosts. */
export function inspectCodexAppearanceModules() {
  const { urls, ...hints } = appearanceModuleCandidates();
  const named: string[] = [];
  for (const role of appearanceRoles) {
    const matches = urls.filter(candidate => role.test(new URL(candidate).pathname));
    if (matches.length > 1) throw Error('CC-APPEARANCE-ADAPTER-002: Multiple official Appearance role modules matched. stage=module-ambiguity; no setting was changed.');
    if (matches[0]) named.push(matches[0]);
  }
  return { named, ...hints };
}

export function findCodexAppearanceModules(): readonly string[] {
  return inspectCodexAppearanceModules().named;
}

export function findCodexAppInitialModule(): string|undefined {
  return findCodexAppInitialModules()[0];
}
export function findCodexAppInitialModules(): readonly string[] {
  return appearanceModuleCandidates().urls.filter(candidate=>appearanceRoles[0]!.test(new URL(candidate).pathname));
}

/** Only a loaded/preloaded official role module may supply the split dispatcher. */
export function findCodexAppearanceActionModules(): readonly string[] {
  return appearanceModuleCandidates().urls.filter(candidate=>appearanceRoles[2]!.test(new URL(candidate).pathname));
}



export function codexDarkThemeApplied(): boolean {
  const root=document.documentElement;
  const dark=root.classList.contains("electron-dark")
    ||root.classList.contains("dark")
    ||root.dataset.theme==="dark";
  const light=root.classList.contains("electron-light")
    ||root.classList.contains("light")
    ||root.dataset.theme==="light";
  return dark&&!light;
}



export function waitForCodexDarkTheme(): Promise<void> {
  return new Promise((resolve,reject) => {
    let settled=false;
    let timer=0;
    let observer: MutationObserver|undefined;
    const cleanup=(): void => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
    const finish=(): void => {
      if(settled) return;
      settled=true;
      cleanup();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    const check=(): void => {
      if(codexDarkThemeApplied()) finish();
    };
    if(codexDarkThemeApplied()) {
      finish();
      return;
    }
    observer=new MutationObserver(check);
    observer.observe(document.documentElement,{ attributes: true,attributeFilter: ["class","data-theme"] });
    timer=window.setTimeout(() => {
      if(settled) return;
      settled=true;
      cleanup();
      reject(new Error("Codex did not finish applying Dark appearance"));
    },CODEX_DARK_APPLY_TIMEOUT_MS);
    check();
  });
}

export function findCodexNumberedRuntimes(): readonly string[] {
  return readAppearanceHints().numbered;
}
