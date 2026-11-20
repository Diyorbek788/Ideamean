import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCapture, summarize, compareSummaries, incompleteSpans, MAX_BYTES, MAX_EVENTS} from '../src/netlog.mjs';
import {markdown} from '../src/report.mjs';
const demo = name => JSON.parse(readFileSync(new URL('../examples/demo-' + name + '.json', import.meta.url)));
const capture = (events, constants = {logEventTypes: {}}) => ({constants, events});
const tcp = (phase, time, source = 1) => ({type: 'TCP_CONNECT', phase, time, source: {id: source}});
const errorEvent = code => ({type: 'URL_REQUEST_START_JOB', params: {net_error: code}});
const header = first => ({type: 'HTTP_TRANSACTION_READ_RESPONSE_HEADERS', params: {headers: first}});
const throws = (fn, code) => assert.throws(fn, e => e.code === code && e.message === code);

test('bundled captures have reproducible observations and HTTP status groups', () => {
  const a = summarize(demo('a')), b = summarize(demo('b'));
  assert.deepEqual([a.totals.events,b.totals.events], [24,33]);
  assert.deepEqual(a.errors, {ERR_CONNECTION_TIMED_OUT:1,ERR_QUIC_PROTOCOL_ERROR:2});
  assert.equal(a.http['2xx'], 1); assert.equal(b.http['2xx'], 3);
  assert.equal(b.totals.errorEvents, 0);
  for (const s of [a,b]) {
    assert.equal(Object.values(s.layers).reduce((n,l) => n + l.events, 0), s.totals.events);
    assert.equal(Object.values(s.layers).reduce((n,l) => n + l.errors, 0), s.totals.errorEvents);
  }
});
test('event and phase dictionaries are local to each Chromium build', () => {
  for (const [id,begin,end] of [[5,1,2],[930,70,8]]) {
    const data = capture([Object.assign(tcp(begin,'100'),{type:id}),Object.assign(tcp(end,'117'),{type:id})],
      {logEventTypes:{TCP_CONNECT:id},logEventPhase:{PHASE_BEGIN:begin,PHASE_END:end}});
    assert.equal(summarize(data).timings.tcpConnect.p95Ms,17);
  }
});
test('errors exclude I/O pending and cancellations, and aggregate unfamiliar negatives', () => {
  const s = summarize(capture([-1,-3,0,-356,-90421,'-101',null].map(errorEvent)));
  assert.equal(s.totals.pending,1); assert.equal(s.totals.cancelled,1); assert.equal(s.totals.errorEvents,2);
  assert.deepEqual(s.errors,{ERR_QUIC_PROTOCOL_ERROR:1,OTHER_NET_ERROR:1});
});
test('unmapped numeric IDs and malformed event rows remain visible in coverage', () => {
  const s = summarize(capture([null,{}, {type:-3}, {type:''}, {type:99,params:{net_error:-101}}, {type:'unlisted'}]));
  assert.deepEqual([s.totals.inputEvents,s.totals.skipped,s.totals.unmappedTypeIds,s.layers.other.events],[6,4,1,2]);
  assert.equal(s.errors.ERR_CONNECTION_RESET,1);
});
test('input errors return stable codes without disclosing file contents', () => {
  throws(() => parseCapture('private data'),'invalidJson');
  throws(() => parseCapture('[]'),'notNetlog');
  throws(() => summarize({events:[{type:1}]}),'missingTypes');
  throws(() => summarize({events:Array(MAX_EVENTS+1)}),'tooManyEvents');
  throws(() => parseCapture('x'.repeat(MAX_BYTES+1)),'tooLarge');
});
test('UTF-8 byte budget also applies to multibyte input', () => {
  throws(() => parseCapture('ü'.repeat(MAX_BYTES/2+1)),'tooLarge');
});
test('BOM and a valid empty capture are supported', () => {
  const s = parseCapture('\ufeff{"constants":{"logEventTypes":{}},"events":[]}');
  assert.equal(s.totals.events,0); assert.equal(s.timings.tlsHandshake.p95Ms,null);
});
test('symbolic event names are usable without a numeric dictionary', () => {
  assert.equal(summarize({events:[errorEvent(-105)]}).errors.ERR_NAME_NOT_RESOLVED,1);
});
test('only status lines on the supported transaction header events count', () => {
  const s = summarize(capture([
    header(['HTTP/1.1 200 OK','Set-Cookie: x']),header(':status: 404\nother: 200'),
    header(['header: 500','HTTP/2 500']), header('HTTP/1.1 2000'),header(undefined),header(401),
    {type:'HTTP2_SESSION_RECV_HEADERS',params:{headers:[':status: 200']}},
    {type:'HTTP_TRANSACTION_READ_EARLY_HINTS_RESPONSE_HEADERS',params:{headers:['HTTP/1.1 103 Early Hints']}},
  ]));
  assert.equal(s.totals.responseHeaders,7); assert.equal(s.totals.unreadableStatus,4);
  assert.deepEqual(s.http,{'1xx':1,'2xx':1,'3xx':0,'4xx':1,'5xx':0});
});
test('timings use per-source stacks for overlapping and nested operations', () => {
  const s = summarize(capture([tcp(1,0,1),tcp(1,1,2),tcp(1,5,1),tcp(2,7,1),tcp(2,9,2),tcp(2,20,1)]));
  assert.deepEqual(s.timings.tcpConnect,{samples:3,p50Ms:8,p95Ms:20,openBegins:0,unmatchedEnds:0,invalid:0});
});
test('source IDs are isolated by event type, including two types for the same metric', () => {
  const s = summarize(capture([
    {...tcp(1,1),type:'HOST_RESOLVER_MANAGER_REQUEST'}, {...tcp(2,3),type:'HOST_RESOLVER_IMPL_REQUEST'},
    {...tcp(2,5),type:'HOST_RESOLVER_MANAGER_REQUEST'},
  ]));
  assert.deepEqual(s.timings.dnsLookup,{samples:1,p50Ms:4,p95Ms:4,openBegins:0,unmatchedEnds:1,invalid:0});
});
test('missing ends, ends without begins, invalid times and invalid source IDs stay explicit', () => {
  const s = summarize(capture([tcp(2,3,1),tcp(1,5,2),tcp(1,7,3),tcp(2,2,3),
    tcp(1,'',4),tcp(2,4,4),tcp(1,2,'private-host'),tcp(1,0,5),tcp(2,0,5)]));
  assert.deepEqual(s.timings.tcpConnect,{samples:1,p50Ms:0,p95Ms:0,openBegins:1,unmatchedEnds:1,invalid:3});
  assert.equal(incompleteSpans(s),5);
});
test('nearest-rank percentiles use sorted, completed spans', () => {
  const s = summarize(capture(Array.from({length:20},(_,i) => [tcp(1,0,i),tcp(2,20-i,i)]).flat()));
  assert.equal(s.timings.tcpConnect.p50Ms,10); assert.equal(s.timings.tcpConnect.p95Ms,19);
});
test('comparison signs describe B minus A, including vanished errors and missing timings', () => {
  const a = summarize(demo('a')), b = summarize(demo('b')), d = compareSummaries(a,b);
  assert.equal(d.delta.errors.ERR_QUIC_PROTOCOL_ERROR,-2); assert.equal(d.delta.http['2xx'],2);
  assert.equal(d.delta.totals.events,9);
  const empty = summarize(capture([]));
  assert.equal(compareSummaries(b,empty).delta.p95Ms.tcpConnect,null);
  assert.equal(compareSummaries(b,a).delta.totals.events,-9);
});
test('changing private fields never changes JSON or Markdown output', () => {
  const gold = demo('a'), noisy = structuredClone(gold);
  const marker = 'PRIVATE-CANARY-2daf';
  noisy.constants.clientInfo={command_line:marker};
  noisy.constants.logEventTypes[marker]=778;
  for (const e of noisy.events) {
    e.time=String(Number(e.time)+7780000); e.source.id+=7420;
    e.params={...e.params, url:'https://'+marker,ip:marker,cookies:marker,token:marker,raw_bytes:marker,
      source_dependency:{id:999,type:marker},note:'<script>'+marker};
    if (e.params.headers) e.params.headers=['HTTP/1.1 200 '+marker,'Set-Cookie: '+marker];
  }
  const a = summarize(gold), b = summarize(noisy);
  assert.deepEqual(a,b);
  const cmp = compareSummaries(a,b);
  for (const result of [b,cmp]) {
    assert.ok(!JSON.stringify(result).includes(marker));
    for (const lang of ['en','uz']) assert.ok(!markdown(result,lang).includes(marker));
  }
});
test('unknown labels and prototype-looking keys cannot enter exported text', () => {
  const data = JSON.parse('{"constants":{"logEventTypes":{"__proto__":5,"MY_PRIVATE_TYPE":7}},"events":[{"type":5},{"type":7,"params":{"net_error":-123456}}]}');
  const s = summarize(data); const out = JSON.stringify(s);
  for (const str of ['__proto__','MY_PRIVATE_TYPE','123456']) assert.ok(!out.includes(str));
  assert.equal(s.errors.OTHER_NET_ERROR,1);
});
test('reports in both languages preserve the measurements, labels and sample sizes', () => {
  const a = summarize(demo('a')), b = summarize(demo('b')), pair = compareSummaries(a,b);
  assert.match(markdown(pair,'uz'),/Tarmoq xatolari/);
  assert.match(markdown(pair),/\| ERR_QUIC_PROTOCOL_ERROR \| 2 \| 0 \| -2 \|/);
  assert.match(markdown(b,'en','B'),/\| Measure \| B \|/);
  assert.match(markdown(pair),/\(n=3\)/);
});
