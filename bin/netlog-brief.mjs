#!/usr/bin/env node
import {createReadStream} from 'node:fs';
import {parseArgs} from 'node:util';
import {CaptureError, MAX_BYTES, parseCapture, compareSummaries} from '../src/netlog.mjs';
import {markdown, WORDS} from '../src/report.mjs';

const help = [
  'NetLog Brief — offline Chromium capture summaries',
  '',
  'netlog-brief summarize <capture.json|-> [--format markdown|json] [--lang en|uz]',
  'netlog-brief compare <A.json|-> <B.json|-> [--format markdown|json] [--lang en|uz]',
  '',
  'Use - for standard input once. Reports go to standard output.',
  'Exit 0: report written. Exit 1: input or read error. Exit 2: invalid arguments.',
  'Each input may contain up to 32 MiB and 250,000 events.',
].join('\n');

async function readSummary(file) {
  const stream = file === '-' ? process.stdin : createReadStream(file);
  const chunks = [];
  let size = 0;
  try {
    for await (const bytes of stream) {
      size += bytes.length;
      if (size > MAX_BYTES) throw new CaptureError('tooLarge');
      chunks.push(bytes);
    }
    return parseCapture(Buffer.concat(chunks, size).toString('utf8'));
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    throw new CaptureError('unreadable');
  }
}

let language = 'en';
try {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {format: {type: 'string', default: 'markdown'}, lang: {type: 'string', default: 'en'},
        help: {type: 'boolean', short: 'h', default: false}},
    });
  } catch {
    throw new CaptureError('arguments');
  }
  const {values, positionals} = parsed;
  if (values.help) {
    process.stdout.write(help + '\n');
  } else {
    if (values.lang === 'uz') language = 'uz';
    const [command, ...files] = positionals;
    const required = command === 'summarize' ? 1 : command === 'compare' ? 2 : 0;
    if (!required || files.length !== required || files.filter(f => f === '-').length > 1 ||
        !['en', 'uz'].includes(values.lang) || !['markdown', 'json'].includes(values.format)) {
      throw new CaptureError('arguments');
    }
    const a = await readSummary(files[0]);
    const report = command === 'compare' ? compareSummaries(a, await readSummary(files[1])) : a;
    process.stdout.write(values.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : markdown(report, language));
  }
} catch (error) {
  const code = error instanceof CaptureError ? error.code : 'unreadable';
  process.stderr.write('NetLog Brief — ' + WORDS[language][code] + '\n');
  process.exitCode = code === 'arguments' ? 2 : 1;
}
