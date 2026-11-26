/* ============================================================
   GTA: TAIPEI — 台北風雲
   config.js — shared world constants & road graph
   Classic script. Attaches to window.TG. Requires THREE global.
   ============================================================ */
window.TG = window.TG || {};

TG.CONFIG = {
  version: '1.0.0',
  title: 'GTA: TAIPEI',
  subtitle: '台北風雲',

  /* world units = metres */
  city: {
    minX: -360, maxX: 360,
    minZ: -360, maxZ: 360,
    blockGap: 80,
    sidewalk: 4,          // sidewalk width
    curbH: 0.22,
    // beyond these lines the city ends
    riverX: -430,          // river surface starts here (west of city)
    riverW: 150
  },

  /* Roads run on a 9x9 grid at -320..320 step 80.
     ew: constant Z, runs along X.  ns: constant X, runs along Z. */
  roads: {
    ew: [
      { z: -320, w: 20, name: '士林夜市街', major: false },
      { z: -240, w: 18, name: '文林路',     major: false },
      { z: -160, w: 22, name: '南京東路',   major: true  },
      { z:  -80, w: 18, name: '南京西路',   major: false },
      { z:    0, w: 24, name: '忠孝東路',   major: true  },
      { z:   80, w: 22, name: '仁愛路',     major: true  },
      { z:  160, w: 22, name: '信義路',     major: true  },
      { z:  240, w: 18, name: '和平東路',   major: false },
      { z:  320, w: 20, name: '辛亥路',     major: false }
    ],
    ns: [
      { x: -320, w: 20, name: '環河北路',   major: false },
      { x: -240, w: 22, name: '中華路',     major: true  },
      { x: -160, w: 18, name: '西寧南路',   major: false },
      { x:  -80, w: 24, name: '中山北路',   major: true  },
      { x:    0, w: 18, name: '中山南路',   major: false },
      { x:   80, w: 22, name: '新生南路',   major: true  },
      { x:  160, w: 18, name: '建國南路',   major: false },
      { x:  240, w: 24, name: '敦化南路',   major: true  },
      { x:  320, w: 20, name: '光復南路',   major: false }
    ]
  },

  /* Named districts: [minX,maxX,minZ,maxZ] */
  districts: [
    { name: '士林區',  box: [-360, 360, -400, -260] },
    { name: '大同區',  box: [-360, -160, -260, -20] },
    { name: '萬華區',  box: [-400, -240, 60, 360] },
    { name: '西門町',  box: [-240, -80, -160, 80] },
    { name: '中正區',  box: [-160, 160, -80, 240] },
    { name: '大安區',  box: [80, 320, 40, 240] },
    { name: '信義區',  box: [160, 400, 240, 400] },
    { name: '中山區',  box: [-80, 240, -260, -20] },
    { name: '松山區',  box: [160, 400, -260, 40] }
  ],

  /* Landmark anchors (world x,z) — used by city.js to reserve blocks,
     by landmarks.js to place models, and by hud minimap. */
  landmarks: {
    taipei101:   { x: 280, z: 280, name: '台北101' },
    cks:         { x: 40,  z: 120, name: '中正紀念堂' },
    station:     { x: -40, z: -40, name: '台北車站' },
    presidential:{ x: -120, z: 120, name: '總統府' },
    longshan:    { x: -280, z: 200, name: '龍山寺' },
    nightmarket: { x: 0,   z: -280, name: '士林夜市' },
    ferris:      { x: 280, z: -200, name: '美麗華摩天輪' },
    ximen:       { x: -200, z: -40, name: '西門町' },
    park:        { x: 160, z: 160, name: '大安森林公園' },
    xiangshan:   { x: 560, z: 560, name: '象山' },
    yangming:    { x: -60, z: -760, name: '陽明山' }
  },

  /* Blocks that city.js must leave empty (landmark / park / special) */
  reservedBlocks: [
    { x: 280, z: 280, r: 62, tag: 'taipei101' },
    { x: 40,  z: 120, r: 46, tag: 'cks' },
    { x: -40, z: -40, r: 52, tag: 'station' },
    { x: -120,z: 120, r: 46, tag: 'presidential' },
    { x: -280,z: 200, r: 42, tag: 'longshan' },
    { x: 0,   z: -280,r: 62, tag: 'nightmarket' },
    { x: 280, z: -200,r: 52, tag: 'ferris' },
    { x: -200,z: -40, r: 44, tag: 'ximen' },
    { x: 160, z: 160, r: 82, tag: 'park' },
    { x: 120, z: 120, r: 60, tag: 'park' },
    { x: 200, z: 120, r: 60, tag: 'park' },
    { x: 120, z: 200, r: 60, tag: 'park' },
    { x: 200, z: 200, r: 60, tag: 'park' }
  ],

  /* Gameplay tuning */
  game: {
    dayLength: 300,          // seconds for a full 24h cycle
    startTime: 17.4,         // start at golden hour (17:24)
    playerWalk: 5.2,
    playerRun: 9.4,
    playerHealth: 100,
    maxWanted: 5,
    policeChaseRadius: 90,
    startMoney: 2000,
    scooterTopSpeed: 33,     // m/s ~ 119 km/h
    carTopSpeed: 40,
    gravity: 26
  },

  palette: {
    skyDay: 0x9fd0ea, skyDusk: 0xf2a06a, skyNight: 0x0a1026,
    fogDay: 0xcfe4ee, fogDusk: 0xe8b48a, fogNight: 0x111a33,
    asphalt: 0x3a3d42, sidewalk: 0xb9b6ae, park: 0x6f9e57,
    river: 0x2f5a6b, concrete: 0xd8d5cc,
    neonPink: 0xff3d9a, neonCyan: 0x35e0ff, neonYellow: 0xffd23f,
    policeBlue: 0x2f6bff, policeRed: 0xff2d2d
  },

  /* HUD radio stations (name + genre colour) */
  radio: [
    { name: '台北之音 FM 92.1', genre: '流行' },
    { name: '夜市電台 FM 107.7', genre: '台語金曲' },
    { name: '警廣交通網 FM 94.3', genre: '路況' },
    { name: 'ICRT FM 100.7', genre: 'Rock' },
    { name: '龍山寺梵音', genre: '誦經' }
  ]
};

