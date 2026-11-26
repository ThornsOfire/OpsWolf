import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build,stop} from '../packages/explorer-ui/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import {launchFixture, delay} from './browser-fixture.mjs';

// Exercise the shipped injector on a synthetic regular chat. The native
// title has its own position even though the chat body is in the flex row.
const source = process.argv.includes('--source');
const labelIndex=process.argv.indexOf('--label'),label=labelIndex>=0?process.argv[labelIndex+1]:'run-'+Date.now();
assert.match(label,/^[a-zA-Z0-9_-]+$/);
const repo=resolve(import.meta.dirname,'..'),out=resolve(repo,'artifacts/f58-tree-layout',label);mkdirSync(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bundlePath=process.argv[2]&&!process.argv[2].startsWith('--')?resolve(process.argv[2]):resolve(repo,'packages/explorer-ui/dist/explorer.js');
const bundle = source ? (await build({entryPoints:[resolve(repo,'packages/explorer-ui/src/index.ts')],bundle:true,write:false,format:'iife',target:'chrome120',loader:{'.png':'dataurl','.webp':'dataurl'},define:{__CODE_CODEX_VERSION__:JSON.stringify(JSON.parse(readFileSync(resolve(repo,'packages/explorer-ui/package.json'))).version),__CODE_CODEX_PLUGIN_CATALOG__:'[]',__CODE_CODEX_STARTUP_EXAMPLES__:'[]',__CODE_CODEX_PIXEL_SCULPT_IMAGE__:'""',__CODE_CODEX_STARTUP_TRANSITION_CSS__:'""',__CODE_CODEX_PPT_WORKER_SOURCE__:'""',__CODE_CODEX_PPT_WASM_BASE64__:'""',__CODE_CODEX_PPT_VIEWER_STYLES__:'""'}})).outputFiles[0].contents : readFileSync(bundlePath);
const ownedSources=['packages/explorer-ui/src/inject.ts','packages/explorer-ui/src/host/tree-layout.ts'];
const sourceHashes=Object.fromEntries(ownedSources.map(path=>[path,hash(readFileSync(resolve(repo,path)))]));
const report={classification:'Production injector/tree layout in offline isolated Chrome with synthetic native panels; not native-app acceptance',source,bundlePath:source?null:bundlePath,bundleSha256:hash(bundle),sourceHashes:source?sourceHashes:undefined,fixtureSha256:hash(readFileSync(import.meta.filename)),checks:[],passed:false};
if(source)writeFileSync(resolve(out,'application.js'),bundle);
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
const check=async(name,expression)=>{const passed=await browser.evaluate(expression);report.checks.push({name,passed});assert.equal(passed,true,name);};
try {
  browser = await launchFixture('http://127.0.0.1:' + server.address().port);
  const inspect = expression => browser.evaluate(expression);
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
    padding:getComputedStyle(title).paddingLeft, overlap:document.querySelector('header').style.getPropertyValue('--cle-tree-title-overlap')
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
  report.legacyChecksPassed=true;

  // Modern native tabs and composer occupy distinct active pages; their shared
  // fixed titlebar is outside both pages and retains native inline dimensions.
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await delay(180);
  await inspect(`frame.setAttribute('data-app-shell-shared-local-frame','');page.setAttribute('data-app-shell-active-page','true');
    const nativePage=document.createElement('div');nativePage.id='native-page';nativePage.setAttribute('data-app-shell-active-page','true');nativePage.style.cssText='width:420px;flex:0 1 420px;max-width:50%;min-width:120px;height:100%';
    nativePage.innerHTML='<aside id="native-side" data-app-shell-focus-area="right-panel" style="height:100%;width:100%"><div role="tabpanel" data-app-shell-tab-panel-controller="right" data-tab-id="file:local:/C:/Fixture/notes.md">Native file contents</div></aside>';wrap.append(nativePage);
    const header=document.querySelector('header');header.style.cssText='position:fixed;top:8px;left:100px;right:auto;width:calc(100vw - 100px);height:32px;display:flex;z-index:3';
    header.innerHTML='<div data-app-shell-header-slot="start" style="position:absolute;left:0"><button id="pencil">New</button></div><div id="title" data-app-shell-main-titlebar style="flex:1;min-width:0"><button id="chat" data-app-shell-titlebar-content style="margin-left:32px">Chat</button></div><div id="native-slot" data-app-shell-titlebar-slot="content" data-app-shell-focus-area="right-panel" style="position:absolute;left:calc(100% - 420px);width:420px;height:32px"><div style="width:420px"><span data-app-shell-tab-controller="right" data-tab-id="file:local:/C:/Fixture/notes.md"><button id="native-tab" style="display:block;width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">A long native file tab title for notes.md</button></span></div></div><div id="end-slot" data-app-shell-header-slot="end" style="position:absolute;right:0;width:56px;display:flex"><div data-app-shell-header-slot-content><button id="end" style="width:28px">Menu</button></div></div>';
    window.nativeOriginal={left:header.style.left,width:header.style.width,slotWidth:document.getElementById('native-slot').style.width,headerStyle:header.style.cssText,slotStyle:document.getElementById('native-slot').style.cssText,titleStyle:document.getElementById('title').style.cssText};
    window.nativeClicks=0;document.getElementById('native-tab').onclick=()=>nativeClicks++;
    window.hit=element=>{const r=element.getBoundingClientRect();return r.width>0&&r.height>0&&element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));};
    window.geometry=()=>{const tree=document.querySelector('[data-mount-strategy="known:workspace-row"]'),header=document.querySelector('header'),r=e=>e.getBoundingClientRect();return {
      reserved:r(document.querySelector('main')).left>=r(tree).right-.75&&r(document.getElementById('native-side')).left>=r(document.querySelector('main')).right-.75,
      header:r(header).left>=r(tree).right-.75&&Math.abs(r(header).right-r(holder).right)<.75,
      tabs:r(document.getElementById('native-tab')).left>=r(document.getElementById('native-side')).left-.75&&r(document.getElementById('native-tab')).right<=r(document.getElementById('end-slot')).left+.75&&r(chat).right<=r(document.getElementById('native-tab')).left+.75,
      hits:[pencil,chat,document.getElementById('native-tab'),end].every(hit)
    };};`);
  await delay(180);
  await check('Two native active pages share one external titlebar',`document.querySelectorAll('[data-app-shell-active-page="true"]').length===2&&!page.contains(document.querySelector('header'))`);
  for(const type of ['file:local:/C:/Fixture/notes.md','browser-fixture']){
    await inspect(`document.querySelector('[data-app-shell-tab-controller="right"]').dataset.tabId=${JSON.stringify(type)};document.querySelector('[data-app-shell-tab-panel-controller="right"]').dataset.tabId=${JSON.stringify(type)}`);
    for(const viewport of [1440,900,840]){
      await browser.command('Emulation.setDeviceMetricsOverride',{width:viewport,height:900,deviceScaleFactor:1,mobile:false});await delay(130);
      for(const state of ['open','resize','collapse','reopen']){
        await inspect(`(()=>{const tree=${tree};if(${JSON.stringify(state)}==='collapse')tree.collapse(true);else{tree.collapse(false);if(${JSON.stringify(state)}==='resize')tree.style.setProperty('--cle-width','340px');}})()`);await delay(100);
        await check(type+' '+viewport+' '+state+': tree reserves native content width',`geometry().reserved`);
        await check(type+' '+viewport+' '+state+': external header fits after the tree',`geometry().header`);
        await check(type+' '+viewport+' '+state+': chat/native tabs and end controls have distinct space',`geometry().tabs&&geometry().hits`);
      }
    }
  }
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await delay(140);
  for(const zoom of [1.25,1.75]){
    await inspect(`document.body.style.zoom=${JSON.stringify(zoom)}`);await delay(150);
    await check('Zoom '+zoom+': native header, tabs and hit targets retain the reserved tree boundary',`(()=>{const g=geometry();return g.reserved&&g.header&&g.tabs&&g.hits})()`);
  }
  await inspect(`document.body.style.zoom='1'`);await delay(120);
  const point=await inspect(`(()=>{const r=document.getElementById('native-tab').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await browser.command('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});
  await check('Native tab handler survives layout updates',`nativeClicks===1`);
  await inspect(`document.querySelector('header').style.width='1550px';document.getElementById('native-slot').style.width='490px';window.nativeOriginal.width='1550px';window.nativeOriginal.slotWidth='490px'`);await delay(150);
  await check('Native dimension writes are reconciled without losing hit targets',`(()=>{const g=geometry();return g.header&&g.tabs&&g.hits})()`);
  // Native replacement renders its own declarations, rather than copying the
  // extension's temporary leased dimensions as its new source of truth.
  await inspect(`(()=>{const next=document.querySelector('header').cloneNode(true);next.style.cssText=nativeOriginal.headerStyle;next.style.width=nativeOriginal.width;const slot=next.querySelector('#native-slot');slot.style.cssText=nativeOriginal.slotStyle;slot.style.width=nativeOriginal.slotWidth;slot.firstElementChild.style.cssText='width:420px';next.querySelector('#title').style.cssText=nativeOriginal.titleStyle;next.querySelectorAll('[data-code-codex-editor-control]').forEach(e=>e.remove());document.querySelector('header').replaceWith(next)})()`);await delay(150);
  await check('A replacement shared titlebar is qualified without a single-active-page assumption',`(()=>{const g=geometry();return g.header&&g.tabs&&g.hits})()`);
  await inspect(`(()=>{const other=document.createElement('header');other.id='unknown-titlebar';other.setAttribute('data-app-shell-titlebar','');other.style.cssText='position:fixed;left:100px;top:42px;width:200px;height:32px';frame.append(other)})()`);await delay(120);
  await check('Ambiguous titlebars retain native declarations instead of guessed reservations',`document.querySelector('header').style.left===nativeOriginal.left&&document.querySelector('header').style.width===nativeOriginal.width&&document.getElementById('native-slot').style.width===nativeOriginal.slotWidth`);
  await inspect(`document.getElementById('unknown-titlebar').remove()`);await delay(120);
  await check('Removing ambiguity restores the qualified geometry and hit targets',`(()=>{const g=geometry();return g.header&&g.tabs&&g.hits})()`);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:640,height:800,deviceScaleFactor:1,mobile:false});await delay(180);
  await check('Drawer fallback restores the native header and slot declarations',`document.querySelector('header').style.left===nativeOriginal.left&&document.querySelector('header').style.width===nativeOriginal.width&&document.getElementById('native-slot').style.width===nativeOriginal.slotWidth`);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await delay(140);
  await check('Returning from drawer reinstates qualified docked geometry',`(()=>{const g=geometry();return g.reserved&&g.header&&g.tabs&&g.hits})()`);
  await inspect(`window.dispatchEvent(new Event('code-codex:dismiss'));${tree}.remove()`);await delay(130);
  await check('Dismissal releases header and native slot leases',`document.querySelector('header').style.left===nativeOriginal.left&&document.querySelector('header').style.width===nativeOriginal.width&&document.getElementById('native-slot').style.width===nativeOriginal.slotWidth`);
  // On 26.1120, the main clears the tree but the end-aligned chat child can
  // extend behind it. Assert the actual scroll area, composer and titlebar.
  await browser.close();
  browser = await launchFixture('http://127.0.0.1:'+server.address().port+'/?unified');
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  for (let i=0;i<80&&!await inspect(tree+'?.offsetWidth > 0');i++) await delay(50);
  assert.ok(await inspect(tree+'?.offsetWidth > 0'),'mounted the tree in a fresh fixture');
  await inspect(`(() => {
    holder.style.display = page.style.display = 'contents';
    holder.setAttribute('data-app-shell-shared-local-frame','');
    page.setAttribute('data-app-shell-unified-tab-strip','');
    const main = document.querySelector('main'), header = document.querySelector('header');
    page.prepend(header);
    header.style.cssText = 'position:fixed;left:100px;right:0;top:8px;height:32px;display:flex';
    title.style.cssText = 'position:absolute;left:0;right:400px';
    end.style.cssText = 'position:absolute;right:0;z-index:2';
    const tabs = document.createElement('div');
    tabs.setAttribute('data-app-shell-focus-area','right-panel');
    tabs.style.cssText = 'position:absolute;right:0;width:400px';
    tabs.innerHTML = '<button id="file-tab" data-app-shell-tab-controller="right">Sample file</button>';
    header.append(tabs);
    const layout = document.createElement('div');
    layout.setAttribute('data-app-shell-main-content-layout','');
    layout.setAttribute('data-app-shell-workspace-layout','');
    layout.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column';
    const content = document.createElement('div');
    content.id = 'chat-content';
    content.style.cssText = 'width:calc(100vw - 500px);min-width:100%;align-self:flex-end';
    window.hostChatWidth = content.style.width;
    content.innerHTML = '<div data-app-shell-focus-area="main"><div data-app-shell-active-page="true"><div class="thread-scroll-container"></div><div data-pip-obstacle="thread-footer">Composer</div></div></div>';
    content.querySelector('.thread-scroll-container').append(main.querySelector('article'));
    layout.append(content);
    const right = document.createElement('aside');
    right.id = 'unified-aside';right.setAttribute('data-app-shell-focus-area','right-panel');
    right.setAttribute('data-app-shell-active-page','true');right.style.cssText='width:400px;flex:none';
    main.replaceChildren(layout,right);
    window.unifiedBounds = () => {
      const rect = el=>el.getBoundingClientRect(), dock = rect(document.querySelector('[data-mount-strategy="known:workspace-row"]'));
      const pane = rect(right), scroll = rect(content.querySelector('.thread-scroll-container')), footer = rect(content.querySelector('[data-pip-obstacle]'));
      const strip=rect(header),tab=rect(document.getElementById('file-tab'));
      return {body: Math.abs(scroll.left-dock.right)<1 && Math.abs(footer.left-dock.right)<1 && Math.abs(scroll.right-pane.left)<1,
        header: Math.abs(strip.left-dock.right)<1 && Math.abs(strip.right-pane.right)<1,
        tabs: Math.abs(tab.left-pane.left)<1 && tab.right<=pane.right+1,
        hit:[pencil,chat,document.getElementById('file-tab'),end].every(button=>{const b=rect(button);return button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})};
    };
    window.resizeNativeSplit = width => {
      right.style.width = tabs.style.width = title.style.right = width+'px';
      content.style.width = 'calc(100vw - '+(width+100)+'px)';
    };
  })()`);
  await delay(200);
  for (const [label,action] of [
    ['open',''],['resize',tree+".style.setProperty('--cle-width','310px')"],
    ['collapse',tree+'.collapse(true)'],['reopen',tree+'.collapse(false)']
  ]) {
    if (action) await inspect(action);
    await delay(120);
    await check('Unified tab strip '+label+': rendered conversation and composer clear tree','unifiedBounds().body');
    await check('Unified tab strip '+label+': title and tab respect native split','unifiedBounds().header && unifiedBounds().tabs && unifiedBounds().hit');
  }
  await inspect("rail.style.width='200px';document.querySelector('header').style.left='200px'");
  await delay(120);
  await check('Unified tab strip reserves width with expanded native rail','Object.values(unifiedBounds()).every(Boolean)');
  // Native sidebar on/off can insert an unmarked, zero-height portal anchor
  // between the tree and shared frame. Recover only our owned host placement.
  await inspect(`window.originalFileTab=document.getElementById('file-tab');
    window.nativeTabClicks=0;originalFileTab.addEventListener('click',()=>nativeTabClicks++);
    const draft=document.createElement('textarea');draft.id='native-draft';draft.value='Native draft remains';
    document.getElementById('unified-aside').append(draft);draft.focus();draft.setSelectionRange(4,9);
    window.sidebarAnchor=document.createElement('div');sidebarAnchor.style.cssText='position:absolute;bottom:0;left:0;width:200px;height:0';
    holder.parentElement.insertBefore(sidebarAnchor,holder);`);
  await delay(200);
  await check('Sidebar anchor insertion restores the owned tree beside its qualified workspace',tree+'.nextElementSibling === holder');
  await check('Sidebar anchor insertion retains chat/header reservation and native tab hit targets','Object.values(unifiedBounds()).every(Boolean)');
  await check('Reconciliation preserves the native tab node, draft, focus and selection',`document.getElementById('file-tab')===originalFileTab && document.activeElement===document.getElementById('native-draft') && document.activeElement.value==='Native draft remains' && document.activeElement.selectionStart===4 && document.activeElement.selectionEnd===9`);
  await inspect('originalFileTab.click()');
  await check('The original native tab handler still owns its click','nativeTabClicks===1');
  await inspect(tree+'.collapse(true)');await delay(120);
  await inspect(tree+'.collapse(false)');await delay(120);
  await check('Tree close/reopen after a sidebar transition retains repaired alignment',tree+'.nextElementSibling===holder && Object.values(unifiedBounds()).every(Boolean)');
  for(let i=0;i<3;i++){
    await inspect('sidebarAnchor.remove();holder.parentElement.insertBefore(sidebarAnchor,holder)');
    await delay(120);
    await check('Repeated sidebar anchor transition '+i+' preserves placement without duplicate hosts',tree+`.nextElementSibling===holder && document.querySelectorAll('[data-mount-strategy="known:workspace-row"]').length===1 && Object.values(unifiedBounds()).every(Boolean)`);
  }
  await inspect('sidebarAnchor.remove();document.getElementById("native-draft").remove()');
  await delay(120);
  await inspect('resizeNativeSplit(525)');
  await delay(120);
  await check('Native split resize preserves chat reflow and tab hit targets','Object.values(unifiedBounds()).every(Boolean)');
  await inspect('resizeNativeSplit(400)');
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1920,height:1040,deviceScaleFactor:1,mobile:false});
  await inspect("document.body.style.zoom='1.3'");
  await delay(120);
  await check('Unified tab strip at 130% zoom keeps the tree and both columns distinct','Object.values(unifiedBounds()).every(Boolean)');
  await inspect("document.body.style.zoom=''");
  await browser.command('Emulation.setDeviceMetricsOverride',{width:720,height:900,deviceScaleFactor:1,mobile:false});
  await delay(180);
  await check('Unified drawer restores the host header start and chat width',`document.querySelector('[data-placement="drawer"]') !== null && document.querySelector('header').style.left==='200px' && getComputedStyle(document.getElementById('chat-content')).maxWidth==='none'`);
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await delay(180);
  await check('Returning from unified drawer restores inline space','Object.values(unifiedBounds()).every(Boolean)');
  await inspect(tree+'.disable()');
  await delay(100);
  await check('Unified tab strip releases sizing on dismissal',`!document.querySelector('[data-mount-strategy]') && document.querySelector('header').style.left==='200px' && document.getElementById('chat-content').style.width===hostChatWidth && getComputedStyle(document.getElementById('chat-content')).maxWidth==='none'`);
  report.passed=true;
  console.log('Page shell header, resize, replacement, Rain backing and disable checks passed.');
} catch(error) {
  report.error=String(error);report.fixtureDiagnostics=error.fixtureDiagnostics;
  try{report.geometry=await browser?.evaluate(`({geometry:window.geometry?.(),tree:document.querySelector('[data-mount-strategy="known:workspace-row"]')?.getBoundingClientRect().toJSON(),header:document.querySelector('header')?.getBoundingClientRect().toJSON(),nativeSlot:document.getElementById('native-slot')?.getBoundingClientRect().toJSON(),nativeAside:document.getElementById('native-side')?.getBoundingClientRect().toJSON()})`);}catch{}
  throw error;
} finally {
  try { await browser?.close(); } finally { server.close(); server.closeAllConnections(); }
  if(source)report.sourceStableDuringRun=ownedSources.every(path=>hash(readFileSync(resolve(repo,path)))===sourceHashes[path]);
  writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await stop();
}
