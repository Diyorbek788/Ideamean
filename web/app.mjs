import {MAX_BYTES, CaptureError, LAYERS, summarize, parseCapture, compareSummaries} from '../src/netlog.mjs';
import {WORDS, reportTables, markdown} from '../src/report.mjs';

const UI = {
  en: {
    skip: 'Skip to workspace', language: 'Language', headline: 'Compare network captures.',
    intro: 'Turn Chromium NetLog files into a short bug report. See which errors, responses and timings changed between two runs.',
    local: 'Local processing', localDetail: 'Files stay in this browser tab.', inputs: 'Input captures', demo: 'Load example',
    clear: 'Clear all', results: 'Evidence', downloadMd: 'Save Markdown', downloadJson: 'Save JSON',
    empty: 'Choose a capture or load the example to see a report.', signals: 'Findings', timing: 'Timing & coverage',
    preview: 'Report preview', sections: 'Report sections', help: 'How to record a capture',
    g1: 'Open chrome://net-export in Chrome or edge://net-export in Edge.',
    g2: 'Keep the default privacy mode. Start logging, reproduce the issue in another tab, then stop logging.',
    g3: 'Choose the saved JSON for A. To compare, repeat the same action under the second condition and load it as B. Short, similar runs make the counts easier to interpret.',
    slotA: 'Baseline capture', slotB: 'Comparison capture', exampleTag: 'Synthetic example', fileTag: 'Local file',
    waiting: 'NetLog JSON · up to 32 MiB', choose: 'Choose file', remove: 'Remove', pick: 'Choose capture', erase: 'Remove capture',
    pair: 'Comparing A → B', single: 'Single capture', exampleMode: 'Synthetic data', realMode: 'Imported data',
    eventsShort: 'Events', errorsShort: 'Error observations', responsesShort: 'Response header events',
    chart: 'Events by layer', scope: 'Counts cover the whole capture. A single failure can produce several error events.',
    reading: 'Reading the local file…', imported: 'Capture loaded.', reset: 'Both inputs were cleared.', removed: 'Capture removed.',
    loadedDemo: 'Synthetic comparison loaded.', downloaded: 'Report file prepared.', previewTitle: 'Markdown for a bug report',
  },
  uz: {
    skip: 'Ish maydoniga o‘tish', language: 'Til', headline: 'Ikki tarmoq yozuvini solishtiring.',
    intro: 'Chromium NetLog fayllaridan qisqa hisobot oling. Ikki urinishda xatolar, HTTP javoblari va kutish vaqti qanday o‘zgarganini ko‘ring.',
    local: 'Kompyuteringizda ishlaydi', localDetail: 'Fayllar shu brauzer oynasida qoladi.', inputs: 'Tarmoq yozuvlari',
    demo: 'Misolni ochish', clear: 'Hammasini tozalash', results: 'Natijalar', downloadMd: 'Markdown saqlash',
    downloadJson: 'JSON saqlash', empty: 'Hisobotni ko‘rish uchun yozuv tanlang yoki misolni oching.',
    signals: 'Hodisalar', timing: 'Vaqt va qamrov', preview: 'Hisobot matni', sections: 'Hisobot bo‘limlari',
    help: 'Tarmoq yozuvi qanday olinadi?', g1: 'Chrome’da chrome://net-export, Edge’da edge://net-export sahifasini oching.',
    g2: 'Maxfiylik sozlamasini odatiy holatda qoldiring. Yozishni boshlang, boshqa oynada muammoni takrorlang, keyin yozishni to‘xtating.',
    g3: 'Saqlangan JSON faylini A uchun tanlang. Ikkinchi sharoitda ayni amalni takrorlab, yangi faylni B uchun oching. Qisqa, o‘xshash yozuvlarni solishtirish osonroq.',
    slotA: 'Boshlang‘ich yozuv', slotB: 'Taqqoslash yozuvi', exampleTag: 'Sun’iy misol', fileTag: 'Mahalliy fayl',
    waiting: 'NetLog JSON · 32 MiB gacha', choose: 'Fayl tanlash', remove: 'Olib tashlash', pick: 'Yozuv tanlash', erase: 'Yozuvni olib tashlash',
    pair: 'Taqqoslash A → B', single: 'Bitta yozuv', exampleMode: 'Sun’iy ma’lumot', realMode: 'Yuklangan yozuv',
    eventsShort: 'Hodisalar', errorsShort: 'Xato qaydlari', responsesShort: 'Javob sarlavhasi qaydlari',
    chart: 'Tarmoq qismlari bo‘yicha hodisalar', scope: 'Hisob butun yozuvni qamraydi. Bitta nosozlik bir necha xato qaydini berishi mumkin.',
    reading: 'Mahalliy fayl o‘qilyapti…', imported: 'Yozuv ochildi.', reset: 'Ikkala yozuv tozalandi.',
    removed: 'Yozuv olib tashlandi.', loadedDemo: 'Sun’iy misol ochildi.', downloaded: 'Hisobot fayli tayyor.',
    previewTitle: 'Xato hisobotiga qo‘shish uchun Markdown matni',
  },
};

