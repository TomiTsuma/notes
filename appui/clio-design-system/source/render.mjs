// Local stand-in for the preview frame: tokens.css + fonts + libs + bundle, then the preview document.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const P = '/home/claude/clio-ds/project';
const T = JSON.parse(fs.readFileSync(P + '/tokens.json', 'utf8'));
const val = (v, th) => (typeof v === 'string' ? v : v[th] ?? v.light);
const fix = (v) => v.replace(/^\{(.+)\}$/, 'var(--$1)');
let css = '';
for (const th of ['light', 'dark']) {
  css += (th === 'light' ? ':root,[data-theme="light"]{' : '[data-theme="dark"]{');
  for (const t of T.color.tokens) css += `--${t.name}:${fix(val(t.value, th))};`;
  for (const t of T.shadow.tokens) css += `--${t.name}:${val(t.value, th)};`;
  css += '}';
}
css += ':root{';
for (const fam of ['spacing', 'radius', 'size']) for (const t of T[fam].tokens) css += `--${t.name}:${t.value};`;
for (const [k, v] of Object.entries(T.type.families)) css += `--font-${k}:${v};`;
css += '}';
for (const f of T.type.fonts) css += `@font-face{font-family:"${f.family}";src:url(data:font/woff2;base64,${fs.readFileSync(P + '/' + f.file).toString('base64')}) format("woff2");font-weight:${f.weight};font-style:${f.style};}`;
fs.writeFileSync('/home/claude/build/tokens.css', css);
const libs = ['react.production.min.js', 'react-dom.production.min.js'].map((f) => fs.readFileSync(P + '/components/lib/' + f, 'utf8'));
const bundle = fs.readFileSync(P + '/components/bundle.js', 'utf8');
const bcss = fs.readFileSync(P + '/components/bundle.css', 'utf8');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const themes = (process.argv[3] || 'light,dark').split(',');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
fs.mkdirSync('/home/claude/build/shots', { recursive: true });
const dirs = fs.readdirSync(P + '/components').filter((d) => fs.existsSync(`${P}/components/${d}/preview.html`) && (!only || only.includes(d)));
for (const d of dirs) {
  const html = fs.readFileSync(`${P}/components/${d}/preview.html`, 'utf8');
  const w = +(/width=(\d+)/.exec(html.split("\n")[0]) || [0, d === "Cover" ? 960 : 1000])[1];
  const h = +(/height=(\d+)/.exec(html.split('\n')[0]) || [0, 300])[1];
  for (const th of themes) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/_blob|fonts|ERR_/.test(m.text()) && errs.push(m.text()));
    const doc = html.replace('<head>', `<head><style>${css}</style><style>${bcss}</style><script>${libs[0]}</script><script>${libs[1]}</script><script>${bundle}</script>`).replace('<html lang="en">', `<html lang="en" data-theme="${th}">`).replace('<html>', `<html data-theme="${th}">`);
    await page.setContent(doc, { waitUntil: 'load' }).catch(() => {});
    await page.waitForTimeout(400);
    const sh = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: `/home/claude/build/shots/${d}-${th}.png`, fullPage: true });
    console.log(d, th, 'h=' + sh, errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    await page.close();
  }
}
await browser.close();
