import {userPreferences, type UserPreferenceStore, type UserPreferences} from '../../core/configuration/user-preferences';
import {getLocale, subscribeLanguage} from '../../i18n';
import {semanticThemeStyles} from '../../components/styles/appearance-tokens';
import {identityProfiles} from '../../core/configuration/identity-profiles';
import {mountIdentitySettings} from './identity-settings';
import {renderIdentityMark} from '../../components/identity-mark';

export interface PreferencesPanelPorts {
  readonly linkPermissions: () => readonly string[];
  readonly resetLinkPermissions: () => void;
}
const OWNER = Symbol.for('cursadex:preferences-panel:v1');
interface Panel { focus(): void; close(): void }

/** Owned settings, independent of the native Settings page and editor drafts. */
export function openPreferencesPanel(ports: PreferencesPanelPorts, doc: Document = document,
  preferences: UserPreferenceStore = userPreferences(doc.defaultView!)): () => void {
  const registry = doc as unknown as Record<symbol, Panel | undefined>;
  if (registry[OWNER]) { registry[OWNER]!.focus(); return registry[OWNER]!.close; }
  const previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : undefined;
  const host = doc.createElement('div'); host.dataset.cursadexSettings = 'true';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>${semanticThemeStyles}
    :host { color-scheme: light dark; }
    dialog { position:fixed; inset:0; margin:auto; box-sizing:border-box; width:min(540px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto;
      padding:24px; border:1px solid var(--cle-main-line); border-radius:12px; background:var(--cle-main-bg); color:var(--cle-main-text); font:14px/1.5 system-ui; }
    dialog::backdrop { background:#0006; } h2 { margin:0 0 12px;font-size:20px; } h3 { font-size:15px;margin:20px 0 8px; }
    label { display:flex; gap:10px; margin:12px 0; align-items:start; } input { accent-color:Highlight; margin-top:5px; flex:none; }
    p { margin:8px 0; } small { display:block; color:var(--cle-main-muted); } ul { padding-left:20px;max-height:100px;overflow:auto;overflow-wrap:anywhere; }
    footer { display:flex;justify-content:space-between;gap:12px;margin-top:20px;flex-wrap:wrap; } button { font:inherit;border:1px solid GrayText;border-radius:6px;padding:6px 10px;background:transparent;color:inherit;cursor:pointer; }
    button:disabled { opacity:.6;cursor:default; } :focus-visible { outline:2px solid Highlight;outline-offset:3px; }
    [role=status] { font-size:12px; } .credit { font-size:12px; }
    details { margin:16px 0; border-block:1px solid var(--cle-main-line);padding:12px 0; } summary { cursor:pointer; font-weight:600; }
    .identity-field { display:flex;flex-wrap:wrap;align-items:center; } .identity-field>span { flex:1;min-width:120px; }
    .identity-field :is(input,select) { box-sizing:border-box;max-width:100%;min-width:0; font:inherit;color:inherit;background:var(--cle-main-bg); }
    .identity-field input[type=text],.identity-field select { width:240px; padding:4px; }
    .identity-actions { display:flex;flex-wrap:wrap;gap:8px;margin:12px 0; }
    .identity-preview { display:flex;align-items:center;min-height:36px;padding:10px;border:2px solid var(--cle-main-line);border-radius:8px;overflow:hidden; }
    @media(forced-colors:active) { .identity-preview { color:CanvasText!important;background:Canvas!important;border-color:Highlight!important; } }
  </style><dialog aria-labelledby="settings-title"><h2 id="settings-title"></h2><p data-intro></p><div data-options></div>
  <div data-identity></div><h3 data-links-title></h3><p data-links-help></p><ul data-links></ul><button type="button" data-links-reset></button>
  <p class="credit" data-credit></p><p role="status" data-status></p><footer><button type="button" data-reset></button><button type="button" data-close autofocus></button></footer></dialog>`;
  const dialog = shadow.querySelector('dialog')!;
  const identity = identityProfiles(doc.defaultView!);
  const disposeIdentity = mountIdentitySettings(shadow.querySelector<HTMLElement>('[data-identity]')!, identity);
  const options: [Exclude<keyof UserPreferences, 'schema'>, string, string, string, string][] = [
    ['typingMeter', 'Typing speed (WPM)', '输入速度（WPM）', 'Gross characters ÷ 5 per active minute. No accuracy score or typing history.', '每活跃分钟输入字符数 ÷ 5。不会记录输入历史或准确率。'],
    ['wordWrap', 'Wrap source text', '源文本自动换行', 'Applies to our editor and source previews. Native Changes keeps its own wrap control.', '适用于本编辑器与源码预览。原生更改视图有独立的换行设置。'],
    ['minimap', 'Code minimap', '代码缩略图', 'Show the overview beside supported source files.', '在支持的源文件旁显示缩略图。'],
    ['collapseSidebar', 'Collapse sidebar after selecting a chat', '选择聊天后折叠侧边栏', 'Once per app session. Does not immediately move your current layout.', '每次应用会话执行一次，不会立即更改当前布局。'],
  ];
  const controls = options.map(([key]) => {
    const label = doc.createElement('label'), input = doc.createElement('input'), copy = doc.createElement('span');
    const name = doc.createElement('span'), help = doc.createElement('small');
    input.type = 'checkbox'; input.dataset.preference = key;
    help.id = `preference-${key}-help`; input.setAttribute('aria-describedby', help.id);
    input.addEventListener('change', () => preferences.set(key, input.checked));
    copy.append(name, help); label.append(input, copy); shadow.querySelector('[data-options]')!.append(label);
    return {key, input, name, help};
  });
  let feedback: 'reset' | 'links' | 'failed' | undefined;
  const render = () => {
    const zh = getLocale() === 'zh-CN', text = (en: string, cn: string) => zh ? cn : en;
    const set = (selector: string, value: string) => { shadow.querySelector(selector)!.textContent = value; };
    renderIdentityMark(shadow.querySelector('h2')!, {...identity.active, name:identity.active.name + text(' settings', ' 设置')});
    set('[data-intro]', text('Preferences apply immediately. Personal identity is saved separately for the next launch.', '偏好立即生效。个人标识单独保存，在下次启动时应用。'));
    for (const [index, control] of controls.entries()) {
      const option = options[index]!;
      control.input.checked = preferences.current[control.key];
      control.name.textContent = text(option[1], option[2]); control.help.textContent = text(option[3], option[4]);
    }
    set('[data-links-title]', text('Preview link permissions', '预览链接权限'));
    set('[data-links-help]', text('Resetting restores confirmation for previously allowed websites and application protocols.', '重置后，之前允许的网站和应用协议会再次要求确认。'));
    const list = shadow.querySelector('[data-links]')!;
    list.replaceChildren(...ports.linkPermissions().map(value => { const li = doc.createElement('li'); li.textContent = value; return li; }));
    set('[data-links-reset]', text('Reset link warnings', '重置链接警告'));
    shadow.querySelector<HTMLButtonElement>('[data-links-reset]')!.disabled = !list.childElementCount;
    set('[data-credit]', text('Cursadex builds on Code-Codex. Upstream tools and native Codex settings remain available.', 'Cursadex 基于 Code-Codex 构建。上游工具与 Codex 原生设置仍然可用。'));
    set('[data-reset]', text('Reset these preferences', '重置这些偏好'));
    set('[data-close]', text('Done', '完成'));
    set('[data-status]', !preferences.persisted ? text('Storage unavailable: preferences apply to this session only.', '存储不可用：偏好仅适用于本次会话。')
      : feedback === 'failed' ? text('Could not reset link permissions. Existing choices are unchanged.', '无法重置链接权限。现有选择保持不变。')
      : feedback === 'links' ? text('Link confirmations restored.', '已恢复链接确认。')
      : feedback === 'reset' ? text('Preferences reset. Files, drafts, pins, themes and link permissions are unchanged.', '偏好已重置。文件、草稿、固定标签、主题和链接权限保持不变。') : '');
  };
  const close = () => { if (dialog.open) dialog.close(); else dispose(); };
  const dispose = () => {
    if (registry[OWNER] !== panel) return;
    unsubscribe(); unlanguage(); disposeIdentity(); delete registry[OWNER]; host.remove();
    if (previous?.isConnected) previous.focus({preventScroll:true});
  };
  const panel: Panel = {focus: () => dialog.focus(), close};
  const unsubscribe = preferences.subscribe(() => { feedback = undefined; render(); });
  const unlanguage = subscribeLanguage(render);
  shadow.querySelector('[data-close]')!.addEventListener('click', close);
  shadow.querySelector('[data-reset]')!.addEventListener('click', () => { preferences.reset(); feedback = 'reset'; render(); });
  shadow.querySelector('[data-links-reset]')!.addEventListener('click', () => {
    try { ports.resetLinkPermissions(); feedback = 'links'; } catch { feedback = 'failed'; } render();
  });
  dialog.addEventListener('close', dispose, {once:true});
  registry[OWNER] = panel; doc.body.append(host); render();
  try { dialog.showModal(); } catch { dispose(); }
  return close;
}
