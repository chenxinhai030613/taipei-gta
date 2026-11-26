// build.mjs — inline three.js + all game modules into one self-contained HTML
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = path.join(ROOT, 'taipei-gta.html');

const MODULES = [
  'src/config.js',
  'src/utils.js',
  'src/city.js',
  'src/landmarks.js',
  'src/vehicles.js',
  'src/agents.js',
  'src/hud.js',
  'src/audio.js',
  'src/game.js'
];

const three = fs.readFileSync(path.join(ROOT, 'vendor/three.min.js'), 'utf8');
const mods = MODULES.map((m) => {
  const code = fs.readFileSync(path.join(ROOT, m), 'utf8');
  return `\n/* ================= ${m} ================= */\n${code}`;
}).join('\n');

const shell = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// strip dev script tags, keep head/body shell
let html = shell.replace(/<script src="[^"]*"><\/script>\s*/g, '');
const bootScript = `<script>\n${three}\n${mods}\n</script>`;
html = html.replace('</body>', () => `${bootScript}\n</body>`);

if (!html.includes('GTA: TAIPEI')) throw new Error('shell template broken');
fs.writeFileSync(OUT, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(`built ${OUT} (${kb} KB)`);
