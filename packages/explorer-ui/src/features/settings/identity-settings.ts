import {DEFAULT_IDENTITY, identityProfiles, validateIdentityLogo, validateIdentityProfile, MAX_LOGO_BYTES,
  type IdentityProfile, type IdentityProfileStore} from '../../core/configuration/identity-profiles';
import {renderIdentityMark} from '../../components/identity-mark';
import {getLocale, subscribeLanguage} from '../../i18n';

/** A draft/preview inside owned Settings. Save never changes the current app identity. */
export function mountIdentitySettings(parent: HTMLElement, store: IdentityProfileStore = identityProfiles(parent.ownerDocument.defaultView!)): () => void {
  const doc = parent.ownerDocument, host = doc.createElement('details');
  host.dataset.identitySettings = 'true';
  host.innerHTML = `<summary></summary><p data-scope></p><p data-active></p>
    <label class="identity-field"><span data-profile-label></span><select data-profiles></select></label>
    <div class="identity-actions"><button type="button" data-new></button><button type="button" data-delete></button><button type="button" data-reload></button></div>
    <label class="identity-field"><span data-name-label></span><input data-name type="text" maxlength="96" autocomplete="off"></label>
    <label class="identity-field"><span data-logo-label></span><input data-logo type="file" accept="image/png,.png"></label>
    <button type="button" data-remove-logo></button>
    <label><input type="checkbox" data-custom-colors><span data-colors-label></span></label>
    <div data-colors></div><div class="identity-preview" data-preview aria-label="Identity preview"></div>
    <div class="identity-actions"><button type="button" data-save></button><button type="button" data-default></button></div>
    <p data-feedback role="status"></p><p data-limits></p>`;
  parent.append(host);
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const text = (en: string, cn: string) => getLocale() === 'zh-CN' ? cn : en;
  let disposed = false, imageGeneration = 0, imagePending = false;
  let draft: IdentityProfile, error = '', saved = false;
  const colors = {background:'#1f1f1f', foreground:'#f2f2f2', accent:'#79b8ff'};
  for (const [key, initial] of Object.entries(colors)) {
    const label = doc.createElement('label'), name = doc.createElement('span'), input = doc.createElement('input');
    label.className = 'identity-field'; name.dataset.colorLabel = key;
    input.type = 'color'; input.value = initial; input.dataset.color = key;
    input.addEventListener('input', () => { error=''; saved=false; updatePreview(); });
    label.append(name,input); q('[data-colors]').append(label);
  }
  const candidate = (): IdentityProfile => ({...draft, name: q<HTMLInputElement>('[data-name]').value,
    colors: q<HTMLInputElement>('[data-custom-colors]').checked ? {
      background:q<HTMLInputElement>('[data-color="background"]').value,
      foreground:q<HTMLInputElement>('[data-color="foreground"]').value,
      accent:q<HTMLInputElement>('[data-color="accent"]').value,
    } : null});
  function updatePreview(): void {
    const preview = q('[data-preview]');
    let valid: IdentityProfile | undefined;
    try { valid = validateIdentityProfile(candidate()); } catch (failure) { error = String((failure as Error).message); }
    if (valid) {
      renderIdentityMark(preview, valid);
      preview.style.backgroundColor = valid.colors?.background ?? '';
      preview.style.color = valid.colors?.foreground ?? '';
      preview.style.borderColor = valid.colors?.accent ?? '';
    } else {
      preview.replaceChildren();
      preview.textContent = text('Fix the fields above to preview this identity.', '请修正上方字段以预览此标识。');
      preview.removeAttribute('style');
    }
    q('[data-colors]').hidden = !q<HTMLInputElement>('[data-custom-colors]').checked;
    q<HTMLButtonElement>('[data-save]').disabled = !valid || imagePending;
    q<HTMLButtonElement>('[data-remove-logo]').disabled = !draft.logo && !imagePending;
    q('[data-feedback]').textContent = error || store.error || (saved
      ? store.restartRequired ? text('Saved. Restart required; your current identity stays active until the next app window loads.', '已保存，需要重启。当前标识将保留，直到下次加载应用窗口。')
        : text('Saved. This identity is already active.', '已保存。此标识已处于活动状态。')
      : store.restartRequired ? text('A saved identity is waiting for restart. This preview does not change the current window.', '已保存的标识等待重启。此预览不会更改当前窗口。')
        : text('Preview only. Save explicitly to use this identity after restart.', '仅为预览。请明确保存，以在重启后使用此标识。'));
  }
  function load(profile: IdentityProfile): void {
    ++imageGeneration; imagePending = false; error=''; saved=false;
    draft = {...profile, id: profile.id === 'default' ? `profile-${crypto.randomUUID()}` : profile.id};
    q<HTMLInputElement>('[data-name]').value = draft.name;
    q<HTMLInputElement>('[data-logo]').value = '';
    q<HTMLInputElement>('[data-custom-colors]').checked = !!draft.colors;
    for (const key of Object.keys(colors) as (keyof typeof colors)[]) q<HTMLInputElement>(`[data-color="${key}"]`).value = draft.colors?.[key] ?? colors[key];
    q<HTMLButtonElement>('[data-delete]').disabled = profile.id === 'default';
    updatePreview();
  }
  function list(selected = store.saved.selected): void {
    const options = [DEFAULT_IDENTITY,...store.saved.profiles].map(profile => {
      const option = doc.createElement('option'); option.value = profile.id;
      option.textContent = profile.name + (profile.id === 'default' ? text(' (default)', '（默认）') : '');
      return option;
    });
    q<HTMLSelectElement>('[data-profiles]').replaceChildren(...options);
    q<HTMLSelectElement>('[data-profiles]').value = selected;
  }
  const action = (operation: () => void) => {
    try { operation(); error=''; saved=true; list(); q<HTMLButtonElement>('[data-delete]').disabled = !store.saved.profiles.some(p => p.id === draft.id); }
    catch (failure) { error=String((failure as Error).message); saved=false; }
    updatePreview();
  };
  function translate(): void {
    const labels: [string,string,string][] = [
      ['summary','Personal identity','个人标识'],
      ['[data-scope]','Personal profiles rename our menu and settings. Colors style our name badge and this preview; they do not replace the editor theme.','个人配置可重命名本扩展的菜单与设置。颜色用于名称徽标和此预览，不会替换编辑器主题。'],
      ['[data-profile-label]','Load a saved profile','加载已保存的配置'], ['[data-new]','New profile','新建配置'], ['[data-delete]','Delete saved profile','删除已保存的配置'],
      ['[data-reload]','Reload saved profiles','重新加载已保存的配置'], ['[data-name-label]','Display name','显示名称'],
      ['[data-logo-label]','Local PNG logo (128 KiB, up to 512 × 512)','本地 PNG 标志（128 KiB，最大 512 × 512）'],
      ['[data-remove-logo]','Remove logo','移除标志'], ['[data-colors-label]','Custom identity colors','自定义标识颜色'],
      ['[data-color-label="background"]','Background','背景'], ['[data-color-label="foreground"]','Text','文字'], ['[data-color-label="accent"]','Accent','强调色'],
      ['[data-save]','Save for next launch','保存以供下次启动使用'], ['[data-default]','Use Cursadex default','使用 Cursadex 默认值'],
      ['[data-limits]','Windows title, taskbar, executable name/icon and Discord activity are not changed by this profile. Upstream credit and internal identifiers stay intact.','此配置不会更改 Windows 标题、任务栏、可执行文件名称/图标或 Discord 活动。上游署名和内部标识保持不变。'],
    ];
    for (const [selector,en,cn] of labels) q(selector).textContent = text(en,cn);
    q('[data-active]').textContent = text('Active in this window: ', '当前窗口标识：') + store.active.name;
    updatePreview();
  }
  q('[data-name]').addEventListener('input', () => { error=''; saved=false; updatePreview(); });
  q('[data-custom-colors]').addEventListener('change', () => { error=''; saved=false; updatePreview(); });
  q('[data-profiles]').addEventListener('change', () => {
    const id = q<HTMLSelectElement>('[data-profiles]').value;
    load(store.saved.profiles.find(p => p.id === id) ?? {...DEFAULT_IDENTITY});
  });
  q('[data-new]').addEventListener('click', () => { load({...DEFAULT_IDENTITY, name:text('My control center','我的控制中心')}); q<HTMLSelectElement>('[data-profiles]').value=''; });
  q('[data-save]').addEventListener('click', () => action(() => store.save(candidate())));
  q('[data-default]').addEventListener('click', () => action(() => { store.reset(); load({...DEFAULT_IDENTITY}); }));
  q('[data-delete]').addEventListener('click', () => action(() => { store.remove(draft.id); load(store.next); }));
  q('[data-reload]').addEventListener('click', () => { store.reload(); list(); load(store.next); });
  q('[data-remove-logo]').addEventListener('click', () => { ++imageGeneration; imagePending=false; draft.logo=null; error=''; saved=false; q<HTMLInputElement>('[data-logo]').value=''; updatePreview(); });
  q<HTMLInputElement>('[data-logo]').addEventListener('change', async () => {
    const file = q<HTMLInputElement>('[data-logo]').files?.[0];
    if (!file) return;
    const generation = ++imageGeneration; imagePending=true; error=''; saved=false; updatePreview();
    try {
      if (file.size > MAX_LOGO_BYTES) throw Error('Choose a PNG logo up to 128 KiB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw=''; for (const byte of bytes) raw += String.fromCharCode(byte);
      const source = validateIdentityLogo('data:image/png;base64,' + btoa(raw))!;
      const image = doc.createElement('img'); image.src=source;
      await image.decode();
      const canvas = doc.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); if (!context) throw Error('Image decoding is unavailable.');
      context.drawImage(image,0,0);
      const normalized = validateIdentityLogo(canvas.toDataURL('image/png'));
      if (disposed || generation !== imageGeneration) return;
      draft.logo=normalized;
    } catch (failure) { if (!disposed && generation === imageGeneration) error=String((failure as Error).message); }
    finally { if (!disposed && generation === imageGeneration) { imagePending=false; q<HTMLInputElement>('[data-logo]').value=''; updatePreview(); } }
  });
  list(); load(store.next); translate();
  const unsubscribe = subscribeLanguage(translate);
  return () => { disposed=true; ++imageGeneration; unsubscribe(); host.remove(); };
}
