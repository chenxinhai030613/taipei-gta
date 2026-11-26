/* ============================================================
   landmarks.js — 台北地標：台北101 / 中正紀念堂 / 台北車站 /
   總統府 / 龍山寺 / 士林夜市 / 美麗華摩天輪 / 西門町紅樓
   ============================================================ */
window.TG = window.TG || {};

TG.Landmarks = (function () {
  'use strict';
  var U = TG.Utils, C = TG.CONFIG;

  var GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
    cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    cone: new THREE.ConeGeometry(0.5, 1, 12),
    cone4: new THREE.ConeGeometry(0.5, 1, 4),
    cone8: new THREE.ConeGeometry(0.5, 1, 8),
    sphere: new THREE.SphereGeometry(0.5, 12, 10)
  };
  var MATC = {};
  function mat(color, opts) {
    var key = color + '|' + JSON.stringify(opts || {});
    if (!MATC[key]) {
      var o = Object.assign({ color: color }, opts || {});
      MATC[key] = new THREE.MeshLambertMaterial(o);
    }
    return MATC[key];
  }
  var emissiveMats = [];
  function emat(color) {
    var m = new THREE.MeshBasicMaterial({ color: color });
    m.userData.nightBoost = 1.5;
    emissiveMats.push(m);
    return m;
  }

  function addBox(parent, w, h, d, color, x, y, z, ry, opts) {
    var m = new THREE.Mesh(GEO.box, mat(color, opts));
    m.scale.set(w, h, d);
    m.position.set(x, y + h / 2, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function addCyl(parent, r, h, color, x, y, z, seg, opts) {
    var g = seg === 8 ? GEO.cyl8 : GEO.cyl;
    var m = new THREE.Mesh(g, mat(color, opts));
    m.scale.set(r * 2, h, r * 2);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function addCone(parent, r, h, color, x, y, z, seg) {
    var g = seg === 4 ? GEO.cone4 : seg === 8 ? GEO.cone8 : GEO.cone;
    var m = new THREE.Mesh(g, mat(color, { flatShading: true }));
    m.scale.set(r * 2, h, r * 2);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function addGlow(parent, w, h, color, x, y, z, d) {
    var m = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: color }));
    m.scale.set(w, h, d || 0.2);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function addSignPlane(parent, text, w, h, x, y, z, ry, bg, fg, tall) {
    var tex = U.signTexture(text, bg || '#101820', fg || '#ffdf6b', { tall: !!tall, size: tall ? 60 : 54 });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, toneMapped: false }));
    m.position.set(x, y, z);
    m.rotation.y = ry || 0;
    parent.add(m);
    return m;
  }

  var groups = [], colliders = [], labels = [], animated = [], glows = [];
  function group(name) { var g = new THREE.Group(); g.name = name; groups.push(g); return g; }

  /* ---------------- 台北101 ---------------- */
  function build101(scene) {
    var L = C.landmarks.taipei101;
    var g = group('台北101');
    var grn = 0x2f7f74, grn2 = 0x3f9c8f, glass = 0x59b3a6;
    addBox(g, 62, 22, 62, 0xbfc6c2, L.x, 0, L.z);
    addBox(g, 64, 1.2, 64, 0x9aa39e, L.x, 22, L.z);
    addSignPlane(g, 'TAIPEI 101', 22, 4.4, L.x, 16, L.z + 31.4, 0, '#0d2b2a', '#eafff8');
    var y = 23, w = 42;
    for (var i = 0; i < 8; i++) {
      var h = 34;
      addBox(g, w, h, w, i % 2 ? grn2 : grn, L.x, y, L.z);
      addBox(g, w + 2.6, 3.2, w + 2.6, glass, L.x, y + h - 3.4, L.z);
      addBox(g, w + 3.4, 1.6, w + 3.4, 0x9fd8cf, L.x, y + h, L.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        addBox(g, 3.2, h, 3.2, 0x27706a, L.x + s[0] * (w / 2 + 0.4), y, L.z + s[1] * (w / 2 + 0.4));
      });
      y += h + 1.6;
      w -= 2.6;
    }
    addBox(g, 16, 6, 16, 0xdfe6e2, L.x, y, L.z);
    addCyl(g, 1.1, 40, 0xcfd6d2, L.x, y + 6, L.z);
    addCyl(g, 0.5, 26, 0xb8c0bc, L.x, y + 44, L.z);
    var beacon = addGlow(g, 2.4, 2.4, 0xff2020, L.x, y + 71, L.z, 2.4);
    beacon.material = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    animated.push(function (dt, t) {
      var on = (Math.sin(t * 2.2) > 0) ? 1 : 0.06;
      beacon.material.color.setRGB(on, on * 0.1, on * 0.1);
      beacon.scale.setScalar(1 + on * 0.8);
    });
    scene.add(g);
    colliders.push({ minX: L.x - 33, maxX: L.x + 33, minZ: L.z - 33, maxZ: L.z + 33 });
    labels.push({ x: L.x, z: L.z, name: '台北101' });
  }

  /* ---------------- 中正紀念堂 + 自由廣場 ---------------- */
  function buildCKS(scene) {
    var L = C.landmarks.cks;
    var g = group('中正紀念堂');
    var white = 0xf2f0ea, blue = 0x2b57a8;
    addBox(g, 62, 1.6, 46, 0xe6e2d8, L.x, 0, L.z);
    addBox(g, 54, 1.6, 38, white, L.x, 1.6, L.z);
    for (var s = 0; s < 5; s++) addBox(g, 22, 0.64, 2.2, 0xeae6dc, L.x, 3.2 - s * 0.64, L.z + 17 + s * 2.2);
    addBox(g, 34, 12, 22, white, L.x, 3.2, L.z);
    for (var i = -3; i <= 3; i++) {
      addCyl(g, 0.75, 12, 0xfbfaf6, L.x + i * 4.6, 3.2, L.z + 11.2);
      addCyl(g, 0.75, 12, 0xfbfaf6, L.x + i * 4.6, 3.2, L.z - 11.2);
    }
    addCone(g, 20, 7, blue, L.x, 15.2, L.z, 8);
    addCone(g, 11, 5, blue, L.x, 21.6, L.z, 8);
    addCyl(g, 1.1, 2.4, 0xffd76b, L.x, 26.4, L.z, 8);
    var az = L.z + 85;
    addBox(g, 26, 1.2, 3, 0xe8e4da, L.x, 0, az);
    [-9, 9].forEach(function (dx) { addBox(g, 2.2, 12, 2.2, white, L.x + dx, 1.2, az); });
    addBox(g, 24, 2.2, 3.4, white, L.x, 13.4, az);
    addBox(g, 15, 3.4, 4.2, white, L.x, 15.6, az);
    addCone(g, 11, 3.2, blue, L.x, 19, az, 8);
    addSignPlane(g, '自由廣場', 9, 1.8, L.x, 15.6, az + 2.3, 0, '#12306b', '#ffffff');
    addSignPlane(g, '自由廣場', 9, 1.8, L.x, 15.6, az - 2.3, Math.PI, '#12306b', '#ffffff');
    scene.add(g);
    colliders.push({ minX: L.x - 18, maxX: L.x + 18, minZ: L.z - 12, maxZ: L.z + 12 });
    colliders.push({ minX: L.x - 13, maxX: L.x + 13, minZ: az - 2, maxZ: az + 2 });
    labels.push({ x: L.x, z: L.z, name: '中正紀念堂' });
  }

  /* ---------------- 台北車站 ---------------- */
  function buildStation(scene) {
    var L = C.landmarks.station;
    var g = group('台北車站');
    var cream = 0xe4dcc8, roofc = 0x5d6b73;
    addBox(g, 62, 3, 52, 0xcfc8b4, L.x, 0, L.z);
    addBox(g, 46, 17, 30, cream, L.x, 0, L.z);
    var roof = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 44, 20, 1, false, 0, Math.PI), mat(roofc));
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(L.x, 17, L.z);
    roof.scale.set(1, 1, 8.6 / 16);
    roof.castShadow = true;
    g.add(roof);
    addBox(g, 47, 1.2, 31, 0xb9b29e, L.x, 16.4, L.z);
    addBox(g, 40, 9, 0.6, 0x2c4453, L.x, 1.4, L.z + 15.2);
    addSignPlane(g, '台北車站', 20, 3.6, L.x, 12.5, L.z + 15.8, 0, '#1a1a1a', '#ffe08a');
    addSignPlane(g, '台北車站', 20, 3.6, L.x, 12.5, L.z - 15.8, Math.PI, '#1a1a1a', '#ffe08a');
    addBox(g, 22, 0.5, 8, 0xd8d2c0, L.x, 6.4, L.z + 19);
    addCyl(g, 1.6, 0.5, 0xffffff, L.x, 12.4, L.z + 16.2, 14);
    addCyl(g, 5.5, 0.9, 0xbdb7a6, L.x, 0, L.z + 24);
    var wtr = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 16), mat(0x4a86a8, { transparent: true, opacity: 0.85 }));
    wtr.position.set(L.x, 1.1, L.z + 24); g.add(wtr);
    scene.add(g);
    colliders.push({ minX: L.x - 23, maxX: L.x + 23, minZ: L.z - 15, maxZ: L.z + 15 });
    labels.push({ x: L.x, z: L.z, name: '台北車站' });
  }

  /* ---------------- 總統府 ---------------- */
  function buildPresidential(scene) {
    var L = C.landmarks.presidential;
    var g = group('總統府');
    var red = 0xa8402f, white = 0xece7dd;
    addBox(g, 54, 2, 40, 0xd6cfc0, L.x, 0, L.z);
    addBox(g, 40, 14, 24, red, L.x, 2, L.z);
    for (var r = 0; r < 3; r++) {
      for (var i = -6; i <= 6; i++) {
        addBox(g, 1.6, 2.2, 0.4, white, L.x + i * 2.9, 4.4 + r * 3.6, L.z + 12.2);
        addBox(g, 1.6, 2.2, 0.4, white, L.x + i * 2.9, 4.4 + r * 3.6, L.z - 12.2);
      }
    }
    addBox(g, 12, 26, 14, red, L.x, 2, L.z);
    addBox(g, 13, 2.4, 15, white, L.x, 25.4, L.z);
    addCone(g, 8.4, 7, 0x8f7038, L.x, 27.8, L.z, 4);
    addBox(g, 42, 1.4, 26, white, L.x, 16, L.z);
    scene.add(g);
    colliders.push({ minX: L.x - 21, maxX: L.x + 21, minZ: L.z - 13, maxZ: L.z + 13 });
    labels.push({ x: L.x, z: L.z, name: '總統府' });
  }

  /* ---------------- 龍山寺 ---------------- */
  function buildLongshan(scene) {
    var L = C.landmarks.longshan;
    var g = group('龍山寺');
    var red = 0x9e2b23, gold = 0xd8a13a, roofc = 0x3f4f57;
    addBox(g, 40, 1.2, 34, 0xbdb6a6, L.x, 0, L.z);
    addBox(g, 22, 7, 15, red, L.x, 1.2, L.z);
    for (var i = -3; i <= 3; i++) addCyl(g, 0.55, 7, 0x7d1f19, L.x + i * 3.2, 1.2, L.z + 7.6);
    function swallowRoof(cx, cz, w, d, y) {
      var r1 = addBox(g, w + 3, 0.9, d * 0.62, roofc, cx, y, cz - d * 0.24);
      r1.rotation.x = -0.30;
      var r2 = addBox(g, w + 3, 0.9, d * 0.62, roofc, cx, y, cz + d * 0.24);
      r2.rotation.x = 0.30;
      addBox(g, w + 4.4, 1.0, 1.4, 0x2f3b42, cx, y + 1.9, cz);
      [-1, 1].forEach(function (s) {
        var tip = addBox(g, 2.6, 0.7, 1.6, 0x2f3b42, cx + s * (w / 2 + 1.6), y + 1.5, cz);
        tip.rotation.z = s * 0.42;
      });
      addBox(g, w + 5, 1.1, 0.9, gold, cx, y + 2.5, cz + d * 0.42);
      addBox(g, w + 5, 1.1, 0.9, gold, cx, y + 2.5, cz - d * 0.42);
    }
    swallowRoof(L.x, L.z, 22, 15, 8.2);
    swallowRoof(L.x, L.z, 15, 11, 12.4);
    addBox(g, 14, 5, 8, red, L.x, 1.2, L.z + 15);
    swallowRoof(L.x, L.z + 15, 14, 8, 6.2);
    for (var k = -2; k <= 2; k++) {
      var lan = new THREE.Mesh(GEO.sphere, emat(0xff5a3c));
      lan.scale.setScalar(1.0);
      lan.position.set(L.x + k * 4.4, 5.6, L.z + 10.4);
      g.add(lan);
      animated.push((function (m, ph) {
        return function (dt, t) { m.position.y = 5.6 + Math.sin(t * 1.4 + ph) * 0.12; };
      })(lan, k));
    }
    addCyl(g, 2.2, 2.4, 0x6b5a3a, L.x, 0, L.z + 21, 14);
    addCyl(g, 2.6, 0.5, gold, L.x, 2.4, L.z + 21, 14);
    scene.add(g);
    colliders.push({ minX: L.x - 12, maxX: L.x + 12, minZ: L.z - 8, maxZ: L.z + 8 });
    labels.push({ x: L.x, z: L.z, name: '龍山寺' });
  }

  /* ---------------- 士林夜市 ---------------- */
  function buildNightMarket(scene) {
    var L = C.landmarks.nightmarket;
    var g = group('士林夜市');
    var rng = U.mulberry32(4242);
    addBox(g, 3, 9, 3, 0x9e2b23, L.x - 9, 0, L.z + 30);
    addBox(g, 3, 9, 3, 0x9e2b23, L.x + 9, 0, L.z + 30);
    addBox(g, 24, 2.4, 4, 0x9e2b23, L.x, 9, L.z + 30);
    addBox(g, 26, 1.4, 5.2, 0xd8a13a, L.x, 11.4, L.z + 30);
    addSignPlane(g, '士林夜市', 16, 3.4, L.x, 10.4, L.z + 32.1, 0, '#7a1a14', '#ffe98a');
    addSignPlane(g, '士林夜市', 16, 3.4, L.x, 10.4, L.z + 27.9, Math.PI, '#7a1a14', '#ffe98a');
    var colors = [0xe8503a, 0x2f8fd8, 0x36a86a, 0xe8b93a, 0x8a52c9, 0xe86a9c];
    var hexes = ['#e8503a', '#2f8fd8', '#36a86a', '#e8b93a', '#8a52c9', '#e86a9c'];
    var foods = ['蚵仔煎', '大雞排', '珍珠奶茶', '臭豆腐', '滷肉飯', '大腸包小腸', '地瓜球', '芒果冰', '胡椒餅', '藥燉排骨'];
    var fi = 0;
    for (var ix = 0; ix < 4; ix++) {
      for (var iz = 0; iz < 3; iz++) {
        var sx = L.x - 27 + ix * 18, sz = L.z - 24 + iz * 20;
        var ci = Math.floor(rng() * colors.length);
        addBox(g, 6, 2.4, 4, 0xdedad0, sx, 0.2, sz);
        var tarp = addBox(g, 7.2, 0.3, 5.2, colors[ci], sx, 2.9, sz);
        tarp.rotation.x = 0.06;
        addBox(g, 7.4, 0.5, 1.2, colors[ci], sx, 2.4, sz + 2.6);
        addBox(g, 6.4, 0.9, 0.8, 0xb8b2a4, sx, 0.2, sz + 2.1);
        addSignPlane(g, foods[fi % foods.length], 5.4, 1.3, sx, 3.9, sz + 2.9, 0, '#1b1b22', hexes[ci]);
        fi++;
      }
    }
    for (var s = 0; s < 3; s++) {
      var zz = L.z - 30 + s * 22;
      for (var n = 0; n < 13; n++) {
        var lan = new THREE.Mesh(GEO.sphere, emat(n % 2 ? 0xff4d4d : 0xffd23f));
        lan.scale.setScalar(0.62);
        lan.position.set(L.x - 30 + n * 5, 5.2, zz);
        g.add(lan);
        animated.push((function (m, ph) {
          return function (dt, t) { m.position.y = 5.2 + Math.sin(t * 1.6 + ph) * 0.16; };
        })(lan, n * 0.5 + s));
      }
    }
    scene.add(g);
    colliders.push({ minX: L.x - 34, maxX: L.x + 34, minZ: L.z - 32, maxZ: L.z + 22 });
    labels.push({ x: L.x, z: L.z, name: '士林夜市' });
  }

  /* ---------------- 美麗華摩天輪 ---------------- */
  function buildFerris(scene) {
    var L = C.landmarks.ferris;
    var g = group('美麗華摩天輪');
    var R = 42;
    var wheel = new THREE.Group();
    wheel.position.set(L.x, R + 6, L.z);
    [0, 3.4].forEach(function (dz) {
      var rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.42, 8, 40), mat(0xe8e6df));
      rim.position.z = dz; rim.castShadow = true; wheel.add(rim);
    });
    var hub = new THREE.Mesh(GEO.cyl, mat(0xd8d4c8));
    hub.scale.set(3.2, 3.6, 3.2); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    var gcols = [0xe8503a, 0x2f8fd8, 0x36a86a, 0xe8b93a, 0x8a52c9, 0xe86a9c];
    for (var i = 0; i < 16; i++) {
      var a = (i / 16) * Math.PI * 2;
      var sx = Math.cos(a) * R, sy = Math.sin(a) * R;
      var spoke = new THREE.Mesh(GEO.box, mat(0xcfcbc0));
      spoke.scale.set(0.28, R, 0.28);
      spoke.position.set(sx / 2, sy / 2, 1.7);
      spoke.rotation.z = a + Math.PI / 2;
      wheel.add(spoke);
      var gon = new THREE.Mesh(GEO.box, mat(gcols[i % gcols.length]));
      gon.scale.set(2.4, 2.4, 2.6);
      gon.position.set(sx, sy - 1.8, 1.7);
      gon.castShadow = true;
      wheel.add(gon);
      var glow = new THREE.Mesh(GEO.box, emat(gcols[i % gcols.length]));
      glow.scale.set(2.5, 0.4, 2.7);
      glow.position.set(sx, sy - 0.5, 1.7);
      wheel.add(glow);
    }
    g.add(wheel);
    [-1, 1].forEach(function (s) {
      var leg = new THREE.Mesh(GEO.box, mat(0xb9b5a8));
      leg.scale.set(2.4, R + 10, 2.4);
      leg.position.set(L.x + s * 12, (R + 10) / 2, L.z);
      leg.rotation.z = s * 0.26;
      leg.castShadow = true;
      g.add(leg);
    });
    addBox(g, 26, 3, 20, 0xcfcabc, L.x, 0, L.z);
    addSignPlane(g, '美麗華', 10, 2.2, L.x, 14, L.z + 10.2, 0, '#241a33', '#ffd23f');
    animated.push(function (dt) { wheel.rotation.z -= dt * 0.06; });
    scene.add(g);
    colliders.push({ minX: L.x - 14, maxX: L.x + 14, minZ: L.z - 11, maxZ: L.z + 11 });
    labels.push({ x: L.x, z: L.z, name: '美麗華摩天輪' });
  }

  /* ---------------- 西門町 ---------------- */
  function buildXimen(scene) {
    var L = C.landmarks.ximen;
    var g = group('西門町');
    var red = 0x8f2b22;
    var hx = L.x - 26, hz = L.z + 4;
    addBox(g, 26, 1.4, 26, 0xc9c2b2, hx, 0, hz);
    var hall = new THREE.Mesh(GEO.cyl8, mat(red));
    hall.scale.set(17, 9, 17);
    hall.position.set(hx, 1.4 + 4.5, hz);
    hall.castShadow = true; hall.receiveShadow = true;
    g.add(hall);
    var roof = new THREE.Mesh(GEO.cone8, mat(0x5c4033, { flatShading: true }));
    roof.scale.set(20, 5.4, 20);
    roof.position.set(hx, 1.4 + 9 + 2.7, hz);
    roof.castShadow = true;
    g.add(roof);
    var tower = new THREE.Mesh(GEO.cyl8, mat(red));
    tower.scale.set(8, 15, 8);
    tower.position.set(hx, 1.4 + 7.5, hz + 14);
    tower.castShadow = true;
    g.add(tower);
    var troof = new THREE.Mesh(GEO.cone8, mat(0x5c4033, { flatShading: true }));
    troof.scale.set(10, 4, 10);
    troof.position.set(hx, 1.4 + 15 + 2, hz + 14);
    g.add(troof);
    addSignPlane(g, '西門紅樓', 8, 1.8, hx, 7, hz + 9, 0, '#3a1310', '#ffd8a8');
    var names = ['西門町', '電影院', 'KTV', '麻辣火鍋', '牛肉麵', '潮流', '手機', '按摩', '網咖', '珍奶'];
    var hexes = ['#ff2e88', '#00e5ff', '#ffd23f', '#7cff5a', '#ff7b2e', '#b06bff'];
    names.forEach(function (nm, i) {
      var side = i % 2 ? 1 : -1;
      var bx = L.x + (i % 5 - 2) * 13;
      var bz = L.z + side * 36;
      addBox(g, 1.1, 9 + (i % 3) * 2.4, 1.1, 0x3a3d42, bx, 0.3, bz);
      addSignPlane(g, nm, 2.4, 5.6, bx, 6.4, bz + side * 1.3, side > 0 ? 0 : Math.PI, '#101018', hexes[i % 6], true);
    });
    var scrTex = U.signTexture('西門町 LED', '#0a0f18', '#35e0ff', { size: 54 });
    var scr = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6),
      new THREE.MeshBasicMaterial({ map: scrTex, side: THREE.DoubleSide, toneMapped: false }));
    var scrFrame = new THREE.Mesh(GEO.box, mat(0x1b1f26));
    scrFrame.scale.set(7.8, 4.2, 0.5);
    scrFrame.position.set(L.x + 22, 7.4, L.z + 6);
    g.add(scrFrame);
    scr.position.set(L.x + 22, 7.4, L.z + 6.3);
    g.add(scr);
    scene.add(g);
    colliders.push({ minX: hx - 9, maxX: hx + 9, minZ: hz - 9, maxZ: hz + 9 });
    labels.push({ x: L.x, z: L.z, name: '西門町' });
  }

  function buildAll(scene) {
    build101(scene);
    buildCKS(scene);
    buildStation(scene);
    buildPresidential(scene);
    buildLongshan(scene);
    buildNightMarket(scene);
    buildFerris(scene);
    buildXimen(scene);
    return { labels: labels, colliders: colliders, groups: groups };
  }

  function setNight(n) {
    for (var i = 0; i < emissiveMats.length; i++) {
      var m = emissiveMats[i];
      if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
      m.color.copy(m.userData.baseColor).multiplyScalar(0.62 + n * 1.7);
    }
  }

  function update(dt, elapsed) {
    for (var i = 0; i < animated.length; i++) animated[i](dt, elapsed);
  }

  return { buildAll: buildAll, setNight: setNight, update: update };
})();


