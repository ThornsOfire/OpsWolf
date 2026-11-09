import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync, mkdirSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative, sep} from 'node:path';
import {createServer} from 'node:http';
import {launchFixture} from './browser-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const ui = resolve(root, 'packages/explorer-ui');
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const cssSource = resolve(root, option('css-source') ?? 'packages/explorer-ui/src/code-rain-native-surfaces.ts');
const out = resolve(root, option('out') ?? 'artifacts/rain-embedded-messaging-surfaces');
if (!cssSource.startsWith(root + sep) || !relative(root, out).startsWith('artifacts' + sep)) throw Error('Fixture source/output must remain inside this checkout/artifacts');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
mkdirSync(out, {recursive: true});
const {build, stop} = createRequire(resolve(ui, 'package.json'))('esbuild');
const bundle = await build({
  stdin: {
    contents: `import {CODE_RAIN_NATIVE_SURFACE_CSS} from ${JSON.stringify(cssSource)};window.rainCss=CODE_RAIN_NATIVE_SURFACE_CSS;`,
    resolveDir: resolve(ui, 'src'), loader: 'ts',
  },
  bundle: true, write: false, format: 'iife',
});
stop();

// Public structural reproduction only: no native source, private state, chat
// identity or real content. The painted canvas is static, not a second renderer.
const html = `<!doctype html><html><head><style>
html{background:#101114;color:#eee;font:16px sans-serif}body{margin:0;isolation:isolate}
[data-code-codex-rain-layer]{position:fixed;inset:0;z-index:-1;pointer-events:none}
canvas{width:100%;height:100%;pointer-events:none}
[data-role=page]{width:680px;margin:20px}
main[data-app-shell-main-surface]{background:rgba(11,12,15,.58);padding:12px}
[data-role=outer],[data-role=pane],[data-role=inner],[data-role=body]{background:#181818;background-image:linear-gradient(#181818,#181818)}
.workspace{background:transparent}main.thread-pane{padding:12px}
[data-role=inner]{min-height:350px;padding:16px}
[data-role=body]{display:flex;flex-direction:column;flex:1;min-height:350px}
[data-role=avatar]{background:#414951;color:white;padding:8px;align-self:flex-start}
h1{margin:0 0 24px;font-size:22px}.bubble{background:#30343b;padding:16px;border-radius:12px}
.composer{background:#363636;padding:14px;margin-top:24px;border-radius:10px}
textarea{width:400px;height:70px;background:#242424;color:white}button{background:#484848;color:white;padding:10px}
.menu,.drop-overlay{background:#444;padding:8px;margin:8px 0}.bg-surface{background:#181818}
[data-role=ordinary]{background:#181818;padding:8px}
</style></head><body>
<div data-code-codex-particle-layer="v1" data-code-codex-rain-layer="fixture" aria-hidden="true"><canvas width="1500" height="1000"></canvas></div>
<main class="bg-surface" data-role="unrelated">Unrelated native main</main>
<div data-role="page" data-app-shell-active-page="true">
<main data-role="default-main" data-app-shell-main-surface="default"><div data-role="focus" data-app-shell-focus-area="main">
<div class="messaging-root messaging-embedded" data-role="outer"><div class="workspace" data-role="workspace"><main class="thread-pane" data-role="pane">
<div class="messaging-root messaging-embedded" data-role="inner"><div class="thread-pane flex-1" data-role="body"><h1>Embedded messaging fixture</h1>
<span data-role="avatar">Synthetic avatar</span>
<p class="bubble" data-role="bubble">Synthetic message for selection and contrast checks.</p>
<div class="composer" data-role="composer"><textarea aria-label="Synthetic draft">Disposable fixture draft</textarea><button type="button">Fixture action</button></div>
<div class="menu" data-role="menu">Synthetic menu backing</div><div class="drop-overlay" data-role="drop">Synthetic drop overlay</div>
</div></div></main></div></div>
<section data-role="ordinary">Ordinary chat surface stays native</section>
</div></main></div><script src="/fixture.js"></script></body></html>`;

