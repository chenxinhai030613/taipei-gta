// tools/shot.cjs — headless Chrome screenshot + JS eval helper (WebGL enabled)
// usage: node tools/shot.cjs --url=file:///E:/dsh/taipei-gta/index.html --out=shots/a.png --wait=2500
//        [--eval="expression"] [--w=1400] [--h=800] [--keys="w,w,w"] [--seq="2000:shots/b.png"]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)=([\s\S]*)$/);
  if (m) args[m[1]] = m[2];
}
const URL = args.url;
const OUT = args.out || 'shots/shot.png';
const WAIT = parseInt(args.wait || '2500', 10);
const W = parseInt(args.w || '1440', 10);
const H = parseInt(args.h || '810', 10);
const PORT = 9000 + Math.floor(Math.random() * 900);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  if (!URL) { console.error('missing --url'); process.exit(1); }
  const profile = path.join(require('os').tmpdir(), 'dsh-shot-' + PORT);
  const chrome = spawn(CHROME, [
    '--headless=new', '--hide-scrollbars', '--mute-audio',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--window-size=' + W + ',' + H,
    '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 80; i++) {
    try { version = await getJSON('/json/version'); break; } catch { await sleep(200); }
  }
  if (!version) { console.error('devtools never came up'); chrome.kill(); process.exit(1); }

  let id = 0;
  const pending = new Map();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve) => {
    const myId = ++id;
    pending.set(myId, resolve);
    ws.send(JSON.stringify({ id: myId, method, params, sessionId }));
  });

  const { result: target } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: attached } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sid = attached.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await send('Log.enable', {}, sid);

  const logs = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push('LOG[' + msg.params.entry.level + ']: ' + msg.params.entry.text);
    }
  });

  await send('Page.navigate', { url: URL }, sid);
  await sleep(WAIT);

  if (args.eval) {
    const r = await send('Runtime.evaluate', { expression: args.eval, returnByValue: true, awaitPromise: true }, sid);
    console.log('EVAL:', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? null).slice(0, 4000));
  }

  // optional key presses: --keys="w:800,w:800" (key:holdms)
  if (args.keys) {
    for (const spec of args.keys.split(',')) {
      const [key, ms] = spec.split(':');
      const code = key.length === 1 ? 'Key' + key.toUpperCase() : key;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) }, sid);
      await sleep(parseInt(ms || '300', 10));
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) }, sid);
    }
  }

  // sequence screenshots: --seq="2000:shots/a.png,3000:shots/b.png" (delay from now)
  if (args.seq) {
    let last = 0;
    for (const spec of args.seq.split(',')) {
      const [delay, file] = spec.split(':');
      await sleep(Math.max(0, parseInt(delay, 10) - last));
      last = parseInt(delay, 10);
      const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
      const p = path.resolve(file);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.from(shot.result.data, 'base64'));
      console.log('SHOT', p);
    }
  } else {
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    const p = path.resolve(OUT);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(shot.result.data, 'base64'));
    console.log('SHOT', p);
  }

  if (logs.length) {
    console.log('--- console ---');
    console.log(logs.slice(0, 40).join('\n'));
  }
  ws.close();
  chrome.kill();
  await sleep(200);
  process.exit(0);
})();
