# GTA: TAIPEI — 台北風雲 / Taipei Storm

> 中英双语说明 / Bilingual documentation: Chinese first, followed by English.

## 中文

一款以 **台北市** 為舞台的開放世界動作遊戲（瀏覽器 3D，Three.js）。
單一 HTML 檔案、離線可玩、免安裝。

> 遊玩方式：**直接雙擊 `taipei-gta.html`**（Chrome / Edge / Firefox 皆可）。
> 首次點擊畫面或按任意鍵即可開始（瀏覽器會要求鎖定滑鼠以控制視角）。

---

### 遊戲內容

| 系統 | 說明 |
| --- | --- |
| 城市 | 9×9 棋盤街道、245 棟建築、棋盤式台北市區（忠孝東路、中山北路、敦化南路…），依行政區調整樓高（信義區高樓、萬華／士林低矮街屋） |
| 地標 | 台北101、中正紀念堂＋自由廣場牌樓、台北車站、總統府、龍山寺、士林夜市、美麗華摩天輪（會轉）、西門町紅樓＋霓虹 |
| 交通工具 | 機車（最有感的交通工具）、轎車、計程車、休旅車、公車、貨車、警車；路邊可牽車，也可直接搶路上行人的車 |
| 交通 AI | 靠右行駛、依車道行進、路口隨機左右轉、跟前車減速、對玩家緊急煞車；機車會鑽車縫 |
| 行人 | 40 位行人走在人行道上，有走路的擺手擺腿動畫、雨傘、購物袋、制服學生；車輛逼近或開槍會尖叫逃竄 |
| 警察 | 通緝 1–5 星，警車會鳴笛追捕（紅藍爆閃燈）、撞車、徒步時被貼上會被逮捕 |
| 任務 | 6 條主線任務：珍珠奶茶外送／夜市大胃王／趕高鐵／廟會遶境／夜間快遞／甩掉警察；黃色光柱＝任務點 |
| 晝夜 | 300 秒一輪晝夜，日出、黃昏、夜晚窗戶逐戶亮燈、霓虹與路燈自動點亮、天空與霧色即時變化 |
| 天氣 | 隨機午後雷陣雨（雨滴粒子＋雨聲音床） |
| HUD | GTA 風格：旋轉式圓形小地圖、通緝星、NT$ 金錢、血量／護甲、時速表、任務面板、廣播電台、暫停選單 |
| 音效 | 全程序化 WebAudio：引擎聲（機車／汽車不同）、警笛、雨聲、碰撞、喇叭、任務音效，以及 5 個電台（台北之音、夜市電台、警廣、ICRT、龍山寺梵音） |

### 操作

| 按鍵 | 功能 |
| --- | --- |
| `W A S D` / 方向鍵 | 走路 / 開車 |
| 滑鼠 | 視角（點擊畫面鎖定滑鼠） |
| `Shift` | 跑步 / 加速 |
| `空白鍵` | 跳 / 手煞車 |
| `E` | 上車 / 下車 |
| `F` | 攻擊（會提升通緝） |
| `H` | 喇叭（嚇跑路人） |
| `R` | 切換廣播電台 |
| `M` | 靜音 |
| `Esc` | 暫停 / 繼續 |

小技巧：機車最靈活；被警察追時鑽進巷子、或騎到河濱公園可甩掉通緝；龍山寺、士林夜市、台北車站附近可補血。

### 專案結構

```text
taipei-gta/
├─ taipei-gta.html      ← 最終成品（單檔，含 three.js，749 KB，離線可玩）
├─ index.html           ← 開發用頁面（分檔載入 src/）
├─ build.mjs            ← 打包：把 vendor/three.min.js + src/*.js 內嵌成單檔
├─ vendor/three.min.js  ← three.js r149 (UMD)
├─ src/
│  ├─ config.js         ← 世界常數：路網、行政區、地標座標、調校參數
│  ├─ utils.js          ← 亂數、數學、Canvas 材質、幾何合併器、AABB 碰撞
│  ├─ city.js           ← 程序化城市：天空、道路、街廓、建築、公園、河、山、雨、晝夜
│  ├─ landmarks.js      ← 8 組台北地標模型
│  ├─ vehicles.js       ← 車輛工廠 + 交通 AI
│  ├─ agents.js         ← 行人 + 警察 AI
│  ├─ hud.js            ← HUD / 小地圖 / 暫停選單
│  ├─ audio.js          ← 程序化音效與電台
│  └─ game.js           ← 主迴圈、玩家控制、駕駛物理、任務、通緝
├─ preview/             ← 各模組獨立預覽頁（city / vehicles）
├─ tools/               ← headless Chrome 截圖與自動化遊玩測試
└─ shots/               ← 驗證截圖
```

### 開發者備註

