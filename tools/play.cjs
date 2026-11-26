// tools/play.cjs — scripted play-test: real key events, timed screenshots, state probes
// usage: node tools/play.cjs --url=file:///... --script="start,E,wait:1500,shot:a.png,W:2000,shot:b.png,eval:TG.Game.state.fps"
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)=([\s\S]*)$/);
  if (m) args[m[1]] = m[2];
}
const URL = args.url;
const SCRIPT = (args.script || '').split('|').filter(Boolean);
const W = parseInt(args.w || '1440', 10);
const H = parseInt(args.h || '810', 10);
const WAIT = parseInt(args.wait || '5000', 10);
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
  const profile = path.join(os.tmpdir(), 'dsh-play-' + PORT);
  const chrome = spawn(CHROME, [
    '--headless=new', '--hide-scrollbars', '--mute-audio',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--window-size=' + W + ',' + H,
    '--user-data-dir=' + profile, 'about:blank'
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

  const logs = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('EXC: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      logs.push('ERR: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });

  await send('Page.navigate', { url: URL }, sid);
  await sleep(WAIT);

  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
    return r.result?.result?.value ?? (r.result?.exceptionDetails ? 'EXC ' + r.result.exceptionDetails.text : null);
  };

  const held = new Set();
  const keyDown = async (code) => {
    const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key, windowsVirtualKeyCode: vkFor(code), nativeVirtualKeyCode: vkFor(code) }, sid);
    held.add(code);
  };
  const keyUp = async (code) => {
    const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vkFor(code), nativeVirtualKeyCode: vkFor(code) }, sid);
    held.delete(code);
  };
  function vkFor(code) {
    if (code.startsWith('Key')) return code.charCodeAt(3);
    if (code === 'Space') return 32;
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 16;
    if (code === 'Escape') return 27;
    return 0;
  }

  const shot = async (file) => {
    const s = await send('Page.captureScreenshot', { format: 'png' }, sid);
    const p = path.resolve(file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(s.result.data, 'base64'));
    console.log('SHOT', p);
  };

  for (const step of SCRIPT) {
    const [cmd, ...rest] = step.split(':');
    const val = rest.join(':');
    if (cmd === 'start') { await keyDown('KeyQ'); await keyUp('KeyQ'); await sleep(400); console.log('START'); }
    else if (cmd === 'shot') await shot(val);
    else if (cmd === 'eval') console.log('EVAL', val, '=>', JSON.stringify(await evalJS(val)));
    else if (cmd === 'wait') await sleep(parseInt(val, 10));
    else if (cmd === 'click') {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: W / 2, y: H / 2, button: 'left', clickCount: 1 }, sid);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: W / 2, y: H / 2, button: 'left', clickCount: 1 }, sid);
      await sleep(200);
    } else if (cmd === 'mouse') {
      const [dx, dy] = val.split('/').map(Number);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: W / 2 + dx, y: H / 2 + dy, button: 'none', movementX: dx, movementY: dy }, sid);
      await sleep(120);
    } else {
      // key hold: NAME:ms
      const ms = parseInt(val || '500', 10);
      await keyDown(cmd);
      await sleep(ms);
      await keyUp(cmd);
    }
  }
  for (const k of held) await keyUp(k);

  const errs = await evalJS('JSON.stringify((window.__ERR||[]).slice(0,3).concat(window.__FRAME_ERR?[window.__FRAME_ERR]:[]))');
  console.log('PAGE ERRORS:', errs);
  if (logs.length) console.log('--- console ---\n' + logs.slice(0, 12).join('\n'));
  ws.close();
  chrome.kill();
  await sleep(200);
  process.exit(0);
})();