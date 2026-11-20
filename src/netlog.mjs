/* NetLog Brief. Report fields are constructed explicitly; capture text stays local. */
export const SCHEMA = 'netlog-brief/v1';
export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_EVENTS = 250_000;
export const LAYERS = Object.freeze(['dns', 'tcp', 'tls', 'quic', 'http', 'request', 'other']);
export const STATUS_CLASSES = Object.freeze(['1xx', '2xx', '3xx', '4xx', '5xx']);
export const TIMINGS = Object.freeze(['dnsLookup', 'tcpConnect', 'tlsHandshake', 'httpReadHeaders']);
const TIMED_EVENTS = new Map([
  ['HOST_RESOLVER_MANAGER_REQUEST', 'dnsLookup'], ['HOST_RESOLVER_IMPL_REQUEST', 'dnsLookup'],
  ['TCP_CONNECT', 'tcpConnect'], ['SSL_CONNECT', 'tlsHandshake'],
  ['HTTP_TRANSACTION_READ_HEADERS', 'httpReadHeaders'],
]);

// Chromium's stable net_error integers. All unlisted negative codes share one bucket.
const ERROR_NAMES = new Map([
  [-2, 'ERR_FAILED'], [-7, 'ERR_TIMED_OUT'], [-21, 'ERR_NETWORK_CHANGED'],
  [-100, 'ERR_CONNECTION_CLOSED'], [-101, 'ERR_CONNECTION_RESET'],
  [-102, 'ERR_CONNECTION_REFUSED'], [-103, 'ERR_CONNECTION_ABORTED'],
  [-104, 'ERR_CONNECTION_FAILED'], [-105, 'ERR_NAME_NOT_RESOLVED'],
  [-106, 'ERR_INTERNET_DISCONNECTED'], [-107, 'ERR_SSL_PROTOCOL_ERROR'],
  [-109, 'ERR_ADDRESS_UNREACHABLE'], [-111, 'ERR_TUNNEL_CONNECTION_FAILED'],
  [-118, 'ERR_CONNECTION_TIMED_OUT'], [-130, 'ERR_PROXY_CONNECTION_FAILED'],
  [-200, 'ERR_CERT_COMMON_NAME_INVALID'], [-201, 'ERR_CERT_DATE_INVALID'],
  [-202, 'ERR_CERT_AUTHORITY_INVALID'], [-324, 'ERR_EMPTY_RESPONSE'],
  [-337, 'ERR_HTTP2_PROTOCOL_ERROR'], [-356, 'ERR_QUIC_PROTOCOL_ERROR'],
  [-358, 'ERR_QUIC_HANDSHAKE_FAILED'], [-803, 'ERR_DNS_TIMED_OUT'],
]);
const counts = (keys) => Object.fromEntries(keys.map(key => [key, 0]));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sum = values => values.reduce((total, value) => total + value, 0);

export class CaptureError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CaptureError';
    this.code = code;
  }
}

export function parseCapture(text) {
  if (typeof text !== 'string') throw new CaptureError('invalidJson');
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) {
    throw new CaptureError('tooLarge');
  }
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new CaptureError('invalidJson');
  }
  return summarize(data);
}

function layerOf(name) {
  if (!name) return 'other';
  if (/^(HOST_RESOLVER_|DNS_)/.test(name)) return 'dns';
  if (name.startsWith('TCP_')) return 'tcp';
  if (/^(SSL_|TLS_|CERT_VERIFIER_)/.test(name)) return 'tls';
  if (/^(QUIC_|HTTP3_)/.test(name)) return 'quic';
  if (/^(HTTP_|HTTP2_)/.test(name)) return 'http';
  if (name === 'REQUEST_ALIVE' || name.startsWith('URL_REQUEST_')) return 'request';
  return 'other';
}

function firstStatusClass(params) {
  const headers = params?.headers;
  const first = Array.isArray(headers) ? headers[0] : headers;
  if (typeof first !== 'string') return null;
  // Only the beginning of the first protocol status line is examined.
  const match = /^(?:HTTP\/[0-9]+(?:\.[0-9]+)?[ \t]+|:status[ \t]*:[ \t]*)([1-5])[0-9]{2}(?=[\s]|$)/i.exec(first);
  return match ? match[1] + 'xx' : null;
}

