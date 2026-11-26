/* ============================================================
   vehicles.js — low-poly Taipei vehicles + traffic AI
   forward = local +Z ; ground y = 0
   ============================================================ */
window.TG = window.TG || {};

TG.Vehicles = (function () {
  'use strict';
  var U = TG.Utils;

  var GEO = {
    wheel: new THREE.CylinderGeometry(1, 1, 1, 12),
    wheelLow: new THREE.CylinderGeometry(1, 1, 1, 8)
  };
  GEO.wheel.rotateZ(Math.PI / 2);
  GEO.wheelLow.rotateZ(Math.PI / 2);

  var MAT = {
    body: new THREE.MeshLambertMaterial({ vertexColors: true }),
    glass: new THREE.MeshPhongMaterial({ color: 0x1b2a35, shininess: 110, specular: 0x88aabb, transparent: true, opacity: 0.92 }),
    tire: new THREE.MeshLambertMaterial({ color: 0x14161a }),
    hub: new THREE.MeshLambertMaterial({ color: 0x9aa2a8 }),
    chrome: new THREE.MeshPhongMaterial({ color: 0xc9d2d8, shininess: 140 }),
    plate: new THREE.MeshLambertMaterial({ color: 0xe8e6da })
  };
  var headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  var tailMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
  var brakeMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });

  function tint(hex, k) {
    var c = new THREE.Color(hex);
    return [c.r * k, c.g * k, c.b * k];
  }
  function colArr(hex) { var c = new THREE.Color(hex); return [c.r, c.g, c.b]; }

  function buildBody(partsFn) {
    var b = new U.GeoBuilder();
    partsFn(b);
    var m = new THREE.Mesh(b.build(), MAT.body);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function box(b, x, y, z, w, h, d, hex, k) { b.box(x, y, z, w, h, d, tint(hex, k === undefined ? 1 : k)); }

  function wheel(x, y, z, r, w) {
    var m = new THREE.Mesh(GEO.wheel, MAT.tire);
    m.scale.set(w, r, r);
    m.position.set(x, y, z);
    m.castShadow = true;
    var hub = new THREE.Mesh(GEO.wheel, MAT.hub);
    hub.scale.set(w * 1.02, r * 0.52, r * 0.52);
    hub.position.set(x, y, z);
    return { mesh: m, hub: hub, radius: r };
  }

  /* ---------------- builders ---------------- */
  function scooter(color, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var body = buildBody(function (b) {
      // floorboard
      box(b, 0, 0.34, 0, 0.42, 0.12, 1.15, 0x2a2d31);
      // front shield
      box(b, 0, 0.55, 0.62, 0.52, 0.62, 0.16, color);
      box(b, 0, 0.82, 0.58, 0.5, 0.30, 0.24, color, 0.92);
      // rear body
      box(b, 0, 0.48, -0.42, 0.40, 0.40, 0.80, color);
      box(b, 0, 0.70, -0.34, 0.38, 0.18, 0.72, 0x1e1f22);
      // seat
      box(b, 0, 0.86, -0.28, 0.36, 0.14, 0.72, 0x18191c);
      // handlebar
      box(b, 0, 1.02, 0.66, 0.62, 0.06, 0.06, 0x222428);
      box(b, -0.30, 1.04, 0.66, 0.06, 0.10, 0.06, 0x222428);
      box(b, 0.30, 1.04, 0.66, 0.06, 0.10, 0.06, 0x222428);
      // mirrors
      box(b, -0.34, 1.18, 0.68, 0.03, 0.18, 0.03, 0x33363a);
      box(b, 0.34, 1.18, 0.68, 0.03, 0.18, 0.03, 0x33363a);
      box(b, -0.34, 1.26, 0.68, 0.12, 0.08, 0.03, 0x33363a);
      box(b, 0.34, 1.26, 0.68, 0.12, 0.08, 0.03, 0x33363a);
      // front fender
      box(b, 0, 0.55, 0.80, 0.20, 0.14, 0.52, color, 0.9);
      // rack / delivery box
      if (opts.delivery) {
        box(b, 0, 1.12, -0.78, 0.5, 0.46, 0.5, 0x0f8a4a);
        box(b, 0, 1.12, -0.52, 0.46, 0.34, 0.02, 0xffffff);
      }
      // rider
      if (opts.rider) {
        box(b, 0, 1.20, -0.15, 0.40, 0.55, 0.28, opts.rider);
        box(b, 0, 1.47, -0.10, 0.30, 0.30, 0.30, 0xd9b48a);
        box(b, 0, 1.66, -0.10, 0.36, 0.16, 0.36, 0xe8e8e8);
        box(b, 0, 1.10, 0.30, 0.14, 0.14, 0.55, opts.rider, 0.9);
      }
    });
    g.add(body);
    var w1 = wheel(0, 0.30, 0.72, 0.30, 0.10);
    var w2 = wheel(0, 0.30, -0.62, 0.30, 0.11);
    g.add(w1.mesh, w1.hub, w2.mesh, w2.hub);
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), headMat.clone());
    hl.position.set(0, 0.88, 0.76); g.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.05), tailMat.clone());
    tl.position.set(0, 0.72, -0.86); g.add(tl);
    return {
      group: g, type: 'scooter', name: '機車',
      dims: { w: 0.7, l: 1.9, h: 1.3 },
      wheels: [{ mesh: w1.mesh, radius: 0.30, steer: true }, { mesh: w2.mesh, radius: 0.30, steer: false }],
      seat: { x: 0, y: 1.02, z: -0.2 },
      headlight: hl, taillight: tl,
      setNight: function (n) {
        hl.material.color.setRGB(1, 0.95, 0.8).multiplyScalar(0.25 + n * 1.6);
        tl.material.color.setRGB(1, 0.2, 0.15).multiplyScalar(0.35 + n * 0.9);
      },
      setBrake: function (on) { tl.material.color.setRGB(1, on ? 0.05 : 0.2, on ? 0.05 : 0.15); }
    };
  }

  function carBase(color, o) {
    var g = new THREE.Group();
    var L = o.l, W = o.w, H = o.h;
    var body = buildBody(function (b) {
      var hb = H * 0.52;
      box(b, 0, 0.30, 0, W, hb, L, color);
      // hood / trunk taper
      box(b, 0, 0.30 + hb, L * 0.26, W * 0.96, 0.10, L * 0.42, color, 0.98);
      box(b, 0, 0.30 + hb, -L * 0.30, W * 0.96, 0.10, L * 0.30, color, 0.98);
      // cabin
      box(b, 0, 0.30 + hb + 0.10, -L * 0.03, W * 0.88, H * 0.40, L * 0.46, color, 0.94);
      // bumpers
      box(b, 0, 0.38, L / 2 - 0.06, W * 0.98, 0.28, 0.18, 0x2b2d30);
      box(b, 0, 0.38, -L / 2 + 0.06, W * 0.98, 0.28, 0.18, 0x2b2d30);
      // sills
      box(b, 0, 0.30, 0, W * 1.01, 0.12, L * 0.74, 0x24262a);
      // mirrors
      box(b, -W * 0.52, H * 0.72, L * 0.14, 0.16, 0.09, 0.10, color, 0.9);
      box(b, W * 0.52, H * 0.72, L * 0.14, 0.16, 0.09, 0.10, color, 0.9);
      // roof light for taxi
      if (o.taxi) {
        box(b, 0, H * 0.95 + 0.12, 0.1, 0.62, 0.20, 0.30, 0xffcf3a);
      }
    });
    g.add(body);
    // glass
    var glass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.80, H * 0.34, L * 0.44), MAT.glass);
    glass.position.set(0, 0.30 + H * 0.52 + 0.10 + H * 0.18, -L * 0.03);
    g.add(glass);
    var ax = W * 0.5, az = L * 0.31, r = o.wheelR || 0.34;
    var wheels = [];
    [[-ax, az, true], [ax, az, true], [-ax, -az, false], [ax, -az, false]].forEach(function (p) {
      var w = wheel(p[0], r, p[1], r, 0.24);
      g.add(w.mesh, w.hub);
      wheels.push({ mesh: w.mesh, hub: w.hub, radius: r, steer: p[2] });
    });
    // grille + lights
    var hlL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat.clone());
    hlL.position.set(-W * 0.32, 0.30 + H * 0.30, L / 2 + 0.01); g.add(hlL);
    var hlR = hlL.clone(); hlR.material = headMat.clone(); hlR.position.x = W * 0.32; g.add(hlR);
    var tlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.05), tailMat.clone());
    tlL.position.set(-W * 0.32, 0.30 + H * 0.34, -L / 2 - 0.01); g.add(tlL);
    var tlR = tlL.clone(); tlR.material = tailMat.clone(); tlR.position.x = W * 0.32; g.add(tlR);
    // plate
    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.03), MAT.plate);
    plate.position.set(0, 0.42, -L / 2 - 0.03); g.add(plate);

    return {
      group: g, type: o.type, name: o.name,
      dims: { w: W, l: L, h: H },
      wheels: wheels.map(function (w) { return { mesh: w.mesh, radius: w.radius, steer: w.steer }; }),
      seat: { x: 0, y: H * 0.95, z: -L * 0.02 },
      headlight: hlL, taillight: tlL,
      setNight: function (n) {
        [hlL, hlR].forEach(function (m) { m.material.color.setRGB(1, 0.97, 0.85).multiplyScalar(0.18 + n * 1.5); });
        [tlL, tlR].forEach(function (m) { m.material.color.setRGB(1, 0.16, 0.12).multiplyScalar(0.30 + n * 0.8); });
      },
      setBrake: function (on) {
        [tlL, tlR].forEach(function (m) { m.material.color.setRGB(1, on ? 0.02 : 0.16, on ? 0.02 : 0.12); });
      }
    };
  }

  function bus() {
    var W = 2.5, L = 11, H = 3.1, color = 0xf2f2ee;
    var g = new THREE.Group();
    var body = buildBody(function (b) {
      box(b, 0, 0.45, 0, W, H - 0.45, L, color);
      box(b, 0, 0.25, 0, W * 0.98, 0.35, L * 0.98, 0x2b2d30);
      box(b, 0, H - 0.12, 0, W * 0.99, 0.18, L * 0.99, 0x2b2d30);
      // window band
      box(b, 0, 1.75, 0, W + 0.02, 0.95, L * 0.94, 0x1c2f3c);
      // stripes
      box(b, 0, 1.05, 0, W + 0.03, 0.16, L * 0.96, 0x2f8f6b);
      box(b, 0, 0.88, 0, W + 0.03, 0.10, L * 0.96, 0xff8a3d);
      // doors
      box(b, -W / 2 - 0.02, 1.0, L * 0.25, 0.04, 1.9, 1.1, 0x22303a);
      box(b, W / 2 + 0.02, 1.0, -L * 0.2, 0.04, 1.9, 1.1, 0x22303a);
      // roof AC
      box(b, 0, H + 0.04, L * 0.15, W * 0.6, 0.28, 2.2, 0xd8d8d2);
      // destination sign
      box(b, 0, 2.55, L / 2 + 0.02, W * 0.55, 0.3, 0.06, 0x111111);
    });
    g.add(body);
    var wheels = [];
    [[-W / 2, 3.4], [W / 2, 3.4], [-W / 2, -3.2], [W / 2, -3.2]].forEach(function (p) {
      var w = wheel(p[0], 0.5, p[1], 0.5, 0.30);
      g.add(w.mesh, w.hub); wheels.push({ mesh: w.mesh, radius: 0.5, steer: false });
    });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.06), headMat.clone());
    hl.position.set(-0.8, 0.85, L / 2 + 0.01); g.add(hl);
    var hl2 = hl.clone(); hl2.material = headMat.clone(); hl2.position.x = 0.8; g.add(hl2);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), tailMat.clone());
    tl.position.set(-0.8, 1.0, -L / 2 - 0.01); g.add(tl);
    var tl2 = tl.clone(); tl2.material = tailMat.clone(); tl2.position.x = 0.8; g.add(tl2);
    return {
      group: g, type: 'bus', name: '公車', dims: { w: W, l: L, h: H },
      wheels: wheels, seat: { x: 0, y: 2.2, z: 3 },
      headlight: hl, taillight: tl,
      setNight: function (n) {
        [hl, hl2].forEach(function (m) { m.material.color.setRGB(1, 0.96, 0.82).multiplyScalar(0.2 + n * 1.4); });
        [tl, tl2].forEach(function (m) { m.material.color.setRGB(1, 0.15, 0.1).multiplyScalar(0.3 + n * 0.8); });
      },
      setBrake: function (on) { [tl, tl2].forEach(function (m) { m.material.color.setRGB(1, on ? 0.02 : 0.15, on ? 0.02 : 0.1); }); }
    };
  }

  function truck() {
    var W = 2.2, L = 6.6, H = 2.7, cab = 0x2f6fa8;
    var g = new THREE.Group();
    var body = buildBody(function (b) {
      box(b, 0, 0.35, 1.7, W, 1.5, 2.0, cab);
      box(b, 0, 1.15, 2.3, W * 0.9, 0.7, 0.1, 0x1c2f3c);
      box(b, 0, 1.9, 1.6, W * 0.94, 0.5, 1.7, cab, 1.02);
      box(b, 0, 0.55, -1.6, W * 1.02, 2.4, 3.6, 0xe9e7de);
      box(b, 0, 2.9, -1.6, W * 1.04, 0.14, 3.7, 0xbfbdb4);
      box(b, 0, 0.35, 2.7, W * 0.9, 0.4, 0.3, 0x2b2d30);
      box(b, 0, 0.35, -3.4, W * 0.9, 0.4, 0.3, 0x2b2d30);
    });
    g.add(body);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.6, 0.08), MAT.glass);
    glass.position.set(0, 2.05, 2.38); g.add(glass);
    var wheels = [];
    [[-W / 2, 1.9], [W / 2, 1.9], [-W / 2, -1.8], [W / 2, -1.8]].forEach(function (p) {
      var w = wheel(p[0], 0.42, p[1], 0.42, 0.26);
      g.add(w.mesh, w.hub); wheels.push({ mesh: w.mesh, radius: 0.42, steer: false });
    });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.05), headMat.clone());
    hl.position.set(-0.7, 0.75, L / 2 + 0.05); g.add(hl);
    var hl2 = hl.clone(); hl2.material = headMat.clone(); hl2.position.x = 0.7; g.add(hl2);
    return {
      group: g, type: 'truck', name: '貨車', dims: { w: W, l: L, h: H },
      wheels: wheels, seat: { x: 0, y: 1.9, z: 1.6 },
      headlight: hl, taillight: hl,
      setNight: function (n) { [hl, hl2].forEach(function (m) { m.material.color.setRGB(1, 0.96, 0.82).multiplyScalar(0.2 + n * 1.4); }); },
      setBrake: function () {}
    };
  }

  function police() {
    var v = carBase(0xf4f6f8, { type: 'police', name: '警車', w: 1.84, l: 4.7, h: 1.48, wheelR: 0.35 });
    var g = v.group;
    // black side panels
    var b = buildBody(function (bb) {
      box(bb, 0, 0.62, 0, 1.87, 0.5, 3.3, 0x16191d);
      box(bb, 0, 0.55, 1.9, 1.88, 0.2, 1.1, 0x16191d);
    });
    g.add(b);
    // light bar
    var red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), new THREE.MeshBasicMaterial({ color: 0xff1a1a }));
    red.position.set(-0.34, 1.55, 0.05); g.add(red);
    var blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), new THREE.MeshBasicMaterial({ color: 0x1a5cff }));
    blue.position.set(0.34, 1.55, 0.05); g.add(blue);
    var bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.28), new THREE.MeshLambertMaterial({ color: 0x22252a }));
    bar.position.set(0, 1.47, 0.05); g.add(bar);
    // 警察 door decal via canvas
    var c = U.canvas(256, 96), ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#123a8c'; ctx.font = 'bold 54px "Microsoft JhengHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('警察', 128, 50);
    var tex = new THREE.CanvasTexture(c);
    var decal = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshBasicMaterial({ map: tex }));
    decal.position.set(-0.94, 0.72, 0.1); decal.rotation.y = -Math.PI / 2; g.add(decal);
    var decal2 = decal.clone(); decal2.position.x = 0.94; decal2.rotation.y = Math.PI / 2; g.add(decal2);
    v.lightbar = { red: red, blue: blue };
    v.type = 'police'; v.name = '警車';
    v.setSiren = function (on, t) {
      if (!on) { red.material.color.setRGB(0.55, 0.06, 0.06); blue.material.color.setRGB(0.05, 0.2, 0.55); return; }
      var f = Math.sin(t * 12) > 0;
      red.material.color.setRGB(f ? 1 : 0.15, f ? 0.08 : 0.02, f ? 0.06 : 0.02);
      blue.material.color.setRGB(f ? 0.05 : 0.1, f ? 0.12 : 0.3, f ? 0.5 : 1);
    };
    return v;
  }

  var cache = {};
  function create(type, opts) {
    opts = opts || {};
    switch (type) {
      case 'scooter': return scooter(opts.color || 0xd23c3c, opts);
      case 'taxi': return carBase(0xffc419, { type: 'taxi', name: '計程車', w: 1.8, l: 4.5, h: 1.44, taxi: true });
      case 'suv': return carBase(opts.color || 0x37444f, { type: 'suv', name: '休旅車', w: 1.95, l: 4.8, h: 1.72, wheelR: 0.38 });
      case 'bus': return bus();
      case 'truck': return truck();
      case 'police': return police();
      case 'sedan':
      default:
        return carBase(opts.color || [0xd8d8d2, 0x2c3e50, 0x8b1e2b, 0x1f6f5c, 0xb9c0c6, 0x3a4a6b][Math.floor(Math.random() * 6)],
          { type: 'sedan', name: '轎車', w: 1.8, l: 4.4, h: 1.4 });
    }
  }

  /* ---------------- traffic ---------------- */
  function Traffic(scene, opts) {
    opts = opts || {};
    this.scene = scene;
    this.count = opts.count || 26;
    this.cars = [];
    this.night = 0;
    this._rng = U.mulberry32(opts.seed || 99173);
    this._ew = TG.CONFIG.roads.ew;
    this._ns = TG.CONFIG.roads.ns;
    this._gridX = this._ns.map(function (r) { return r.x; });
    this._gridZ = this._ew.map(function (r) { return r.z; });
  }

  Traffic.prototype._roadFor = function (axis, coord) {
    var list = axis === 'x' ? this._ew : this._ns;
    for (var i = 0; i < list.length; i++) {
      var p = axis === 'x' ? list[i].z : list[i].x;
      if (Math.abs(p - coord) < 0.5) return list[i];
    }
    return list[0];
  };
  Traffic.prototype._gridFor = function (axis) { return axis === 'x' ? this._gridX : this._gridZ; };

  Traffic.prototype._planNext = function (car) {
    var grid = this._gridFor(car.axis), best = null, i;
    for (i = 0; i < grid.length; i++) {
      var d = (grid[i] - car.pos) * car.dir;
      if (d > 1 && (best === null || d < best.d)) best = { p: grid[i], d: d };
    }
    if (!best) { // U-turn at the edge of the map
      car.dir = -car.dir;
      return this._planNext(car);
    }
    car.nextG = best.p;
    var atEdge = (best.p <= -319 || best.p >= 319);
    var r = this._rng();
    if (r < (atEdge ? 0.75 : 0.3)) {
      var newAxis = car.axis === 'x' ? 'z' : 'x';
      var newDir = this._rng() < 0.5 ? 1 : -1;
      // don't turn outward at an edge
      var coordOther = car.axis === 'x' ? best.p : best.p;
      car.turnQueued = true;
      car.nextAxis = newAxis;
      car.nextDir = newDir;
      car.nextRoad = this._roadFor(newAxis, coordOther);
    } else {
      car.turnQueued = false;
      car.nextAxis = car.axis;
      car.nextDir = car.dir;
      car.nextRoad = car.road;
    }
  };

  Traffic.prototype._applyTurn = function (car) {
    car.axis = car.nextAxis;
    car.dir = car.nextDir;
    car.road = car.nextRoad;
    car.lane = car.road.w * 0.25 * car.dir;
    car.pos = car.nextG;
    if (car.axis === 'x') { car.x = car.pos; car.z = car.road.z + car.lane; }
    else { car.z = car.pos; car.x = car.road.x - car.lane; }
    this._planNext(car);
  };

  Traffic.prototype.makeCar = function (type, axis, road, pos, dir) {
    var v = TG.Vehicles.create(type, {});
    var s = 0.92 + this._rng() * 0.16;
    v.group.scale.setScalar(s);
    this.scene.add(v.group);
    var lane = road.w * 0.25 * dir;
    var car = {
      veh: v, type: type, axis: axis, dir: dir, road: road, lane: lane, pos: pos,
      x: 0, z: 0, heading: 0, speed: 7 + this._rng() * 5,
      targetSpeed: 9 + this._rng() * 5, stopped: false, brake: false, wheelSpin: 0
    };
    if (axis === 'x') { car.x = pos; car.z = road.z + lane; car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.z = pos; car.x = road.x - lane; car.heading = dir > 0 ? 0 : Math.PI; }
    v.group.position.set(car.x, 0, car.z);
    v.group.rotation.y = car.heading;
    car.nextG = null;
    this._planNext(car);
    this.cars.push(car);
    return car;
  };

  Traffic.prototype.spawnAt = function (type, x, z, heading) {
    var nr = TG.CONFIG.nearestRoad(x, z);
    var axis = nr.road.axis;
    var dir = this._rng() < 0.5 ? 1 : -1;
    var road = axis === 'x' ? this._roadFor('x', nr.road.pos) : this._roadFor('z', nr.road.pos);
    var pos = axis === 'x' ? x : z;
    return this.makeCar(type, axis, road, Math.max(-330, Math.min(330, pos)), dir);
  };

  Traffic.prototype._spawnRandom = function (px, pz) {
    var rng = this._rng;
    var axis = rng() < 0.5 ? 'x' : 'z';
    var list = axis === 'x' ? this._ew : this._ns;
    var road = list[Math.floor(rng() * list.length)];
    var t = rng();
    var type = t < 0.46 ? 'sedan' : t < 0.60 ? 'taxi' : t < 0.76 ? 'scooter' : t < 0.87 ? 'suv' : t < 0.94 ? 'bus' : 'truck';
    var pos;
    if (axis === 'x') {
      pos = Math.max(-330, Math.min(330, px + (rng() - 0.5) * 300));
    } else {
      pos = Math.max(-330, Math.min(330, pz + (rng() - 0.5) * 300));
    }
    var dir = rng() < 0.5 ? 1 : -1;
    return this.makeCar(type, axis, road, pos, dir);
  };

  Traffic.prototype.update = function (dt, ctx) {
    ctx = ctx || {};
    var px = ctx.playerX || 0, pz = ctx.playerZ || 0;
    var pv = ctx.playerVehicle || null;
    this.night = ctx.night || 0;
    var i, j;

    // cull far cars
    for (i = this.cars.length - 1; i >= 0; i--) {
      var c0 = this.cars[i];
      var dd = (c0.x - px) * (c0.x - px) + (c0.z - pz) * (c0.z - pz);
      if (dd > 430 * 430) {
        this.scene.remove(c0.veh.group);
        this.cars.splice(i, 1);
      }
    }
    // maintain density
    var guard = 0;
    while (this.cars.length < this.count && guard++ < 3) {
      var c1 = this._spawnRandom(px, pz);
      if (!c1) break;
    }

    for (i = 0; i < this.cars.length; i++) {
      var car = this.cars[i];
      var want = car.targetSpeed;

      // slow before intersection when turning
      if (car.nextG !== null) {
        var toG = (car.nextG - car.pos) * car.dir;
        if (toG < 18 && car.turnQueued) want = Math.min(want, 6.0);
      }
      // follow other cars
      for (j = 0; j < this.cars.length; j++) {
        if (j === i) continue;
        var o = this.cars[j];
        if (o.axis !== car.axis || o.dir !== car.dir || Math.abs(o.lane - car.lane) > 2.4) continue;
        var ahead = (o.pos - car.pos) * car.dir;
        if (ahead > 0 && ahead < 14) want = Math.min(want, Math.max(0, (ahead - 5.5) * 1.5));
      }
      // player vehicle
      if (pv) {
        var dx = pv.x - car.x, dz = pv.z - car.z;
        var aheadP = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        var sideP = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (aheadP > 0 && aheadP < 14 && sideP < 3.2) want = Math.min(want, Math.max(0, (aheadP - 6) * 1.4));
      }
      // player on foot
      if (!pv && ctx.playerX !== undefined) {
        var fx = ctx.playerX - car.x, fz = ctx.playerZ - car.z;
        var ap = car.axis === 'x' ? fx * car.dir : fz * car.dir;
        var sp = car.axis === 'x' ? Math.abs(fz) : Math.abs(fx);
        if (ap > 0 && ap < 10 && sp < 2.6) want = 0;
      }

      car.brake = want < 2;
      car.speed += (want - car.speed) * Math.min(1, dt * 2.4);
      if (car.speed < 0.15) car.speed = 0;
      var move = car.speed * dt;
      car.pos += move * car.dir;

      if (car.nextG !== null && (car.nextG - car.pos) * car.dir <= 0.45) {
        if (car.turnQueued) this._applyTurn(car);
        else { car.pos = car.nextG; this._planNext(car); }
      }

      if (car.axis === 'x') { car.x = car.pos; car.z = car.road.z + car.lane; }
      else { car.z = car.pos; car.x = car.road.x - car.lane; }

      var targetHead = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.heading = U.angleLerp(car.heading, targetHead, Math.min(1, dt * 7));
      car.veh.group.position.set(car.x, 0, car.z);
      car.veh.group.rotation.y = car.heading;

      car.wheelSpin += move / 0.34;
      for (var wi = 0; wi < car.veh.wheels.length; wi++) car.veh.wheels[wi].mesh.rotation.x = car.wheelSpin;
      car.veh.setNight(this.night);
      car.veh.setBrake(car.brake);
      if (car.veh.setSiren) car.veh.setSiren(false, 0);
    }
  };

  Traffic.prototype.getNear = function (x, z, r) {
    var out = [], r2 = r * r;
    for (var i = 0; i < this.cars.length; i++) {
      var c = this.cars[i];
      if ((c.x - x) * (c.x - x) + (c.z - z) * (c.z - z) < r2) out.push(c);
    }
    return out;
  };
  Traffic.prototype.setCount = function (n) { this.count = n; };

  return { create: create, Traffic: Traffic, setLightbar: function (veh, mode) { if (veh.setSiren) veh.setSiren(mode !== 'off', performance.now() / 1000); } };
})();

/* convenience global (contract used by game.js / agents.js) */
TG.Traffic = TG.Vehicles.Traffic;