* 重新打包：`node build.mjs`
* 自動化測試（headless Chrome + SwiftShader，可截圖與模擬按鍵）：
  ```powershell
  node tools/play.cjs --url="file:///<絕對路徑>/taipei-gta.html" --wait=6000 `
    --script="start|KeyE:200|KeyW:2500|shot:shots/a.png"
  node tools/shot.cjs --url="file:///<絕對路徑>/taipei-gta.html" --out=shots/b.png --wait=5000
  ```
* 瀏覽器 Console 可直接除錯：
  ```js
  TG.Game.debug.teleport(280, 240)   // 傳送到台北101
  TG.Game.debug.setTod(21.5)         // 切換到夜晚
  TG.Game.debug.addWanted(3)         // 升起通緝
  TG.Game.debug.giveVehicle('police')// 生一台警車
  TG.Game.debug.missions()           // 任務狀態
  ```
* 效能：城市幾何全部合併（約 245 棟建築僅數個 draw call），行人共用材質與幾何；桌機獨顯可輕鬆 60fps。

### 已知限制

* 行人、車輛為低多邊形風格，無骨架動畫（以關節旋轉模擬）。
* 建築為程序化生成，非真實街景一比一還原；地標為簡化造型。
* 音效需使用者互動後才會啟動（瀏覽器自動播放政策）。
* 為純前端專案：無存檔功能，重新整理即重新開始。

---

## English

An open-world action game set in **Taipei** and built for the browser with Three.js. It is a single HTML file, playable offline, with no installation required.

> How to play: **double-click `taipei-gta.html`** (Chrome, Edge, or Firefox). Click the screen or press any key to start; the browser will request pointer lock for camera control.

---

### Game systems

| System | Description |
| --- | --- |
| City | 9×9 grid of streets, 245 buildings, grid-style Taipei blocks (Zhongxiao East Road, Zhongshan North Road, Dunhua South Road, etc.), with building heights varying by district (high-rises in Xinyi, lower street houses in Wanhua and Shilin) |
| Landmarks | Taipei 101, Chiang Kai-shek Memorial Hall and Liberty Square gate, Taipei Main Station, Presidential Office Building, Longshan Temple, Shilin Night Market, Miramar Ferris wheel (animated), Ximending Red House and neon signs |
| Vehicles | Scooters, sedans, taxis, SUVs, buses, trucks, and police cars; park or take vehicles from pedestrians on the street |
| Traffic AI | Drives on the right, follows lanes, turns randomly at intersections, slows for cars ahead, brakes for the player; scooters weave through traffic |
| Pedestrians | 40 sidewalk pedestrians with arm and leg swing animations, umbrellas, shopping bags, and student uniforms; they scream and run from approaching vehicles or gunfire |
| Police | 1–5 wanted stars, police cars chase with sirens and flashing red/blue lights, ram the player, and make foot arrests |
| Missions | Six main quests: bubble-tea delivery / night-market eating contest / catch the high-speed rail / temple parade / night delivery / lose the police; yellow light beams mark objectives |
| Day and night | 300-second cycle with sunrise, dusk, windows lighting up one by one at night, neon and streetlights switching on automatically, and live sky and fog colors |
| Weather | Random afternoon thunderstorms with rain particles and a rain audio bed |
| HUD | GTA-style rotating circular minimap, wanted stars, NT$ money, health/armor, speedometer, mission panel, radio stations, and pause menu |
| Audio | Fully procedural WebAudio: engine sounds (scooter and car variants), sirens, rain, collisions, horns, mission cues, and five radio stations (Taipei Voice, Night Market Radio, Police Radio, ICRT, Longshan Temple chants) |

### Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Walk / drive |
| Mouse | Camera (click to lock pointer) |
| `Shift` | Run / accelerate |
| `Space` | Jump / handbrake |
| `E` | Enter / exit vehicle |
| `F` | Attack (increases wanted level) |
| `H` | Horn (scares pedestrians) |
| `R` | Switch radio station |
| `M` | Mute |
| `Esc` | Pause / resume |

Tip: scooters are the most agile. When chased, cut through alleys or ride to a riverside park to shake the wanted level. Longshan Temple, Shilin Night Market, and Taipei Main Station are good places to recover health.

### Project structure

```text
taipei-gta/
├─ taipei-gta.html      ← final single-file build (with three.js, 749 KB, offline)
├─ index.html           ← development page (loads src/ separately)
├─ build.mjs            ← bundles vendor/three.min.js + src/*.js into one file
├─ vendor/three.min.js  ← three.js r149 (UMD)
├─ src/
│  ├─ config.js         ← world constants: road grid, districts, landmark coordinates, tuning
│  ├─ utils.js          ← random, math, Canvas materials, geometry merging, AABB collision
│  ├─ city.js           ← procedural city: sky, roads, blocks, buildings, parks, river, mountains, rain, day-night
│  ├─ landmarks.js      ← eight Taipei landmark models
│  ├─ vehicles.js       ← vehicle factory + traffic AI
│  ├─ agents.js         ← pedestrian + police AI
│  ├─ hud.js            ← HUD / minimap / pause menu
│  ├─ audio.js          ← procedural audio and radio stations
│  └─ game.js           ← main loop, player control, driving physics, missions, wanted system
├─ preview/             ← individual module previews (city / vehicles)
├─ tools/               ← headless Chrome screenshots and automated play tests
└─ shots/               ← verification screenshots
```

### Developer notes

* Rebuild: `node build.mjs`
* Automated tests (headless Chrome + SwiftShader; screenshots and simulated keystrokes):
  ```powershell
  node tools/play.cjs --url="file:///<absolute-path>/taipei-gta.html" --wait=6000 `
    --script="start|KeyE:200|KeyW:2500|shot:shots/a.png"
  node tools/shot.cjs --url="file:///<absolute-path>/taipei-gta.html" --out=shots/b.png --wait=5000
  ```
* Debug from the browser console:
  ```js
  TG.Game.debug.teleport(280, 240)   // teleport to Taipei 101
  TG.Game.debug.setTod(21.5)         // switch to night
  TG.Game.debug.addWanted(3)         // raise wanted level
  TG.Game.debug.giveVehicle('police')// spawn a police car
  TG.Game.debug.missions()           // mission status
  ```
* Performance: city geometry is fully merged (about 245 buildings in only a few draw calls), and pedestrians share materials and geometry; a desktop discrete GPU can hold 60 fps easily.

### Known limitations

* Pedestrians and vehicles are low-poly, with no skeletal animation (limb motion is simulated by joint rotation).
* Buildings are procedurally generated rather than a 1:1 reconstruction of real streets; landmarks are simplified.
* Audio starts only after user interaction (browser autoplay policy).
* This is a pure front-end project: there is no save system, and refreshing restarts the game.
