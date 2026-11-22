import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {launchFixture, delay} from './browser-fixture.mjs';

// Exercise the shipped injector on a synthetic regular chat. The native
// title has its own position even though the chat body is in the flex row.
const bundle = readFileSync(process.argv[2] ?? new URL('../packages/explorer-ui/dist/explorer.js', import.meta.url));
const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0}#frame{height:100vh;background:linear-gradient(#111,#111)}
#row,#workspace,#holder,#page,#wrap,main{display:flex;min-width:0;flex:1;height:100%}
#rail{width:100px;flex:none}#backing{position:absolute;inset:0;background:#111;pointer-events:none}
#holder{z-index:1}#page{background:#222}header{position:fixed;z-index:3;top:8px;left:100px;right:0;display:flex}
#title{min-width:0;flex:1}#pencil{width:32px}#chat{margin-left:32px}button{background:#444}
.sidebar-navigation{background:#252525}
[class~="bg-(--app-shell-sidebar-popover-background)"]{background:var(--app-shell-sidebar-popover-background)}
</style><div id="frame" data-app-shell-frame data-app-shell-page-surface="true">
<nav data-app-navigation-rail><button data-sidebar-destination="builtin:home" aria-current="page" hidden></button></nav>
<button hidden data-app-shell-sidebar-trigger></button>
<div id="row" data-app-shell-workspace-row="true"><div id="workspace" data-app-shell-workspace="true">
<div id="backing" data-app-shell-surface-backing aria-hidden="true"></div><aside id="rail" class="app-shell-left-panel">
<div class="sidebar-navigation" data-sidebar-navigation-root><div id="flyout" data-slate-sidebar-content class="sidebar-navigation"></div></div></aside>
<div id="holder"><div id="page" data-app-shell-page-surface="true"><div id="wrap"><main data-app-shell-main-surface="default">
<article data-response-annotation-conversation="thread_panel_fixture"></article>
</main></div></div></div></div></div>
<header data-app-shell-titlebar><div data-app-shell-header-slot="start" style="position:absolute;left:0;z-index:1"><button id="pencil">New chat</button></div><div id="title" data-app-shell-main-titlebar><button id="chat">Chat</button></div><button id="end">Menu</button></header>
</div><script>window.__CODE_CODEX_BOOTSTRAP__={token:'fixture',codexVersion:'26.1117.3838.0',supported:true};
window.__codeCodex={request:async({method})=>method==='explorer.settings.get'?{panelWidth:260,collapsed:false}:{}};
</script><script src="/explorer.js"></script>`;

const server = createServer((req, res) => {
  const script = req.url === '/explorer.js';
  res.setHeader('Content-Type', script ? 'text/javascript' : 'text/html');
  res.end(script ? bundle : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await launchFixture('http://127.0.0.1:' + server.address().port);
  const inspect = browser.evaluate;
  const tree = 'document.querySelector(\'[data-mount-strategy="known:workspace-row"]\')';
  for (let i = 0; i < 80 && !await inspect(tree + '?.offsetWidth > 0'); i++) await delay(50);
  assert.ok(await inspect(tree + '?.offsetWidth > 0'), 'inline file tree mounted');
  for (const marker of ['data-code-codex-particle-image-background', 'data-code-codex-glow-horizon-background']) {
    await inspect(`document.documentElement.setAttribute('${marker}', '');
      flyout.style.setProperty('--app-shell-sidebar-popover-background', 'rgb(48, 51, 54)');
      flyout.classList.add('bg-(--app-shell-sidebar-popover-background)')`);
    assert.equal(await inspect('getComputedStyle(flyout).backgroundColor'), 'rgb(48, 51, 54)', 'hover flyout keeps the native opaque color');
    assert.equal(await inspect('getComputedStyle(flyout.parentElement).backgroundColor'), 'rgba(0, 0, 0, 0)', 'outer navigation stays translucent');
    await inspect("flyout.classList.remove('bg-(--app-shell-sidebar-popover-background)')");
    assert.equal(await inspect('getComputedStyle(flyout).backgroundColor'), 'rgba(0, 0, 0, 0)', 'docking restores panel styling');
    await inspect(`document.documentElement.removeAttribute('${marker}')`);
    assert.equal(await inspect('getComputedStyle(flyout).backgroundColor'), 'rgb(37, 37, 37)', 'effect off uses native styling');
  }
  const aligned = () => inspect(`Math.abs(chat.getBoundingClientRect().left - ${tree}.getBoundingClientRect().right - 32) < 1 &&
    end.getBoundingClientRect().right === innerWidth`);
  const clear = () => inspect(`['frame','page','backing'].every(id => {
    const style = getComputedStyle(document.getElementById(id));
    return style.backgroundImage === 'none' && style.backgroundColor === 'rgba(0, 0, 0, 0)';
  })`);
  const pencilClear = () => inspect(`Math.abs(pencil.getBoundingClientRect().left - ${tree}.getBoundingClientRect().right) < 1 && pencil.getBoundingClientRect().right <= chat.getBoundingClientRect().left + 1 && document.elementFromPoint(pencil.getBoundingClientRect().x + 16, pencil.getBoundingClientRect().y + 8) === pencil`);
  assert.ok(await pencilClear(), 'native pencil clears the expanded tree toolbar');
  const headerPass = await aligned();
  if (!headerPass) console.log(await inspect(`({
    tree:${tree}.getBoundingClientRect().toJSON(), title:title.getBoundingClientRect().toJSON(),
    chat:chat.getBoundingClientRect().left, end:end.getBoundingClientRect().right, viewport:innerWidth,
    padding:getComputedStyle(title).paddingLeft, overlap:document.documentElement.style.getPropertyValue('--code-codex-title-tree-overlap')
  })`));
  await inspect("document.documentElement.toggleAttribute('data-code-codex-code-rain-background',true)");
  const rainPass = await clear();
  assert.deepEqual({headerPass, rainPass}, {headerPass:true, rainPass:true});
  assert.equal(await inspect("getComputedStyle(chat).backgroundColor"), 'rgb(68, 68, 68)');
  await inspect("document.documentElement.removeAttribute('data-code-codex-code-rain-background')");
  assert.equal(await clear(), false);
  for (const width of [18, 320]) {
    await inspect(width === 18 ? `${tree}.setAttribute('data-collapsed','true')`
      : `${tree}.removeAttribute('data-collapsed');${tree}.style.setProperty('--cle-width','320px')`);
    await delay(100);
    assert.equal(await inspect(tree + '.offsetWidth'), width);
    assert.equal(await aligned(), true, 'chat and end control follow tree resize');
    assert.ok(await pencilClear(), 'new-chat slot follows tree resize');
  }
  await inspect("title.replaceWith(title.cloneNode(true))");
  await delay(100);
  assert.equal(await aligned(), true, 'replacement title stays aligned');
  await inspect("chat.setAttribute('data-app-shell-titlebar-content','')");
  await delay(50);
  assert.equal(await aligned(), true, 'legacy header uses its outer offset exactly once');
  await inspect("chat.removeAttribute('data-app-shell-titlebar-content')");
  await browser.command('Emulation.setDeviceMetricsOverride', {width:640,height:800,deviceScaleFactor:1,mobile:false});
  await delay(200);
  assert.equal(await inspect(tree + "?.dataset.placement ?? document.querySelector('[data-placement=drawer]')?.dataset.placement"), 'drawer');
  assert.equal(await inspect("chat.getBoundingClientRect().left"), 132, 'drawer leaves native header in place');
  console.log('Page shell header, resize, replacement, Rain backing and disable checks passed.');
} finally {
  try { await browser?.close(); } finally { server.close(); server.closeAllConnections(); }
}
