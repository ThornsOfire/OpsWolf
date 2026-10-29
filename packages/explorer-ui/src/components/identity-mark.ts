import type {IdentityProfile} from '../core/configuration/identity-profiles';

/** Renders only into a caller-owned label; never edits native app/process branding. */
export function renderIdentityMark(target: HTMLElement, profile: IdentityProfile): void {
  target.replaceChildren();
  const label = target.ownerDocument.createElement('span');
  label.textContent = profile.name;
  label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  if (profile.colors) {
    label.style.backgroundColor = profile.colors.background;
    label.style.color = profile.colors.foreground;
    label.style.borderBottom = `2px solid ${profile.colors.accent}`;
    label.style.borderRadius = '3px';
    label.style.padding = '0 4px';
  }
  if (profile.logo) {
    const image = target.ownerDocument.createElement('img');
    image.alt = ''; image.width = 18; image.height = 18;
    image.style.cssText = 'object-fit:contain;vertical-align:middle;margin-inline-end:6px;flex:none;';
    image.addEventListener('error', () => image.remove(), {once:true});
    image.src = profile.logo; target.append(image);
  }
  target.append(label);
}
