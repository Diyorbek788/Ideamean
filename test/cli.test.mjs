import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseCapture} from '../src/netlog.mjs';
const file = path => fileURLToPath(new URL('../' + path,import.meta.url));
const cli = (args, input) => spawnSync(process.execPath,[file('bin/netlog-brief.mjs'),...args],{input,encoding:'utf8'});
const a = readFileSync(file('examples/demo-a.json'),'utf8');
test('CLI JSON matches the same library function, including stdin', () => {
  const r = cli(['summarize','-','--format','json'],a);
  assert.equal(r.status,0); assert.deepEqual(JSON.parse(r.stdout),parseCapture(a)); assert.equal(r.stderr,'');
});
test('CLI compares a disk file and stdin and renders Uzbek Markdown', () => {
  const r = cli(['compare',file('examples/demo-a.json'),'-','--lang','uz'],readFileSync(file('examples/demo-b.json')));
  assert.equal(r.status,0); assert.match(r.stdout,/Ikki yozuv taqqoslanishi/); assert.match(r.stdout,/ERR_QUIC_PROTOCOL_ERROR/);
});
test('CLI rejects duplicate stdin, bad format, extra file and unknown options', () => {
  for (const args of [['compare','-','-'],['summarize','-','--format','html'],['summarize','-','stray'],['--secret-option']]) {
    const r=cli(args,''); assert.equal(r.status,2); assert.equal(r.stdout,'');
  }
});
test('malformed input or missing files exit cleanly with no raw fragments or paths', () => {
  for (const [args,input] of [[['summarize','-'],'PRIVATE-CANARY'],[['summarize','/missing/PRIVATE-CANARY'],'']]) {
    const r=cli(args,input); assert.equal(r.status,1); assert.equal(r.stdout,'');
    assert.doesNotMatch(r.stderr,/PRIVATE-CANARY|SyntaxError|ENOENT/);
  }
});
test('help describes the disk, stdin, and exit-code contracts', () => {
  const r = cli(['--help']); assert.equal(r.status,0); assert.match(r.stdout,/standard input/); assert.match(r.stdout,/Exit 2/);
});
