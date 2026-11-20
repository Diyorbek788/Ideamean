import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseCapture, compareSummaries} from '../src/netlog.mjs';

const marker = 'brief-local-' + randomUUID();
const root = await mkdtemp(join(tmpdir(), 'netlog-brief-smoke-'));
const server = createServer((req, res) => {
  res.writeHead(req.url.startsWith('/missing') ? 404 : 200, {'Content-Type': 'text/plain', 'X-Local-Canary': marker, 'Connection': 'close'});
  res.end('NetLog Brief integration check');
});

async function capture(name, path) {
  const file = join(root, name + '.json');
  const args = ['--headless', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
    '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--no-proxy-server',
    '--host-resolver-rules=EXCLUDE 127.0.0.1, EXCLUDE localhost, MAP * ~NOTFOUND', '--user-data-dir=' + join(root, name),
    '--log-net-log=' + file, '--dump-dom', 'http://127.0.0.1:' + server.address().port + path + '?marker=' + marker];
  await new Promise((resolve, reject) => {
    const proc = spawn(process.env.CHROMIUM_BIN || 'chromium', args, {stdio: 'ignore', timeout: 35_000});
    proc.once('error', reject);
    proc.once('close', (code, signal) => code === 0 ? resolve() : reject(new Error('Chromium exited: ' + (signal || code))));
  });
  const raw = await readFile(file, 'utf8');
  assert.ok(raw.includes(marker), 'test capture must actually contain the canary');
  const summary = parseCapture(raw);
  assert.ok(summary.totals.events > 0);
  return summary;
}

try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const a = await capture('a', '/ok');
  const b = await capture('b', '/missing');
  const report = compareSummaries(a, b);
  assert.ok(a.http['2xx'] > 0, 'expected the loopback 200 response in A');
  assert.equal(a.http['4xx'], 0, 'the baseline server only produced 2xx');
  assert.ok(b.http['4xx'] > 0, 'expected the loopback 404 response in B');
  assert.ok(report.delta.http['4xx'] > 0);
  assert.ok(!JSON.stringify(report).includes(marker));
  console.log('Chromium loopback smoke passed: A recorded 2xx, B added 4xx, and the private marker stayed out of the comparison.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(root, {recursive: true, force: true});
}
