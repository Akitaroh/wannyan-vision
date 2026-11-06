import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

// Execute production functions. Only browser/encoder boundaries are replaced;
// completion order is controlled so slow mobile PNG encodes are reproducible.
function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Production section missing: ${start}`);
  return source.slice(from, to);
}

function fixture() {
  const pending = [], revoked = [], active = new Map(), listeners = new Map();
  const nodes = new Map(), timers = new Map();
  let nextURL = 0, nextTimer = 0, context;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { showModal() { this.open = true; } });
    return nodes.get(id);
  };
  context = vm.createContext({
    $: node,
    SPECIES: { dog: { label: 'いぬ' }, cat: { label: 'ねこ' } },
    setStatus: message => { node('status').textContent = message; },
    exportCanvas: () => ({
      toBlob: callback => pending.push({
        callback,
        revision: vm.runInContext('state.revision', context),
      }),
    }),
    URL: {
      createObjectURL: blob => {
        const url = `blob:test-${++nextURL}`;
        active.set(url, blob);
        return url;
      },
      revokeObjectURL: url => { revoked.push(url); active.delete(url); },
    },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    window: { addEventListener: (event, callback) => listeners.set(event, callback) },
  });
  for (const declaration of [/^const state = .*;$/m, /^let exportJob = .*;$/m, /^let exportTimer;$/m]) {
    const match = source.match(declaration);
    assert.ok(match, `Production declaration missing: ${declaration}`);
    vm.runInContext(match[0], context);
  }
  vm.runInContext([
    between('function scheduleExport()', 'function setBusy('),
    between('function invalidateExport()', 'function setAnimal('),
    between('async function prepareExport()', 'async function share()'),
    between("window.addEventListener('pagehide'", "\nsetAnimal('dog')"),
    'state.loaded = true;',
  ].join('\n'), context);
  return {
    pending, revoked, active, listeners, timers, node,
    run: expression => vm.runInContext(expression, context),
    complete(index, blob = { revision: pending[index].revision }) {
      pending[index].callback(blob);
      return blob;
    },
  };
}

test('background encoding and Save share one PNG; the displayed download URL stays valid', async () => {
  const f = fixture();
  const background = f.run('prepareExport()');
  const save = f.run('showExport()');
  assert.equal(f.pending.length, 1);
  const blob = f.complete(0);
  await Promise.all([background, save]);
  const url = f.node('download-link').href;
  assert.equal(f.node('export-dialog').open, true);
  assert.equal(f.node('export-image').src, url);
  assert.equal(f.active.get(url), blob);
  assert.equal(f.run('state.exportURL'), url);
  assert.deepEqual(f.revoked, []);
  assert.equal(await f.run('prepareExport()'), blob);
  assert.equal(f.pending.length, 1);
});

for (const order of ['new-first', 'old-first']) {
  test(`a superseded revision cannot replace or revoke the current export (${order})`, async () => {
    const f = fixture();
    const stale = f.run('prepareExport()');
    f.run('invalidateExport()');
    const save = f.run('showExport()');
    assert.equal(f.pending.length, 2);
    const oldBlob = { revision: 0 }, currentBlob = { revision: 1 };
    if (order === 'new-first') {
      f.complete(1, currentBlob);
      await save;
      f.complete(0, oldBlob);
    } else {
      f.complete(0, oldBlob);
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(f.pending.length, 2, 'stale completion must join the pending current job');
      f.complete(1, currentBlob);
    }
    assert.equal(await stale, currentBlob);
    await save;
    const url = f.node('download-link').href;
    assert.equal(f.active.get(url), currentBlob);
    assert.equal(f.run('state.blobRevision'), 1);
    assert.equal(f.run('state.exportURL'), url);
    assert.deepEqual(f.revoked, []);
    assert.equal(f.pending.length, 2);
  });
}

test('back-forward-cache pagehide keeps an open save dialog usable; final departure releases it', async () => {
  const f = fixture();
  f.run('scheduleExport()');
  const save = f.run('showExport()');
  const blob = f.complete(0);
  await save;
  const url = f.node('download-link').href;
  f.listeners.get('pagehide')({ persisted: true });
  assert.equal(f.active.get(url), blob);
  assert.equal(f.run('state.exportURL'), url);
  assert.equal(f.run('state.blob'), blob);
  assert.equal(f.node('export-dialog').open, true);
  assert.equal(f.timers.size, 1);
  f.listeners.get('pagehide')({ persisted: false });
  assert.equal(f.active.has(url), false);
  assert.equal(f.run('state.exportURL'), null);
  assert.equal(f.run('state.blob'), null);
  assert.equal(f.timers.size, 0);
});

test('a failed PNG encode can be retried', async () => {
  const f = fixture();
  const first = f.run('prepareExport()');
  f.complete(0, null);
  await assert.rejects(first, /export/);
  const retry = f.run('prepareExport()');
  assert.equal(f.pending.length, 2);
  const blob = f.complete(1);
  assert.equal(await retry, blob);
  assert.equal(f.active.get(f.run('state.exportURL')), blob);
});