function tick(value) {
  if (typeof value === 'string' && !/^\d{1,16}$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function observeTiming(row, stacks, samples, eventName, event, phaseMap) {
  const phase = event.phase;
  const begin = phase === 'PHASE_BEGIN' || phase === (phaseMap ? phaseMap.PHASE_BEGIN : 1);
  const end = phase === 'PHASE_END' || phase === (phaseMap ? phaseMap.PHASE_END : 2);
  if (phase == null || (!begin && !end)) return;
  const sourceId = tick(event.source?.id);
  if (sourceId === null) {
    row.invalid += 1;
    return;
  }
  const key = eventName + '/' + sourceId;
  const stack = stacks.get(key);
  const time = tick(event.time);
  if (begin) {
    if (stack) stack.push(time);
    else stacks.set(key, [time]);
    row.openBegins += 1;
    return;
  }
  if (!stack) {
    row.unmatchedEnds += 1;
    return;
  }
  const start = stack.pop();
  if (!stack.length) stacks.delete(key);
  row.openBegins -= 1;
  if (start === null || time === null || time < start) row.invalid += 1;
  else samples.push(time - start);
}

export function summarize(capture) {
  if (!record(capture) || !Array.isArray(capture.events)) throw new CaptureError('notNetlog');
  if (capture.events.length > MAX_EVENTS) throw new CaptureError('tooManyEvents');
  const types = capture.constants?.logEventTypes;
  // Expanded symbolic names are accepted without constants. Numeric IDs are build-specific.
  if (!record(types) && !capture.events.some(event => record(event) && typeof event.type === 'string')) {
    throw new CaptureError('missingTypes');
  }
  const names = new Map();
  if (record(types)) {
    for (const [name, id] of Object.entries(types)) {
      if (Number.isSafeInteger(id) && id >= 0) names.set(id, name);
    }
  }
  const layers = Object.fromEntries(LAYERS.map(key => [key, {events: 0, errors: 0}]));
  const timings = Object.fromEntries(TIMINGS.map(key => [key, {
    samples: 0, p50Ms: null, p95Ms: null, openBegins: 0, unmatchedEnds: 0, invalid: 0,
  }]));
  const samples = Object.fromEntries(TIMINGS.map(key => [key, []]));
  const stacks = new Map();
  const phaseMap = record(capture.constants?.logEventPhase) ? capture.constants.logEventPhase : null;
  const errors = new Map();
  const http = counts(STATUS_CLASSES);
  const totals = {
    inputEvents: capture.events.length, events: 0, skipped: 0, unmappedTypeIds: 0,
    errorEvents: 0, cancelled: 0, pending: 0, responseHeaders: 0, unreadableStatus: 0,
  };

  for (const event of capture.events) {
    if (!record(event) || !(typeof event.type === 'string' && event.type.length > 0 ||
        Number.isSafeInteger(event.type) && event.type >= 0)) {
      totals.skipped += 1;
      continue;
    }
    const name = typeof event.type === 'string' ? event.type : names.get(event.type);
    if (name === undefined) totals.unmappedTypeIds += 1;
    const layer = layers[layerOf(name)];
    layer.events += 1;
    totals.events += 1;
    const code = event.params?.net_error;
    if (code === -1) totals.pending += 1;
    else if (code === -3) totals.cancelled += 1;
    else if (Number.isSafeInteger(code) && code < 0) {
      const label = ERROR_NAMES.get(code) ?? 'OTHER_NET_ERROR';
      errors.set(label, (errors.get(label) ?? 0) + 1);
      layer.errors += 1;
      totals.errorEvents += 1;
    }
    if (name === 'HTTP_TRANSACTION_READ_RESPONSE_HEADERS' || name === 'HTTP_TRANSACTION_READ_EARLY_HINTS_RESPONSE_HEADERS') {
      totals.responseHeaders += 1;
      const status = firstStatusClass(event.params);
      if (status) http[status] += 1;
      else totals.unreadableStatus += 1;
    }
    const metric = TIMED_EVENTS.get(name);
    if (metric) observeTiming(timings[metric], stacks, samples[metric], name, event, phaseMap);
  }
  for (const key of TIMINGS) {
    const values = samples[key].sort((a, b) => a - b);
    const row = timings[key];
    row.samples = values.length;
    if (values.length) {
      row.p50Ms = values[Math.ceil(values.length * 0.50) - 1];
      row.p95Ms = values[Math.ceil(values.length * 0.95) - 1];
    }
  }
  return {schema: SCHEMA, kind: 'summary', totals, layers,
    errors: Object.fromEntries([...errors].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
    http, timings};
}

// Both inputs must be summary objects produced by summarize() or parseCapture().
export function compareSummaries(a, b) {
  const errorKeys = [...new Set([...Object.keys(a.errors), ...Object.keys(b.errors)])].sort();
  const diff = (keys, left, right) => Object.fromEntries(keys.map(key => [key, (right[key] ?? 0) - (left[key] ?? 0)]));
  const delta = {
    totals: diff(Object.keys(a.totals), a.totals, b.totals),
    errors: diff(errorKeys, a.errors, b.errors),
    http: diff(STATUS_CLASSES, a.http, b.http),
    layers: Object.fromEntries(LAYERS.map(key => [key, diff(['events', 'errors'], a.layers[key], b.layers[key])])),
    p95Ms: Object.fromEntries(TIMINGS.map(key => {
      const left = a.timings[key].p95Ms, right = b.timings[key].p95Ms;
      return [key, left === null || right === null ? null : right - left];
    })),
  };
  return {schema: SCHEMA, kind: 'comparison', a, b, delta};
}

export function incompleteSpans(summary) {
  return sum(Object.values(summary.timings).map(row => row.openBegins + row.unmatchedEnds + row.invalid));
}
