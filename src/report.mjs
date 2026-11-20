import {LAYERS, STATUS_CLASSES, TIMINGS, incompleteSpans} from './netlog.mjs';

export const WORDS = {
  en: {
    title: 'NetLog Brief', summary: 'Capture summary', comparison: 'Capture comparison', metric: 'Measure',
    errors: 'Network errors', error: 'Chromium error', http: 'HTTP responses', status: 'Status class',
    stages: 'Network activity', layer: 'Layer', latency: 'Operation timings', operation: 'Operation',
    quality: 'Capture coverage', totals: 'Overview', events: 'Event records', errorEvents: 'Error observations',
    responseHeaders: 'Response header events', cancelled: 'Cancelled operations', pending: 'Pending I/O events',
    skipped: 'Malformed rows skipped', unmappedTypeIds: 'Unmapped type IDs', unreadableStatus: 'Unreadable HTTP status',
    incomplete: 'Unpaired or invalid timing records', timingDetail: 'Cells show p50 / p95 in milliseconds and the sample count.',
    stageDetail: 'Cells show event count / error observations.', stageDelta: 'Δ errors',
    timingDelta: 'Δ p95 (ms)', delta: 'B − A', noneErrors: 'No negative network errors counted.',
    noneHttp: 'No readable HTTP status line in the supported header events.', noSamples: 'No samples',
    evidence: 'Each count describes events in the whole capture. One failed operation can appear in several events. Differences alone cannot establish a root cause.',
    privacy: 'Only fixed labels, counts and relative timing statistics are included.',
    dns: 'DNS', tcp: 'TCP', tls: 'TLS', quic: 'QUIC / HTTP/3', httpLayer: 'HTTP', request: 'URL request', other: 'Other',
    dnsLookup: 'DNS lookup', tcpConnect: 'TCP connect', tlsHandshake: 'TLS handshake', httpReadHeaders: 'HTTP header read',
    invalidJson: 'The file is incomplete or is not valid JSON. Stop logging before opening it.',
    notNetlog: 'Choose a Chromium NetLog JSON file containing an events array.',
    missingTypes: 'This file lacks the event-type dictionary needed to read numeric event IDs.',
    tooLarge: 'The file exceeds 32 MiB. Use a shorter capture.',
    tooManyEvents: 'The file exceeds 250,000 events. Use a shorter capture.',
    unreadable: 'The file could not be read.', arguments: 'Check the arguments. Run netlog-brief --help.',
  },
  uz: {
    title: 'NetLog Brief', summary: 'Bitta yozuv hisoboti', comparison: 'Ikki yozuv taqqoslanishi', metric: 'Ko‘rsatkich',
    errors: 'Tarmoq xatolari', error: 'Chromium xatosi', http: 'HTTP javoblari', status: 'Holat kodi guruhi',
    stages: 'Tarmoq hodisalari', layer: 'Tarmoq qismi', latency: 'Amallar davomiyligi', operation: 'Amal',
    quality: 'Yozuv qamrovi', totals: 'Umumiy natija', events: 'Hisoblangan hodisalar', errorEvents: 'Xato qaydlari',
    responseHeaders: 'Javob sarlavhasi qaydlari', cancelled: 'Bekor qilingan amallar', pending: 'Kutilayotgan I/O amallari',
    skipped: 'O‘tkazib yuborilgan yaroqsiz qatorlar', unmappedTypeIds: 'Nomi topilmagan hodisa kodlari',
    unreadableStatus: 'O‘qilmagan HTTP holat kodi', incomplete: 'Jufti yetishmagan yoki vaqti yaroqsiz qaydlar',
    timingDetail: 'Kataklarda p50 / p95 millisekundda va o‘lchovlar soni ko‘rsatilgan.',
    stageDetail: 'Kataklarda hodisalar soni / xato qaydlari soni ko‘rsatilgan.', stageDelta: 'Xatolar farqi',
    timingDelta: 'p95 farqi (ms)', delta: 'B − A', noneErrors: 'Hisobga olinadigan tarmoq xatosi qayd etilmagan.',
    noneHttp: 'Qo‘llab-quvvatlangan sarlavha qaydlarida o‘qiladigan HTTP holat kodi topilmadi.', noSamples: 'O‘lchov yo‘q',
    evidence: 'Sonlar butun yozuvdagi hodisalarni bildiradi. Bitta xato bir necha joyda qayd etilishi mumkin. Faqat sonlar farqiga qarab sababni aniqlab bo‘lmaydi.',
    privacy: 'Hisobotda faqat oldindan belgilangan nomlar, sanoqlar va nisbiy vaqt statistikasi bor.',
    dns: 'DNS', tcp: 'TCP', tls: 'TLS', quic: 'QUIC / HTTP/3', httpLayer: 'HTTP', request: 'URL so‘rovi', other: 'Boshqa',
    dnsLookup: 'DNS qidiruvi', tcpConnect: 'TCP ulanishi', tlsHandshake: 'TLS kelishuvi', httpReadHeaders: 'HTTP sarlavhasini o‘qish',
    invalidJson: 'Fayl chala yoki JSON shakli buzilgan. Uni ochishdan oldin yozishni to‘xtating.',
    notNetlog: 'Hodisalar ro‘yxati bor Chromium NetLog JSON faylini tanlang.',
    missingTypes: 'Raqamli hodisa kodlarini o‘qish uchun kerakli lug‘at faylda yo‘q.',
    tooLarge: 'Fayl 32 MiB dan katta. Qisqaroq yozuv oling.',
    tooManyEvents: 'Faylda 250 000 dan ortiq hodisa bor. Qisqaroq yozuv oling.',
    unreadable: 'Faylni o‘qib bo‘lmadi.', arguments: 'Parametrlarni tekshiring. netlog-brief --help buyrug‘ini ishlating.',
  },
};

