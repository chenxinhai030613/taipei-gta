/* ============================================================
   utils.js — shared helpers: RNG, math, canvas textures, geo builder
   ============================================================ */
window.TG = window.TG || {};

TG.Utils = (function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var damp = function (a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  var rand = function (rng, a, b) { return a + (b - a) * rng(); };
  var pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; };
  var TAU = Math.PI * 2;
  function angleLerp(a, b, t) {
    var d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * t;
  }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  /* ---------- canvas texture helpers ---------- */
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function texFrom(c, repeatX, repeatY, opts) {
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeatX || repeatY) t.repeat.set(repeatX || 1, repeatY || 1);
    t.anisotropy = 4;
    if (opts && opts.nearest) { t.magFilter = THREE.NearestFilter; }
    return t;
  }

  /* Building facade: base + window grid.  Returns {map, emissiveMap} */
  function facadeTextures(rng, opts) {
    opts = opts || {};
    var size = 256, cols = 4, rows = 4;
    var c = canvas(size, size), g = c.getContext('2d');
    var e = canvas(size, size), ge = e.getContext('2d');
    var base = opts.base || '#cfc9bd';
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    // subtle concrete noise
    for (var i = 0; i < 900; i++) {
      var a = rng() * 0.06;
      g.fillStyle = 'rgba(0,0,0,' + a + ')';
      g.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
    }
    ge.fillStyle = '#000'; ge.fillRect(0, 0, size, size);

    var cw = size / cols, ch = size / rows;
    var marginX = cw * 0.26, marginY = ch * 0.30;
    var glass = opts.glass || '#5a7d8c';
    for (var r = 0; r < rows; r++) {
      for (var k = 0; k < cols; k++) {
        var x = k * cw + marginX, y = r * ch + marginY;
        var w = cw - marginX * 2, h = ch - marginY * 2;
        // glass
        var grad = g.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, glass);
        grad.addColorStop(1, '#2d4450');
        g.fillStyle = grad; g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        // window frame divider
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(x, y + h * 0.5, w, 1);
        // emissive: some windows lit at night
        if (rng() < (opts.lit || 0.42)) {
          var warm = rng();
          ge.fillStyle = warm < 0.72 ? '#ffd48a' : warm < 0.9 ? '#fff2d0' : '#a8d8ff';
          ge.fillRect(x, y, w, h);
          ge.fillStyle = 'rgba(0,0,0,0.25)';
          ge.fillRect(x, y + h * 0.5, w, 1);
        }
      }
    }
    // floor bands
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (var b = 0; b <= rows; b++) g.fillRect(0, b * ch - 1, size, 2);

    return {
      map: texFrom(c, 1, 1),
      emissiveMap: texFrom(e, 1, 1)
    };
  }

  /* Asphalt with lane markings; u runs across road, v along road */
  function roadTexture(major) {
    var W = 128, H = 256;
    var c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = major ? '#3b3e44' : '#42454b'; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 2600; i++) {
      var v = rng_road() * 0.10;
      g.fillStyle = 'rgba(255,255,255,' + v + ')';
      g.fillRect(rng_road() * W, rng_road() * H, 1, 1);
    }
    // edge lines
    g.fillStyle = 'rgba(240,240,235,0.75)';
    g.fillRect(4, 0, 2, H); g.fillRect(W - 6, 0, 2, H);
    // dashed centre line
    g.fillStyle = 'rgba(250,215,90,0.85)';
    for (var y = 0; y < H; y += 48) g.fillRect(W / 2 - 1.5, y, 3, 26);
    if (major) {
      g.fillStyle = 'rgba(240,240,235,0.55)';
      g.fillRect(W * 0.28, 0, 2, H); g.fillRect(W * 0.72, 0, 2, H);
    }
    var t = texFrom(c, 1, 1);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  var _rr = mulberry32(7);
  function rng_road() { return _rr(); }

  /* Emissive sign texture for neon boards */
  function signTexture(text, bg, fg, opts) {
    opts = opts || {};
    var W = 256, H = opts.tall ? 512 : 128;
    var c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = fg;
    g.font = 'bold ' + (opts.size || 62) + 'px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var chars = String(text).split('');
    if (opts.tall) {
      var step = H / (chars.length + 0.4);
      for (var i = 0; i < chars.length; i++) g.fillText(chars[i], W / 2, step * (i + 0.7));
    } else {
      g.fillText(text, W / 2, H / 2 + 4);
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  /* Rounded rectangle path */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------- geometry builder: accumulate quads into one BufferGeometry ---------- */
  function GeoBuilder() {
    this.pos = []; this.nor = []; this.uv = []; this.col = [];
  }
  GeoBuilder.prototype.quad = function (a, b, c, d, normal, uvs, color) {
    var n = normal;
    var pts = [a, b, c, a, c, d];
    var uu = uvs || [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    if (uu.length === 4) uu = [uu[0], uu[1], uu[2], uu[0], uu[2], uu[3]];
    for (var i = 0; i < 6; i++) {
      this.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uu[i][0], uu[i][1]);
      var cc = color || [1, 1, 1];
      this.col.push(cc[0], cc[1], cc[2]);
    }
  };
  /* Axis-aligned box; uScale/vScale control texture tiling per metre */
  GeoBuilder.prototype.box = function (x, y, z, w, h, d, color, uScale, vScale) {
    var hw = w / 2, hh = h / 2, hd = d / 2;
    var us = uScale || 1 / 4, vs = vScale || 1 / 3.4;
    var c = color || [1, 1, 1];
    var x0 = x - hw, x1 = x + hw, y0 = y, y1 = y + h, z0 = z - hd, z1 = z + hd;
    // +X
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0],
      [[0, 0], [d * us, 0], [d * us, h * vs], [0, h * vs]], c);
    // -X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0],
      [[0, 0], [d * us, 0], [d * us, h * vs], [0, h * vs]], c);
    // +Z
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1],
      [[0, 0], [w * us, 0], [w * us, h * vs], [0, h * vs]], c);
    // -Z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1],
      [[0, 0], [w * us, 0], [w * us, h * vs], [0, h * vs]], c);
    // top
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
      [[0, 0], [w * us, 0], [w * us, d * us], [0, d * us]], c);
    return this;
  };
  GeoBuilder.prototype.flat = function (x, y, z, w, d, color, uvScale, rotY) {
    var hw = w / 2, hd = d / 2;
    var us = uvScale || 1 / 8;
    var c = color || [1, 1, 1];
    var p = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]];
    if (rotY) {
      var ca = Math.cos(rotY), sa = Math.sin(rotY);
      p = p.map(function (q) { return [q[0] * ca - q[2] * sa, 0, q[0] * sa + q[2] * ca]; });
    }
    var a = [x + p[0][0], y, z + p[0][2]], b = [x + p[1][0], y, z + p[1][2]],
      cc = [x + p[2][0], y, z + p[2][2]], d = [x + p[3][0], y, z + p[3][2]];
    this.quad(a, b, cc, d, [0, 1, 0],
      [[0, 0], [w * us, 0], [w * us, d * us], [0, d * us]], c);
    return this;
  };
  GeoBuilder.prototype.build = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  GeoBuilder.prototype.isEmpty = function () { return this.pos.length === 0; };

  /* simple AABB collision registry */
  function Colliders() { this.list = []; }
  Colliders.prototype.add = function (minX, maxX, minZ, maxZ, tag) {
    this.list.push({ minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ, tag: tag || '' });
  };
  Colliders.prototype.addCircle = function (x, z, r, tag) {
    this.add(x - r, x + r, z - r, z + r, tag);
  };
  /* circle vs AABB resolve: returns {x,z} corrected position */
  Colliders.prototype.resolve = function (x, z, radius) {
    var out = { x: x, z: z, hit: false };
    for (var i = 0; i < this.list.length; i++) {
      var b = this.list[i];
      if (x + radius < b.minX || x - radius > b.maxX || z + radius < b.minZ || z - radius > b.maxZ) continue;
      var cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
      var dx = x - cx, dz = z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      out.hit = true;
      if (d2 > 1e-6) {
        var d = Math.sqrt(d2);
        out.x = cx + (dx / d) * radius;
        out.z = cz + (dz / d) * radius;
      } else {
        // inside: push out along smallest penetration axis
        var pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
        var m = Math.min(pl, pr, pt, pb);
        if (m === pl) out.x = b.minX - radius;
        else if (m === pr) out.x = b.maxX + radius;
        else if (m === pt) out.z = b.minZ - radius;
        else out.z = b.maxZ + radius;
      }
      x = out.x; z = out.z;
    }
    return out;
  };

  return {
    mulberry32: mulberry32, clamp: clamp, lerp: lerp, smooth: smooth, damp: damp,
    rand: rand, pick: pick, angleLerp: angleLerp, dist2: dist2, TAU: TAU,
    canvas: canvas, texFrom: texFrom, facadeTextures: facadeTextures,
    roadTexture: roadTexture, signTexture: signTexture, roundRect: roundRect,
    GeoBuilder: GeoBuilder, Colliders: Colliders,
    // handy shared rng
    rng: mulberry32(20240521)
  };
})();