/* ---------- derived helpers ---------- */
TG.CONFIG.roadGraph = (function () {
  var C = TG.CONFIG;
  var ew = C.roads.ew.map(function (r) { return { axis: 'x', pos: r.z, w: r.w, name: r.name, major: r.major }; });
  var ns = C.roads.ns.map(function (r) { return { axis: 'z', pos: r.x, w: r.w, name: r.name, major: r.major }; });
  return {
    ew: ew,
    ns: ns,
    all: ew.concat(ns),
    bounds: { minX: C.city.minX, maxX: C.city.maxX, minZ: C.city.minZ, maxZ: C.city.maxZ },
    // lane centre offset from road centre-line (right-hand traffic)
    lane: function (road, dir) { return (road.w * 0.25) * (dir > 0 ? 1 : -1); }
  };
})();

/* Is a world point on a road surface? */
TG.CONFIG.isOnRoad = function (x, z) {
  var g = TG.CONFIG.roadGraph, i;
  for (i = 0; i < g.ew.length; i++) {
    var r = g.ew[i];
    if (Math.abs(z - r.pos) < r.w / 2 && x >= -370 && x <= 370) return r;
  }
  for (i = 0; i < g.ns.length; i++) {
    var s = g.ns[i];
    if (Math.abs(x - s.pos) < s.w / 2 && z >= -370 && z <= 370) return s;
  }
  return null;
};

/* Nearest road centre-line point + distance (for ped paths / traffic reset) */
TG.CONFIG.nearestRoad = function (x, z) {
  var g = TG.CONFIG.roadGraph, best = null, bd = 1e9, i;
  for (i = 0; i < g.ew.length; i++) {
    var r = g.ew[i], d = Math.abs(z - r.pos);
    if (d < bd) { bd = d; best = { road: r, dist: d, px: x, pz: r.pos }; }
  }
  for (i = 0; i < g.ns.length; i++) {
    var s = g.ns[i], d2 = Math.abs(x - s.pos);
    if (d2 < bd) { bd = d2; best = { road: s, dist: d2, px: s.pos, pz: z }; }
  }
  return best;
};

TG.CONFIG.districtAt = function (x, z) {
  var d = TG.CONFIG.districts;
  for (var i = 0; i < d.length; i++) {
    var b = d[i].box;
    if (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]) return d[i].name;
  }
  return '台北市';
};

