/* ============================================================
   agents.js — 行人（西門町/夜市人潮）與警察 AI
   ============================================================ */
window.TG = window.TG || {};

TG.Agents = (function () {
  'use strict';
  var U = TG.Utils, C = TG.CONFIG;

  var GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 10, 8)
  };
  var MATS = {};
  function mat(c) {
    if (!MATS[c]) MATS[c] = new THREE.MeshLambertMaterial({ color: c });
    return MATS[c];
  }
  var SHIRTS = [0xe8503a, 0x2f8fd8, 0x36a86a, 0xe8b93a, 0x8a52c9, 0xe86a9c, 0xeaeaea, 0x2c3e50, 0xff8a3d, 0x46c2c2];
  var PANTS = [0x2b3340, 0x3d4450, 0x5a4632, 0x22303a, 0x6b7280];
  var SKIN = [0xe8c39e, 0xd9a97e, 0xf0d3b0, 0xc08a5e];

  function makePed(rng) {
    var g = new THREE.Group();
    var shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
    var pants = PANTS[Math.floor(rng() * PANTS.length)];
    var skin = SKIN[Math.floor(rng() * SKIN.length)];
    var s = 0.92 + rng() * 0.2;

    var torso = new THREE.Mesh(GEO.box, mat(shirt));
    torso.scale.set(0.42, 0.62, 0.25);
    torso.position.y = 1.16;
    torso.castShadow = true;
    g.add(torso);
    var head = new THREE.Mesh(GEO.sphere, mat(skin));
    head.scale.setScalar(0.27);
    head.position.y = 1.63;
    head.castShadow = true;
    g.add(head);
    var hair = new THREE.Mesh(GEO.box, mat(0x2a2320));
    hair.scale.set(0.29, 0.12, 0.29);
    hair.position.y = 1.74;
    g.add(hair);

    function limb(x, y, len, w, color) {
      var pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      var m = new THREE.Mesh(GEO.box, mat(color));
      m.scale.set(w, len, w);
      m.position.y = -len / 2;
      m.castShadow = true;
      pivot.add(m);
      g.add(pivot);
      return pivot;
    }
    var legL = limb(-0.11, 0.86, 0.86, 0.17, pants);
    var legR = limb(0.11, 0.86, 0.86, 0.17, pants);
    var armL = limb(-0.28, 1.42, 0.62, 0.13, shirt);
    var armR = limb(0.28, 1.42, 0.62, 0.13, shirt);

    // accessories
    var acc = null;
    var r = rng();
    if (r < 0.18) { // umbrella
      var um = new THREE.Mesh(GEO.box, mat(0x2b6fd8));
      um.scale.set(0.12, 1.0, 0.12);
      um.position.set(0.3, 1.55, 0);
      g.add(um);
      var can = new THREE.Mesh(GEO.box, mat(0x3a8fd8));
      can.scale.set(1.0, 0.1, 1.0);
      can.position.set(0.3, 2.05, 0);
      g.add(can);
      acc = 'umbrella';
    } else if (r < 0.34) { // shopping bag
      var bag = new THREE.Mesh(GEO.box, mat(0xe8e6da));
      bag.scale.set(0.26, 0.32, 0.12);
      bag.position.set(-0.36, 0.95, 0);
      g.add(bag);
      acc = 'bag';
    } else if (r < 0.44) { // school uniform
      torso.material = mat(0xf2f4f6);
      var skirt = new THREE.Mesh(GEO.box, mat(0x22304a));
      skirt.scale.set(0.44, 0.26, 0.28);
      skirt.position.y = 0.9;
      g.add(skirt);
      acc = 'student';
    } else if (r < 0.5) { // helmet (scooter courier on foot)
      var hel = new THREE.Mesh(GEO.sphere, mat(0x1f2933));
      hel.scale.setScalar(0.34);
      hel.position.y = 1.66;
      g.add(hel);
      acc = 'helmet';
    }
    g.scale.setScalar(s);
    return { group: g, legL: legL, legR: legR, armL: armL, armR: armR, acc: acc, shirt: shirt };
  }

  function Agents(scene, ctx) {
    this.scene = scene;
    this.ctx = ctx || {};
    this.peds = [];
    this.police = [];
    this.maxPeds = (ctx && ctx.maxPeds) || 40;
    this.wanted = 0;
    this._rng = U.mulberry32(5150);
    this._policeTimer = 0;
  }

  Agents.prototype._sidewalkSpot = function (px, pz) {
    var rng = this._rng;
    var g = C.roadGraph;
    var useEW = rng() < 0.5;
    var list = useEW ? g.ew : g.ns;
    var road = list[Math.floor(rng() * list.length)];
    var side = rng() < 0.5 ? 1 : -1;
    var off = road.w / 2 + 2.2;
    var along = Math.max(-330, Math.min(330, (useEW ? px : pz) + (rng() - 0.5) * 170));
    var p = { axis: useEW ? 'x' : 'z', road: road, dir: rng() < 0.5 ? 1 : -1, pos: along };
    if (useEW) { p.x = along; p.z = road.pos + side * off; }
    else { p.z = along; p.x = road.pos + side * off; }
    return p;
  };

  Agents.prototype.spawnPed = function (x, z) {
    if (this.peds.length >= this.maxPeds) return null;
    var road = TG.CONFIG.nearestRoad(x, z);
    var axis = road.road.axis;
    var spot = {
      axis: axis, road: road.road, dir: this._rng() < 0.5 ? 1 : -1,
      pos: axis === 'x' ? x : z, side: this._rng() < 0.5 ? 1 : -1
    };
    return this._addPed(spot);
  };

  Agents.prototype._addPed = function (spot) {
    var p = makePed(this._rng);
    this.scene.add(p.group);
    var off = spot.road.w / 2 + 2.2;
    var rec = {
      m: p, axis: spot.axis, road: spot.road, dir: spot.dir, pos: spot.pos,
      side: spot.side || 1, x: 0, z: 0, heading: 0, speed: 1.2 + this._rng() * 0.7,
      phase: this._rng() * 6.28, state: 'walk', fleeT: 0, t: 0
    };
    if (rec.axis === 'x') { rec.x = rec.pos; rec.z = rec.road.pos + rec.side * off; }
    else { rec.z = rec.pos; rec.x = rec.road.pos + rec.side * off; }
    rec.heading = rec.axis === 'x' ? (rec.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (rec.dir > 0 ? 0 : Math.PI);
    p.group.position.set(rec.x, 0, rec.z);
    p.group.rotation.y = rec.heading;
    this.peds.push(rec);
    return rec;
  };

  Agents.prototype.panicAt = function (x, z, radius) {
    var r2 = radius * radius;
    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < r2) {
        p.state = 'flee';
        p.fleeT = 2.5 + this._rng() * 2.5;
        p.fleeFrom = { x: x, z: z };
      }
    }
  };

  Agents.prototype.setWanted = function (n) {
    this.wanted = n;
    var want = Math.min(n, 4);
    var i;
    if (want === 0) {
      for (i = this.police.length - 1; i >= 0; i--) {
        this.scene.remove(this.police[i].veh.group);
      }
      this.police.length = 0;
      return;
    }
    while (this.police.length < want) this._spawnPolice();
    while (this.police.length > want) {
      var u = this.police.pop();
      this.scene.remove(u.veh.group);
    }
  };

  Agents.prototype._spawnPolice = function () {
    var rng = this._rng;
    var sel = this.ctx.playerRef ? this.ctx.playerRef() : { x: 0, z: 0 };
    var ang = rng() * Math.PI * 2;
    var dist = 90 + rng() * 90;
    var x = sel.x + Math.cos(ang) * dist, z = sel.z + Math.sin(ang) * dist;
    x = Math.max(-330, Math.min(330, x)); z = Math.max(-330, Math.min(330, z));
    var nr = TG.CONFIG.nearestRoad(x, z);
    var veh = TG.Vehicles.create('police');
    this.scene.add(veh.group);
    var axis = nr.road.axis;
    var u = {
      veh: veh, x: axis === 'x' ? x : nr.road.pos, z: axis === 'x' ? nr.road.pos : z,
      heading: 0, speed: 0, state: 'chase', brake: false, wheelSpin: 0, stuck: 0
    };
    u.x = axis === 'x' ? x : nr.road.pos;
    u.z = axis === 'x' ? nr.road.pos : z;
    veh.group.position.set(u.x, 0, u.z);
    this.police.push(u);
    return u;
  };

  Agents.prototype.policeCount = function () { return this.police.length; };

  Agents.prototype.getNearestPolice = function (x, z) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.police.length; i++) {
      var u = this.police[i];
      var d = Math.sqrt((u.x - x) * (u.x - x) + (u.z - z) * (u.z - z));
      if (d < bd) { bd = d; best = u; }
    }
    return best ? { dist: bd, unit: best } : null;
  };

  Agents.prototype.clearPolice = function () { this.setWanted(0); };

  Agents.prototype.update = function (dt, ctx2) {
    ctx2 = ctx2 || {};
    var px = ctx2.playerX || 0, pz = ctx2.playerZ || 0;
    var i, p;

    /* ---- pedestrians ---- */
    for (i = this.peds.length - 1; i >= 0; i--) {
      p = this.peds[i];
      var dxp = p.x - px, dzp = p.z - pz;
      if (dxp * dxp + dzp * dzp > 175 * 175) {
        this.scene.remove(p.m.group);
        this.peds.splice(i, 1);
        continue;
      }
    }
    var want = this.maxPeds;
    var guard = 0;
    while (this.peds.length < want && guard++ < 3) {
      var spot = this._sidewalkSpot(px, pz);
      this._addPed(spot);
    }

    for (i = 0; i < this.peds.length; i++) {
      p = this.peds[i];
      p.t += dt;
      var speed = p.speed;
      var fleeing = p.state === 'flee';
      if (fleeing) {
        p.fleeT -= dt;
        speed = 4.2;
        if (p.fleeT <= 0) p.state = 'walk';
      } else {
        // panic if a fast vehicle is near
        var pv = ctx2.playerVehicle;
        if (pv) {
          var dvx = pv.x - p.x, dvz = pv.z - p.z;
          if (dvx * dvx + dvz * dvz < 100 && Math.abs(pv.speed || 0) > 9) {
            p.state = 'flee'; p.fleeT = 2.2;
            p.fleeFrom = { x: pv.x, z: pv.z };
            fleeing = true; speed = 4.2;
          }
        }
      }
      if (fleeing && p.fleeFrom) {
        // run away from threat along the sidewalk axis
        var away = (p.axis === 'x') ? (p.x - p.fleeFrom.x) : (p.z - p.fleeFrom.z);
        p.dir = away >= 0 ? 1 : -1;
      }
      p.pos += speed * dt * p.dir;
      if (p.pos > 340 || p.pos < -340) { p.dir *= -1; }
      if (p.axis === 'x') { p.x = p.pos; }
      else { p.z = p.pos; }

      var targetHead = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      p.heading = U.angleLerp(p.heading, targetHead, Math.min(1, dt * 6));
      p.m.group.position.set(p.x, 0, p.z);
      p.m.group.rotation.y = p.heading;

      // walk cycle
      var w = p.t * speed * 3.4 + p.phase;
      var amp = fleeing ? 0.9 : 0.55;
      p.m.legL.rotation.x = Math.sin(w) * amp;
      p.m.legR.rotation.x = -Math.sin(w) * amp;
      if (fleeing) {
        p.m.armL.rotation.x = -2.2; p.m.armR.rotation.x = -2.2;
        p.m.armL.rotation.z = 0.4; p.m.armR.rotation.z = -0.4;
      } else {
        p.m.armL.rotation.x = -Math.sin(w) * amp * 0.8;
        p.m.armR.rotation.x = Math.sin(w) * amp * 0.8;
        p.m.armL.rotation.z = 0; p.m.armR.rotation.z = 0;
      }
    }

    /* ---- police ---- */
    var sel2 = this.ctx.playerRef ? this.ctx.playerRef() : { x: px, z: pz };
    px = sel2.x; pz = sel2.z;
    for (i = 0; i < this.police.length; i++) {
      var u = this.police[i];
      var dx = px - u.x, dz = pz - u.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var desired = Math.atan2(dx, dz);          // heading where forward = +Z
      u.heading = U.angleLerp(u.heading, desired, Math.min(1, dt * 2.6));
      var maxSpeed = 16 + this.wanted * 2.2;
      var want2 = dist > 16 ? maxSpeed : dist > 10 ? 6 : 0;
      if (u.state === 'arrest') want2 = 0;
      if (!ctx2.onFoot && dist < 30) want2 = Math.min(want2, 8);
      u.speed += (want2 - u.speed) * Math.min(1, dt * 1.8);
      var mv = u.speed * dt;
      u.x += Math.sin(u.heading) * mv;
      u.z += Math.cos(u.heading) * mv;

      // building avoidance
      if (this.ctx.collisionResolve) {
        var res = this.ctx.collisionResolve(u.x, u.z, 2.4);
        if (res.hit) {
          u.x = res.x; u.z = res.z;
          u.heading += dt * 1.6;   // slide along the wall
        }
      }
      u.x = Math.max(-350, Math.min(350, u.x));
      u.z = Math.max(-350, Math.min(350, u.z));
      u.veh.group.position.set(u.x, 0, u.z);
      u.veh.group.rotation.y = u.heading;
      u.wheelSpin += mv / 0.35;
      for (var wi = 0; wi < u.veh.wheels.length; wi++) u.veh.wheels[wi].mesh.rotation.x = u.wheelSpin;
      u.veh.setNight(ctx2.night || 0);
      u.veh.setBrake(dist < 12);
      if (u.veh.setSiren) u.veh.setSiren(true, U.clamp(1 - dist / 140, 0.15, 1));
      if (dist < 9 && ctx2.onFoot) u.state = 'arrest'; else if (dist > 14) u.state = 'chase';
    }
  };

  return Agents;
})();