export function mount(demos) {
  const el = id => document.getElementById(id);
  function tag(name, content, className) {
    const item = document.createElement(name);
    if (content !== undefined) item.textContent = content;
    if (className) item.className = className;
    return item;
  }
  const keys = ['a', 'b'];
  let lang = navigator.language.toLowerCase().startsWith('uz') ? 'uz' : 'en';
  let view = 'signals', example = true, message = '', errorMessage = false;
  let slots = {a: summarize(demos.a), b: summarize(demos.b)};
  const versions = {a: 0, b: 0};
  let report, label;
  const reading = new Set();
  const ui = key => UI[lang][key];
  const word = key => WORDS[lang][key];
  function notice(key = '', error = false) {
    message = key;
    errorMessage = error;
    el('notice').classList.toggle('error', error);
    el('notice').textContent = key ? (error ? word(key) : ui(key)) : '';
  }
  function resetState(withDemo) {
    versions.a++; versions.b++;
    reading.clear();
    example = withDemo; view = 'signals';
    slots = withDemo ? {a: summarize(demos.a), b: summarize(demos.b)} : {a: null, b: null};
    notice(withDemo ? 'loadedDemo' : 'reset');
    render();
  }
  async function loadFile(key, file) {
    if (!file) return;
    const ticket = ++versions[key];
    reading.add(key);
    notice('reading');
    render();
    try {
      if (file.size > MAX_BYTES) throw new CaptureError('tooLarge');
      const text = await file.text();
      if (versions[key] !== ticket) return;
      const summary = parseCapture(text);
      // The first successful real import discards both examples, even when B is loaded first.
      if (example) { slots = {a: null, b: null}; example = false; }
      slots[key] = summary;
      notice('imported');
    } catch (error) {
      if (versions[key] !== ticket) return;
      notice(error instanceof CaptureError ? error.code : 'unreadable', true);
    } finally {
      if (versions[key] === ticket) { reading.delete(key); render(); }
    }
  }

  function createSlot(key) {
    const letter = key.toUpperCase();
    const box = tag('div', undefined, 'slot ' + key);
    const title = tag('div', undefined, 'slot-title');
    const texts = tag('div');
    const titleTag = tag('h3');
    const info = tag('small');
    texts.append(titleTag, info);
    title.append(tag('span', letter, 'letter'), texts);
    const actions = tag('div', undefined, 'slot-actions');
    const input = tag('input');
    input.id = 'file-' + key; input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
    const choose = tag('button', undefined, 'choose');
    const remove = tag('button', undefined, 'clear-slot');
    choose.onclick = () => input.click();
    input.onchange = () => { const file = input.files[0]; input.value = ''; void loadFile(key, file); };
    remove.onclick = () => {
      versions[key]++; reading.delete(key); slots[key] = null;
      if (!slots.a && !slots.b) example = false;
      notice('removed'); render();
    };
    actions.append(input, choose, remove); box.append(title, actions); el('slots').append(box);
    return () => {
      const summary = slots[key];
      titleTag.textContent = ui('slot' + letter);
      info.textContent = summary ? ui(example ? 'exampleTag' : 'fileTag') + ' · ' + summary.totals.events + ' ' + ui('eventsShort').toLowerCase() : ui('waiting');
      choose.textContent = ui('choose'); choose.setAttribute('aria-label', ui('pick') + ' ' + letter);
      remove.textContent = ui('remove'); remove.setAttribute('aria-label', ui('erase') + ' ' + letter);
      remove.hidden = !summary && !reading.has(key);
    };
  }
  const updateSlots = keys.map(createSlot);
  function tableView(table) {
    const box = tag('article', undefined, 'block');
    box.append(tag('h3', table.title));
    if (table.note) box.append(tag('p', table.note));
    if (!table.rows.length) { box.append(tag('p', table.empty)); return box; }
    const scroller = tag('div', undefined, 'table-box');
    const grid = tag('table'); grid.setAttribute('aria-label', table.title);
    const head = grid.createTHead().insertRow();
    for (const col of table.cols) { const th = tag('th', col); th.scope = 'col'; head.append(th); }
    const body = grid.createTBody();
    for (const data of table.rows) {
      const tr = body.insertRow();
      data.forEach((cell, index) => tr.append(tag('td', cell, table.id === 'errors' && !index ? 'error-name' : '')));
    }
    scroller.append(grid); box.append(scroller); return box;
  }
  function chart() {
    const box = tag('article', undefined, 'block');
    const top = tag('div', undefined, 'chart-head');
    const legend = tag('div', undefined, 'legend');
    for (const k of keys.filter(k => slots[k])) {
      const name = tag('span'); name.append(tag('i', undefined, k + '-key'), k.toUpperCase()); legend.append(name);
    }
    top.append(tag('h3', ui('chart')), legend); box.append(top);
    const figure = tag('div', undefined, 'chart');
    const active = keys.filter(k => slots[k]);
    const max = Math.max(1, ...active.flatMap(k => LAYERS.map(layer => slots[k].layers[layer].events)));
    for (const layer of LAYERS) {
      const name = word(layer === 'http' ? 'httpLayer' : layer);
      const row = tag('div', undefined, 'chart-row'); row.append(tag('span', name));
      const tracks = tag('div', undefined, 'tracks');
      for (const k of active) {
        const n = slots[k].layers[layer].events;
        const track = tag('div', undefined, 'track ' + k);
        const bar = tag('meter'); bar.min = 0; bar.max = max; bar.value = n;
        bar.setAttribute('aria-label', k.toUpperCase() + ' · ' + name);
        track.append(bar, tag('small', n)); tracks.append(track);
      }
      row.append(tracks); figure.append(row);
    }
    box.append(figure); return box;
  }
  function render() {
    document.documentElement.lang = lang;
    el('language').value = lang;
    document.querySelectorAll('[data-ui]').forEach(node => { node.textContent = ui(node.dataset.ui); });
    el('views').setAttribute('aria-label', ui('sections'));
    updateSlots.forEach(update => update());
    notice(message, errorMessage);
    const pair = Boolean(slots.a && slots.b);
    report = pair ? compareSummaries(slots.a, slots.b) : slots.a ?? slots.b;
    label = slots.a ? 'A' : 'B';
    el('mode').textContent = report ? (pair ? ui('pair') : ui('single') + ' ' + label) + ' · ' + ui(example ? 'exampleMode' : 'realMode') : '';
    el('filled').hidden = !report; el('empty').hidden = Boolean(report);
    el('reset').disabled = !report && !reading.size;
    el('save-md').disabled = !report; el('save-json').disabled = !report;
    const stats = el('stats'), panel = el('panel');
    stats.replaceChildren(); panel.replaceChildren();
    if (!report) return;
    for (const [key, name] of [['events', 'eventsShort'], ['errorEvents', 'errorsShort'], ['responseHeaders', 'responsesShort']]) {
      const stat = tag('div', undefined, 'stat');
      const number = tag('span', undefined, 'num');
      if (pair) number.append(String(slots.a.totals[key]), tag('span', '→', 'arrow'), String(slots.b.totals[key]));
      else number.textContent = report.totals[key];
      stat.append(tag('small', ui(name)), number); stats.append(stat);
    }
    document.querySelectorAll('[data-view]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    const tables = Object.fromEntries(reportTables(report, lang, label).map(table => [table.id, table]));
    if (view === 'signals') {
      const pairBox = tag('div', undefined, 'two-col');
      pairBox.append(tableView(tables.errors), tableView(tables.http)); panel.append(pairBox, chart());
    } else if (view === 'timing') {
      panel.append(tableView(tables.timings), tableView(tables.coverage), tableView(tables.layers), tableView(tables.overview));
    } else {
      const block = tag('article', undefined, 'block');
      block.append(tag('h3', ui('previewTitle')), tag('pre', markdown(report, lang, label))); panel.append(block);
    }
    el('scope').textContent = ui('scope');
  }
  function save(format) {
    if (!report) return;
    const json = format === 'json';
    const content = json ? JSON.stringify(report, null, 2) + '\n' : markdown(report, lang, label);
    const url = URL.createObjectURL(new Blob([content], {type: json ? 'application/json' : 'text/markdown;charset=utf-8'}));
    const link = tag('a'); link.href = url; link.download = 'netlog-brief-' + report.kind + '.' + format;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('downloaded');
  }
  el('language').onchange = () => { lang = el('language').value; render(); };
  el('demo').onclick = () => resetState(true);
  el('reset').onclick = () => resetState(false);
  for (const button of document.querySelectorAll('[data-view]')) {
    button.onclick = () => { view = button.dataset.view; render(); };
  }
  el('save-md').onclick = () => save('md'); el('save-json').onclick = () => save('json');
  render();
}