const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].text : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const report = {
  scope: 'Synthetic embedded-messaging family using production Rain surface CSS; no live app acceptance',
  policy: 'Every active exact structural family is styled; this is not Dot identity or a uniqueness guarantee',
  fixtureSha256: hash(import.meta.filename), cssSource: relative(root, cssSource).split(sep).join('/'), cssSha256: hash(cssSource),
  checks: [], failures: [], passed: false,
};
try {
  browser = await launchFixture(`http://127.0.0.1:${server.address().port}`);
  report.browser = await browser.command('Browser.getVersion');
  const e = browser.evaluate;
  const check = async (name, expression) => {
    const actual = await e(expression);
    report.checks.push({name, actual});
    if (actual !== true) report.failures.push(name);
  };
  await e(`
    window.part=role=>document.querySelector('[data-role="'+role+'"]');
    window.targets=()=>['outer','pane','inner'].map(part);
    window.alpha=node=>{const color=getComputedStyle(node).backgroundColor;return color==='transparent'?0:color.startsWith('rgba')?Number(color.split(',').at(-1).replace(')','')):1};
    window.clear=()=>targets().every(node=>alpha(node)===0&&getComputedStyle(node).backgroundImage==='none');
    window.solid=()=>targets().every(node=>alpha(node)===1&&getComputedStyle(node).backgroundImage!=='none');
    window.bodyClear=()=>alpha(part('body'))===0&&getComputedStyle(part('body')).backgroundImage==='none';
    window.bodySolid=()=>alpha(part('body'))===1&&getComputedStyle(part('body')).backgroundImage!=='none';
    window.nativeBackings=()=>['composer','bubble','menu','drop','ordinary','unrelated'].every(role=>alpha(part(role))===1);
    window.geometry=()=>['default-main','outer','pane','inner','body','avatar','composer','bubble','menu','drop','ordinary','unrelated'].map(role=>{const node=part(role),r=node.getBoundingClientRect(),s=getComputedStyle(node);return [role,r.x,r.y,r.width,r.height,s.opacity,s.pointerEvents,s.position,s.zIndex,node.scrollHeight,node.clientHeight]});
    window.textarea=document.querySelector('textarea');window.button=document.querySelector('button');window.clicks=0;
    button.addEventListener('click',()=>window.clicks++);
    textarea.focus();textarea.setSelectionRange(3,12);
    window.before=JSON.stringify(geometry());
    window.layer=document.querySelector('[data-code-codex-rain-layer]');window.canvas=layer.querySelector('canvas');
    const ctx=canvas.getContext('2d');ctx.fillStyle='#101b16';ctx.fillRect(0,0,1500,1000);ctx.fillStyle='#508d65';ctx.font='18px monospace';
    for(let x=0;x<1500;x+=30)for(let y=20;y<1000;y+=30)ctx.fillText((x+y)%3?'1':'0',x,y);
    window.style=document.createElement('style');style.textContent=rainCss;document.head.append(style);
  `);
  await check('Host supports required selector and media capabilities', `CSS.supports('selector(:has(> canvas))')&&matchMedia('(forced-colors: none)').matches&&matchMedia('(prefers-reduced-transparency: no-preference)').matches`);
  await check('Without Rain ownership all three native backings remain opaque', 'solid()');
  await check('Panel body retains its opaque native backing before Rain ownership', 'bodySolid()');
  await e(`document.documentElement.setAttribute('data-code-codex-code-rain-background','fixture')`);
  await check('Exact active embedded family clears only its three blocking backings', 'clear()');
  await check('BUG-022 immediate DIV panel body also clears over the existing canvas', 'bodyClear()');
  await check('Avatar and existing native content remain opaque inside the cleared panel body', `alpha(part('avatar'))===1&&nativeBackings()`);
  await check('Existing default-main translucent mask is retained', `Math.abs(alpha(part('default-main'))-.58)<.001`);
  await check('Composer, bubble, menus, overlay, ordinary chat and unrelated main stay opaque', 'nativeBackings()');
  await check('Appearance change preserves geometry, scroll dimensions, text opacity and hit policy', 'JSON.stringify(geometry())===before');
  await check('Focus, draft value and caret selection survive appearance change', `document.activeElement===textarea&&textarea.value==='Disposable fixture draft'&&textarea.selectionStart===3&&textarea.selectionEnd===12`);
  const point = await e(`(()=>{const r=button.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await browser.command('Input.dispatchMouseEvent', {type: 'mousePressed', ...point, button: 'left', clickCount: 1});
  await browser.command('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', clickCount: 1});
  await check('Native button remains the click hit target and receives focus', 'clicks===1&&document.activeElement===button');
  await e(`const range=document.createRange();range.selectNodeContents(part('bubble'));getSelection().removeAllRanges();getSelection().addRange(range);window.selected=getSelection().toString()`);
  await e(`document.documentElement.removeAttribute('data-code-codex-code-rain-background')`);
  await check('Owner removal restores native backgrounds and preserves text selection', `solid()&&getSelection().toString()===selected&&selected==='Synthetic message for selection and contrast checks.'`);
  await check('Owner removal restores the panel body backing', 'bodySolid()');
  await e(`document.documentElement.setAttribute('data-code-codex-code-rain-background','fixture')`);
  await check('Re-enabling ownership needs no new controller or renderer', 'clear()&&document.querySelectorAll("canvas").length===1');
  await check('Re-enabling ownership clears the body without changing native content', 'bodyClear()&&nativeBackings()');

  for (const [name, change, restore] of [
    ['No canvas', 'canvas.remove()', 'layer.append(canvas)'],
    ['No Rain layer', 'layer.remove()', 'document.body.prepend(layer)'],
    ['Other background layer only', "layer.removeAttribute('data-code-codex-rain-layer')", "layer.setAttribute('data-code-codex-rain-layer','fixture')"],
    ['Unowned particle layer', "layer.removeAttribute('data-code-codex-particle-layer')", "layer.setAttribute('data-code-codex-particle-layer','v1')"],
    ['Rain canvas outside body', 'document.head.append(layer)', 'document.body.prepend(layer)'],
    ['Inactive page', "part('page').setAttribute('data-app-shell-active-page','false')", "part('page').setAttribute('data-app-shell-active-page','true')"],
    ['Missing active-page qualification', "part('page').removeAttribute('data-app-shell-active-page')", "part('page').setAttribute('data-app-shell-active-page','true')"],
    ['Wrong default main', "part('default-main').setAttribute('data-app-shell-main-surface','other')", "part('default-main').setAttribute('data-app-shell-main-surface','default')"],
    ['Wrong focus area', "part('focus').setAttribute('data-app-shell-focus-area','right-panel')", "part('focus').setAttribute('data-app-shell-focus-area','main')"],
    ['Unknown outer root', "part('outer').classList.remove('messaging-embedded')", "part('outer').classList.add('messaging-embedded')"],
    ['Malformed workspace chain', "part('workspace').classList.remove('workspace')", "part('workspace').classList.add('workspace')"],
    ['Wrong pane class', "part('pane').classList.remove('thread-pane')", "part('pane').classList.add('thread-pane')"],
    ['Unknown inner root', "part('inner').classList.remove('messaging-embedded')", "part('inner').classList.add('messaging-embedded')"],
  ]) {
    await e(change);
    await check(`${name} retains all native backings`, 'solid()&&nativeBackings()');
    await check(`${name}: panel body stays opaque`, 'bodySolid()');
    await e(restore);
    await check(`${name}: restoring qualification reapplies CSS automatically`, 'clear()');
    await check(`${name}: panel body clears again`, 'bodyClear()');
  }
  for (const role of ['focus', 'outer', 'workspace', 'pane', 'inner']) {
    await e(`part('${role}').setAttribute('data-app-shell-active-page','false')`);
    await check(`Nested inactive ${role} under active page remains opaque`, 'solid()');
    await check(`Nested inactive ${role} also protects its panel body`, 'bodySolid()');
    await e(`part('${role}').removeAttribute('data-app-shell-active-page')`);
  }
  // Retain the pane reference while breaking its direct-child relationship.
  await e(`window.savedPane=part('pane');window.extra=document.createElement('div');savedPane.replaceWith(extra);extra.append(savedPane)`);
  await check('Extra wrapper breaking direct-child chain retains native backings', 'solid()');
  await check('Broken outer direct-child chain also retains opaque body', 'bodySolid()');
  await e(`extra.replaceWith(savedPane)`);

  for (const [name, change] of [
    ['Inactive sibling workspace', "sibling.setAttribute('data-app-shell-active-page','false')"],
    ['Malformed sibling workspace', "sibling.classList.remove('workspace')"],
    ['Inactive sibling pane', "sibling.querySelector('main').setAttribute('data-app-shell-active-page','false')"],
    ['Malformed sibling pane', "sibling.querySelector('main').classList.remove('thread-pane')"],
    ['Malformed sibling inner root', "sibling.querySelector('[data-role=inner]').classList.remove('messaging-embedded')"],
  ]) {
    await e(`window.sibling=part('workspace').cloneNode(true);part('outer').append(sibling);${change}`);
    await check(`${name} is not styled by a valid neighboring chain`, `clear()&&[...sibling.querySelectorAll('[data-role=pane],[data-role=inner]')].every(node=>alpha(node)===1)`);
    await check(`${name}: neighboring body is not accidentally cleared`, `bodyClear()&&alpha(sibling.querySelector('[data-role=body]'))===1`);
    await e('sibling.remove()');
  }
  await e(`window.inactiveInner=part('inner').cloneNode(true);inactiveInner.setAttribute('data-app-shell-active-page','false');part('pane').append(inactiveInner)`);
  await check('Inactive sibling inner root remains opaque beside a valid inner root', 'clear()&&alpha(inactiveInner)===1');
  await check('Inactive sibling inner root protects its own panel body', `bodyClear()&&alpha(inactiveInner.querySelector('[data-role=body]'))===1`);
  await e('inactiveInner.remove()');

  for (const [name, change, restore] of [
    ['Inactive body itself', "part('body').setAttribute('data-app-shell-active-page','false')", "part('body').removeAttribute('data-app-shell-active-page')"],
    ['Unknown body class', "part('body').classList.remove('thread-pane')", "part('body').classList.add('thread-pane')"],
  ]) {
    await e(change);
    await check(`${name} remains opaque while the valid three wrappers still clear`, 'clear()&&bodySolid()');
    await e(restore);
    await check(`${name}: restoring shape automatically clears only the body backing`, `bodyClear()&&alpha(part('avatar'))===1&&nativeBackings()`);
  }
  await e(`window.savedBody=part('body');window.wrongTag=document.createElement('section');for(const a of savedBody.attributes)wrongTag.setAttribute(a.name,a.value);wrongTag.append(...savedBody.childNodes);savedBody.replaceWith(wrongTag)`);
  await check('Wrong body tag remains opaque despite identical class and direct parent', 'clear()&&bodySolid()');
  await e(`wrongTag.replaceWith(savedBody);savedBody.append(...wrongTag.childNodes);window.bodyWrapper=document.createElement('div');savedBody.replaceWith(bodyWrapper);bodyWrapper.append(savedBody)`);
  await check('Body at the wrong depth is not cleared through an intervening wrapper', 'clear()&&bodySolid()');
  await e(`bodyWrapper.replaceWith(savedBody);part('pane').append(savedBody)`);
  await check('Sibling body under MAIN instead of inner root keeps its native backing', 'clear()&&bodySolid()');
  await e(`part('inner').append(savedBody);window.nestedPane=document.createElement('div');nestedPane.className='thread-pane';nestedPane.style.cssText='background:#181818;background-image:linear-gradient(#181818,#181818)';savedBody.append(nestedPane)`);
  await check('Nested content thread-pane remains opaque inside the qualified cleared body', 'bodyClear()&&alpha(nestedPane)===1');
  await e(`nestedPane.remove();savedBody.classList.remove('flex-1')`);
  await check('Body qualification does not depend on the flex-1 utility class', 'bodyClear()');
  await e(`savedBody.classList.add('flex-1');savedBody.remove()`);
  await check('Removing the body leaves qualified ancestors and existing canvas intact', `clear()&&!part('body')&&document.querySelectorAll('canvas').length===1`);
  await e(`part('inner').append(savedBody)`);
  await check('Reinserted body inherits the fix without activation or hooks', 'bodyClear()&&nativeBackings()');

  for (const [name, features] of [
    ['Forced colors', [{name: 'forced-colors', value: 'active'}]],
    ['Reduced transparency', [{name: 'prefers-reduced-transparency', value: 'reduce'}]],
  ]) {
    await browser.command('Emulation.setEmulatedMedia', {features});
    await check(`${name} retains opaque backings`, 'targets().every(node=>alpha(node)===1)');
    await check(`${name} retains opaque body and avatar`, `alpha(part('body'))===1&&alpha(part('avatar'))===1`);
    await browser.command('Emulation.setEmulatedMedia', {features: []});
    await check(`${name}: returning to normal media restores scoped treatment`, 'clear()');
    await check(`${name}: returning to normal media clears body only`, `bodyClear()&&alpha(part('avatar'))===1`);
  }
  await e(`window.second=part('page').cloneNode(true);second.setAttribute('data-role','second-page');document.body.append(second)`);
  await check('Multiple legitimate active families intentionally each receive scoped treatment', `clear()&&[...second.querySelectorAll('[data-role=outer],[data-role=pane],[data-role=inner]')].every(node=>alpha(node)===0)`);
  await check('Multiple legitimate active families also clear their own immediate bodies', `bodyClear()&&alpha(second.querySelector('[data-role=body]'))===0`);
  await e(`second.setAttribute('data-app-shell-active-page','false')`);
  await check('Cached duplicate remains native while active family stays styled', `clear()&&[...second.querySelectorAll('[data-role=outer],[data-role=pane],[data-role=inner]')].every(node=>alpha(node)===1)`);
  await check('Cached duplicate body remains opaque beside active cleared body', `bodyClear()&&alpha(second.querySelector('[data-role=body]'))===1`);
  await e('second.remove()');
  await e(`window.original=part('outer');window.replacement=original.cloneNode(true);original.replaceWith(replacement)`);
  await check('Replacement native subtree receives scoped appearance without remount hooks', 'clear()&&nativeBackings()');
  await check('Replacement subtree body clears while avatar/content retain backing', `bodyClear()&&alpha(part('avatar'))===1&&nativeBackings()`);
  await e(`replacement.replaceWith(original);textarea.focus();textarea.setSelectionRange(2,7);style.remove()`);
  await check('Stylesheet disposal restores native presentation and keeps draft focus/selection', `solid()&&document.activeElement===textarea&&textarea.selectionStart===2&&textarea.selectionEnd===7&&JSON.stringify(geometry())===before`);
  await check('Stylesheet disposal restores opaque body and retains native avatar', `bodySolid()&&alpha(part('avatar'))===1`);
  await e(`document.head.append(style);document.documentElement.removeAttribute('data-code-codex-code-rain-background');document.documentElement.setAttribute('data-code-codex-glow-horizon-background','')`);
  await check('Another effect alone cannot activate embedded Rain styling', 'solid()&&nativeBackings()');
  await check('Another background effect alone leaves the body native', 'bodySolid()');
  await e(`document.documentElement.removeAttribute('data-code-codex-glow-horizon-background');document.documentElement.setAttribute('data-code-codex-code-rain-background','fixture')`);
  await check('Final qualified state preserves native layout and controls', 'clear()&&nativeBackings()&&JSON.stringify(geometry())===before');
  await check('Final body clears with native avatar, layout, focus and selection preserved', `bodyClear()&&alpha(part('avatar'))===1&&JSON.stringify(geometry())===before&&document.activeElement===textarea&&textarea.selectionStart===2&&textarea.selectionEnd===7`);
  await e('getSelection().removeAllRanges()');
  writeFileSync(resolve(out, 'fixture.png'), Buffer.from((await browser.command('Page.captureScreenshot')).data, 'base64'));
  report.passed = report.failures.length === 0;
} catch (error) {
  report.error = String(error.stack || error);
  throw error;
} finally {
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({scope: report.scope, checks: report.checks.length, failures: report.failures, passed: report.passed, report: resolve(out, 'results.json')}));
assert.equal(report.passed, true);