export function signed(value) {
  if (value === null) return '—';
  return value > 0 ? '+' + value : String(value);
}

export function reportTables(report, lang = 'en', singleLabel = 'A') {
  const t = WORDS[lang] ?? WORDS.en;
  const pair = report.kind === 'comparison';
  const a = pair ? report.a : report;
  const b = pair ? report.b : null;
  function columns(label, last = t.delta) {
    return pair ? [label, 'A', 'B', last] : [label, singleLabel];
  }
  function row(label, av, bv) {
    return pair ? [label, av, bv, signed(bv - av)] : [label, av];
  }
  const overview = ['events', 'errorEvents', 'responseHeaders', 'cancelled', 'pending'];
  const coverage = ['skipped', 'unmappedTypeIds', 'unreadableStatus'];
  const errorKeys = [...new Set([...Object.keys(a.errors), ...Object.keys(b?.errors ?? {})])]
    .sort((x, y) => (a.errors[y] ?? 0) + (b?.errors[y] ?? 0) - (a.errors[x] ?? 0) - (b?.errors[x] ?? 0) || (x < y ? -1 : x > y ? 1 : 0));
  function stageCell(data, key) {
    return data.layers[key].events + ' / ' + data.layers[key].errors;
  }
  function timeCell(data, key) {
    const m = data.timings[key];
    return m.samples ? m.p50Ms + ' / ' + m.p95Ms + ' (n=' + m.samples + ')' : t.noSamples;
  }

  return [
    {id: 'overview', title: t.totals, cols: columns(t.metric), rows: overview.map(key => row(t[key], a.totals[key], b?.totals[key]))},
    {id: 'errors', title: t.errors, cols: columns(t.error), empty: t.noneErrors,
      rows: errorKeys.map(key => row(key, a.errors[key] ?? 0, b?.errors[key] ?? 0))},
    {id: 'http', title: t.http, cols: columns(t.status), empty: t.noneHttp,
      rows: STATUS_CLASSES.filter(key => a.http[key] || b?.http[key]).map(key => row(key, a.http[key], b?.http[key]))},
    {id: 'layers', title: t.stages, cols: columns(t.layer, t.stageDelta), note: t.stageDetail,
      rows: LAYERS.map(key => {
        const label = t[key === 'http' ? 'httpLayer' : key];
        return pair ? [label, stageCell(a, key), stageCell(b, key), signed(report.delta.layers[key].errors)] : [label, stageCell(a, key)];
      })},
    {id: 'timings', title: t.latency, cols: columns(t.operation, t.timingDelta), note: t.timingDetail,
      rows: TIMINGS.map(key => pair ? [t[key], timeCell(a, key), timeCell(b, key), signed(report.delta.p95Ms[key])] : [t[key], timeCell(a, key)])},
    {id: 'coverage', title: t.quality, cols: columns(t.metric),
      rows: [...coverage.map(key => row(t[key], a.totals[key], b?.totals[key])), row(t.incomplete, incompleteSpans(a), b ? incompleteSpans(b) : 0)]},
  ];
}

export function markdown(report, lang = 'en', singleLabel = 'A') {
  const t = WORDS[lang] ?? WORDS.en;
  const lines = ['# NetLog Brief — ' + (report.kind === 'comparison' ? t.comparison : t.summary), '', t.evidence, ''];
  const tableLine = cells => '| ' + cells.join(' | ') + ' |';
  for (const table of reportTables(report, lang, singleLabel)) {
    lines.push('## ' + table.title, '');
    if (table.note) lines.push(table.note, '');
    if (table.rows.length) {
      lines.push(tableLine(table.cols), tableLine(table.cols.map(() => '---')), ...table.rows.map(tableLine), '');
    } else lines.push(table.empty, '');
  }
  lines.push(t.privacy, '', 'Schema: ' + report.schema, '');
  return lines.join('\n');
}
