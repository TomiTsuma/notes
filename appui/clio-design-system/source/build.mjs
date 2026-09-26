import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const OUT = '/home/claude/clio-ds/project';
const SRC = '/home/claude/build/src';
fs.mkdirSync(OUT + '/components/lib', { recursive: true });

// ---- bundle
const r = await esbuild.build({ entryPoints: [SRC + '/index.jsx'], bundle: true, format: 'iife', globalName: '__Clio', write: false, minify: true,
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019', footer: { js: 'window.Clio=Object.assign(window.Clio||{},__Clio);' } });
let js = r.outputFiles[0].text;
const previews = fs.readdirSync(SRC + '/previews').filter((f) => /^[A-Z].*\.jsx$/.test(f));
const comps = previews.map((f) => f.replace('.jsx', ''));
const order = JSON.parse(fs.readFileSync(SRC + '/order.json', 'utf8'));
const listed = order.filter((n) => comps.includes(n) && !n.endsWith('Page'));
js = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: 'Clio', components: listed.map((name) => ({ name })) })} */\n` + js;
if (/<\/script|<!--/i.test(js)) throw new Error('bundle contains forbidden sequence');
fs.writeFileSync(OUT + '/components/bundle.js', js);
fs.copyFileSync(SRC + '/bundle.css', OUT + '/components/bundle.css');
for (const f of fs.readdirSync('/home/claude/build/lib')) fs.copyFileSync('/home/claude/build/lib/' + f, OUT + '/components/lib/' + f);

// ---- previews
for (const f of previews) {
  const name = f.replace('.jsx', '');
  const src = fs.readFileSync(SRC + '/previews/' + f, 'utf8');
  const m = /^\/\/ @card (.*)$/m.exec(src);
  const isPage = name.endsWith('Page');
  const b = await esbuild.build({ entryPoints: [SRC + '/previews/' + f], bundle: true, format: 'iife', write: false, minify: true,
    jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019' });
  const code = b.outputFiles[0].text;
  if (/<\/script|<!--/i.test(code)) throw new Error('preview ' + name + ' contains forbidden sequence');
  const pad = isPage ? '0' : '20px';
  const html = `<!-- @dsCard ${m[1]} -->
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${name} — Clio</title>
<style>html,body{margin:0;background:var(--${isPage ? 'canvas' : 'surface'});}#root{padding:${pad};}</style>
</head>
<body>
<div id="root" class="cl"></div>
<script>${code}</script>
</body>
</html>
`;
  const dir = OUT + '/components/' + name;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/preview.html', html);
  const doc = SRC + '/docs/' + name + '.md';
  if (fs.existsSync(doc)) fs.copyFileSync(doc, dir + '/README.md');
}
console.log('bundle', js.length, 'components', listed.length, 'previews', previews.length);
