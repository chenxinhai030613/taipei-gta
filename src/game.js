/* ============================================================
   game.js — 主程式：玩家控制、駕駛物理、任務、通緝、循環
   ============================================================ */
window.TG = window.TG || {};

TG.Game = (function () {
  'use strict';
  var U = TG.Utils, C = TG.CONFIG;

  var renderer, scene, camera, clock;
  var city, landmarks, traffic, agents;
  var player, parkedVehs = [], missions = [], missionBeams = [];
  var keys = {}, state = {}, running = false, paused = false, started = false;
  var camYaw = 0, camPitch = -0.18, camDist = 7, camTarget = new THREE.Vector3();
  var mouseLocked = false;
  var rng = U.mulberry32(31337);
  var rainOn = false, rainTimer = 90;
  var audio = TG.Audio, hud = TG.HUD;
  var hudEls = {};
  var lastCrime = 0, wantedDecayT = 0, arrestT = 0, healCooldown = 0, freeCamPose = null;

  /* ---------------- player ---------------- */
  function buildPlayer() {
    var g = new THREE.Group();
    var geo = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(0.5, 10, 8) };
    function m(color) { return new THREE.MeshLambertMaterial({ color: color }); }
    var jacket = 0xffc419, pants = 0x24303c, skin = 0xe8c39e;
    var torso = new THREE.Mesh(geo.box, m(jacket)); torso.scale.set(0.46, 0.66, 0.28); torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
    var head = new THREE.Mesh(geo.sphere, m(skin)); head.scale.setScalar(0.28); head.position.y = 1.66; head.castShadow = true; g.add(head);
    var hair = new THREE.Mesh(geo.box, m(0x1f1a17)); hair.scale.set(0.3, 0.14, 0.3); hair.position.y = 1.79; g.add(hair);
    var cap = new THREE.Mesh(geo.box, m(0x111820)); cap.scale.set(0.34, 0.1, 0.36); cap.position.set(0, 1.82, 0.05); g.add(cap);
    function limb(x, y, len, w, color) {
      var pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      var mm = new THREE.Mesh(geo.box, m(color)); mm.scale.set(w, len, w); mm.position.y = -len / 2; mm.castShadow = true;
      pivot.add(mm); g.add(pivot); return pivot;
    }
    var legL = limb(-0.12, 0.88, 0.88, 0.18, pants);
    var legR = limb(0.12, 0.88, 0.88, 0.18, pants);
    var armL = limb(-0.3, 1.44, 0.64, 0.14, jacket);
    var armR = limb(0.3, 1.44, 0.64, 0.14, jacket);
    return { group: g, legL: legL, legR: legR, armL: armL, armR: armR };
  }

  /* ---------------- missions ---------------- */
  var MISSION_DEFS = [
    {
      id: 'boba', title: '珍珠奶茶外送', start: C.landmarks.ximen, time: 200, reward: 1500,
      desc: '西門町接到三筆訂單',
      steps: [
        { x: C.landmarks.station.x, z: -16, label: '送珍珠奶茶到台北車站' },
        { x: C.landmarks.park.x, z: C.landmarks.park.z, label: '送到大安森林公園' },
        { x: 240, z: 280, label: '最後送到信義區辦公大樓' }
      ]
    },
    {
      id: 'nightmarket', title: '夜市大胃王', start: { x: 0, z: -236 }, time: 170, reward: 1200,
      desc: '把士林夜市的招牌小吃送出去',
      steps: [
        { x: C.landmarks.longshan.x, z: 178, label: '先送藥燉排骨到龍山寺' },
        { x: C.landmarks.ximen.x, z: C.landmarks.ximen.z, label: '再送大雞排回西門町' }
      ]
    },
    {
      id: 'train', title: '趕高鐵', start: C.landmarks.station, time: 80, reward: 2000,
      desc: '乘客趕時間，衝到台北101',
      steps: [{ x: C.landmarks.taipei101.x, z: 238, label: '在時間內抵達台北101' }]
    },
    {
      id: 'temple', title: '廟會遶境', start: C.landmarks.longshan, time: 180, reward: 1800,
      desc: '護送香火遶境',
      steps: [
        { x: 40, z: 190, label: '遶境到自由廣場牌樓' },
        { x: C.landmarks.presidential.x, z: 96, label: '最後到總統府前' }
      ]
    },
    {
      id: 'delivery', title: '夜間快遞', start: { x: 280, z: -172 }, time: 210, reward: 2200,
      desc: '美麗華到信義區的急件',
      steps: [
        { x: C.landmarks.taipei101.x, z: 238, label: '送到台北101' },
        { x: C.landmarks.nightmarket.x, z: -236, label: '回士林夜市收尾' }
      ]
    },
    {
      id: 'survive', title: '甩掉警察', start: C.landmarks.presidential, time: 70, reward: 3000,
      desc: '讓通緝升到 3 星並撐過 60 秒',
      steps: [], survive: true
    }
  ];

  var beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
  });

  function makeBeam(x, z, color) {
    var g = new THREE.Group();
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 42, 12, 1, true), beamMat.clone());
    beam.position.y = 21;
    g.add(beam);
    var ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.4, 24), ringMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    if (color) { g.children.forEach(function (c) { c.material.color.setHex(color); }); }
    g.position.set(x, 0, z);
    g.visible = false;
    scene.add(g);
    return g;
  }

  function initMissions() {
    missions = MISSION_DEFS.map(function (d) {
      return { def: d, status: 'available', step: 0, timer: 0, surviveT: 0 };
    });
    missions.forEach(function (m) {
      m.beam = makeBeam(m.def.start.x, m.def.start.z, 0xffd23f);
      m.objBeam = makeBeam(0, 0, 0x35e0ff);
    });
  }

  function startMission(m) {
    m.status = 'active';
    m.step = 0;
    m.timer = m.def.time;
    m.surviveT = 0;
    m.beam.visible = false;
    hud.bigText(m.def.title, m.def.desc);
    audio.sfx('success');
    if (m.def.survive) {
      addWanted(3);
      hud.toast('通緝升到 3 星，撐過 60 秒！', 'bad');
    } else {
      var s = m.def.steps[0];
      m.objBeam.position.set(s.x, 0, s.z);
      m.objBeam.visible = true;
      hud.toast('任務開始：' + s.label, 'good');
    }
  }

  function completeMission(m) {
    m.status = 'done';
    m.beam.visible = false;
    m.objBeam.visible = false;
    player.money += m.def.reward;
    hud.bigText('任務完成', '+ NT$' + m.def.reward.toLocaleString('en-US'));
    hud.toast('任務完成：' + m.def.title + ' +NT$' + m.def.reward, 'good');
    audio.sfx('success');
    addWanted(0);
    state.wanted = Math.max(0, state.wanted - 1);
    agents.setWanted(state.wanted);
  }

  function failMission(m, why) {
    m.status = 'available';
    m.beam.visible = true;
    m.objBeam.visible = false;
    hud.toast(why || ('任務失敗：' + m.def.title), 'bad');
    audio.sfx('fail');
  }

  function updateMissions(dt) {
    for (var i = 0; i < missions.length; i++) {
      var m = missions[i];
      if (m.status === 'available') {
        m.beam.visible = true;
        var d = Math.hypot(player.x - m.def.start.x, player.z - m.def.start.z);
        if (d < 6) startMission(m);
      } else if (m.status === 'active') {
        m.timer -= dt;
        if (m.def.survive) {
          m.surviveT += dt;
          if (m.timer <= 0) { completeMission(m); continue; }
          if (state.wanted < 1) failMission(m, '警察放棄追捕了，任務失敗');
          continue;
        }
        var s = m.def.steps[m.step];
        var dd = Math.hypot(player.x - s.x, player.z - s.z);
        if (dd < 8) {
          audio.sfx('cash');
          m.step++;
          if (m.step >= m.def.steps.length) { completeMission(m); continue; }
          var ns = m.def.steps[m.step];
          m.objBeam.position.set(ns.x, 0, ns.z);
          hud.toast('下一站：' + ns.label, 'good');
        }
        if (m.timer <= 0) failMission(m, '時間到！任務失敗');
      }
    }
    // beam animation
    var t = performance.now() / 1000;
    missions.forEach(function (m) {
      [m.beam, m.objBeam].forEach(function (b) {
        if (!b.visible) return;
        b.children[0].material.opacity = 0.30 + Math.sin(t * 2.4) * 0.12;
        b.children[1].scale.setScalar(1 + Math.sin(t * 2.4) * 0.06);
        b.rotation.y += dt * 0.6;
      });
    });
  }

  /* ---------------- wanted ---------------- */
  function addWanted(n) {
    if (!n) return;
    var before = state.wanted;
    state.wanted = Math.min(C.game.maxWanted, state.wanted + n);
    if (state.wanted !== before) {
      agents.setWanted(state.wanted);
      hud.toast('通緝等級 ' + state.wanted + ' 星', 'bad');
      audio.sfx('star');
      lastCrime = performance.now() / 1000;
    }
  }

  function updateWanted(dt) {
    if (state.wanted <= 0) return;
    var now = performance.now() / 1000;
    var near = agents.getNearestPolice(player.x, player.z);
    var seen = near && near.dist < 70;
    if (!seen && now - lastCrime > 18) {
      wantedDecayT += dt;
      if (wantedDecayT > 12) {
        wantedDecayT = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        agents.setWanted(state.wanted);
        hud.toast(state.wanted > 0 ? '通緝降到 ' + state.wanted + ' 星' : '你甩掉警察了', 'good');
      }
    } else wantedDecayT = 0;
  }

  /* ---------------- vehicles ---------------- */
  function spawnParked() {
    var spots = [
      { t: 'scooter', x: -166, z: -34, h: 0.2 }, { t: 'scooter', x: -160, z: -28, h: 0.4 },
      { t: 'scooter', x: -40, z: -20, h: 1.6 }, { t: 'sedan', x: 6, z: 30, h: 0 },
      { t: 'taxi', x: -70, z: 26, h: 3.14 }, { t: 'scooter', x: 30, z: 120, h: 1.2 },
      { t: 'suv', x: 250, z: 200, h: 0 }, { t: 'scooter', x: -280, z: 180, h: 0.8 },
      { t: 'sedan', x: 170, z: 150, h: 1.57 }, { t: 'scooter', x: 0, z: -250, h: 0.1 },
      { t: 'taxi', x: 260, z: -190, h: 2.2 }, { t: 'scooter', x: -172, z: -60, h: 0.6 },
      { t: 'scooter', x: 90, z: -70, h: 2.6 }, { t: 'police', x: -120, z: 60, h: 0.3 }
    ];
    spots.forEach(function (s) {
      var v = TG.Vehicles.create(s.t, s.t === 'scooter' ? { color: 0x2f8fd8 } : {});
      v.group.position.set(s.x, 0, s.z);
      v.group.rotation.y = s.h;
      v.setNight(0);
      scene.add(v.group);
      parkedVehs.push({ veh: v, x: s.x, z: s.z, heading: s.h });
    });
  }

  function nearestVehicle(x, z, maxD) {
    var best = null, bd = maxD * maxD;
    parkedVehs.forEach(function (p) {
      var d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bd) { bd = d; best = p; }
    });
    if (best) return { kind: 'parked', ref: best, veh: best.veh, x: best.x, z: best.z, heading: best.heading };
    // traffic cars (carjack)
    var cars = traffic.getNear(x, z, maxD);
    if (cars.length) {
      var c = cars[0];
      return { kind: 'traffic', ref: c, veh: c.veh, x: c.x, z: c.z, heading: c.heading };
    }
    return null;
  }

  function enterVehicle(target) {
    if (target.kind === 'traffic') {
      var idx = traffic.cars.indexOf(target.ref);
      if (idx >= 0) traffic.cars.splice(idx, 1);
      addWanted(1);
      hud.toast('你搶走了一台' + target.veh.name + '！', 'bad');
    }
    player.veh = {
      veh: target.veh, kind: target.kind, ref: target.ref,
      speed: 0, heading: target.heading, steer: 0, wheelSpin: 0, type: target.veh.type,
      hp: 100
    };
    player.onFoot = false;
    player.model.group.visible = false;
    camDist = target.veh.type === 'scooter' ? 6.2 : target.veh.type === 'bus' || target.veh.type === 'truck' ? 12 : 8.4;
    audio.sfx('enterCar');
    audio.setRadio(Math.max(0, audio.getStation()));
    hud.toast('上車：' + target.veh.name + '　R 切換電台', 'good');
    player.veh.veh.setNight(city.night);
  }

  function exitVehicle() {
    var v = player.veh;
    if (!v) return;
    var sideX = Math.cos(v.heading) * 1.8, sideZ = -Math.sin(v.heading) * 1.8;
    var px = v.veh.group.position.x + sideX, pz = v.veh.group.position.z + sideZ;
    var res = city.colliders.resolve(px, pz, 0.5);
    player.x = res.x; player.z = res.z;
    player.heading = v.heading;
    player.onFoot = true;
    player.model.group.visible = true;
    parkedVehs.push({ veh: v.veh, x: v.veh.group.position.x, z: v.veh.group.position.z, heading: v.heading });
    player.veh = null;
    camDist = 7;
    audio.setEngine(false);
    audio.setRadio(-1);
    audio.sfx('exitCar');
    hud.toast('下車', 'info');
  }

  /* ---------------- input ---------------- */
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      if (!started) { beginPlay(); return; }
      if (e.code === 'Escape') { paused = !paused; hud.setPaused(paused); if (paused) document.exitPointerLock && document.exitPointerLock(); }
      if (e.code === 'KeyE') { if (player.veh) exitVehicle(); else { var t = nearestVehicle(player.x, player.z, 4.2); if (t) enterVehicle(t); else hud.toast('附近沒有車輛', 'info'); } }
      if (e.code === 'KeyR') { var i = audio.nextRadio(); var st = C.radio[i]; hud.setRadioBanner(st.name, st.genre); }
      if (e.code === 'KeyH') { audio.sfx('horn'); agents.panicAt(player.x, player.z, 12); }
      if (e.code === 'KeyF') { attack(); }
      if (e.code === 'KeyM') { audio.setMuted(!audio.muted); hud.toast(audio.muted ? '靜音' : '開啟音效', 'info'); }
      if (e.code === 'Space' && player.onFoot) player.jump = 1;
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    renderer.domElement.addEventListener('click', function () {
      if (!started) { beginPlay(); return; }
      if (!paused && !mouseLocked) renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', function () {
      mouseLocked = document.pointerLockElement === renderer.domElement;
    });
    document.addEventListener('mousemove', function (e) {
      if (!mouseLocked) return;
      camYaw -= e.movementX * 0.0026;
      camPitch = U.clamp(camPitch - e.movementY * 0.0022, -0.9, 0.5);
    });
    window.addEventListener('resize', function () {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  }

  function attack() {
    if (!player.onFoot) { audio.sfx('horn'); return; }
    player.punchT = 0.35;
    audio.sfx('punch');
    var hit = false;
    agents.peds.forEach(function (p) {
      if (Math.hypot(p.x - player.x, p.z - player.z) < 2.6) { hit = true; }
    });
    var np = agents.getNearestPolice(player.x, player.z);
    if (np && np.dist < 6) hit = true;
    if (hit) { addWanted(1); agents.panicAt(player.x, player.z, 16); }
    else agents.panicAt(player.x, player.z, 8);
  }

  /* ---------------- player update ---------------- */
  function updateOnFoot(dt) {
    var fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    var right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    var move = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp) move.add(fwd);
    if (keys.KeyS || keys.ArrowDown) move.sub(fwd);
    if (keys.KeyD || keys.ArrowRight) move.add(right);
    if (keys.KeyA || keys.ArrowLeft) move.sub(right);
    var sprint = keys.ShiftLeft || keys.ShiftRight;
    var speed = sprint ? C.game.playerRun : C.game.playerWalk;
    if (move.lengthSq() > 0) {
      move.normalize();
      player.x += move.x * speed * dt;
      player.z += move.z * speed * dt;
      player.heading = U.angleLerp(player.heading, Math.atan2(move.x, move.z), Math.min(1, dt * 12));
      player.walkPhase = (player.walkPhase || 0) + dt * speed * 2.2;
    } else {
      player.walkPhase = (player.walkPhase || 0) + dt * 1.2;
    }
    // jump / gravity
    player.vy = (player.vy || 0) - C.game.gravity * dt;
    player.y = Math.max(0, (player.y || 0) + player.vy * dt);
    if (player.jump && player.y <= 0.001) { player.vy = 6.2; player.jump = 0; }

    // collision with buildings
    var res = city.colliders.resolve(player.x, player.z, 0.5);
    player.x = U.clamp(res.x, -370, 370); player.z = U.clamp(res.z, -370, 370);

    // model
    var amp = sprint ? 0.85 : 0.5;
    var w = player.walkPhase;
    player.model.legL.rotation.x = Math.sin(w) * amp;
    player.model.legR.rotation.x = -Math.sin(w) * amp;
    player.model.armL.rotation.x = -Math.sin(w) * amp * 0.8;
    player.model.armR.rotation.x = Math.sin(w) * amp * 0.8;
    if (player.punchT > 0) {
      player.punchT -= dt;
      player.model.armR.rotation.x = -1.6 + (0.35 - player.punchT) * 3;
    }
    player.model.group.position.set(player.x, player.y || 0, player.z);
    player.model.group.rotation.y = player.heading;
    // traffic damage
    var cars = traffic.getNear(player.x, player.z, 3.2);
    if (cars.length) {
      var c = cars[0];
      if (c.speed > 5) { damagePlayer(12 * dt * (c.speed / 10) * 6); }
    }
  }

  function updateDriving(dt) {
    var v = player.veh;
    var scooter = v.type === 'scooter';
    var maxSpeed = scooter ? C.game.scooterTopSpeed : v.type === 'bus' || v.type === 'truck' ? 26 : C.game.carTopSpeed;
    if (v.type === 'police') maxSpeed = 44;
    var accel = scooter ? 13 : v.type === 'bus' ? 6 : 10;
    var throttle = 0, brake = 0, steer = 0;
    if (keys.KeyW || keys.ArrowUp) throttle = 1;
    if (keys.KeyS || keys.ArrowDown) brake = 1;
    if (keys.KeyA || keys.ArrowLeft) steer += 1;
    if (keys.KeyD || keys.ArrowRight) steer -= 1;
    if (keys.ShiftLeft) throttle = Math.min(1.2, throttle + 0.4);
    var handbrake = !!keys.Space;

    v.speed += (throttle * accel - brake * accel * 1.5) * dt;
    if (handbrake) v.speed -= v.speed * Math.min(1, dt * 3.4);
    v.speed -= v.speed * dt * (throttle ? 0.12 : 0.55);      // drag
    v.speed = U.clamp(v.speed, -maxSpeed * 0.35, maxSpeed);
    if (Math.abs(v.speed) < 0.05) v.speed = 0;

    var speedFactor = U.clamp(Math.abs(v.speed) / 9, 0, 1);
    var turnRate = (scooter ? 2.6 : v.type === 'bus' || v.type === 'truck' ? 1.1 : 1.9) *
      (1 - Math.min(0.55, Math.abs(v.speed) / maxSpeed * 0.55));
    v.heading += steer * turnRate * speedFactor * dt * (v.speed < 0 ? -1 : 1);
    v.steer = U.damp(v.steer || 0, steer, 8, dt);

    var nx = v.veh.group.position.x + Math.sin(v.heading) * v.speed * dt;
    var nz = v.veh.group.position.z + Math.cos(v.heading) * v.speed * dt;
    var radius = Math.max(1.0, v.veh.dims.w * 0.55);
    var res = city.colliders.resolve(nx, nz, radius);
    if (res.hit) {
      var impact = Math.abs(v.speed);
      nx = res.x; nz = res.z;
      v.speed *= -0.18;
      if (impact > 8) { damagePlayer(impact * 0.5); audio.sfx('crash'); }
    }
    // world bounds
    nx = U.clamp(nx, -368, 368); nz = U.clamp(nz, -368, 368);

    // traffic car collisions
    var near = traffic.getNear(nx, nz, 3.0 + v.veh.dims.l * 0.35);
    if (near.length) {
      var other = near[0];
      var d = Math.hypot(other.x - nx, other.z - nz);
      if (d < 3.4) {
        v.speed *= 0.45;
        other.speed *= 0.2;
        audio.sfx('crash');
        if (Math.abs(v.speed) > 6) damagePlayer(6);
        agents.panicAt(nx, nz, 18);
      }
    }
    // pedestrians
    agents.peds.forEach(function (p) {
      if (Math.hypot(p.x - nx, p.z - nz) < 1.6 && Math.abs(v.speed) > 6) {
        agents.panicAt(p.x, p.z, 20);
        addWanted(1);
        damagePlayer(4);
        audio.sfx('punch');
      }
    });
    // police contact
    var np = agents.getNearestPolice(nx, nz);
    if (np && np.dist < 3.4) {
      v.speed *= 0.3;
      damagePlayer(8 * dt * 10);
    }

    v.veh.group.position.set(nx, 0, nz);
    v.veh.group.rotation.y = v.heading;
    if (scooter) {
      v.veh.group.rotation.z = U.damp(v.veh.group.rotation.z || 0, -v.steer * 0.35 * speedFactor, 6, dt);
      player.model.group.visible = true;
      player.model.group.position.set(nx - Math.sin(v.heading) * 0.12, 0.2, nz - Math.cos(v.heading) * 0.12);
      player.model.group.rotation.y = v.heading;
      player.model.group.rotation.z = (v.veh.group.rotation.z || 0) * 1.4;
      player.model.legL.rotation.x = -1.25; player.model.legR.rotation.x = -1.25;
      player.model.armL.rotation.x = -0.7; player.model.armR.rotation.x = -0.7;
      player.model.armL.rotation.z = 0.2; player.model.armR.rotation.z = -0.2;
    } else {
      player.model.group.visible = false;
    }
    v.wheelSpin += v.speed * dt / 0.34;
    for (var i = 0; i < v.veh.wheels.length; i++) {
      var wh = v.veh.wheels[i];
      wh.mesh.rotation.x = v.wheelSpin;
      if (wh.steer) wh.mesh.rotation.y = v.steer * 0.45;
    }
    v.veh.setNight(city.night);
    v.veh.setBrake(!!brake || handbrake);

    player.x = nx; player.z = nz;
    player.heading = v.heading;
    audio.setEngine(true, Math.min(1, Math.abs(v.speed) / maxSpeed), throttle, scooter ? 'scooter' : 'car');

    // speed camera shake
    state.speedKmh = Math.abs(v.speed) * 3.6;
  }

  function damagePlayer(amount) {
    if (amount <= 0) return;
    if (player.armor > 0) {
      var a = Math.min(player.armor, amount * 0.6);
      player.armor -= a; amount -= a;
    }
    player.health -= amount;
    hud.showDamage();
    if (player.health <= 0) respawn(true);
  }

  function respawn(busted) {
    var lost = Math.floor(player.money * (busted ? 0.1 : 0.15));
    player.money = Math.max(0, player.money - lost);
    player.health = 100; player.armor = Math.max(0, player.armor);
    state.wanted = 0; agents.setWanted(0);
    if (player.veh) {
      parkedVehs.push({ veh: player.veh.veh, x: player.veh.veh.group.position.x, z: player.veh.veh.group.position.z, heading: player.veh.heading });
      player.veh = null;
    }
    player.onFoot = true;
    player.model.group.visible = true;
    player.x = C.landmarks.station.x; player.z = C.landmarks.station.z + 22;
    audio.setEngine(false);
    hud.bigText(busted ? '被逮捕了' : '送醫急救', '- NT$' + lost.toLocaleString('en-US'));
    hud.toast(busted ? '警察把你帶回局裡' : '你在醫院醒來', 'bad');
    audio.sfx('fail');
  }

  /* ---------------- camera ---------------- */
  function updateCamera(dt) {
    if (freeCamPose) {
      camera.position.set(freeCamPose.p[0], freeCamPose.p[1], freeCamPose.p[2]);
      camera.lookAt(freeCamPose.t[0], freeCamPose.t[1], freeCamPose.t[2]);
      return;
    }
    var targetY, dist = camDist, height;
    if (player.veh) {
      var sp = Math.abs(player.veh.speed);
      dist = camDist + sp * 0.06;
      height = player.veh.type === 'bus' || player.veh.type === 'truck' ? 6 : 3.4;
      targetY = 1.4;
    } else {
      dist = camDist; height = 2.6; targetY = 1.5;
    }
    var lookAhead = player.veh ? Math.abs(player.veh.speed) * 0.12 : 0;
    var px = player.x - Math.sin(camYaw) * dist * Math.cos(camPitch);
    var pz = player.z - Math.cos(camYaw) * dist * Math.cos(camPitch);
    var py = (player.y || 0) + height + dist * Math.sin(camPitch) * -1;
    py = Math.max(1.2, py);
    camera.position.lerp(new THREE.Vector3(px, py, pz), Math.min(1, dt * 9));
    camTarget.lerp(new THREE.Vector3(
      player.x + Math.sin(camYaw) * lookAhead,
      (player.y || 0) + targetY,
      player.z + Math.cos(camYaw) * lookAhead), Math.min(1, dt * 9));
    camera.lookAt(camTarget);
    camera.fov = U.damp(camera.fov, player.veh ? 62 + Math.abs(player.veh.speed) * 0.35 : 60, 3, dt);
    camera.updateProjectionMatrix();
  }

  /* ---------------- HUD state ---------------- */
  function buildHudState() {
    var t = state.tod;
    var hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
    var blips = [];
    missions.forEach(function (m) {
      if (m.status === 'available') blips.push({ x: m.def.start.x, z: m.def.start.z, color: '#ffd23f', shape: 'star' });
      else if (m.status === 'active' && !m.def.survive && m.def.steps[m.step]) {
        blips.push({ x: m.def.steps[m.step].x, z: m.def.steps[m.step].z, color: '#35e0ff', shape: 'star' });
      }
    });
    agents.police.forEach(function (u) { blips.push({ x: u.x, z: u.z, color: '#ff4d4d' }); });
    var mission = null;
    for (var i = 0; i < missions.length; i++) {
      if (missions[i].status === 'active') {
        var m = missions[i];
        mission = {
          title: m.def.title,
          objective: m.def.survive ? ('撐過 ' + Math.max(0, Math.ceil(m.timer)) + ' 秒（通緝 ' + state.wanted + ' 星）') : m.def.steps[m.step].label,
          timerSec: Math.ceil(m.timer), totalSec: m.def.time,
          progress01: m.def.survive ? 1 - m.timer / m.def.time : (m.step / Math.max(1, m.def.steps.length))
        };
        break;
      }
    }
    var st = C.radio[audio.getStation()];
    return {
      health: player.health, armor: player.armor, money: player.money, wanted: state.wanted,
      speedKmh: state.speedKmh || 0, inVehicle: !player.onFoot,
      vehicleName: player.veh ? player.veh.veh.name : '', onFoot: player.onFoot,
      clock: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
      district: C.districtAt(player.x, player.z),
      radio: st ? { name: st.name, genre: st.genre } : null,
      mission: mission, player: { x: player.x, z: player.z, heading: player.heading },
      blips: blips, night: city.night
    };
  }

  /* ---------------- misc world flavour ---------------- */
  function updateAmbient(dt) {
    rainTimer -= dt;
    if (rainTimer <= 0) {
      rainOn = !rainOn;
      rainTimer = rainOn ? 60 + rng() * 60 : 120 + rng() * 120;
      city.setRain(rainOn);
      audio.setRain(rainOn, 0.7);
      hud.toast(rainOn ? '下起午後雷陣雨了' : '雨停了', 'info');
    }
    if (rainOn) city.setRain(true);
    // heal spots
    healCooldown -= dt;
    if (healCooldown <= 0) {
      var heal = [C.landmarks.longshan, C.landmarks.nightmarket, C.landmarks.station];
      for (var i = 0; i < heal.length; i++) {
        if (Math.hypot(player.x - heal[i].x, player.z - heal[i].z) < 14 && player.health < 100) {
          player.health = Math.min(100, player.health + 35);
          healCooldown = 12;
          audio.sfx('heal');
          hud.toast('補充體力 +35', 'good');
          break;
        }
      }
    }
  }

  /* ---------------- loop ---------------- */
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    if (paused) { renderer.render(scene, camera); return; }
    var elapsed = clock.elapsedTime;
    try {
      step(dt, elapsed);
    } catch (err) {
      if (!window.__FRAME_ERR) { window.__FRAME_ERR = err.stack || String(err); console.error('[TG] frame error', err); }
    }
  }

  function step(dt, elapsed) {

    state.tod = (state.tod + dt * (24 / C.game.dayLength)) % 24;
    city.update(dt, state.tod);
    landmarks.setNight(city.night);
    landmarks.update(dt, elapsed);

    if (player.onFoot) updateOnFoot(dt); else updateDriving(dt);
    traffic.update(dt, { playerX: player.x, playerZ: player.z, playerVehicle: player.veh ? { x: player.x, z: player.z, speed: player.veh.speed, heading: player.veh.heading } : null, night: city.night, wanted: state.wanted });
    agents.update(dt, {
      playerX: player.x, playerZ: player.z, onFoot: player.onFoot, wanted: state.wanted, night: city.night,
      playerVehicle: player.veh ? { x: player.x, z: player.z, speed: player.veh.speed } : null
    });
    updateMissions(dt);
    updateWanted(dt);
    updateAmbient(dt);
    updateCamera(dt);
    city.followCamera(camera);
    audio.tick(dt);
    updateSirenAudio();

    // arrest check
    var np = agents.getNearestPolice(player.x, player.z);
    if (np && np.dist < 5 && player.onFoot && state.wanted > 0) {
      arrestT += dt;
      if (arrestT > 1.4) { arrestT = 0; respawn(true); }
    } else arrestT = 0;

    hud.update(buildHudState());
    renderer.render(scene, camera);
    state.fps = Math.round(1 / Math.max(dt, 0.0001));
  }

  function updateSirenAudio() {
    var np = agents.getNearestPolice(player.x, player.z);
    if (np && state.wanted > 0) audio.setSiren(true, U.clamp(1 - np.dist / 110, 0.1, 1));
    else audio.setSiren(false);
  }

  /* ---------------- boot ---------------- */
  function beginPlay() {
    if (started) return;
    started = true;
    audio.resume();
    var boot = document.getElementById('boot');
    if (boot) { boot.classList.add('hide'); setTimeout(function () { boot.style.display = 'none'; }, 700); }
    hud.bigText('GTA: TAIPEI', '台北風雲 · 自由探索');
    hud.toast('騎上機車，開始你的台北之旅', 'good');
    if (renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
  }

  function start() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('app').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 6000);
    clock = new THREE.Clock();

    var bar = document.getElementById('bootbar');
    if (bar) bar.style.width = '35%';

    city = TG.City.build(scene, { seed: 8821 });
    landmarks = TG.Landmarks;
    var lm = landmarks.buildAll(scene);
    lm.colliders.forEach(function (c) { city.colliders.list.push(c); });
    city.update(0, C.game.startTime);

    if (bar) bar.style.width = '65%';

    traffic = new TG.Traffic(scene, { count: 24 });
    agents = new TG.Agents(scene, {
      collisionResolve: function (x, z, r) { return city.colliders.resolve(x, z, r); },
      playerRef: function () { return { x: player.x, z: player.z }; },
      maxPeds: 40
    });
    spawnParked();
    initMissions();

    player = {
      x: C.landmarks.ximen.x + 34, z: C.landmarks.ximen.z + 6, y: 0, heading: 0,
      onFoot: true, veh: null, health: C.game.playerHealth, armor: 0, money: C.game.startMoney,
      model: buildPlayer(), walkPhase: 0, vy: 0, punchT: 0
    };
    scene.add(player.model.group);
    player.model.group.position.set(player.x, 0, player.z);
    hud.init({ onResume: function () { paused = false; hud.setPaused(false); } });
    state = { tod: C.game.startTime, wanted: 0, speedKmh: 0, fps: 0 };
    bindInput();

    if (bar) bar.style.width = '100%';
    var tip = document.getElementById('boottip');
    if (tip) tip.textContent = '點擊畫面或按任意鍵開始（WASD 移動、E 上車）';

    hud.setRadioBanner(C.radio[0].name, C.radio[0].genre);
    running = true;
    frame();
  }

  return {
    start: start,
    get state() { return state; },
    get player() { return player; },
    /* QA / debug helpers (also handy from the browser console) */
    debug: {
      addWanted: addWanted,
      teleport: function (x, z) { player.x = x; player.z = z; if (player.veh) player.veh.veh.group.position.set(x, 0, z); camTarget.set(x, 1.5, z); camera.position.set(x - Math.sin(camYaw) * camDist, 4, z - Math.cos(camYaw) * camDist); },
      setMoney: function (m) { player.money = m; },
      setHealth: function (h) { player.health = h; },
      setTod: function (t) { state.tod = t; },
      setCam: function (yaw, pitch, dist) { camYaw = yaw; if (pitch !== undefined) camPitch = pitch; if (dist) camDist = dist; },
      freeCam: function (x, y, z, tx, ty, tz) {
        freeCamPose = { p: [x, y, z], t: [tx, ty, tz] };
        camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateProjectionMatrix();
      },
      releaseCam: function () { freeCamPose = null; },
      giveVehicle: function (type) {
        var v = TG.Vehicles.create(type, {});
        v.group.position.set(player.x, 0, player.z);
        scene.add(v.group);
        parkedVehs.push({ veh: v, x: player.x, z: player.z, heading: player.heading });
        return type;
      },
      missions: function () { return missions.map(function (m) { return m.def.id + ':' + m.status + ':' + m.step; }); }
    }
  };
})();

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(function () { TG.Game.start(); }, 60);
} else {
  window.addEventListener('DOMContentLoaded', function () { TG.Game.start(); });
}





