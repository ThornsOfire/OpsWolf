import {expectedBundleTag,registeredExplorerIdentity} from './ui-build-identity.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {launchFixture, delay} from './browser-fixture.mjs';

// Full explorer composition with a synthetic public host and authenticated bridge responses.
// A canonical thread can appear before the native workspace metadata becomes available.
const repo = resolve(import.meta.dirname, '..');
const bundlePath = resolve(process.argv[2] ?? resolve(repo, 'packages/explorer-ui/dist/explorer.js'));
const expectedTag = expectedBundleTag(repo, bundlePath);
const application = readFileSync(bundlePath, 'utf8');

const html = `<!doctype html><meta charset="utf-8">
<nav data-app-navigation-rail><button id="home" data-sidebar-destination="builtin:home" aria-current="page">Home</button></nav>
<button hidden data-app-shell-sidebar-trigger></button>
<div data-app-shell-workspace-row="true">
  <aside class="app-shell-left-panel">
    <button id="thread" data-app-action-sidebar-thread-host-id="local" data-app-action-sidebar-thread-kind="local">Thread</button>
  </aside>
  <div data-app-shell-active-page="true">
    <div data-app-shell-page-surface="true">
      <header data-app-shell-titlebar><span data-app-shell-titlebar-content>Fixture</span></header>
      <div class="_MainContentClip_fixture">
        <main data-app-shell-main-surface="default">
          <article id="response"></article>
          <form id="composer" data-codex-composer-root>
            <div id="portal"><textarea>Preserve this synthetic draft</textarea></div>
            <button type="submit">Send</button>
          </form>
        </main>
      </div>
    </div>
  </div>
</div>
<script>
  const thread = document.getElementById('thread');
  const response = document.getElementById('response');
  const composer = document.getElementById('composer');
  const portal = document.getElementById('portal');
  const home = document.getElementById('home');
  const roots = {};
  const calls = [];
  const errors = [];
  const confirmed = [];
  let clears = 0;
  let holdList = false;
  let releaseList = null;
  let releaseSave = null;
  let saveRequest = null;
  window.confirm = message => { confirmed.push(message); return false; };
  let bound = null;
  let selection = 0;
  let nextThread = null;
  let holdThread = null;
  let release = null;
  function select(id, host = 'local') {
    thread.dataset.appActionSidebarThreadHostId = host;
    if (id) {
      thread.dataset.appActionSidebarThreadActive = 'true';
      thread.dataset.appActionSidebarThreadId = host + ':' + id;
      portal.dataset.aboveComposerConversationId = id;
      response.dataset.responseAnnotationConversation = id;
    } else {
      delete thread.dataset.appActionSidebarThreadActive;
      delete thread.dataset.appActionSidebarThreadId;
      delete portal.dataset.aboveComposerConversationId;
      delete response.dataset.responseAnnotationConversation;
    }
    history.pushState({}, '', id ? '/thread/' + id : '/');
  }
  composer.addEventListener('submit', event => {
    event.preventDefault();
    select(nextThread);
    response.textContent = 'Synthetic first turn';
  });
  window.__CODE_CODEX_BOOTSTRAP__ = {token:'fixture', codexVersion:'26.1029.7803.0', supported:true};
  window.__codeCodex = {request:async ({id, method, params}) => {
    if (method === 'explorer.settings.get') return {collapsed:false, panelWidth:260};
    if (method === 'explorer.context.clear') {
      clears++;
      selection++;
      bound = null;
    }
    if (method === 'explorer.context') {
      const threadId = params.threadId;
      const rootName = roots[threadId];
      calls.push({threadId, hasRoot:!!rootName});
      const generation = ++selection;
      if (holdThread === threadId) {
        holdThread = null;
        await new Promise(resolve => {release = resolve;});
      }
      if (!rootName) return {id, ok:false, error:{code:'NO_CONTEXT', message:'No local workspace.'}};
      if (generation === selection) bound = {threadId, rootName};
      return {threadId, projectName:rootName, rootName, rootPath:'C:/Fixture/' + rootName, compatible:true};
    }
    if (method === 'explorer.context.check') {
      return bound ? {threadId:bound.threadId, rootPath:'C:/Fixture/' + bound.rootName} : null;
    }
    if (method === 'explorer.list') {
      const name = bound?.rootName + '.md';
      const entries = bound && bound.rootName !== 'empty-root' ? [{name, relativePath:name, kind:'file'}] : [];
      if (holdList) {
        holdList = false;
        await new Promise(resolve => {releaseList = resolve;});
      }
      return {entries};
    }
    if (method === 'explorer.preview') return {
      kind:'text', text:'Synthetic file', sizeBytes:14, truncated:false, editable:true,
      version:'a'.repeat(64), lineEnding:'lf',
    };
    if (method === 'explorer.preview.save') {
      saveRequest = {...params, threadId:bound?.threadId};
      await new Promise(resolve => {releaseSave = resolve;});
      const text = atob(params.contentBase64);
      return {kind:'text', text, sizeBytes:text.length, truncated:false, editable:true, version:'b'.repeat(64), lineEnding:'lf'};
    }
    return {};
  }};
  addEventListener('error', event => errors.push(event.message));
  addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  const explorer = () => document.querySelector(window.fixtureExplorer.tag);
  const state = () => explorer()?.dataset.state;
  const root = () => explorer()?.shadowRoot.querySelector('.project-name')?.textContent;
  const loaded = name => state() === 'ready' && root() === name &&
    !!explorer().shadowRoot.querySelector('[data-path="' + name + '.md"]');
  const attempts = id => calls.filter(call => call.threadId === id).length;
  const viewer = () => document.querySelector(window.fixtureExplorer.previewTag);
  const mode = text => [...(viewer()?.shadowRoot.querySelectorAll('.preview-mode-button') ?? [])]
    .find(button => button.textContent === text);
  const editor = () => viewer()?.shadowRoot.querySelector('.code-editor');
</script>
<script src="/explorer.js"></script>`;

