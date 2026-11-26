/* ============================================================
   city.js — 台北市 procedural city: sky, roads, blocks, buildings,
   parks, river, mountains, street props, rain, day/night.
   ============================================================ */
window.TG = window.TG || {};

TG.City = (function () {
  'use strict';
  var U = TG.Utils, C = TG.CONFIG;

  var MAT = {};

  function build(scene, opts) {
    opts = opts || {};
    var rng = U.mulberry32(opts.seed || 8821);
    var root = new THREE.Group();
    root.name = 'city';
    scene.add(root);

    var colliders = new U.Colliders();
    var labels = [];

    /* ---------------- sky ---------------- */
    var skyUniforms = {
      topColor: { value: new THREE.Color(0x2f6fb8) },
      botColor: { value: new THREE.Color(0xcfe4ee) },
      sunColor: { value: new THREE.Color(0xffe3b0) },
      sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
      offset: { value: 0.0 }
    };
    var skyGeo = new THREE.SphereGeometry(4200, 24, 16);
    var skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: [
        'varying vec3 vW;',
        'void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz;',
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor; uniform vec3 botColor; uniform vec3 sunColor; uniform vec3 sunDir;',
        'varying vec3 vW;',
        'void main(){',
        ' vec3 d = normalize(vW);',
        ' float h = clamp(d.y*1.15+0.06, 0.0, 1.0);',
        ' vec3 col = mix(botColor, topColor, pow(h, 0.72));',
        ' float sd = max(dot(d, normalize(sunDir)), 0.0);',
        ' col += sunColor * pow(sd, 26.0) * 0.85;',
        ' col += sunColor * pow(sd, 3.0) * 0.10;',
        ' gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    root.add(sky);

    /* ---------------- lights ---------------- */
    var hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5c5348, 0.78);
    root.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
    sun.position.set(120, 160, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 620;
    sun.shadow.camera.left = -110;
    sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110;
    sun.shadow.camera.bottom = -110;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.6;
    var sunTarget = new THREE.Object3D();
    root.add(sunTarget);
    sun.target = sunTarget;
    root.add(sun);
    var ambient = new THREE.AmbientLight(0x7d8ba3, 0.34);
    root.add(ambient);
    // warm city bounce at night
    var cityGlow = new THREE.PointLight(0xffb066, 0, 900, 2);
    cityGlow.position.set(0, 40, 0);
    root.add(cityGlow);

    scene.fog = new THREE.Fog(0xcfe4ee, 220, 1500);

    /* ---------------- ground ---------------- */
    var groundMat = new THREE.MeshLambertMaterial({ color: 0x3c423d });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    root.add(ground);

    /* ---------------- textures / materials ---------------- */
    var facade = U.facadeTextures(rng, { base: '#b8b1a3', glass: '#5f8494', lit: 0.45 });
    MAT.facade = new THREE.MeshLambertMaterial({
      map: facade.map,
      vertexColors: true,
      emissiveMap: facade.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0
    });
    var facade2 = U.facadeTextures(rng, { base: '#a3aeb5', glass: '#3f6274', lit: 0.55 });
    MAT.glass = new THREE.MeshLambertMaterial({
      map: facade2.map,
      vertexColors: true,
      emissiveMap: facade2.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0
    });
    MAT.plain = new THREE.MeshLambertMaterial({ vertexColors: true });
    MAT.asphalt = new THREE.MeshLambertMaterial({
      map: U.roadTexture(true),
      vertexColors: true
    });
    MAT.paint = new THREE.MeshLambertMaterial({ color: 0xf2f0e6, vertexColors: false });
    MAT.lamp = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
    MAT.lamp.materialName = 'lamp';
    MAT.neon = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
    MAT.tree = new THREE.MeshLambertMaterial({ vertexColors: true });
    MAT.water = new THREE.MeshPhongMaterial({
      color: 0x2c5468, shininess: 90, specular: 0x88bbcc, transparent: true, opacity: 0.94
    });

    /* builders */
    var bWall = new U.GeoBuilder();     // textured facades
    var bGlass = new U.GeoBuilder();    // glass towers
    var bPlain = new U.GeoBuilder();    // roofs, props, sidewalks
    var bRoad = new U.GeoBuilder();
    var bPaint = new U.GeoBuilder();
    var bLamp = new U.GeoBuilder();
    var bNeon = new U.GeoBuilder();
    var bTree = new U.GeoBuilder();

    /* ---------------- roads ---------------- */
    var RW = C.roads.ew, NS = C.roads.ns;
    var EXT = 380;
    function roadSurface(axis, pos, width) {
      var hw = width / 2, len = EXT * 2, vrep = len / 14;
      var y = 0.01;
      var uvA = [[0, 0], [1, 0], [1, vrep], [0, vrep]];
      if (axis === 'x') {
        bRoad.quad([-EXT, y, pos + hw], [EXT, y, pos + hw], [EXT, y, pos - hw], [-EXT, y, pos - hw],
          [0, 1, 0], uvA, [1, 1, 1]);
      } else {
        bRoad.quad([pos - hw, y, EXT], [pos + hw, y, EXT], [pos + hw, y, -EXT], [pos - hw, y, -EXT],
          [0, 1, 0], uvA, [1, 1, 1]);
      }
    }
    RW.forEach(function (r) { roadSurface('x', r.z, r.w); });
    NS.forEach(function (r) { roadSurface('z', r.x, r.w); });

    /* intersections get their own asphalt patch to hide seam + painted box */
    RW.forEach(function (er) {
      NS.forEach(function (nr) {
        var hw = er.w / 2, hw2 = nr.w / 2;
        bPaint.quad(
          [nr.x - hw2 + 1.2, 0.03, er.z - hw + 1.2],
          [nr.x + hw2 - 1.2, 0.03, er.z - hw + 1.2],
          [nr.x + hw2 - 1.2, 0.03, er.z + hw - 1.2],
          [nr.x - hw2 + 1.2, 0.03, er.z + hw - 1.2],
          [0, 1, 0], null, [1, 1, 1]);
      });
    });

    /* crosswalk zebra stripes on all four approaches of each intersection */
    function crosswalks(ix, iz, rw, rn) {
      var halfE = rw / 2, halfN = rn / 2;
      var stripe = 0.55, gap = 0.55, depth = 3.2;
      // north & south approach (stripes run along X)
      for (var side = -1; side <= 1; side += 2) {
        var zc = iz + side * (halfE + 2.0);
        for (var x = ix - halfN + 1.0; x < ix + halfN - 1.0; x += stripe + gap) {
          bPaint.quad([x, 0.035, zc - depth / 2], [x + stripe, 0.035, zc - depth / 2],
            [x + stripe, 0.035, zc + depth / 2], [x, 0.035, zc + depth / 2], [0, 1, 0], null, [1, 1, 1]);
        }
        // east & west approach (stripes run along Z)
        var xc = ix + side * (halfN + 2.0);
        for (var z = iz - halfE + 1.0; z < iz + halfE - 1.0; z += stripe + gap) {
          bPaint.quad([xc - depth / 2, 0.035, z], [xc + depth / 2, 0.035, z],
            [xc + depth / 2, 0.035, z + stripe], [xc - depth / 2, 0.035, z + stripe], [0, 1, 0], null, [1, 1, 1]);
        }
      }
    }

    /* ---------------- blocks / buildings ---------------- */
    var bx = [-360].concat(NS.map(function (r) { return r.x; })).concat([360]);
    var bz = [-360].concat(RW.map(function (r) { return r.z; })).concat([360]);

    function roadHalfAt(axis, pos) {
      var list = axis === 'x' ? RW : NS;
      for (var i = 0; i < list.length; i++) {
        var p = axis === 'x' ? list[i].z : list[i].x;
        if (Math.abs(p - pos) < 0.01) return list[i].w / 2;
      }
      return 10;
    }

    function reservedAt(cx, cz) {
      for (var i = 0; i < C.reservedBlocks.length; i++) {
        var b = C.reservedBlocks[i];
        if (Math.abs(cx - b.x) < b.r && Math.abs(cz - b.z) < b.r) return b;
      }
      return null;
    }

    var sidewalkColor = [0.72, 0.71, 0.68];
    var sidewalkY = 0.22;

    /* sidewalk ring around a block rect */
    function sidewalkRing(x0, x1, z0, z1, w) {
      var c = sidewalkColor;
      bPlain.box((x0 + x1) / 2, 0, z0 + w / 2, (x1 - x0), sidewalkY, w, c);
      bPlain.box((x0 + x1) / 2, 0, z1 - w / 2, (x1 - x0), sidewalkY, w, c);
      bPlain.box(x0 + w / 2, 0, (z0 + z1) / 2, w, sidewalkY, (z1 - z0) - 2 * w, c);
      bPlain.box(x1 - w / 2, 0, (z0 + z1) / 2, w, sidewalkY, (z1 - z0) - 2 * w, c);
    }

    var buildingStats = { count: 0 };

    var districtHeight = {
      '信義區': [70, 165], '中正區': [22, 58], '大安區': [18, 44], '西門町': [16, 42],
      '中山區': [20, 52], '松山區': [24, 60], '大同區': [12, 30], '萬華區': [10, 26], '士林區': [10, 26]
    };

    var wallColors = [
      [0.86, 0.84, 0.78], [0.80, 0.79, 0.74], [0.90, 0.87, 0.79], [0.72, 0.73, 0.72],
      [0.83, 0.75, 0.64], [0.77, 0.79, 0.80], [0.88, 0.82, 0.72], [0.70, 0.72, 0.75],
      [0.85, 0.80, 0.70], [0.75, 0.78, 0.78]
    ];

    function makeBuilding(x, z, w, d, h, district, rng) {
      var glassy = h > 55 || rng() < 0.22;
      var col = wallColors[Math.floor(rng() * wallColors.length)].slice();
      if (glassy) col = [0.62 + rng() * 0.12, 0.72 + rng() * 0.10, 0.82 + rng() * 0.08];
      var b = glassy ? bGlass : bWall;
      var us = glassy ? 1 / 8.5 : 1 / 10;
      var vs = glassy ? 1 / 14 : 1 / 12.8;

      // podium
      if (rng() < 0.42 && h > 18) {
        var ph = 4 + rng() * 6;
        b.box(x, 0, z, w + 1.5, ph, d + 1.5, col.map(function (v) { return v * 0.92; }), us, vs);
        bPlain.box(x, ph, z, w + 2.6, 0.5, d + 2.6, [0.55, 0.55, 0.53]);
        bPlain.box(x, 0, z, w + 2.2, 0.16, d + 2.2, [0.35, 0.35, 0.34]);
        bPlain.box(x, ph + 0.5, z, w * 0.82, h - ph - 0.5, d * 0.82, col, us, vs);
        // actually upper tower uses facade material:
        bWall.box(x, ph + 0.5, z, w * 0.82, h - ph - 0.5, d * 0.82, col, us, vs);
      } else {
        bPlain.box(x, 0, z, w + 1.0, 0.18, d + 1.0, [0.38, 0.38, 0.37]);
        b.box(x, 0.18, z, w, h - 0.18, d, col, us, vs);
      }

      // roof slab + parapet
      bPlain.box(x, h, z, w + 0.6, 0.5, d + 0.6, [0.42, 0.42, 0.41]);
      if (rng() < 0.7) {
        // rooftop clutter: water tanks / AC units
        var n = 1 + Math.floor(rng() * 3);
        for (var i = 0; i < n; i++) {
          var rw2 = 1.2 + rng() * 2.2, rh2 = 0.8 + rng() * 1.6;
          bPlain.box(x + (rng() - 0.5) * (w - 4), h + 0.5, z + (rng() - 0.5) * (d - 4),
            rw2, rh2, rw2, [0.62, 0.62, 0.60]);
        }
        if (rng() < 0.35) {
          bPlain.box(x + (rng() - 0.5) * (w - 6), h + 0.5, z + (rng() - 0.5) * (d - 6), 1.2, 3.2, 1.2, [0.55, 0.55, 0.53]);
        }
      }
      // ground-floor shop awning + sign strip
      if (h < 60 && rng() < 0.75) {
        var awn = [0.85, 0.35, 0.3, 0.3].map(function () { return rng(); });
        bPlain.box(x, 3.6, z + d / 2 + 0.35, w * 0.92, 0.18, 1.4,
          [0.35 + rng() * 0.4, 0.3 + rng() * 0.35, 0.3 + rng() * 0.4]);
      }
      colliders.add(x - w / 2 - 1.6, x + w / 2 + 1.6, z - d / 2 - 1.6, z + d / 2 + 1.6, 'building');
      buildingStats.count++;
    }

    function fillBlock(x0, x1, z0, z1, district) {
      var pad = 0.5;
      var W = x1 - x0 - pad * 2, D = z1 - z0 - pad * 2;
      if (W < 8 || D < 8) return;
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      var res = reservedAt(cx, cz);
      if (res) { return; }

      var hr = districtHeight[district] || [16, 40];
      // split into lots
      var lots = [];
      var cols = W > 46 ? 2 : 1;
      var rows = D > 46 ? 2 : 1;
      if (W > 46 && D > 46 && rng() < 0.55) { cols = 2; rows = 2; }
      var lw = W / cols, ld = D / rows;
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var jx = 0.6 + rng() * 1.2, jz = 0.6 + rng() * 1.2;
          lots.push({
            x: x0 + pad + lw * (i + 0.5),
            z: z0 + pad + ld * (j + 0.5),
            w: lw - jx * 2, d: ld - jz * 2
          });
        }
      }
      lots.forEach(function (L) {
        if (rng() < 0.08) return; // occasional empty lot
        var h = hr[0] + rng() * (hr[1] - hr[0]);
        if (district === '信義區') h = Math.pow(rng(), 0.7) * (hr[1] - hr[0]) + hr[0];
        makeBuilding(L.x, L.z, L.w, L.d, h, district, rng);
      });
    }

    var specialBlocks = {};

    for (var xi = 0; xi < bx.length - 1; xi++) {
      for (var zi = 0; zi < bz.length - 1; zi++) {
        var x0 = bx[xi], x1 = bx[xi + 1], z0 = bz[zi], z1 = bz[zi + 1];
        var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        var hwE = roadHalfAt('x', z0), hwE2 = roadHalfAt('x', z1);
        var hwN = roadHalfAt('z', x0), hwN2 = roadHalfAt('z', x1);
        var ix0 = x0 + hwN + 4, ix1 = x1 - hwN2 - 4;
        var iz0 = z0 + hwE + 4, iz1 = z1 - hwE2 - 4;
        if (ix1 - ix0 < 4 || iz1 - iz0 < 4) continue;
        sidewalkRing(ix0, ix1, iz0, iz1, C.city.sidewalk);

        var district = C.districtAt(cx, cz);
        var res = reservedAt(cx, cz);
        if (res) {
          // paving for landmark blocks
          var pc = [0.52, 0.51, 0.49];
          bPlain.flat(cx, 0.05, cz, ix1 - ix0 - 1, iz1 - iz0 - 1, pc, 1 / 10);
          if (res.tag === 'park') {
            bPlain.flat(cx, 0.08, cz, ix1 - ix0, iz1 - iz0, [0.36, 0.55, 0.30], 1 / 12);
          }
          specialBlocks[res.tag] = true;
        } else {
          fillBlock(ix0, ix1, iz0, iz1, district);
        }
      }
    }

    /* crosswalks + street lights at every intersection */
    RW.forEach(function (er) {
      NS.forEach(function (nr) {
        crosswalks(nr.x, er.z, er.w, nr.w);
        // corner street lamps (4)
        for (var sx = -1; sx <= 1; sx += 2) {
          for (var sz = -1; sz <= 1; sz += 2) {
            var lx = nr.x + sx * (nr.w / 2 + 2.6);
            var lz = er.z + sz * (er.w / 2 + 2.6);
            streetLamp(lx, lz);
          }
        }
      });
    });

    function streetLamp(x, z) {
      var y0 = 0.22;
      bPlain.box(x, y0, z, 0.22, 7.2, 0.22, [0.30, 0.32, 0.33]);
      bPlain.box(x + 0.9, y0 + 7.0, z, 1.9, 0.16, 0.18, [0.30, 0.32, 0.33]);
      bLamp.box(x + 1.75, y0 + 6.86, z, 0.9, 0.22, 0.5, [1, 0.92, 0.72]);
    }

    /* street name signs on a few central intersections */
    var signCache = {};
    function streetSign(x, z, name, rotY) {
      var tex = signCache[name];
      if (!tex) {
        tex = U.signTexture(name, '#0f6b3f', '#ffffff', { size: 46 });
        signCache[name] = tex;
      }
      var g = new THREE.PlaneGeometry(3.2, 0.8);
      var m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
      var mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, 5.4, z);
      mesh.rotation.y = rotY;
      root.add(mesh);
    }

    /* ---------------- parks / green ---------------- */
    function parkBlock(cx, cz, w, d) {
      bPlain.flat(cx, 0.06, cz, w, d, [0.34, 0.52, 0.29], 1 / 12);
      // paths
      bPlain.flat(cx, 0.09, cz, w * 0.16, d, [0.66, 0.64, 0.58], 1 / 8);
      bPlain.flat(cx, 0.09, cz, w, d * 0.14, [0.66, 0.64, 0.58], 1 / 8);
      // pond
      if (rng() < 0.6) {
        var pond = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, d) * 0.22, 18), MAT.water);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(cx + w * 0.16, 0.1, cz - d * 0.1);
        root.add(pond);
      }
      // trees
      var n = Math.floor((w * d) / 90);
      for (var i = 0; i < n; i++) {
        var tx = cx + (rng() - 0.5) * (w - 6), tz = cz + (rng() - 0.5) * (d - 6);
        tree(tx, tz, 0.9 + rng() * 0.7);
      }
    }
    var parkCenters = [[160, 160], [120, 120], [200, 120], [120, 200], [200, 200]];
    parkCenters.forEach(function (p) { parkBlock(p[0], p[1], 62, 62); });

    function tree(x, z, s) {
      var h = 4.2 * s;
      bTree.box(x, 0.1, z, 0.42 * s, h, 0.42 * s, [0.32, 0.24, 0.16]);
      var cols = [[0.22, 0.42, 0.20], [0.28, 0.48, 0.22], [0.18, 0.36, 0.18]];
      var c = cols[Math.floor(rng() * cols.length)];
      bTree.box(x, h, z, 3.4 * s, 2.6 * s, 3.4 * s, c);
      bTree.box(x, h + 2.2 * s, z, 2.2 * s, 1.8 * s, 2.2 * s, c.map(function (v) { return v * 1.08; }));
    }

    /* roadside trees along 仁愛路 & 敦化南路 (tree-lined avenues) */
    for (var tx1 = -360; tx1 <= 360; tx1 += 18) {
      if (Math.abs(tx1) > 350) continue;
      tree(tx1 + 3, 80 + 13.6, 0.85);
      tree(tx1 + 3, 80 - 13.6, 0.85);
      tree(240 + 15.5, tx1 + 4, 0.8);
      tree(240 - 15.5, tx1 + 4, 0.8);
    }
    for (var tz1 = -360; tz1 <= 360; tz1 += 22) {
      tree(-80 + 16.5, tz1, 0.8);
      tree(-80 - 16.5, tz1, 0.8);
    }

    /* ---------------- river & mountains ---------------- */
    var waterGeo = new THREE.PlaneGeometry(C.city.riverW, 1600, 1, 1);
    var water = new THREE.Mesh(waterGeo, MAT.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(C.city.riverX - C.city.riverW / 2, -1.4, 0);
    root.add(water);
    // riverbank grass
    bPlain.flat((C.city.riverX + -360) / 2, 0.02, 0, (C.city.riverX + 360) * -1 + 0, 1600, [0.30, 0.45, 0.26], 1 / 30);

    function hill(x, z, r, h, color) {
      var g = new THREE.ConeGeometry(r, h, 7 + Math.floor(rng() * 3), 1);
      var m = new THREE.MeshLambertMaterial({ color: color, flatShading: true });
      var mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, h / 2 - 2, z);
      mesh.rotation.y = rng() * 6.28;
      root.add(mesh);
    }
    // 象山 (SE) — green hills
    for (var i = 0; i < 16; i++) {
      var a = rng() * Math.PI * 2, rr = 420 + rng() * 420;
      hill(860 + Math.cos(a) * rr * 0.5, 860 + Math.sin(a) * rr * 0.5, 150 + rng() * 170, 140 + rng() * 220, 0x2f4a2e);
    }
    // 陽明山 (N)
    for (var j = 0; j < 18; j++) {
      hill(-60 + (rng() - 0.5) * 1500, -1150 - rng() * 500, 170 + rng() * 200, 180 + rng() * 260, 0x334f30);
    }
    // ring of far hills to close the horizon
    for (var k = 0; k < 26; k++) {
      var ang = (k / 26) * Math.PI * 2 + rng() * 0.1;
      var dist = 1750 + rng() * 500;
      hill(Math.cos(ang) * dist, Math.sin(ang) * dist, 240 + rng() * 260, 220 + rng() * 320, 0x2c4430);
    }

    /* ---------------- neon signs (西門町 / 夜市 / downtown) ---------------- */
    var neonNames = ['西門町', '電影院', 'KTV', '麻辣火鍋', '牛肉麵', '珍奶', '潮流', '手機', '按摩', '網咖',
      '蚵仔煎', '大雞排', '臭豆腐', '滷肉飯', '藥局', '便利商店'];
    var neonPalette = [
      ['#ff2e88', '#ffd7ea'], ['#00e5ff', '#062b33'], ['#ffd23f', '#3a2c00'],
      ['#7cff5a', '#0b2a08'], ['#ff7b2e', '#2b1200'], ['#b06bff', '#1a0b2e']
    ];
    function neonSign(x, y, z, text, rotY, scale) {
      var pal = neonPalette[Math.floor(rng() * neonPalette.length)];
      var tex = U.signTexture(text, pal[1], pal[0], { tall: text.length > 2, size: 54 });
      var w = scale || 2.2, h = (text.length > 2 ? 6.2 : 1.5) * (scale ? scale / 2.2 : 1);
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false });
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.userData.neon = true;
      neonMats.push(mat);
      root.add(mesh);
    }
    var neonMats = [];

    // 西門町 block edge signs
    var ximenSigns = [
      [-236, 10, -44, '西門町', Math.PI / 2], [-236, 7, -28, '電影院', Math.PI / 2],
      [-236, 11, -12, 'KTV', Math.PI / 2], [-236, 6.5, -58, '珍奶', Math.PI / 2],
      [-164, 8, -50, '潮流', -Math.PI / 2], [-164, 10, -30, '麻辣火鍋', -Math.PI / 2],
      [-200, 6, -84, '手機', 0], [-184, 7, -84, '網咖', 0],
      [-216, 8, 4, '牛肉麵', Math.PI], [-196, 6, 4, '藥局', Math.PI]
    ];
    ximenSigns.forEach(function (s) { neonSign(s[0], s[1], s[2], s[3], s[4]); });

    // 夜市 signs
    for (var nsi = 0; nsi < 10; nsi++) {
      var nx = -34 + (nsi % 5) * 17, nz = -320 + 9 + Math.floor(nsi / 5) * 12;
      neonSign(nx, 3.2, nz, neonNames[10 + (nsi % 6)], nsi % 2 ? 0 : Math.PI, 1.9);
    }

    // downtown rooftop billboards
    for (var bi = 0; bi < 12; bi++) {
      var rx = -300 + Math.floor(rng() * 9) * 80 + (rng() - 0.5) * 30;
      var rz = -300 + Math.floor(rng() * 9) * 80 + (rng() - 0.5) * 30;
      if (reservedAt(rx, rz)) continue;
      neonSign(rx, 16 + rng() * 22, rz, neonNames[Math.floor(rng() * neonNames.length)], rng() * 6.28, 2.8);
    }

    /* ---------------- build merged meshes ---------------- */
    function addMerged(builder, mat, shadow, receive) {
      if (builder.isEmpty()) return null;
      var mesh = new THREE.Mesh(builder.build(), mat);
      mesh.castShadow = !!shadow;
      mesh.receiveShadow = receive !== false;
      mesh.frustumCulled = true;
      root.add(mesh);
      return mesh;
    }
    var wallMesh = addMerged(bWall, MAT.facade, true, true);
    var glassMesh = addMerged(bGlass, MAT.glass, true, true);
    var plainMesh = addMerged(bPlain, MAT.plain, true, true);
    var roadMesh = addMerged(bRoad, MAT.asphalt, false, true);
    var paintMesh = addMerged(bPaint, MAT.paint, false, true);
    var lampMesh = addMerged(bLamp, MAT.lamp, false, false);
    var treeMesh = addMerged(bTree, MAT.tree, true, true);

    /* ---------------- rain ---------------- */
    var rainCount = 3200;
    var rainGeo = new THREE.BufferGeometry();
    var rainPos = new Float32Array(rainCount * 3);
    for (var ri = 0; ri < rainCount; ri++) {
      rainPos[ri * 3] = (rng() - 0.5) * 160;
      rainPos[ri * 3 + 1] = rng() * 60;
      rainPos[ri * 3 + 2] = (rng() - 0.5) * 160;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    var rainMat = new THREE.PointsMaterial({ color: 0xaec6da, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false });
    var rain = new THREE.Points(rainGeo, rainMat);
    rain.visible = false;
    rain.frustumCulled = false;
    root.add(rain);

    /* ---------------- day / night ---------------- */
    var night = 0;
    var tod = C.game.startTime;

    function setNight(n) {
      night = n;
      MAT.facade.emissiveIntensity = n * 1.05;
      MAT.glass.emissiveIntensity = n * 1.25;
      MAT.lamp.color.setRGB(1, 0.92, 0.72).multiplyScalar(0.45 + n * 1.5);
      neonMats.forEach(function (m) { m.opacity = 0.55 + n * 0.45; });
      cityGlow.intensity = n * 0.55;
      rainMat.opacity = 0.35 + n * 0.25;
      root.traverse(function (o) {
        if (o.isMesh && o.material && o.material.userData && o.material.userData.neon) {
          o.material.color.setScalar(0.55 + n * 0.75);
        }
      });
    }

    var _sunDir = new THREE.Vector3();
    function update(dt, timeOfDay) {
      tod = timeOfDay;
      var t = (tod / 24) * Math.PI * 2 - Math.PI / 2; // 6:00 sunrise at -PI/2
      var elev = Math.sin((tod - 6) / 12 * Math.PI);
      var az = ((tod - 6) / 12) * Math.PI;
      _sunDir.set(Math.cos(az) * 0.9, Math.max(-0.3, elev), Math.sin(az) * 0.55).normalize();
      sun.position.set(_sunDir.x * 300, Math.max(12, _sunDir.y * 300), _sunDir.z * 300);
      sunTarget.position.set(0, 0, 0);
      var day = U.clamp(elev, 0, 1);
      var dusk = U.clamp(1 - Math.abs(elev) * 3.2, 0, 1);
      sun.intensity = 0.10 + day * 2.55;
      sun.color.setHSL(0.09, 0.55 * dusk + 0.10, 0.55 + 0.18 * day);
      hemi.intensity = 0.30 + day * 0.62;
      hemi.color.setRGB(0.55 + 0.3 * day, 0.62 + 0.25 * day, 0.85);
      hemi.groundColor.setRGB(0.28 + 0.12 * day, 0.25 + 0.1 * day, 0.22 + 0.1 * day);
      ambient.intensity = 0.20 + day * 0.20;

      var nightF = U.clamp((0.16 - elev) * 3.2, 0, 1);
      setNight(nightF);

      // sky & fog colours
      var topDay = new THREE.Color(0x2f6fb8), topNight = new THREE.Color(0x080e1c);
      var botDay = new THREE.Color(0xcfe4ee), botNight = new THREE.Color(0x1d2740);
      var topDusk = new THREE.Color(0x24406e), botDusk = new THREE.Color(0xf5a15c);
      var top = topDay.clone().lerp(topNight, nightF);
      var bot = botDay.clone().lerp(botNight, nightF);
      var duskAmt = U.clamp(1 - Math.abs(elev) * 4.5, 0, 1) * (1 - nightF * 0.4);
      top.lerp(topDusk, duskAmt * 0.65);
      bot.lerp(botDusk, duskAmt * 0.9);
      skyUniforms.topColor.value.copy(top);
      skyUniforms.botColor.value.copy(bot);
      skyUniforms.sunColor.value.setHSL(0.09, 0.8, 0.62).multiplyScalar(0.4 + day * 0.8);
      skyUniforms.sunDir.value.copy(_sunDir);
      scene.fog.color.copy(bot).lerp(top, 0.25);
      scene.fog.near = 200 + nightF * 80;
      scene.fog.far = 1500 - nightF * 280;

      // rain follows camera
      if (rain.visible) {
        var p = rainGeo.attributes.position;
        for (var i = 0; i < rainCount; i++) {
          p.array[i * 3 + 1] -= dt * 34;
          if (p.array[i * 3 + 1] < 0) p.array[i * 3 + 1] += 60;
        }
        p.needsUpdate = true;
        rain.position.x = cameraRef.x;
        rain.position.z = cameraRef.z;
      }
    }

    var cameraRef = { x: 0, z: 0 };
    function followCamera(cam) {
      cameraRef.x = cam.position.x;
      cameraRef.z = cam.position.z;
      // shadow camera follows player
      sunTarget.position.set(cam.position.x, 0, cam.position.z);
      sun.position.set(cam.position.x + _sunDir.x * 260, Math.max(20, _sunDir.y * 260), cam.position.z + _sunDir.z * 260);
    }

    return {
      root: root,
      colliders: colliders,
      labels: labels,
      sun: sun,
      sky: sky,
      skyUniforms: skyUniforms,
      water: water,
      rain: rain,
      setNight: setNight,
      update: update,
      followCamera: followCamera,
      setRain: function (on) { rain.visible = !!on; },
      get night() { return night; },
      buildingCount: buildingStats.count,
      stats: function () { return { buildings: buildingStats.count, colliders: colliders.list.length }; }
    };
  }

  return { build: build };
})();



