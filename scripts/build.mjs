import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const path = name => new URL('../' + name, import.meta.url);
const read = name => readFile(path(name), 'utf8');
const modules = ['src/netlog.mjs', 'src/report.mjs', 'web/app.mjs'];
const sources = await Promise.all(modules.map(read));
const [template, css, a, b] = await Promise.all(['web/page.html', 'web/style.css', 'examples/demo-a.json', 'examples/demo-b.json'].map(read));
// All project modules are inlined in dependency order for direct file:// use.
const combined = sources.map(source => source.replace(/^import \{[^}\n]+\} from '[.][^'\n]+';\n/gm, '')).join('\n');
if (/^import\s/m.test(combined)) throw new Error('Review the standalone build after adding an import.');
const demos = JSON.stringify({a: JSON.parse(a), b: JSON.parse(b)}).replaceAll('<', '\\u003c');
const script = combined + '\nmount(' + demos + ');\n';
if (/<\/script/i.test(script) || /<\/style/i.test(css)) throw new Error('Unsafe HTML closing tag in bundled asset.');
const hash = value => "'sha256-" + createHash('sha256').update(value).digest('base64') + "'";
const csp = ["default-src 'none'", 'style-src ' + hash(css), 'script-src ' + hash(script),
  "connect-src 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'none'"].join('; ');
const html = template.replace('@@CSP@@', () => csp).replace('@@CSS@@', () => css).replace('@@SCRIPT@@', () => script);
if (process.argv.includes('--check')) {
  if (html !== await read('index.html')) { console.error('Rebuild index.html with npm run build.'); process.exitCode = 1; }
} else await writeFile(path('index.html'), html);
