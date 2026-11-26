/* ============================================================
   audio.js — 全程序化 WebAudio：引擎、警笛、雨聲、音效、5 個電台
   ============================================================ */
window.TG = window.TG || {};

TG.Audio = (function () {
  'use strict';

  var ctx = null, master = null, musicBus = null, sfxBus = null, engBus = null, ambBus = null;
  var engine = null, siren = null, rainGain = null;
  var radioIndex = -1, radioTimer = null, radioStep = 0, radioNextTime = 0;
  var muted = false, started = false;

  function now() { return ctx ? ctx.currentTime : 0; }

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);
    engBus = ctx.createGain(); engBus.gain.value = 0.0; engBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.0; ambBus.connect(master);
    buildEngine();
    buildSiren();
    buildRain();
  }
  function resume() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function buildEngine() {
    var osc = ctx.createOscillator(); osc.type = 'sawtooth';
    var osc2 = ctx.createOscillator(); osc2.type = 'square';
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3;
    var g = ctx.createGain(); g.gain.value = 0.5;
    var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 26;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = 0.09;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    osc.connect(lp); osc2.connect(lp); lp.connect(g); g.connect(engBus);
    osc.start(); osc2.start(); lfo.start();
    engine = { osc: osc, osc2: osc2, lp: lp, gain: g, on: false };
  }
  function setEngine(on, rpm01, throttle01, type) {
    if (!ctx || !engine) return;
    engine.on = !!on;
    if (!on) { engBus.gain.setTargetAtTime(0, now(), 0.08); return; }
    var rpm = Math.max(0, Math.min(1, rpm01 || 0));
    var thr = Math.max(0, Math.min(1, throttle01 || 0));
    var base = (type === 'scooter') ? 62 : 44;
    var f = base + rpm * (type === 'scooter' ? 210 : 150);
    engine.osc.frequency.setTargetAtTime(f, now(), 0.05);
    engine.osc2.frequency.setTargetAtTime(f * 2.01, now(), 0.05);
    engine.lp.frequency.setTargetAtTime(420 + rpm * 1900 + thr * 600, now(), 0.06);
    engBus.gain.setTargetAtTime(0.10 + thr * 0.14 + rpm * 0.06, now(), 0.1);
  }

  function buildSiren() {
    var osc = ctx.createOscillator(); osc.type = 'triangle';
    var g = ctx.createGain(); g.gain.value = 0.0;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    osc.connect(lp); lp.connect(g); g.connect(sfxBus); osc.start();
    siren = { osc: osc, gain: g, on: false };
  }
  var sirenTimer = 0;
  function setSiren(on, prox01) {
    if (!ctx || !siren) return;
    if (!on) { siren.gain.gain.setTargetAtTime(0, now(), 0.15); siren.on = false; return; }
    siren.on = true;
    var p = Math.max(0.05, Math.min(1, prox01 === undefined ? 0.5 : prox01));
    siren.gain.gain.setTargetAtTime(0.13 * p, now(), 0.2);
  }
  function tickSiren(dt) {
    if (!ctx || !siren || !siren.on) return;
    sirenTimer += dt;
    var t = sirenTimer % 1.6;
    var f = t < 0.8 ? 700 + t * 250 : 900 - (t - 0.8) * 250;
    siren.osc.frequency.setTargetAtTime(f, now(), 0.02);
  }

  function buildRain() {
    var len = Math.floor(ctx.sampleRate * 2);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    src.connect(bp); bp.connect(hp); hp.connect(rainGain); rainGain.connect(ambBus);
    src.start();
  }
  function setRain(on, intensity) {
    if (!ctx || !rainGain) return;
    ambBus.gain.setTargetAtTime(on ? 0.6 : 0, now(), 0.5);
    rainGain.gain.setTargetAtTime(on ? (0.1 + 0.35 * (intensity === undefined ? 0.7 : intensity)) : 0, now(), 0.8);
  }

  function blip(freq, dur, type, gain, slideTo) {
    if (!ctx) return;
    var o = ctx.createOscillator(); o.type = type || 'sine';
    var g = ctx.createGain();
    o.frequency.setValueAtTime(freq, now());
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now() + dur);
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(gain || 0.25, now() + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(); o.stop(now() + dur + 0.05);
  }
  function noise(dur, gain, filtFrom, filtTo) {
    if (!ctx) return;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(filtFrom || 1200, now());
    f.frequency.exponentialRampToValueAtTime(Math.max(80, filtTo || 200), now() + dur);
    var g = ctx.createGain(); g.gain.value = gain || 0.3;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start();
  }
  var SFX = {
    cash: function () { blip(880, 0.1, 'triangle', 0.22); setTimeout(function () { blip(1320, 0.14, 'triangle', 0.2); }, 90); },
    punch: function () { noise(0.16, 0.4, 900, 120); blip(120, 0.12, 'square', 0.18, 60); },
    crash: function () { noise(0.5, 0.6, 2200, 150); blip(90, 0.35, 'sawtooth', 0.22, 45); },
    horn: function () { blip(392, 0.28, 'square', 0.18); blip(494, 0.28, 'square', 0.14); },
    success: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.22, 'triangle', 0.22); }, i * 110); }); },
    fail: function () { [440, 370, 294].forEach(function (f, i) { setTimeout(function () { blip(f, 0.3, 'sawtooth', 0.18); }, i * 150); }); },
    enterCar: function () { blip(220, 0.09, 'square', 0.16); setTimeout(function () { blip(330, 0.09, 'square', 0.14); }, 80); },
    exitCar: function () { blip(330, 0.09, 'square', 0.14); setTimeout(function () { blip(220, 0.09, 'square', 0.13); }, 80); },
    star: function () { blip(660, 0.12, 'square', 0.2, 990); },
    click: function () { blip(1200, 0.05, 'square', 0.12); },
    heal: function () { blip(523, 0.3, 'sine', 0.18, 784); }
  };
  function sfx(name) { if (!ctx) return; var f = SFX[name]; if (f) f(); }

  var STATIONS = [
    { tempo: 0.26, wave: 'triangle', scale: [0, 2, 4, 7, 9, 12], bass: [0, 7, 5, 7], root: 392, hat: 0.2 },
    { tempo: 0.34, wave: 'sawtooth', scale: [0, 3, 5, 7, 10], bass: [0, 5, 3, 7], root: 294, hat: 0.1 },
    { tempo: 0.5, wave: 'sine', scale: [0, 7], bass: [0], root: 660, hat: 0 },
    { tempo: 0.22, wave: 'square', scale: [0, 3, 7, 10, 12], bass: [0, 0, 3, 5], root: 330, hat: 0.35 },
    { tempo: 0.9, wave: 'sine', scale: [0, 5, 7, 12], bass: [0], root: 523, hat: 0 }
  ];
  function scheduleRadio() {
    if (!ctx || radioIndex < 0 || muted) return;
    var st = STATIONS[radioIndex];
    var look = now() + 0.4;
    var guard = 0;
    while (radioNextTime < look && guard++ < 40) {
      var t = radioNextTime, step = radioStep % 16;
      if (step % 2 === 0 || Math.random() < 0.4) {
        var semi = st.scale[Math.floor(Math.random() * st.scale.length)];
        var f = st.root * Math.pow(2, semi / 12) * (step % 8 >= 4 ? 2 : 1);
        voice(f, t, st.tempo * 0.9, st.wave, 0.16);
      }
      if (step % 4 === 0) {
        var b = st.bass[Math.floor(step / 4) % st.bass.length];
        voice(st.root / 4 * Math.pow(2, b / 12), t, st.tempo * 3.2, 'sine', 0.3);
      }
      if (st.hat > 0 && (step % 2 === 1 || Math.random() < st.hat)) hat(t, st.hat);
      radioNextTime += st.tempo;
      radioStep++;
    }
    radioTimer = setTimeout(scheduleRadio, 250);
  }
  function voice(freq, t, dur, wave, gain) {
    var o = ctx.createOscillator(); o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t, amt) {
    var len = Math.floor(ctx.sampleRate * 0.05);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    var g = ctx.createGain(); g.gain.value = 0.05 * amt * 3;
    src.connect(hp); hp.connect(g); g.connect(musicBus);
    src.start(t);
  }
  function setRadio(i) {
    init();
    radioIndex = i;
    if (!ctx) return;
    if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; }
    radioStep = 0;
    radioNextTime = now() + 0.2;
    if (i < 0 || muted) { musicBus.gain.setTargetAtTime(0, now(), 0.2); return; }
    musicBus.gain.setTargetAtTime(0.45, now(), 0.4);
    scheduleRadio();
  }
  function nextRadio() {
    var n = TG.CONFIG.radio.length;
    var i = radioIndex < 0 ? 0 : (radioIndex + 1) % n;
    setRadio(i);
    return i;
  }
  function setMuted(m) {
    muted = !!m;
    if (!ctx) return;
    master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.1);
    if (muted) { if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; } }
    else if (radioIndex >= 0) setRadio(radioIndex);
  }

  return {
    init: init, resume: resume,
    setEngine: setEngine, setSiren: setSiren, setRain: setRain, sfx: sfx,
    setRadio: setRadio, nextRadio: nextRadio, setMuted: setMuted,
    tick: function (dt) { tickSiren(dt); },
    getStation: function () { return radioIndex; },
    get ready() { return started; },
    get muted() { return muted; }
  };
})();