const server = createServer((request, response) => {
  const script = request.url === '/explorer.js';
  response.setHeader('Content-Type', script ? 'text/javascript' : 'text/html; charset=utf-8');
  response.end(script ? application : html);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
let browser;
const checks = [];
try {
  browser = await launchFixture(`http://127.0.0.1:${server.address().port}/`);
  const evaluate = expression => browser.evaluate(expression);
  const {version, tag} = await registeredExplorerIdentity(browser, {tag: expectedTag});
  const previewTag = 'code-codex-main-preview-v' + version.replaceAll('.', '-');
  await evaluate(`window.fixtureExplorer = Object.freeze(${JSON.stringify({tag, previewTag})});`);
  const waitFor = async (condition, budget = 4000) => {
    const until = Date.now() + budget;
    do {
      if (await evaluate(condition)) return true;
      await delay(25);
    } while (Date.now() < until);
    return false;
  };
  assert.ok(await waitFor("state() === 'no-project' && calls.length === 0"), 'blank composer stays unbound');
  checks.push('Blank composer stays unbound');
  await evaluate(`
    thread.dataset.appActionSidebarThreadActive = 'true';
    thread.dataset.appActionSidebarThreadId = 'local:client-new-thread:temporary_fixture';
  `);
  await delay(100);
  assert.equal(await evaluate("state() === 'no-project' && calls.length === 0"), true);
  checks.push('Temporary ID without qualified annotations is unbound');

  for (const [id, name] of [['new_fixture_a', 'project-a'], ['new_fixture_b', 'project-b']]) {
    await evaluate(`select(null); nextThread = '${id}'; composer.requestSubmit();`);
    assert.ok(await waitFor(`attempts('${id}') === 1`), 'first request sees missing metadata');
    assert.equal(await evaluate('calls.at(-1).hasRoot'), false);
    await evaluate(`roots['${id}'] = '${name}'; response.textContent = 'Synthetic turn complete';`);
    const automatic = await waitFor(`loaded('${name}')`);
    if (!automatic) {
      await evaluate('select(null)');
      assert.ok(await waitFor("state() === 'no-project'"), 'baseline stays unbound');
      await evaluate(`select('${id}')`);
      assert.ok(await waitFor(`loaded('${name}')`), 'reselect recovers the correct tree');
    }
    assert.equal(automatic, true, `first send binds ${name} without Refresh or reselect`);
    checks.push(`First send binds ${name} without Refresh or reselect`);
  }

  await evaluate("select('new_fixture_a')");
  assert.ok(await waitFor("loaded('project-a')"), 'existing root binds immediately');

  // A failed first lookup may be waiting to retry when the selection changes.
  await evaluate("select('stale_fixture_a')");
  assert.ok(await waitFor("attempts('stale_fixture_a') === 1"));
  await evaluate("roots.stale_fixture_a = 'wrong-root'; select('new_fixture_b')");
  assert.ok(await waitFor("loaded('project-b')"));
  await delay(850);
  assert.equal(await evaluate("attempts('stale_fixture_a') === 1 && loaded('project-b')"), true);
  checks.push('Switching cancels the prior workspace retry');

  // A late response for a superseded request must never paint its tree.
  await evaluate("roots.delayed_fixture = 'wrong-root'; holdThread = 'delayed_fixture'; select(holdThread)");
  assert.ok(await waitFor('typeof release === "function"'));
  await evaluate("select('new_fixture_a')");
  assert.ok(await waitFor("loaded('project-a')"));
  const clearCount = await evaluate('clears');
  await evaluate('release();');
  await delay(150);
  assert.equal(await evaluate("loaded('project-a') && clears === " + clearCount), true);
  checks.push('Late response leaves the current workspace intact');

  await evaluate("select('remote_fixture', 'remote')");
  assert.ok(await waitFor("state() === 'no-project'"));
  assert.equal(await evaluate("attempts('remote_fixture')"), 0);
  assert.equal(await evaluate('composer.querySelector("textarea").value'), 'Preserve this synthetic draft');
  checks.push('Nonlocal route is unbound and the native draft is intact');

  // Leaving Home doesn't necessarily increment the workspace generation.
  await evaluate("select('leaving_fixture')");
  assert.ok(await waitFor("attempts('leaving_fixture') === 1"));
  await evaluate("home.removeAttribute('aria-current'); roots.leaving_fixture = 'return-root'");
  assert.ok(await waitFor("explorer().hasAttribute('data-home-view-hidden')"));
  await delay(650);
  assert.equal(await evaluate("attempts('leaving_fixture')"), 1);
  await evaluate("home.setAttribute('aria-current', 'page')");
  assert.ok(await waitFor("loaded('return-root')"));
  checks.push('Leaving Home cancels retry and returning binds the current root');

  await evaluate("holdList = true; select('new_fixture_b')");
  assert.ok(await waitFor('typeof releaseList === "function"'));
  await evaluate("home.removeAttribute('aria-current')");
  assert.ok(await waitFor("explorer().hasAttribute('data-home-view-hidden')"));
  await evaluate('releaseList();');
  await delay(100);
  await evaluate("home.setAttribute('aria-current', 'page')");
  assert.ok(await waitFor("loaded('project-b')"));
  checks.push('Leaving during listing cannot cache a partially initialized workspace');

  await evaluate("select('unresolved_fixture')");
  assert.ok(await waitFor("state() === 'no-project'", 11_000));
  assert.equal(await evaluate("attempts('unresolved_fixture')"), 4);
  await evaluate("roots.unresolved_fixture = 'empty-root'; explorer().refresh()");
  assert.ok(await waitFor("state() === 'empty' && root() === 'empty-root'"));
  checks.push('Retry budget ends and manual refresh can bind an empty workspace');

  await evaluate("select('new_fixture_a')");
  assert.ok(await waitFor("loaded('project-a')"));
  await evaluate(`explorer().shadowRoot.querySelector('[data-path="project-a.md"]').click()`);
  assert.ok(await waitFor("!!mode('Edit')"));
  await evaluate("mode('Edit').click()");
  assert.ok(await waitFor('!!editor()'));
  await evaluate("editor().value = 'Keep this edit'; editor().dispatchEvent(new Event('input', {bubbles:true})); select('new_fixture_b')");
  assert.ok(await waitFor('confirmed.length === 1'));
  assert.equal(await evaluate("loaded('project-a') && editor()?.value === 'Keep this edit'"), true);
  checks.push('A declined switch preserves the existing tree and editor draft');

  await evaluate("select('new_fixture_a'); mode('Save').click()");
  assert.ok(await waitFor('typeof releaseSave === "function"'));
  const beforeSaveSwitch = await evaluate("attempts('new_fixture_b')");
  await evaluate("select('new_fixture_b')");
  await delay(100);
  assert.equal(await evaluate("attempts('new_fixture_b')"), beforeSaveSwitch);
  assert.deepEqual(await evaluate('saveRequest'), {
    threadId:'new_fixture_a', relativePath:'project-a.md', expectedVersion:'a'.repeat(64),
    contentBase64:Buffer.from('Keep this edit').toString('base64'),
  });
  await evaluate('releaseSave();');
  assert.ok(await waitFor("loaded('project-b')"));
  checks.push('Verified save remains scoped to its original root before the queued switch');

  await evaluate(`explorer().shadowRoot.querySelector('[data-path="project-b.md"]').click()`);
  assert.ok(await waitFor("!!mode('Edit')"));
  await evaluate("mode('Edit').click()");
  assert.ok(await waitFor('!!editor()'));
  await evaluate("releaseSave = null; editor().value = 'Save B'; editor().dispatchEvent(new Event('input', {bubbles:true})); mode('Save').click()");
  assert.ok(await waitFor('typeof releaseSave === "function"'));
  const beforeStaleSwitch = await evaluate("attempts('new_fixture_a')");
  await evaluate("select('new_fixture_a')");
  await delay(100);
  await evaluate("home.removeAttribute('aria-current')");
  assert.ok(await waitFor("explorer().hasAttribute('data-home-view-hidden')"));
  await evaluate('releaseSave();');
  await delay(150);
  assert.equal(await evaluate("loaded('project-b') && attempts('new_fixture_a') === " + beforeStaleSwitch), true);
  await evaluate("home.setAttribute('aria-current', 'page')");
  assert.ok(await waitFor("loaded('project-a')"));
  checks.push('A queued switch that becomes stale during a save leaves the prior workspace intact');

  await evaluate("select('dismiss_fixture')");
  assert.ok(await waitFor("attempts('dismiss_fixture') === 1"));
  await evaluate("roots.dismiss_fixture = 'dismissed-root'; explorer().disable()");
  const afterDismiss = await evaluate('clears');
  await delay(650);
  assert.equal(await evaluate("attempts('dismiss_fixture') === 1 && !explorer() && clears === " + afterDismiss), true);
  checks.push('Dismissing the explorer stops a pending lookup retry');

  assert.deepEqual(await evaluate('errors'), []);
  console.log(JSON.stringify({checks}, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
