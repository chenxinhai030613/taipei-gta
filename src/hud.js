/* ============================================================
   hud.js — GTA 風格 HUD：金錢 / 血量 / 護甲 / 通緝星 /
   旋轉小地圖 / 時速表 / 任務面板 / 提示 / 暫停選單
   ============================================================ */
window.TG = window.TG || {};

TG.HUD = (function () {
  'use strict';
  var U = TG.Utils, C = TG.CONFIG;

  var root = null, els = {}, mapCtx = null, mapC = null;
  var bigTimer = null, radioTimer = null, damageTimer = null;
  var initialized = false;

  var CSS = [
    '#tg-hud,#tg-hud *{box-sizing:border-box;margin:0;padding:0;',
    'font-family:"Microsoft JhengHei","Noto Sans TC","PingFang TC",system-ui,sans-serif;',
    '-webkit-font-smoothing:antialiased;user-select:none;}',
    '#tg-hud{position:fixed;inset:0;z-index:60;pointer-events:none;color:#fff;overflow:hidden}',
    '.tg-panel{background:linear-gradient(180deg,rgba(8,12,20,.72),rgba(8,12,20,.55));',
    'border:1px solid rgba(120,180,230,.22);border-radius:10px;backdrop-filter:blur(6px);',
    'box-shadow:0 6px 22px rgba(0,0,0,.45)}',
    '.tg-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;',
    'background:rgba(8,12,20,.62);border:1px solid rgba(120,180,230,.25);font-size:12px;letter-spacing:.06em}',
    '#tg-topleft{position:absolute;left:22px;top:18px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
    '#tg-clock{font-size:26px;font-weight:800;letter-spacing:.06em;text-shadow:0 2px 10px rgba(0,0,0,.85)}',
    '#tg-district{color:#8fd8ff}',
    '#tg-topright{position:absolute;right:20px;top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px}',
    '#tg-mapwrap{position:relative;width:196px;height:196px;filter:drop-shadow(0 6px 18px rgba(0,0,0,.55))}',
    '#tg-map{width:196px;height:196px;border-radius:50%;display:block}',
    '#tg-mapring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(150,205,245,.5);',
    'box-shadow:inset 0 0 26px rgba(0,0,0,.6)}',
    '#tg-compass{position:absolute;left:50%;top:-6px;transform:translateX(-50%);font-size:11px;font-weight:800;',
    'color:#ffd23f;text-shadow:0 1px 4px #000}',
    '#tg-stars{display:flex;gap:4px;padding:6px 10px;border-radius:999px;background:rgba(8,12,20,.6);',
    'border:1px solid rgba(120,180,230,.22)}',
    '.tg-star{font-size:17px;line-height:1;color:rgba(255,255,255,.18);text-shadow:0 0 8px rgba(0,0,0,.7)}',
    '.tg-star.on{color:#ffd23f;text-shadow:0 0 12px rgba(255,190,60,.9)}',
    '.tg-star.pulse{animation:tg-starpop .45s ease}',
    '@keyframes tg-starpop{0%{transform:scale(1)}40%{transform:scale(1.5)}100%{transform:scale(1)}}',
    '#tg-bottomleft{position:absolute;left:22px;bottom:20px;display:flex;flex-direction:column;gap:8px;width:230px}',
    '#tg-money{font-size:30px;font-weight:800;color:#7ef29b;letter-spacing:.02em;',
    'text-shadow:0 2px 10px rgba(0,0,0,.9),0 0 18px rgba(60,220,120,.35)}',
    '#tg-money span{font-size:15px;color:#bff5cf;font-weight:700;margin-right:2px}',
    '.tg-bar{height:8px;border-radius:6px;background:rgba(0,0,0,.55);overflow:hidden;border:1px solid rgba(255,255,255,.16)}',
    '.tg-bar i{display:block;height:100%;width:100%;transition:width .18s ease}',
    '#tg-health i{background:linear-gradient(90deg,#39d353,#9bff7a)}',
    '#tg-armor i{background:linear-gradient(90deg,#3aa0ff,#8fdcff)}',
    '#tg-bottomright{position:absolute;right:22px;bottom:20px;display:flex;flex-direction:column;align-items:flex-end;gap:10px}',
    '#tg-speedo{display:none;align-items:flex-end;gap:10px;padding:8px 14px}',
    '#tg-speedo.on{display:flex}',
    '#tg-kmh{font-size:44px;font-weight:900;line-height:.9;letter-spacing:-.02em;text-shadow:0 2px 12px rgba(0,0,0,.8)}',
    '#tg-kmh small{font-size:13px;font-weight:700;color:#9fc7e8;margin-left:4px}',
    '#tg-vehname{font-size:13px;color:#cfe8ff;text-align:right}',
    '#tg-radio{font-size:12px;color:#ffd9a8;display:none;padding:6px 12px}',
    '#tg-radio.on{display:block}',
    '#tg-mission{display:none;width:290px;padding:12px 14px}',
    '#tg-mission.on{display:block}',
    '#tg-mtitle{color:#ffd23f;font-weight:800;font-size:14px;letter-spacing:.04em;margin-bottom:4px}',
    '#tg-mobj{font-size:13px;color:#eaf4ff;line-height:1.45}',
    '#tg-mbar{margin-top:8px;height:6px;border-radius:4px;background:rgba(0,0,0,.5);overflow:hidden;display:none}',
    '#tg-mbar.on{display:block}',
    '#tg-mbar i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff7b2e)}',
    '#tg-toasts{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);display:flex;flex-direction:column;',
    'align-items:center;gap:8px}',
    '.tg-toast{padding:9px 18px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:.03em;',
    'background:rgba(10,14,22,.82);border:1px solid rgba(140,200,240,.3);animation:tg-in .3s ease;',
    'text-shadow:0 1px 6px rgba(0,0,0,.8)}',
    '.tg-toast.good{border-color:rgba(90,240,150,.6);color:#c8ffdd}',
    '.tg-toast.bad{border-color:rgba(255,90,90,.6);color:#ffd0d0}',
    '@keyframes tg-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '#tg-big{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;opacity:0;',
    'transition:opacity .5s ease}',
    '#tg-big.on{opacity:1}',
    '#tg-bigmain{font-size:52px;font-weight:900;letter-spacing:.06em;',
    'background:linear-gradient(180deg,#fff,#8fd8ff 60%,#ff4f9a);-webkit-background-clip:text;background-clip:text;',
    'color:transparent;filter:drop-shadow(0 4px 16px rgba(0,0,0,.7))}',
    '#tg-bigsub{font-size:19px;color:#e8f4ff;letter-spacing:.22em;margin-top:6px;text-shadow:0 2px 8px rgba(0,0,0,.9)}',
    '#tg-cross{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;',
    'background:rgba(255,255,255,.75);box-shadow:0 0 6px rgba(0,0,0,.8);display:none}',
    '#tg-cross.on{display:block}',
    '#tg-dmg{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .3s;',
    'background:radial-gradient(ellipse at center,rgba(255,0,0,0) 42%,rgba(190,0,0,.55) 100%)}',
    '#tg-dmg.on{opacity:1}',
    '#tg-pause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;',
    'background:rgba(4,7,14,.72);backdrop-filter:blur(10px);pointer-events:auto}',
    '#tg-pause.on{display:flex}',
    '#tg-pausepanel{width:min(780px,92vw);padding:26px 30px;display:grid;grid-template-columns:1.1fr 1fr;gap:22px}',
    '#tg-pausepanel h2{font-size:34px;font-weight:900;letter-spacing:.1em;margin-bottom:6px;',
    'background:linear-gradient(180deg,#fff,#7fd0ff 70%);-webkit-background-clip:text;background-clip:text;color:transparent}',
    '#tg-pausesub{color:#8fa9c4;letter-spacing:.28em;font-size:12px;margin-bottom:16px}',
    '.tg-key{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.1)}',
    '.tg-key b{color:#8fd8ff;font-weight:700}',
    '#tg-resume{margin-top:16px;pointer-events:auto;cursor:pointer;display:inline-block;padding:10px 22px;border-radius:10px;',
    'background:linear-gradient(180deg,#2bd3ff,#1b7fd8);color:#04121f;font-weight:900;letter-spacing:.1em;',
    'box-shadow:0 6px 20px rgba(30,150,220,.4)}',
    '#tg-radio-banner{position:absolute;left:50%;top:64px;transform:translateX(-50%);padding:8px 16px;border-radius:10px;',
    'background:rgba(10,14,22,.8);border:1px solid rgba(255,200,120,.35);display:none;text-align:center}',
    '#tg-radio-banner.on{display:block}',
    '#tg-rb1{font-size:14px;font-weight:800;color:#ffd9a8;letter-spacing:.05em}',
    '#tg-rb2{font-size:11px;color:#9fc7e8;letter-spacing:.2em}'
  ].join('');

  function el(tag, id, parent, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function init(opts) {
    if (initialized) return TG.HUD;
    opts = opts || {};
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = el('div', 'tg-hud', document.body);

    var tl = el('div', 'tg-topleft', root);
    els.clock = el('div', 'tg-clock', tl); els.clock.textContent = '17:24';
    els.district = el('div', 'tg-district', tl, 'tg-chip'); els.district.textContent = '中正區';

    var tr = el('div', 'tg-topright', root);
    var mw = el('div', 'tg-mapwrap', tr);
    mapC = el('canvas', 'tg-map', mw); mapC.width = 392; mapC.height = 392;
    mapCtx = mapC.getContext('2d');
    el('div', 'tg-mapring', mw);
    els.compass = el('div', 'tg-compass', mw); els.compass.textContent = '北';
    els.stars = el('div', 'tg-stars', tr);
    els.starEls = [];
    for (var i = 0; i < 5; i++) {
      var s = el('div', 'tg-star-' + i, els.stars, 'tg-star');
      s.textContent = '★';
      els.starEls.push(s);
    }

    var bl = el('div', 'tg-bottomleft', root);
    els.money = el('div', 'tg-money', bl);
    els.money.innerHTML = '<span>NT$</span>2,000';
    els.healthBar = el('i', null, el('div', 'tg-health', bl, 'tg-bar'));
    els.armorBar = el('i', null, el('div', 'tg-armor', bl, 'tg-bar'));

    var br = el('div', 'tg-bottomright', root);
    els.radio = el('div', 'tg-radio', br, 'tg-panel'); els.radio.textContent = 'FM 92.1 台北之音';
    els.speedo = el('div', 'tg-speedo', br, 'tg-panel');
    els.kmh = el('div', 'tg-kmh', els.speedo); els.kmh.innerHTML = '0<small>km/h</small>';
    els.vehname = el('div', 'tg-vehname', els.speedo); els.vehname.textContent = '機車';
    els.mission = el('div', 'tg-mission', br, 'tg-panel');
    els.mtitle = el('div', 'tg-mtitle', els.mission);
    els.mobj = el('div', 'tg-mobj', els.mission);
    els.mbar = el('div', 'tg-mbar', els.mission);
    els.mbarInner = el('i', null, els.mbar);

    els.toasts = el('div', 'tg-toasts', root);
    els.big = el('div', 'tg-big', root);
    els.bigmain = el('div', 'tg-bigmain', els.big);
    els.bigsub = el('div', 'tg-bigsub', els.big);
    els.cross = el('div', 'tg-cross', root);
    els.dmg = el('div', 'tg-dmg', root);
    els.radioBanner = el('div', 'tg-radio-banner', root);
    els.rb1 = el('div', 'tg-rb1', els.radioBanner);
    els.rb2 = el('div', 'tg-rb2', els.radioBanner);

    els.pause = el('div', 'tg-pause', root);
    var pp = el('div', 'tg-pausepanel', els.pause, 'tg-panel');
    var left = el('div', null, pp);
    el('h2', null, left).textContent = 'GTA: TAIPEI';
    el('div', 'tg-pausesub', left).textContent = '台 北 風 雲 · 已 暫 停';
    var keys = [
      ['W A S D', '移動 / 駕駛'], ['滑鼠', '視角（點擊鎖定）'], ['Shift', '跑步 / 加速'],
      ['空白鍵', '手煞車 / 跳'], ['E', '上車 / 下車'], ['F', '攻擊'], ['R', '切換廣播電台'],
      ['H', '喇叭'], ['Esc', '暫停 / 繼續']
    ];
    keys.forEach(function (k) {
      var row = el('div', null, left, 'tg-key');
      var b = el('b', null, row); b.textContent = k[0];
      var sp = el('span', null, row); sp.textContent = k[1];
    });
    var right = el('div', null, pp);
    var tips = el('div', null, right, 'tg-panel');
    tips.style.padding = '14px 16px';
    tips.innerHTML = '<div style="color:#ffd23f;font-weight:800;margin-bottom:8px">生存指南</div>' +
      '<div style="font-size:13px;line-height:1.7;color:#dbeaff">' +
      '· 騎上機車探索台北：西門町、士林夜市、台北101<br>' +
      '· 黃色光柱是任務點，靠近即可接任務<br>' +
      '· 犯案會提升通緝等級，警車會追捕你<br>' +
      '· 進便利商店或躲進巷子可以降低通緝<br>' +
      '· 加油站、寺廟、夜市都能補血</div>';
    els.resume = el('div', 'tg-resume', right); els.resume.textContent = '繼 續 遊 戲';
    els.resume.addEventListener('click', function () { if (opts.onResume) opts.onResume(); });

    initialized = true;
    return TG.HUD;
  }

  var MAP_SCALE = 0.62;
  function drawMap(st) {
    if (!mapCtx) return;
    var W = mapC.width, cx = W / 2, cy = W / 2, R = W / 2 - 4;
    var ctx = mapCtx;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(10,16,26,.94)'; ctx.fillRect(0, 0, W, W);

    var px = st.player ? st.player.x : 0, pz = st.player ? st.player.z : 0;
    var head = st.player ? st.player.heading : 0;
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI + head);
    ctx.scale(MAP_SCALE, MAP_SCALE);
    ctx.translate(-px, -pz);

    var g = C.roadGraph;
    ctx.lineCap = 'butt';
    g.ew.forEach(function (r) {
      ctx.strokeStyle = r.major ? 'rgba(150,190,220,.75)' : 'rgba(118,152,182,.5)';
      ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.moveTo(-370, r.pos); ctx.lineTo(370, r.pos); ctx.stroke();
    });
    g.ns.forEach(function (r) {
      ctx.strokeStyle = r.major ? 'rgba(150,190,220,.75)' : 'rgba(118,152,182,.5)';
      ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.moveTo(r.pos, -370); ctx.lineTo(r.pos, 370); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(70,140,80,.5)';
    ctx.fillRect(120, 120, 100, 100);
    ctx.fillStyle = 'rgba(50,100,140,.9)';
    ctx.fillRect(C.city.riverX - C.city.riverW, -900, C.city.riverW, 1800);

    Object.keys(C.landmarks).forEach(function (k) {
      var L = C.landmarks[k];
      if (L.x < -400 || L.z < -520) return;
      ctx.fillStyle = 'rgba(255,235,180,.92)';
      ctx.beginPath(); ctx.arc(L.x, L.z, 3.2, 0, Math.PI * 2); ctx.fill();
    });
    (st.blips || []).forEach(function (b) {
      ctx.fillStyle = b.color || '#ff4d4d';
      ctx.beginPath(); ctx.arc(b.x, b.z, b.shape === 'star' ? 6 : 4.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 11); ctx.lineTo(0, 6); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 11), cy + Math.sin(a) * (R - 11));
      ctx.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
      ctx.stroke();
    }
  }

  function update(st) {
    if (!initialized) return;
    els.clock.textContent = st.clock || '00:00';
    els.district.textContent = st.district || '台北市';
    els.money.innerHTML = '<span>NT$</span>' + (st.money || 0).toLocaleString('en-US');
    els.healthBar.style.width = Math.max(0, Math.min(100, st.health)) + '%';
    els.armorBar.style.width = Math.max(0, Math.min(100, st.armor || 0)) + '%';

    var w = Math.max(0, Math.min(5, st.wanted | 0));
    for (var i = 0; i < 5; i++) els.starEls[i].className = 'tg-star' + (i < w ? ' on' : '');
    if (w > (els._lastWanted || 0)) {
      for (var k = 0; k < w; k++) {
        (function (e) {
          e.className = 'tg-star on pulse';
          setTimeout(function () { e.className = 'tg-star on'; }, 480);
        })(els.starEls[k]);
      }
    }
    els._lastWanted = w;

    if (st.inVehicle) {
      els.speedo.classList.add('on');
      els.kmh.innerHTML = Math.round(st.speedKmh || 0) + '<small>km/h</small>';
      els.vehname.textContent = st.vehicleName || '';
    } else {
      els.speedo.classList.remove('on');
    }
    els.cross.className = st.onFoot ? 'on' : '';

    if (st.radio && st.radio.name) {
      els.radio.classList.add('on');
      var on = st.radio.name + (st.radio.genre ? ' · ' + st.radio.genre : '');
      if (els.radio.textContent !== on) els.radio.textContent = on;
    } else els.radio.classList.remove('on');

    if (st.mission) {
      els.mission.classList.add('on');
      els.mtitle.textContent = st.mission.title || '';
      els.mobj.textContent = st.mission.objective || '';
      if (st.mission.timerSec !== null && st.mission.timerSec !== undefined) {
        els.mbar.classList.add('on');
        var tot = st.mission.totalSec || Math.max(st.mission.timerSec, 1);
        els.mbarInner.style.width = Math.max(0, Math.min(100, (st.mission.timerSec / tot) * 100)) + '%';
      } else if (st.mission.progress01 !== null && st.mission.progress01 !== undefined) {
        els.mbar.classList.add('on');
        els.mbarInner.style.width = (st.mission.progress01 * 100) + '%';
      } else els.mbar.classList.remove('on');
    } else els.mission.classList.remove('on');

    drawMap(st);
  }

  function toast(text, kind) {
    if (!initialized) return;
    var t = el('div', null, els.toasts, 'tg-toast' + (kind ? ' ' + kind : ''));
    t.textContent = text;
    setTimeout(function () {
      t.style.transition = 'opacity .4s, transform .4s';
      t.style.opacity = '0'; t.style.transform = 'translateY(-8px)';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 420);
    }, 2600);
    while (els.toasts.children.length > 4) els.toasts.removeChild(els.toasts.firstChild);
  }

  function setMission(m) {
    if (!initialized) return;
    if (!m) { els.mission.classList.remove('on'); return; }
    els.mission.classList.add('on');
    els.mtitle.textContent = m.title || '';
    els.mobj.textContent = m.objective || '';
  }

  function bigText(main, sub) {
    if (!initialized) return;
    els.bigmain.textContent = main || '';
    els.bigsub.textContent = sub || '';
    els.big.classList.add('on');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(function () { els.big.classList.remove('on'); }, 3000);
  }

  function setRadioBanner(name, genre) {
    if (!initialized) return;
    els.rb1.textContent = name || '';
    els.rb2.textContent = genre || '';
    els.radioBanner.classList.add('on');
    clearTimeout(radioTimer);
    radioTimer = setTimeout(function () { els.radioBanner.classList.remove('on'); }, 3200);
  }

  function showDamage() {
    if (!initialized) return;
    els.dmg.classList.add('on');
    clearTimeout(damageTimer);
    damageTimer = setTimeout(function () { els.dmg.classList.remove('on'); }, 260);
  }
  function setPaused(on) {
    if (!initialized) return;
    els.pause.classList[on ? 'add' : 'remove']('on');
  }
  function show() { if (root) root.style.display = 'block'; }
  function hide() { if (root) root.style.display = 'none'; }

  return {
    init: init, update: update, toast: toast, setMission: setMission, bigText: bigText,
    setRadioBanner: setRadioBanner, showDamage: showDamage,
    setPaused: setPaused, show: show, hide: hide,
    get ready() { return initialized; }
  };
})();