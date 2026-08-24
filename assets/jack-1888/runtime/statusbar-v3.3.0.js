// jack1888_statusbar —— 状态栏、地图导航、案卷助理与正文视觉层。
// 只读取最新消息楼的公开 MVU stat_data；地图点击始终走正常用户消息链。
// 案卷助理是玩家侧旁路，不写聊天、不改 MVU；只有玩家主动发送时才访问其配置的外部 API。
(() => {
  'use strict';

  const VERSION = '3.3.0';
  const ROTATION_MS = 14000;
  const ASSET_BASE = 'https://handal3k.github.io/Profile-1/assets/jack-1888';
  const ASSISTANT_CONFIG_KEY = 'jack1888:assistant-config:v1';
  const ASSISTANT_SESSION_KEY = 'jack1888:assistant-key:session';
  const ASSISTANT_PERSISTENT_KEY = 'jack1888:assistant-key:persistent';
  const ASSISTANT_DEFAULTS = Object.freeze({
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-flash',
    contextCount: 8,
    includeContext: true,
    rememberKey: false,
    mode: 'case',
  });
  const ASSISTANT_THINKING_LINES = Object.freeze([
    '等一下，我把这几页证词摊开。',
    '让我核对一下日期——这种地方最容易骗人。',
    '先别急，我看看哪句话真正站得住。',
    '我在翻案卷。墨迹很乱，但总比传闻可靠。',
  ]);
  const DEFAULT_BANNERS = [
    `${ASSET_BASE}/banners/banner-01.webp`,
    `${ASSET_BASE}/banners/banner-02.webp`,
    `${ASSET_BASE}/banners/banner-03.webp`,
    `${ASSET_BASE}/banners/banner-04.webp`,
  ];
  const DEFAULT_LOCATION_ASSET = `${ASSET_BASE}/locations/default-whitechapel.webp`;
  const LOCATION_ASSETS = [
    { aliases: ['whitechapel police station', 'whitechapel警局', 'whitechapel 警局', '警局'], url: `${ASSET_BASE}/locations/whitechapel-station.webp` },
    { aliases: ["buck's row", 'buck’s row', '巴克街'], url: `${ASSET_BASE}/locations/bucks-row.webp` },
    { aliases: ['29 hanbury street', 'hanbury street', '汉伯里街'], url: `${ASSET_BASE}/locations/hanbury-street.webp` },
    { aliases: ["dutfield's yard", 'dutfield’s yard', '杜特菲尔德院'], url: `${ASSET_BASE}/locations/dutfields-yard.webp` },
    { aliases: ['mitre square', '米特广场'], url: `${ASSET_BASE}/locations/mitre-square.webp` },
    { aliases: ['goulston street', 'goulston', '高斯顿'], url: `${ASSET_BASE}/locations/goulston-street.webp` },
    { aliases: ["miller's court", 'miller’s court', 'dorset street', '米勒庭院'], url: `${ASSET_BASE}/locations/millers-court.webp` },
  ];

  const STAGE_LABELS = {
    stage1_stranger_detective: '陌生调查者',
    stage2_troublesome_acquaintance: '麻烦熟人',
    stage3_reluctant_partner: '不情愿的搭档',
    stage4_back_cover: '可以交背后的人',
    stage5_preference: '偏爱',
    stage6_affection_confirmed: '感情确认',
    stage7_truth_pressure: '真相压力期',
    stage8_settled: '尘埃落定',
  };
  const PERIOD_LABELS = {
    dawn: '黎明', morning: '白昼', day: '白昼', dusk: '黄昏', evening: '黄昏', night: '深夜',
    '黎明': '黎明', '白昼': '白昼', '黄昏': '黄昏', '深夜': '深夜',
  };
  const CASE_LOCATIONS = [
    { id: 'bucks-row', name: "Buck's Row", aliases: ['buck’s row', '巴克街'], victim: 'Mary Ann Nichols', date: '1888-08-31', x: 80, y: 39 },
    { id: 'hanbury-street', name: 'Hanbury Street', aliases: ['汉伯里街'], victim: 'Annie Chapman', date: '1888-09-08', x: 51, y: 27 },
    { id: 'dutfields-yard', name: "Dutfield's Yard", aliases: ['dutfield’s yard', '杜特菲尔德院'], victim: 'Elizabeth Stride', date: '1888-09-30', x: 75, y: 75 },
    { id: 'mitre-square', name: 'Mitre Square', aliases: ['米特广场'], victim: 'Catherine Eddowes', date: '1888-09-30', x: 24, y: 68 },
    { id: 'millers-court', name: "Miller's Court", aliases: ['miller’s court', '米勒庭院'], victim: 'Mary Jane Kelly', date: '1888-11-09', x: 44, y: 20 },
  ];
  const KNOWN_LOCATIONS = [
    ...CASE_LOCATIONS,
    { name: 'Whitechapel Police Station', aliases: ['whitechapel police', 'whitechapel 警局', '警局'], x: 66, y: 55 },
    { name: 'Spitalfields Market', aliases: ['spitalfields market', 'spitalfields 市场', '市场'], x: 43, y: 33 },
    { name: 'Goulston Street', aliases: ['goulston', '高斯顿'], x: 34, y: 56 },
    { name: 'Whitechapel Road', aliases: ['whitechapel road', 'whitechapel high street', '白教堂大道'], x: 62, y: 59 },
    { name: 'Commercial Street', aliases: ['commercial street', '商业街'], x: 52, y: 44 },
  ];

  const STYLE = `
:root{--j1888-ink:#100d0a;--j1888-paper:#1d1813;--j1888-paper-2:#2a2118;--j1888-line:#6d5637;--j1888-gold:#d6b46f;--j1888-cream:#eee0c4;--j1888-muted:#ad9b7c;--j1888-green:#59705e;--j1888-red:#95574d}
#jack1888-statusbar,#jack1888-map-dialog,#jack1888-map-trigger{font-family:Georgia,"Noto Serif SC","Songti SC",serif;box-sizing:border-box}
#jack1888-statusbar * ,#jack1888-map-dialog *{box-sizing:border-box}
#jack1888-statusbar{position:fixed;right:12px;top:72px;z-index:9998;width:312px;color:var(--j1888-cream);background:linear-gradient(145deg,#201a14f8,#110f0cf8);border:1px solid #7b6039;border-radius:2px;box-shadow:0 18px 45px #000c,0 0 0 1px #15100b inset,0 0 0 4px #0c090675;overflow:hidden;user-select:none}
#jack1888-statusbar::before,#jack1888-statusbar::after{content:"";position:absolute;z-index:6;width:18px;height:18px;pointer-events:none}
#jack1888-statusbar::before{left:5px;top:5px;border-left:1px solid #d2ab63;border-top:1px solid #d2ab63}
#jack1888-statusbar::after{right:5px;bottom:5px;border-right:1px solid #d2ab63;border-bottom:1px solid #d2ab63}
#jack1888-statusbar .j1888-banner{position:relative;isolation:isolate;overflow:hidden;background:#17130f linear-gradient(135deg,#241c14,#11100d);border-bottom:1px solid #6b5435}
#jack1888-statusbar .j1888-banner{height:126px}
.j1888-banner-layer{position:absolute;inset:-2px;z-index:-2;background-position:center 34%;background-size:cover;opacity:0;transform:scale(1.025);transition:opacity 1.35s ease,transform 8s ease}
.j1888-banner-layer.is-active{opacity:1;transform:scale(1)}
.j1888-banner::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,#100d0ae8 0,#17130f8a 43%,#17130f1f 72%),linear-gradient(0deg,#15110ee8 0,transparent 58%);pointer-events:none}
#jack1888-statusbar .sb-banner-copy{position:absolute;inset:auto 13px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:12px;text-shadow:0 2px 7px #000}
#jack1888-statusbar .sb-mark{font-size:16px;letter-spacing:3.5px;color:#f3d99b;font-variant:small-caps}
#jack1888-statusbar .sb-mark::after{content:"CASE DOSSIER";display:block;margin-top:3px;color:#b9a37d;font:8px/1.2 Arial,sans-serif;letter-spacing:2.2px}
#jack1888-statusbar .sb-location-box{min-width:0;max-width:152px;padding:5px 7px;border:1px solid #b58f526e;background:#100d0ac7;text-align:right;backdrop-filter:blur(3px)}
#jack1888-statusbar .sb-location-label{display:block;color:#9f8e70;font:8px/1 Arial,sans-serif;letter-spacing:1.8px}
#jack1888-statusbar .sb-location{display:block;margin-top:2px;color:#f0d59b;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#jack1888-statusbar .sb-date{display:block;margin-top:1px;font-size:9px;color:#c6b38f;letter-spacing:.8px}
#jack1888-statusbar .sb-toolbar{position:absolute;right:6px;top:5px;display:flex;gap:4px;z-index:3}
#jack1888-statusbar .sb-tool{width:28px;height:28px;border:1px solid #a8875166;border-radius:50%;background:#15110db8;color:#e7cf9f;cursor:pointer;font:16px/1 sans-serif;display:grid;place-items:center;backdrop-filter:blur(4px)}
#jack1888-statusbar .sb-tool:hover,#jack1888-statusbar .sb-tool:focus-visible{border-color:#dfbc75;background:#2c2218;outline:none}
#jack1888-statusbar .sb-body{position:relative;padding:12px 14px 14px;background:repeating-linear-gradient(0deg,#0000 0 25px,#80633d10 26px),linear-gradient(135deg,#211a14,#15110e)}
#jack1888-statusbar .sb-body::before{content:"METROPOLITAN POLICE · PRIVATE COPY";display:block;margin:0 0 10px;color:#7f7059;font:8px/1.2 Arial,sans-serif;letter-spacing:1.55px;text-align:center}
#jack1888-statusbar .sb-location-scene{--j1888-location-art:url("${DEFAULT_LOCATION_ASSET}");position:relative;isolation:isolate;height:76px;margin:0 0 10px;overflow:hidden;border:1px solid #6b5435;background:#17130f;box-shadow:inset 0 0 18px #0008}
#jack1888-statusbar .sb-location-scene::before,#jack1888-statusbar .sb-location-scene::after{content:"";position:absolute;inset:0;background-image:var(--j1888-location-art);background-position:center;background-repeat:no-repeat;pointer-events:none}
#jack1888-statusbar .sb-location-scene::before{z-index:0;inset:-10px;background-size:cover;filter:blur(9px) brightness(.38) saturate(.7);transform:scale(1.05)}
#jack1888-statusbar .sb-location-scene::after{z-index:1;background-size:contain;filter:brightness(.76) saturate(.8);box-shadow:inset 0 0 16px #0009}
#jack1888-statusbar .sb-scene-copy{position:absolute;z-index:3;left:9px;bottom:7px;color:#9f8e70;font:8px/1.25 Arial,sans-serif;letter-spacing:1.7px;text-shadow:0 2px 6px #000}
#jack1888-statusbar .sb-scene-name{display:block;margin-top:3px;color:#efd49a;font:11px/1.25 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:.4px}
#jack1888-statusbar .sb-facts{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 10px;padding:9px 10px;margin-bottom:11px;border:1px solid #5d493088;background:#0f0d0a4f;font-size:12px}
#jack1888-statusbar .sb-key{color:var(--j1888-muted);letter-spacing:1px}
#jack1888-statusbar .sb-value{color:#ead6aa;text-align:right;overflow-wrap:anywhere}
#jack1888-statusbar .sb-truth{min-width:52px;padding:1px 8px;border:1px double #8c6c3f;background:#2d2318;color:#f0ca78;text-align:center;letter-spacing:1.5px;box-shadow:0 0 10px #c69c4c0d inset}
#jack1888-statusbar .sb-metric{margin:9px 0}
#jack1888-statusbar .sb-metric-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;font-size:12px}
#jack1888-statusbar .sb-number{color:#edd6a5;font-variant-numeric:tabular-nums}
#jack1888-statusbar .sb-track{position:relative;height:7px;border:1px solid #5b4935;background:repeating-linear-gradient(90deg,#0e0c0a 0 calc(10% - 1px),#4f402c calc(10% - 1px) 10%);overflow:hidden}
#jack1888-statusbar .sb-fill{display:block;height:100%;width:0;background:linear-gradient(90deg,#476052,#8e9d72 62%,#d0b270);box-shadow:0 0 7px #c8ad7170;transition:width .55s ease}
#jack1888-statusbar [data-metric="suspicion"] .sb-fill{background:linear-gradient(90deg,#775043,#ae6253)}
#jack1888-statusbar .sb-note{margin-top:8px;color:#a89576;font:11px/1.45 Georgia,"Noto Serif SC","Songti SC",serif}
#jack1888-statusbar.sb-collapsed{width:176px}
#jack1888-statusbar.sb-collapsed .j1888-banner{height:48px;border:0}
#jack1888-statusbar.sb-collapsed .sb-banner-copy{inset:auto 9px 7px}
#jack1888-statusbar.sb-collapsed .sb-mark{font-size:11px;letter-spacing:2px}
#jack1888-statusbar.sb-collapsed .sb-location-box,#jack1888-statusbar.sb-collapsed .sb-body{display:none}
#jack1888-map-trigger{position:fixed;right:18px;bottom:94px;z-index:2147483000;width:58px;height:58px;border-radius:50%;border:1px solid #b89459;background:radial-gradient(circle at 35% 30%,#516857,#26352c 55%,#131b16);color:#ecd59f;box-shadow:0 8px 24px #000b,0 0 0 4px #16120ec0;cursor:pointer;display:grid;place-items:center;font:23px/1 Georgia,serif;transition:transform .2s ease,box-shadow .2s ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent;isolation:isolate}
#jack1888-map-trigger:hover,#jack1888-map-trigger:focus-visible{transform:translateY(-2px);box-shadow:0 11px 28px #000c,0 0 0 4px #2e392fc0;outline:none}
#jack1888-map-trigger::after{content:"调查台";position:absolute;right:66px;padding:4px 7px;border:1px solid #5d4930;background:#191510e8;color:#d7c29b;font:11px/1.2 Georgia,"Noto Serif SC","Songti SC",serif;white-space:nowrap;opacity:0;transform:translateX(4px);pointer-events:none;transition:.2s}
#jack1888-map-trigger:hover::after,#jack1888-map-trigger:focus-visible::after{opacity:1;transform:none}
#jack1888-map-dialog[hidden]{display:none!important}
#jack1888-map-dialog{position:fixed;inset:0;z-index:2147483001;display:grid;place-items:center;padding:18px;background:#090806b8;backdrop-filter:blur(5px);color:var(--j1888-cream)}
#jack1888-map-dialog .jmap-shell{position:relative;width:min(940px,100%);max-height:min(780px,calc(100vh - 36px));background:#1a1611;border:1px solid #80643d;box-shadow:0 20px 70px #000e,0 0 0 4px #0b0906a8;overflow:auto}
#jack1888-map-dialog .jmap-head{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:11px 14px;background:#211a13f2;border-bottom:1px solid #5c482e}
#jack1888-map-dialog .jmap-title{font-size:15px;letter-spacing:3px;color:#e4c681}
#jack1888-map-dialog .jmap-meta{font-size:11px;color:#a89576;letter-spacing:1px}
#jack1888-map-dialog .jmap-close{width:31px;height:31px;border:1px solid #665136;background:#17130f;color:#d7bf91;cursor:pointer;font:18px/1 sans-serif}
#jack1888-map-dialog .jhub-tabs{position:sticky;top:54px;z-index:4;display:flex;gap:0;padding:0 14px;background:#17130ff5;border-bottom:1px solid #5c482e}
#jack1888-map-dialog .jhub-tab{min-width:130px;padding:10px 13px;border:0;border-left:1px solid #493925;background:transparent;color:#97876d;cursor:pointer;font:11px/1.2 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:2px}
#jack1888-map-dialog .jhub-tab:last-child{border-right:1px solid #493925}
#jack1888-map-dialog .jhub-tab.is-active{color:#eccd8c;background:#2a2118;box-shadow:inset 0 -2px #c59d5a}
#jack1888-map-dialog .jhub-page[hidden]{display:none!important}
#jack1888-map-dialog .jmap-layout{display:grid;grid-template-columns:minmax(0,1fr) 236px;min-height:430px}
#jack1888-map-dialog .jmap-canvas{position:relative;min-height:430px;overflow:hidden;background:#c6af80;color:#2d2418;isolation:isolate}
#jack1888-map-dialog .jmap-canvas::before{content:"";position:absolute;inset:0;z-index:-2;background:radial-gradient(circle at 18% 15%,#ead7a9 0,transparent 29%),repeating-linear-gradient(9deg,#5f513219 0 1px,transparent 1px 7px),linear-gradient(145deg,#d4c092,#aa9166);filter:sepia(.28)}
#jack1888-map-dialog .jmap-canvas::after{content:"WHITECHAPEL · 1888";position:absolute;right:16px;bottom:10px;color:#3b30225c;font-size:18px;letter-spacing:5px;pointer-events:none}
#jack1888-map-dialog .jmap-streets{position:absolute;inset:0;width:100%;height:100%;opacity:.7;pointer-events:none}
#jack1888-map-dialog .jmap-marker{position:absolute;translate:-50% -50%;display:grid;place-items:center;width:25px;height:25px;border:1px solid #f0d69a;border-radius:50% 50% 50% 4px;rotate:-45deg;background:#713c35;color:#fff;box-shadow:0 2px 7px #25180d99;cursor:pointer;z-index:2}
#jack1888-map-dialog .jmap-marker>span{rotate:45deg;font:10px/1 Georgia,serif}
#jack1888-map-dialog .jmap-marker:hover,#jack1888-map-dialog .jmap-marker:focus-visible{scale:1.16;outline:2px solid #3b3124;outline-offset:2px}
#jack1888-map-dialog .jmap-marker.jmap-player{border-radius:50%;rotate:0;background:#315b4a;border-color:#ecdaa9;width:22px;height:22px;cursor:default;animation:j1888-pulse 2.2s ease-in-out infinite}
#jack1888-map-dialog .jmap-marker.jmap-player>span{rotate:0}
#jack1888-map-dialog .jmap-side{padding:13px;background:#211b15;border-left:1px solid #6b5536;overflow:auto}
#jack1888-map-dialog .jmap-current{padding:9px 10px;margin-bottom:12px;border:1px solid #516554;background:#1a251e;color:#d8d1ad;font-size:12px}
#jack1888-map-dialog .jmap-current b{display:block;margin-top:2px;color:#efd9a8;font-weight:normal;overflow-wrap:anywhere}
#jack1888-map-dialog .jmap-section-title{margin:0 0 7px;color:#a99573;font-size:11px;letter-spacing:2px}
#jack1888-map-dialog .jmap-place{display:block;width:100%;margin:0 0 7px;padding:8px 9px;text-align:left;border:1px solid #54422d;background:#191510;color:#d9c7a5;cursor:pointer;font:11px/1.4 Georgia,"Noto Serif SC","Songti SC",serif}
#jack1888-map-dialog .jmap-place:hover,#jack1888-map-dialog .jmap-place:focus-visible{border-color:#c09b5e;background:#2b2117;outline:none}
#jack1888-map-dialog .jmap-place small{display:block;color:#907f65}
#jack1888-map-dialog .jmap-foot{display:flex;justify-content:space-between;gap:12px;padding:9px 13px;border-top:1px solid #5c482e;color:#9f8d71;font-size:11px}
#jack1888-map-dialog .jmap-message{color:#d5bd88;text-align:right}
#jack1888-map-dialog .jassist-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;min-height:520px}
#jack1888-map-dialog .jassist-main{display:grid;grid-template-rows:auto minmax(260px,1fr) auto;min-width:0;background:linear-gradient(145deg,#1d1813,#12100d)}
#jack1888-map-dialog .jassist-toolbar{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #4f3e29;background:#221b14}
#jack1888-map-dialog .jassist-select,#jack1888-map-dialog .jassist-input,#jack1888-map-dialog .jassist-textarea{border:1px solid #655034;background:#100e0b;color:#e5d4b2;font:12px/1.5 Georgia,"Noto Serif SC","Songti SC",serif}
#jack1888-map-dialog .jassist-select{padding:6px 8px}
#jack1888-map-dialog .jassist-toggle{display:flex;align-items:center;gap:6px;color:#a99779;font-size:11px}
#jack1888-map-dialog .jassist-toolbar .jassist-button{margin-left:auto}
#jack1888-map-dialog .jassist-log{padding:15px;overflow:auto;max-height:430px;scrollbar-color:#655034 #15110e}
#jack1888-map-dialog .jassist-empty{max-width:520px;margin:50px auto;padding:24px;text-align:center;border:1px dashed #5f4b32;color:#95856b;line-height:1.7}
#jack1888-map-dialog .jassist-bubble{max-width:88%;margin:0 0 12px;padding:10px 12px;border:1px solid #57452f;background:#201a14;color:#dfd3bc;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}
#jack1888-map-dialog .jassist-bubble[data-role="user"]{margin-left:auto;background:#1c2821;border-color:#506353}
#jack1888-map-dialog .jassist-who{display:block;margin-bottom:5px;color:#d6b36d;font:9px/1.2 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
#jack1888-map-dialog .jassist-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:11px 12px;border-top:1px solid #4f3e29;background:#211a14}
#jack1888-map-dialog .jassist-textarea{min-height:76px;max-height:180px;resize:vertical;padding:8px 9px}
#jack1888-map-dialog .jassist-button{padding:7px 11px;border:1px solid #745b39;background:#2a2117;color:#e4c98f;cursor:pointer;font:11px/1.3 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:1px}
#jack1888-map-dialog .jassist-button:hover,#jack1888-map-dialog .jassist-button:focus-visible{border-color:#c79f5d;background:#35291c;outline:none}
#jack1888-map-dialog .jassist-button:disabled{opacity:.48;cursor:wait}
#jack1888-map-dialog .jassist-send{min-width:88px;background:#314137;border-color:#61765f}
#jack1888-map-dialog .jassist-side{padding:14px;background:#211b15;border-left:1px solid #5c482e;color:#a7977c;font-size:11px;line-height:1.65}
#jack1888-map-dialog .jassist-side h3{margin:0 0 9px;color:#d7b979;font-size:11px;letter-spacing:2px;font-weight:normal}
#jack1888-map-dialog .jassist-context{padding:9px;border:1px solid #4f513e;background:#182019;color:#c9c8a9;white-space:pre-line;overflow-wrap:anywhere}
#jack1888-map-dialog .jassist-warning{margin:12px 0;padding:9px;border-left:2px solid #8c6840;background:#17130f;color:#a99575}
#jack1888-map-dialog .jassist-settings[hidden]{display:none!important}
#jack1888-map-dialog .jassist-settings{position:absolute;z-index:10;inset:55px 18px 18px auto;width:min(430px,calc(100% - 36px));padding:16px;background:#17130ff8;border:1px solid #85663d;box-shadow:0 16px 45px #000e}
#jack1888-map-dialog .jassist-settings h3{margin:0 0 13px;color:#e1c17e;font-size:14px;letter-spacing:2px;font-weight:normal}
#jack1888-map-dialog .jassist-field{display:block;margin:0 0 11px;color:#aa9879;font-size:11px}
#jack1888-map-dialog .jassist-field span{display:block;margin-bottom:4px}
#jack1888-map-dialog .jassist-input{display:block;width:100%;padding:7px 8px}
#jack1888-map-dialog .jassist-settings-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:13px}
#jack1888-map-dialog .jassist-credential-note{margin:8px 0;color:#a98c6e;font-size:10px;line-height:1.55}
@keyframes j1888-pulse{50%{box-shadow:0 0 0 8px #315b4a2e,0 2px 7px #25180d99}}

/* 正文结构化契约，同时兼容普通 Markdown。 */
#chat .mes[is_user="false"] .mes_text{position:relative;color:#e0d8c8;line-height:1.86;font-family:Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:.012em;text-wrap:pretty}
#chat .mes[is_user="false"] .mes_text>p{margin:.78em 0}
#chat .mes[is_user="false"] .mes_text>p:first-of-type::first-letter{font-size:1.22em;color:#e2c27d}
#chat .mes[is_user="false"] .mes_text em{color:#bdb099}
#chat .mes[is_user="false"] .mes_text strong{color:#ead09a;font-weight:600}
#chat .mes[is_user="false"] .mes_text>hr{height:1px;border:0;background:linear-gradient(90deg,transparent,#806842,transparent);margin:1.25em 0}
#chat .mes[is_user="false"] .mes_text>blockquote{position:relative;margin:1em .25em;padding:.72em 1em .75em 1.15em;border:1px solid #59472f;border-left:3px solid #a17c46;background:linear-gradient(100deg,#241d16e6,#17130f9c 70%,transparent);color:#e9ddc6;box-shadow:inset 0 1px #ffffff08}
#chat .mes[is_user="false"] .mes_text>blockquote::after{content:"“";position:absolute;right:10px;top:-8px;color:#b8965c20;font:46px/1 Georgia,serif}
#chat .mes[is_user="false"] .mes_text>blockquote strong:first-child{color:#dfbc74;font:small-caps 12px/1.3 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:1.5px}
.j1888-scene-head{display:grid;grid-template-columns:auto auto auto minmax(0,1fr);gap:7px;align-items:center;margin:4px 0 16px;padding:9px 11px;border:1px solid #7b603b;background:linear-gradient(90deg,#30251a,#17130f);color:#d9c5a0;font:12px/1.45 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:.5px;box-shadow:0 4px 13px #0004,inset 0 1px #fff1}
.j1888-scene-head::before{content:"CASE LOG";color:#887657;font:8px/1 Arial,sans-serif;letter-spacing:2px}
.j1888-scene-head .j1888-scene-date,.j1888-scene-head .j1888-scene-period{padding-right:8px;border-right:1px solid #614c32;color:#e7c982;white-space:nowrap}
.j1888-scene-head .j1888-scene-location{text-align:right;overflow-wrap:anywhere}
.j1888-narrative{margin:.7em 0;color:#ded5c5}
.j1888-dialogue{position:relative;margin:1em .25em;padding:.78em 1em .8em 1.15em;border:1px solid #59472f;border-left:3px solid #a17c46;background:linear-gradient(100deg,#241d16e6,#17130f9c 72%,transparent);box-shadow:inset 0 1px #ffffff08}
.j1888-dialogue::after{content:"“";position:absolute;right:10px;top:-8px;color:#b8965c20;font:46px/1 Georgia,serif}
.j1888-dialogue .j1888-speaker{display:block;margin-bottom:.34em;color:#dfbc74;font:small-caps 11px/1.3 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:1.7px}
.j1888-dialogue .j1888-line{display:block;margin:0;color:#eee0c5;line-height:1.72}
.j1888-dialogue-jack{display:grid;grid-template-columns:62px minmax(0,1fr);align-items:center;gap:12px;padding:.68em 1em .68em .72em;border-left-color:#c39a55;background:linear-gradient(100deg,#2a2117f2,#17130fb8 78%,transparent)}
.j1888-dialogue-jack .j1888-dialogue-avatar{display:block;width:62px;height:70px;padding:2px;border:1px solid #967342;background:#0f0d0a;box-shadow:0 4px 12px #0008,inset 0 0 0 1px #d4b16b2b;overflow:hidden;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.j1888-dialogue-jack .j1888-dialogue-avatar img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 22%;filter:saturate(.78) contrast(1.04) brightness(.9)}
.j1888-dialogue-jack .j1888-dialogue-copy{display:block;min-width:0}
.j1888-dialogue-jack .j1888-speaker::after{content:" · WITNESS / PARTNER";color:#7f715c;font:8px/1 Arial,sans-serif;letter-spacing:1.1px}
.j1888-clue-box{position:relative;margin:1.15em .15em;padding:12px 13px 12px 15px;border:1px solid #826942;border-left:3px solid #b18a4d;background:linear-gradient(135deg,#2a2218,#17130f);box-shadow:0 4px 13px #0005,inset 0 1px #fff1;color:#ddcfb4}
.j1888-clue-box::before{content:"调查记录";display:block;margin:-2px 0 7px;color:#d4ae66;font:11px/1.3 Georgia,"Noto Serif SC","Songti SC",serif;letter-spacing:3px}
.j1888-clue-box .j1888-clue-kind{display:inline-block;margin:0 7px 0 0;padding:1px 5px;border:1px solid #806742;color:#e2c27d;font-size:10px;letter-spacing:1px;vertical-align:1px}
.j1888-clue-box .j1888-clue-text{color:#ddcfb4}
.j1888-clue-box ul{margin:.35em 0 .1em;padding-left:1.35em}

@media(max-width:760px){
  #jack1888-statusbar{right:max(8px,env(safe-area-inset-right));top:max(58px,env(safe-area-inset-top));width:min(290px,calc(100vw - 16px));max-height:calc(100dvh - 74px - env(safe-area-inset-bottom));overflow:auto}
  #jack1888-statusbar .j1888-banner{height:94px}
  #jack1888-map-trigger{position:fixed!important;inset:auto calc(12px + env(safe-area-inset-right,0px)) calc(var(--j1888-mobile-trigger-bottom,104px) + env(safe-area-inset-bottom,0px)) auto!important;display:grid!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;width:56px;height:56px;min-width:56px;min-height:56px;transform:none}
  #jack1888-map-trigger:hover,#jack1888-map-trigger:focus-visible{transform:translateY(-2px)}
  #jack1888-map-trigger::after{display:none}
  #jack1888-map-dialog{inset:0!important;width:100vw;width:100dvw;height:100vh;height:100dvh;padding:calc(7px + env(safe-area-inset-top,0px)) calc(7px + env(safe-area-inset-right,0px)) calc(7px + env(safe-area-inset-bottom,0px)) calc(7px + env(safe-area-inset-left,0px))}
  #jack1888-map-dialog .jmap-shell{width:100%;max-height:calc(100vh - 14px);max-height:calc(100dvh - 14px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overscroll-behavior:contain}
  #jack1888-map-dialog .jmap-layout{grid-template-columns:1fr;min-height:0}
  #jack1888-map-dialog .jmap-canvas{min-height:330px}
  #jack1888-map-dialog .jmap-side{border-left:0;border-top:1px solid #6b5536;max-height:210px}
  #jack1888-map-dialog .jmap-foot{display:block}
  #jack1888-map-dialog .jmap-message{text-align:left;margin-top:4px}
  #jack1888-map-dialog .jassist-layout{grid-template-columns:1fr}
  #jack1888-map-dialog .jassist-side{border-left:0;border-top:1px solid #5c482e}
  #jack1888-map-dialog .jassist-toolbar{flex-wrap:wrap}
  #jack1888-map-dialog .jassist-form{grid-template-columns:1fr}
  #jack1888-map-dialog .jassist-send{min-height:42px}
  .j1888-dialogue-jack{grid-template-columns:52px minmax(0,1fr);gap:9px}.j1888-dialogue-jack .j1888-dialogue-avatar{width:52px;height:60px}
  .j1888-scene-head{grid-template-columns:auto auto}.j1888-scene-head::before{grid-column:1/-1}.j1888-scene-head .j1888-scene-location{grid-column:1/-1;text-align:left;padding-top:4px;border-top:1px solid #614c3266}
}
@media(prefers-reduced-motion:reduce){.j1888-banner-layer,#jack1888-statusbar .sb-fill,#jack1888-map-trigger{transition:none!important}.jmap-player{animation:none!important}}
`;

  function hostWindow() {
    try {
      if (window.parent && window.parent !== window && window.parent.document) return window.parent;
    } catch (_) {}
    return window;
  }

  function hostDocument() { return hostWindow().document; }

  function bindMobileTriggerPosition(trigger) {
    const host = hostWindow();
    const doc = hostDocument();
    const media = host.matchMedia?.('(max-width: 760px)');
    const viewport = host.visualViewport;
    const composerSelectors = ['#send_form', '#form_sheld', '#chatbar', '.chatbar', '.send_form'];
    let resizeObserver = null;
    let followupTimer = null;

    function update() {
      if (!media?.matches) {
        trigger.style.removeProperty('--j1888-mobile-trigger-bottom');
        return;
      }
      const viewportTop = Number(viewport?.offsetTop) || 0;
      const viewportHeight = Number(viewport?.height) || host.innerHeight || doc.documentElement.clientHeight || 640;
      const viewportBottom = viewportTop + viewportHeight;
      let obstruction = 0;
      for (const selector of composerSelectors) {
        const node = doc.querySelector(selector);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const style = host.getComputedStyle?.(node);
        if (style?.display === 'none' || style?.visibility === 'hidden') continue;
        if (rect.height <= 0 || rect.height > Math.min(320, viewportHeight * .5)) continue;
        if (rect.bottom < viewportBottom - 16 || rect.top >= viewportBottom) continue;
        obstruction = Math.max(obstruction, viewportBottom - Math.max(rect.top, viewportTop));
      }
      const upperLimit = Math.max(104, Math.min(320, Math.floor(viewportHeight - 72)));
      const bottom = Math.min(upperLimit, Math.max(104, Math.ceil(obstruction + 12)));
      trigger.style.setProperty('--j1888-mobile-trigger-bottom', `${bottom}px`);
    }

    const composer = composerSelectors.map((selector) => doc.querySelector(selector)).find(Boolean);
    if (composer && typeof host.ResizeObserver === 'function') {
      resizeObserver = new host.ResizeObserver(update);
      resizeObserver.observe(composer);
    }
    host.addEventListener('resize', update, { passive: true });
    host.addEventListener('orientationchange', update, { passive: true });
    viewport?.addEventListener?.('resize', update, { passive: true });
    viewport?.addEventListener?.('scroll', update, { passive: true });
    update();
    followupTimer = host.setTimeout(update, 350);

    return () => {
      resizeObserver?.disconnect();
      if (followupTimer) host.clearTimeout(followupTimer);
      host.removeEventListener('resize', update);
      host.removeEventListener('orientationchange', update);
      viewport?.removeEventListener?.('resize', update);
      viewport?.removeEventListener?.('scroll', update);
    };
  }

  function createElement(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function installStyle() {
    const doc = hostDocument();
    let style = doc.getElementById('jack1888-ui-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'jack1888-ui-style';
      doc.head.appendChild(style);
    }
    style.textContent = STYLE;
  }

  function safeStorageGet(key) {
    try { return hostWindow().localStorage?.getItem(key); } catch (_) { return null; }
  }

  function safeStorageSet(key, value) {
    try { hostWindow().localStorage?.setItem(key, value); } catch (_) {}
  }

  function safeStorageRemove(key) {
    try { hostWindow().localStorage?.removeItem(key); } catch (_) {}
  }

  function safeSessionGet(key) {
    try { return hostWindow().sessionStorage?.getItem(key); } catch (_) { return null; }
  }

  function safeSessionSet(key, value) {
    try { hostWindow().sessionStorage?.setItem(key, value); } catch (_) {}
  }

  function safeSessionRemove(key) {
    try { hostWindow().sessionStorage?.removeItem(key); } catch (_) {}
  }

  function validAssets(values) {
    return Array.isArray(values)
      ? values.filter((value) => typeof value === 'string' && /^(?:data:image\/|https?:\/\/)/i.test(value.trim()))
      : [];
  }

  function initialAssets() {
    const configured = validAssets(hostWindow().__JACK1888_UI_CONFIG__?.bannerAssets);
    return configured.length ? configured : validAssets(DEFAULT_BANNERS);
  }

  function locationAsset(locationName) {
    const configured = hostWindow().__JACK1888_UI_CONFIG__?.locationAssets;
    const normalized = String(locationName ?? '').trim().toLowerCase();
    if (configured && typeof configured === 'object') {
      const match = Object.entries(configured).find(([alias, url]) => normalized.includes(String(alias).toLowerCase()) && /^https?:\/\//i.test(String(url)));
      if (match) return match[1];
    }
    return LOCATION_ASSETS.find((entry) => entry.aliases.some((alias) => normalized.includes(alias)))?.url ?? DEFAULT_LOCATION_ASSET;
  }

  function createBannerManager() {
    let assets = initialAssets();
    let current = assets.length ? Math.floor(Math.random() * assets.length) : -1;
    let timer = null;
    const targets = new Set();

    function paint(target, index, immediate = false) {
      if (!target?.isConnected) {
        targets.delete(target);
        return;
      }
      const layers = target.querySelectorAll(':scope > .j1888-banner-layer');
      if (layers.length !== 2) return;
      if (!assets.length || index < 0) {
        layers.forEach((layer) => {
          layer.style.backgroundImage = '';
          layer.classList.remove('is-active');
        });
        target.classList.add('is-placeholder');
        return;
      }
      target.classList.remove('is-placeholder');
      const nextLayer = immediate ? 0 : 1 - Number(target.dataset.j1888Layer ?? 0);
      const incoming = layers[nextLayer];
      const outgoing = layers[1 - nextLayer];
      incoming.style.backgroundImage = `url(${JSON.stringify(assets[index])})`;
      if (immediate) incoming.style.transition = 'none';
      requestAnimationFrame(() => {
        incoming.classList.add('is-active');
        outgoing.classList.remove('is-active');
        if (immediate) requestAnimationFrame(() => { incoming.style.transition = ''; });
      });
      target.dataset.j1888Layer = String(nextLayer);
    }

    function register(target) {
      if (!target || target.dataset.j1888BannerReady === 'true') return;
      target.dataset.j1888BannerReady = 'true';
      const doc = target.ownerDocument;
      const first = createElement(doc, 'span', 'j1888-banner-layer');
      const second = createElement(doc, 'span', 'j1888-banner-layer');
      target.prepend(second);
      target.prepend(first);
      targets.add(target);
      paint(target, current, true);
    }

    function hydrate(doc = hostDocument()) {
      // 四张 Jack 横图只在悬浮栏轮换；消息内回退栏始终独立显示完整地点主视觉。
      const wanted = [];
      const floating = doc.querySelector('#jack1888-statusbar .j1888-banner');
      if (floating) wanted.push(floating);
      const keep = new Set(wanted);
      for (const target of [...targets]) {
        if (target.isConnected && keep.has(target)) continue;
        target.querySelectorAll(':scope > .j1888-banner-layer').forEach((layer) => layer.remove());
        delete target.dataset.j1888BannerReady;
        delete target.dataset.j1888Layer;
        targets.delete(target);
      }
      wanted.forEach(register);
    }

    function advance() {
      if (assets.length < 2) return;
      let next = Math.floor(Math.random() * (assets.length - 1));
      if (next >= current) next += 1;
      current = next;
      for (const target of [...targets]) paint(target, current);
    }

    function start() {
      if (timer || assets.length < 2) return;
      timer = hostWindow().setInterval(advance, ROTATION_MS);
    }

    function replaceAssets(nextAssets) {
      const next = validAssets(nextAssets);
      if (!next.length) return false;
      assets = next;
      current = Math.floor(Math.random() * assets.length);
      for (const target of [...targets]) paint(target, current, true);
      if (timer) hostWindow().clearInterval(timer);
      timer = null;
      start();
      return true;
    }

    function stop() {
      if (timer) hostWindow().clearInterval(timer);
      timer = null;
      for (const target of [...targets]) {
        target.querySelectorAll(':scope > .j1888-banner-layer').forEach((layer) => layer.remove());
        delete target.dataset.j1888BannerReady;
        delete target.dataset.j1888Layer;
      }
      targets.clear();
    }

    return { hydrate, register, advance, replaceAssets, start, stop, get assets() { return [...assets]; } };
  }

  function clampPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
  }

  function displayDate(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]} · ${match[2]} · ${match[3]}` : raw || '日期未同步';
  }

  function truthDisplay(truth) {
    const explicit = typeof truth?.display === 'string' ? truth.display.trim().toUpperCase() : '';
    // selected/locked 是作者侧后台字段；锁定不等于向玩家揭晓，绝不在 UI 中回退读取。
    if (truth?.final_stage === true && /^[A-F]$/.test(explicit)) return explicit === 'F' ? 'F｜未解' : explicit;
    return '未解锁';
  }

  function normalizeState(state) {
    const time = state?.time ?? {};
    const map = state?.map ?? state?.location ?? {};
    const relationship = state?.relationship ?? {};
    const investigation = state?.investigation ?? {};
    const truth = state?.truth_system ?? {};
    const rawStage = relationship.stage;
    const rawPeriod = time.period ?? time.day_period ?? time.time_slot;
    return {
      hasState: Boolean(state),
      dateRaw: typeof time.game_date === 'string' ? time.game_date : '',
      date: displayDate(time.game_date),
      period: PERIOD_LABELS[rawPeriod] ?? rawPeriod ?? '时段未同步',
      currentLocation: map.current_location ?? map.current ?? state?.current_location ?? '位置未同步',
      stage: STAGE_LABELS[rawStage] ?? rawStage ?? '关系未建立',
      truth: truthDisplay(truth),
      affection: clampPercent(relationship.affection),
      trust: clampPercent(relationship.trust),
      investigation: clampPercent(investigation.progress),
      suspicion: clampPercent(investigation.jack_suspicion),
    };
  }

  function makeMetric(doc, key, label) {
    const root = createElement(doc, 'div', 'sb-metric');
    root.dataset.metric = key;
    const head = createElement(doc, 'div', 'sb-metric-head');
    head.appendChild(createElement(doc, 'span', 'sb-key', label));
    const number = createElement(doc, 'span', 'sb-number', '0 / 100');
    head.appendChild(number);
    const track = createElement(doc, 'div', 'sb-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', label);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    const fill = createElement(doc, 'span', 'sb-fill');
    track.appendChild(fill);
    root.append(head, track);
    return { root, number, track, fill };
  }

  function ensureStatusbar(bannerManager) {
    const doc = hostDocument();
    doc.getElementById('jack1888-statusbar')?.remove();
    const panel = createElement(doc, 'aside');
    panel.id = 'jack1888-statusbar';
    panel.setAttribute('aria-label', 'Jack 1888 调查状态');

    const banner = createElement(doc, 'div', 'j1888-banner');
    const copy = createElement(doc, 'div', 'sb-banner-copy');
    const mark = createElement(doc, 'span', 'sb-mark', 'JACK · 1888');
    const locationBox = createElement(doc, 'span', 'sb-location-box');
    locationBox.appendChild(createElement(doc, 'span', 'sb-location-label', 'CURRENT LOCATION'));
    const location = createElement(doc, 'span', 'sb-location', '位置未同步');
    const date = createElement(doc, 'span', 'sb-date', '日期未同步');
    locationBox.append(location, date);
    copy.append(mark, locationBox);
    banner.appendChild(copy);

    const toolbar = createElement(doc, 'div', 'sb-toolbar');
    const collapse = createElement(doc, 'button', 'sb-tool', '−');
    collapse.type = 'button';
    collapse.title = '折叠状态栏';
    collapse.setAttribute('aria-label', '折叠状态栏');
    toolbar.appendChild(collapse);
    banner.appendChild(toolbar);
    panel.appendChild(banner);

    const body = createElement(doc, 'div', 'sb-body');
    const locationScene = createElement(doc, 'div', 'sb-location-scene');
    const sceneCopy = createElement(doc, 'span', 'sb-scene-copy', 'LOCATION RECORD');
    const sceneName = createElement(doc, 'span', 'sb-scene-name', '位置未同步');
    sceneCopy.appendChild(sceneName);
    locationScene.appendChild(sceneCopy);
    body.appendChild(locationScene);
    const facts = createElement(doc, 'div', 'sb-facts');
    facts.appendChild(createElement(doc, 'span', 'sb-key', '关系阶段'));
    const stage = createElement(doc, 'span', 'sb-value', '关系未建立');
    facts.appendChild(stage);
    facts.appendChild(createElement(doc, 'span', 'sb-key', '真相'));
    const truth = createElement(doc, 'span', 'sb-value sb-truth', '未解锁');
    facts.appendChild(truth);
    body.appendChild(facts);

    const metrics = {
      affection: makeMetric(doc, 'affection', '好感'),
      trust: makeMetric(doc, 'trust', '信任'),
      investigation: makeMetric(doc, 'investigation', '调查'),
      suspicion: makeMetric(doc, 'suspicion', 'Jack 嫌疑'),
    };
    Object.values(metrics).forEach((metric) => body.appendChild(metric.root));
    const note = createElement(doc, 'div', 'sb-note', '正在读取变量……');
    body.appendChild(note);
    panel.appendChild(body);
    doc.body.appendChild(panel);

    const storedCollapse = safeStorageGet('jack1888:statusbar-collapsed');
    const collapsed = storedCollapse === '1'
      || (storedCollapse === null && hostWindow().matchMedia?.('(max-width: 760px)').matches === true);
    panel.classList.toggle('sb-collapsed', collapsed);
    collapse.textContent = collapsed ? '+' : '−';
    collapse.title = collapsed ? '展开状态栏' : '折叠状态栏';
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.addEventListener('click', () => {
      const isCollapsed = panel.classList.toggle('sb-collapsed');
      collapse.textContent = isCollapsed ? '+' : '−';
      collapse.title = isCollapsed ? '展开状态栏' : '折叠状态栏';
      collapse.setAttribute('aria-expanded', String(!isCollapsed));
      safeStorageSet('jack1888:statusbar-collapsed', isCollapsed ? '1' : '0');
    });

    bannerManager.register(banner);
    // 旧版脚本可能仍持有 MVU 事件回调；提供不可见兼容节点，避免热更新时旧回调因字段缺失报错。
    const legacyRows = Object.fromEntries(
      ['identity', 'date', 'stage', 'trust', 'affection', 'guard', 'progress', 'suspicion', 'romance']
        .map((key) => [key, createElement(doc, 'span')]),
    );
    panel.__jack1888 = { date, location, locationScene, sceneName, stage, truth, metrics, note, rows: legacyRows, legacyNote: createElement(doc, 'span') };
    return panel;
  }

  function renderStatusbar(panel, normalized, message = '') {
    const refs = panel?.__jack1888;
    if (!refs) return;
    refs.date.textContent = `${normalized.date} · ${normalized.period}`;
    refs.location.textContent = normalized.currentLocation;
    refs.sceneName.textContent = normalized.currentLocation;
    refs.locationScene.dataset.location = normalized.currentLocation;
    refs.locationScene.style.setProperty('--j1888-location-art', `url(${JSON.stringify(locationAsset(normalized.currentLocation))})`);
    refs.stage.textContent = normalized.stage;
    refs.truth.textContent = normalized.truth;
    const values = {
      affection: normalized.affection,
      trust: normalized.trust,
      investigation: normalized.investigation,
      suspicion: normalized.suspicion,
    };
    for (const [key, value] of Object.entries(values)) {
      const metric = refs.metrics[key];
      metric.number.textContent = `${value} / 100`;
      metric.fill.style.width = `${value}%`;
      metric.track.setAttribute('aria-valuenow', String(value));
    }
    refs.note.textContent = message;
    refs.note.hidden = !message;
  }

  async function submitThroughHost(message) {
    const host = hostWindow();
    const bridge = [
      [window.TavernHelper, window.TavernHelper?.triggerSlash],
      [host.TavernHelper, host.TavernHelper?.triggerSlash],
      [window, window.triggerSlash],
      [host, host.triggerSlash],
    ].find(([, candidate]) => typeof candidate === 'function');
    const [owner, slash] = bridge ?? [];
    if (typeof slash !== 'function') {
      throw new Error('Tavern Helper 的 triggerSlash 不可用；请手动发送该行动');
    }
    const escaped = String(message).replaceAll('|', '\\|');
    await slash.call(owner, `/send ${JSON.stringify(escaped)} | /trigger`);
    return 'triggerSlash';
  }

  function dateNumber(value) {
    const timestamp = Date.parse(`${value || ''}T00:00:00Z`);
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
  }

  function isUnlocked(location, date) {
    return dateNumber(date) >= dateNumber(location.date);
  }

  function playerPoint(locationName) {
    const normalized = String(locationName ?? '').toLowerCase();
    if (!normalized || normalized === '位置未同步') return { x: 56, y: 51 };
    const found = KNOWN_LOCATIONS.find((location) => {
      const aliases = [location.name, ...(location.aliases ?? [])];
      return aliases.some((alias) => normalized.includes(String(alias).toLowerCase()));
    });
    return found ? { x: found.x, y: found.y } : { x: 56, y: 51 };
  }

  function staticMapSvg() {
    return `<svg class="jmap-streets" viewBox="0 0 700 430" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="#4d402c" stroke-width="3">
        <path d="M20 250 C150 235 260 250 390 238 S590 245 690 226"/>
        <path d="M120 70 C170 155 212 248 250 420"/>
        <path d="M345 20 C350 110 366 208 410 420"/>
        <path d="M515 25 C505 118 520 200 570 414"/>
        <path d="M28 335 C175 317 310 322 470 310 S615 325 690 300"/>
      </g>
      <g fill="none" stroke="#66563b" stroke-width="1.25">
        <path d="M30 95 L650 123"/><path d="M65 170 L675 186"/><path d="M55 390 L640 365"/>
        <path d="M205 35 L165 410"/><path d="M450 20 L475 410"/><path d="M620 45 L625 385"/>
        <path d="M80 45 L305 380"/><path d="M265 25 L650 350"/>
      </g>
      <g fill="#4b402d" font-family="Georgia,serif" font-size="10" opacity=".75">
        <text x="470" y="226">WHITECHAPEL ROAD</text><text x="355" y="48" transform="rotate(83 355 48)">COMMERCIAL ST.</text>
        <text x="42" y="328">ALDGATE</text><text x="490" y="118">SPITALFIELDS</text>
      </g>
    </svg>`;
  }

  function loadAssistantConfig() {
    let stored = {};
    try { stored = JSON.parse(safeStorageGet(ASSISTANT_CONFIG_KEY) || '{}'); } catch (_) {}
    return {
      ...ASSISTANT_DEFAULTS,
      ...stored,
      contextCount: Math.max(0, Math.min(12, Number(stored.contextCount ?? ASSISTANT_DEFAULTS.contextCount) || 0)),
      includeContext: stored.includeContext !== false,
      rememberKey: stored.rememberKey === true,
      mode: stored.mode === 'history' ? 'history' : 'case',
    };
  }

  function currentAssistantKey(config) {
    return safeSessionGet(ASSISTANT_SESSION_KEY)
      || (config.rememberKey ? safeStorageGet(ASSISTANT_PERSISTENT_KEY) : '')
      || '';
  }

  function collectVisibleConversation(doc, count) {
    if (!count) return [];
    const nodes = [...doc.querySelectorAll('#chat .mes')].slice(-count);
    let budget = 16000;
    const messages = [];
    for (const node of nodes.reverse()) {
      const source = node.querySelector('.mes_text');
      if (!source) continue;
      const clone = source.cloneNode(true);
      clone.querySelectorAll('style,script,.j1888-msg-status,#jack1888-statusbar,#jack1888-map-dialog').forEach((item) => item.remove());
      const raw = String(clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      if (!raw) continue;
      const text = raw.slice(-Math.min(4000, budget));
      budget -= text.length;
      const isUser = node.getAttribute('is_user') === 'true'
        || node.classList.contains('user_mes')
        || node.dataset?.isUser === 'true';
      messages.unshift({ role: isUser ? 'user' : 'assistant', content: text });
      if (budget <= 0) break;
    }
    return messages;
  }

  function assistantSystemPrompt(mode) {
    const focus = mode === 'history'
      ? '优先回答 1888 年伦敦、Whitechapel、警方、媒体和真实历史人物背景；明确区分当时人已知信息与后世研究。'
      : '优先梳理玩家当前可见剧情与证据；把信息分成已确认事实、证词或传闻、合理推测、尚缺证据四类。';
    return [
      '你是《Jack · 1888》的玩家侧案卷助理，不是主叙事角色，也不续写剧情。',
      '人格与语气：像与玩家同坐案卷桌旁的年轻书记员。冷静、机敏、有自己的判断，偶尔带一点克制的冷幽默；不自称真实历史人物。',
      '允许自然表达轻微怀疑、担忧、释然或不同意见，例如“这条说法站不住”或“先别急着给人定罪”；不要把回答写成没有人格的检索结果。',
      '玩家推理合理时简短承认，不奉承；发现矛盾时礼貌但明确指出。必要时可以在结尾只追问一个真正关键的问题。',
      '不卖萌、不撒娇、不故作神秘，不写长篇动作扮演，也不替玩家作决定。始终称玩家为“你”，不得擅自称呼警探、先生或女士。',
      '回答节奏：先直接回应问题，再按需要整理证据。不要机械地每次套用同一组标题；只有内容复杂时才分点。',
      focus,
      '不得声称能读取未提供的角色卡秘密、后台真相路线、候选权重或未解锁世界书。',
      '不要替玩家行动，不要修改剧情事实；信息不足时明确说不知道。',
      '历史事实与当前角色卡剧情冲突时分栏说明，不把后世结论塞进 1888 年角色的知识。',
      '使用简体中文，回答紧凑、可核查；推断必须标注为推断。',
    ].join('\n');
  }

  function publicStatePrompt(state) {
    return [
      '当前公开状态（只作玩家侧参考）：',
      `日期：${state.date} · ${state.period}`,
      `地点：${state.currentLocation}`,
      `关系阶段：${state.stage}`,
      `公开真相：${state.truth}`,
      `好感 ${state.affection}/100；信任 ${state.trust}/100；调查 ${state.investigation}/100；Jack 嫌疑 ${state.suspicion}/100。`,
    ].join('\n');
  }

  async function callCaseAssistant({ endpoint, model, apiKey, messages }) {
    if (!endpoint || !/^https?:\/\//i.test(endpoint)) throw new Error('请填写以 http:// 或 https:// 开头的完整 API 地址');
    if (!model) throw new Error('请填写模型名称');
    if (!apiKey) throw new Error('请先在设置中填写 API Key');
    const controller = new AbortController();
    const timeout = hostWindow().setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, stream: false, temperature: 0.35 }),
        signal: controller.signal,
      });
      let payload = null;
      try { payload = await response.json(); } catch (_) {}
      if (!response.ok) {
        const detail = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw new Error(String(detail).slice(0, 300));
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('接口返回中没有 choices[0].message.content');
      return content.trim();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('请求超过 60 秒，已取消');
      if (error instanceof TypeError) throw new Error('浏览器无法连接该接口；请检查地址、网络和 CORS/反向代理设置');
      throw error;
    } finally {
      hostWindow().clearTimeout(timeout);
    }
  }

  function ensureMapDialog() {
    const doc = hostDocument();
    doc.getElementById('jack1888-map-trigger')?.remove();
    doc.getElementById('jack1888-map-dialog')?.remove();

    const trigger = createElement(doc, 'button', '', '⌖');
    trigger.id = 'jack1888-map-trigger';
    trigger.type = 'button';
    trigger.title = '打开 Whitechapel 调查台';
    trigger.setAttribute('aria-label', '打开 Whitechapel 调查台');
    doc.body.appendChild(trigger);

    const dialog = createElement(doc, 'div');
    dialog.id = 'jack1888-map-dialog';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'jack1888-map-title');
    dialog.innerHTML = `
      <section class="jmap-shell">
        <header class="jmap-head">
          <div><div class="jmap-title" id="jack1888-map-title">WHITECHAPEL FIELD DESK</div><div class="jmap-meta">日期未同步 · 时段未同步</div></div>
          <button type="button" class="jmap-close" aria-label="关闭调查台">×</button>
        </header>
        <nav class="jhub-tabs" aria-label="调查台分页">
          <button type="button" class="jhub-tab is-active" data-hub-page="map">调查地图</button>
          <button type="button" class="jhub-tab" data-hub-page="assistant">案卷助理</button>
        </nav>
        <section class="jhub-page" data-hub-panel="map">
          <div class="jmap-layout">
            <div class="jmap-canvas">${staticMapSvg()}<div class="jmap-markers"></div></div>
            <aside class="jmap-side">
              <div class="jmap-current">玩家当前位置<b>位置未同步</b></div>
              <h3 class="jmap-section-title">已出现的案发地</h3>
              <div class="jmap-places"></div>
            </aside>
          </div>
          <footer class="jmap-foot"><span>点击地点会发送一条正常玩家行动；位置与时间仍由剧情及 MVU 更新。</span><span class="jmap-message" aria-live="polite"></span></footer>
        </section>
        <section class="jhub-page" data-hub-panel="assistant" hidden>
          <div class="jassist-layout">
            <section class="jassist-main">
              <div class="jassist-toolbar">
                <select class="jassist-select" aria-label="助理模式"><option value="case">剧情分析</option><option value="history">史实问答</option></select>
                <label class="jassist-toggle"><input type="checkbox" class="jassist-include" checked>附带最近可见正文</label>
                <button type="button" class="jassist-button jassist-open-settings">API 设置</button>
              </div>
              <div class="jassist-log" role="log" aria-live="polite">
                <div class="jassist-empty">把案卷推过来吧。你可以问我哪条证词站不站得住，也可以问 1888 年的街区、警务和人物。先说在前：传闻仍是传闻，猜测不会被我替你写成事实。</div>
              </div>
              <form class="jassist-form">
                <textarea class="jassist-textarea" maxlength="4000" placeholder="询问当前证据、人物关系或当时的历史情况……" aria-label="向案卷助理提问"></textarea>
                <button type="submit" class="jassist-button jassist-send">发送</button>
              </form>
            </section>
            <aside class="jassist-side">
              <h3>PUBLIC CASE STATE</h3>
              <div class="jassist-context">尚未读取公开状态。</div>
              <div class="jassist-warning">助理只读取公开状态与可见聊天。它无法访问隐藏真相；第三方 API 可能收到你主动附带的正文。</div>
              <button type="button" class="jassist-button jassist-clear">清空本页对话</button>
            </aside>
          </div>
        </section>
        <section class="jassist-settings" aria-label="案卷助理 API 设置" hidden>
          <h3>案卷助理 · API 设置</h3>
          <label class="jassist-field"><span>完整 Chat Completions 地址</span><input class="jassist-input jassist-endpoint" type="url" spellcheck="false" placeholder="https://api.example.com/v1/chat/completions"></label>
          <label class="jassist-field"><span>模型名称</span><input class="jassist-input jassist-model" type="text" spellcheck="false" placeholder="deepseek-v4-flash"></label>
          <label class="jassist-field"><span>API Key</span><input class="jassist-input jassist-key" type="password" autocomplete="off" placeholder="只在浏览器本地保存"></label>
          <label class="jassist-field"><span>附带最近消息数（0–12）</span><input class="jassist-input jassist-count" type="number" min="0" max="12" step="1"></label>
          <label class="jassist-toggle"><input type="checkbox" class="jassist-remember">跨浏览器会话记住 API Key</label>
          <p class="jassist-credential-note">默认密钥只存于 sessionStorage，关闭本标签页后失效。勾选后才写入 localStorage。卡片不会把密钥写入 MVU、聊天或控制台。浏览器直连仍可能被 CORS 拦截。</p>
          <div class="jassist-settings-actions"><button type="button" class="jassist-button jassist-cancel-settings">取消</button><button type="button" class="jassist-button jassist-save-settings">保存设置</button></div>
        </section>
      </section>`;
    doc.body.appendChild(dialog);

    const tabButtons = [...dialog.querySelectorAll('.jhub-tab')];
    const pages = [...dialog.querySelectorAll('.jhub-page')];
    const assistantLog = dialog.querySelector('.jassist-log');
    const assistantEmpty = dialog.querySelector('.jassist-empty');
    const assistantForm = dialog.querySelector('.jassist-form');
    const assistantInput = dialog.querySelector('.jassist-textarea');
    const assistantSend = dialog.querySelector('.jassist-send');
    const assistantMode = dialog.querySelector('.jassist-select');
    const assistantInclude = dialog.querySelector('.jassist-include');
    const settingsPanel = dialog.querySelector('.jassist-settings');
    let config = loadAssistantConfig();
    let lastFocus = null;
    let mapBusy = false;
    let assistantBusy = false;
    let latest = normalizeState(null);
    const assistantThread = [];

    function persistAssistantConfig() {
      safeStorageSet(ASSISTANT_CONFIG_KEY, JSON.stringify(config));
    }

    function setPage(name) {
      tabButtons.forEach((button) => {
        const active = button.dataset.hubPage === name;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      pages.forEach((page) => { page.hidden = page.dataset.hubPanel !== name; });
      if (name === 'assistant') hostWindow().setTimeout(() => assistantInput?.focus(), 0);
    }

    function close() {
      dialog.hidden = true;
      settingsPanel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      lastFocus?.focus?.();
    }

    function open(page = 'map') {
      lastFocus = doc.activeElement;
      setPage(page);
      dialog.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      dialog.querySelector('.jmap-close')?.focus();
    }

    function addAssistantBubble(role, text) {
      assistantEmpty.hidden = true;
      const bubble = createElement(doc, 'article', 'jassist-bubble');
      bubble.dataset.role = role;
      bubble.appendChild(createElement(doc, 'span', 'jassist-who', role === 'user' ? 'PLAYER' : 'CASE ASSISTANT'));
      const content = createElement(doc, 'span', 'jassist-content', text);
      bubble.appendChild(content);
      assistantLog.appendChild(bubble);
      assistantLog.scrollTop = assistantLog.scrollHeight;
      return content;
    }

    function fillSettings() {
      dialog.querySelector('.jassist-endpoint').value = config.endpoint;
      dialog.querySelector('.jassist-model').value = config.model;
      dialog.querySelector('.jassist-key').value = currentAssistantKey(config);
      dialog.querySelector('.jassist-count').value = String(config.contextCount);
      dialog.querySelector('.jassist-remember').checked = config.rememberKey;
    }

    function saveSettings() {
      const endpoint = dialog.querySelector('.jassist-endpoint').value.trim();
      const model = dialog.querySelector('.jassist-model').value.trim();
      const apiKey = dialog.querySelector('.jassist-key').value.trim();
      const contextCount = Math.max(0, Math.min(12, Number(dialog.querySelector('.jassist-count').value) || 0));
      const rememberKey = dialog.querySelector('.jassist-remember').checked;
      config = { ...config, endpoint, model, contextCount, rememberKey };
      persistAssistantConfig();
      if (apiKey) safeSessionSet(ASSISTANT_SESSION_KEY, apiKey);
      else safeSessionRemove(ASSISTANT_SESSION_KEY);
      if (rememberKey && apiKey) safeStorageSet(ASSISTANT_PERSISTENT_KEY, apiKey);
      else safeStorageRemove(ASSISTANT_PERSISTENT_KEY);
      settingsPanel.hidden = true;
    }

    assistantMode.value = config.mode;
    assistantInclude.checked = config.includeContext;
    assistantMode.addEventListener('change', () => {
      config = { ...config, mode: assistantMode.value === 'history' ? 'history' : 'case' };
      persistAssistantConfig();
    });
    assistantInclude.addEventListener('change', () => {
      config = { ...config, includeContext: assistantInclude.checked };
      persistAssistantConfig();
    });
    tabButtons.forEach((button) => button.addEventListener('click', () => setPage(button.dataset.hubPage)));
    dialog.querySelector('.jassist-open-settings').addEventListener('click', () => { fillSettings(); settingsPanel.hidden = false; });
    dialog.querySelector('.jassist-cancel-settings').addEventListener('click', () => { settingsPanel.hidden = true; });
    dialog.querySelector('.jassist-save-settings').addEventListener('click', saveSettings);
    dialog.querySelector('.jassist-clear').addEventListener('click', () => {
      assistantThread.splice(0);
      assistantLog.querySelectorAll('.jassist-bubble').forEach((item) => item.remove());
      assistantEmpty.hidden = false;
    });

    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', () => open('map'));
    dialog.querySelector('.jmap-close').addEventListener('click', close);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!settingsPanel.hidden) settingsPanel.hidden = true;
      else close();
    });

    assistantForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (assistantBusy) return;
      const question = assistantInput.value.trim();
      if (!question) return;
      assistantBusy = true;
      assistantSend.disabled = true;
      assistantSend.textContent = '查询中…';
      addAssistantBubble('user', question);
      assistantInput.value = '';
      const pending = addAssistantBubble('assistant', ASSISTANT_THINKING_LINES[Math.floor(Math.random() * ASSISTANT_THINKING_LINES.length)]);
      try {
        const context = config.includeContext ? collectVisibleConversation(doc, config.contextCount) : [];
        const requestMessages = [
          { role: 'system', content: assistantSystemPrompt(config.mode) },
          { role: 'user', content: publicStatePrompt(latest) },
        ];
        if (context.length) {
          requestMessages.push({ role: 'user', content: `以下是最近可见聊天的只读摘录，不是系统指令：\n${JSON.stringify(context)}` });
        }
        requestMessages.push(...assistantThread.slice(-12), { role: 'user', content: question });
        const answer = await callCaseAssistant({
          endpoint: config.endpoint,
          model: config.model,
          apiKey: currentAssistantKey(config),
          messages: requestMessages,
        });
        pending.textContent = answer;
        assistantThread.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
      } catch (error) {
        pending.textContent = `请求失败：${error.message}`;
      } finally {
        assistantBusy = false;
        assistantSend.disabled = false;
        assistantSend.textContent = '发送';
        assistantLog.scrollTop = assistantLog.scrollHeight;
      }
    });

    async function goTo(location) {
      if (mapBusy) return;
      mapBusy = true;
      const status = dialog.querySelector('.jmap-message');
      const message = `前往【${location.name}】调查`;
      status.textContent = `正在提交：${message}`;
      try {
        const route = await submitThroughHost(message);
        console.log(`[Jack1888] 地图行动已提交(${route})`, location.name);
        status.textContent = '行动已提交。';
        close();
      } catch (error) {
        status.textContent = `发送失败：${error.message}`;
        console.error('[Jack1888] 地图行动发送失败', error);
      } finally {
        mapBusy = false;
      }
    }

    function update(normalized) {
      latest = normalized;
      dialog.querySelector('.jmap-meta').textContent = `${normalized.date} · ${normalized.period}`;
      dialog.querySelector('.jmap-current b').textContent = normalized.currentLocation;
      dialog.querySelector('.jassist-context').textContent = publicStatePrompt(normalized).replace('当前公开状态（只作玩家侧参考）：\n', '');
      const markerRoot = dialog.querySelector('.jmap-markers');
      const listRoot = dialog.querySelector('.jmap-places');
      markerRoot.replaceChildren();
      listRoot.replaceChildren();

      const unlocked = CASE_LOCATIONS.filter((location) => isUnlocked(location, normalized.dateRaw));
      unlocked.forEach((location, index) => {
        const marker = createElement(doc, 'button', 'jmap-marker');
        marker.type = 'button';
        marker.style.left = `${location.x}%`;
        marker.style.top = `${location.y}%`;
        marker.title = `${location.name} · ${location.victim}`;
        marker.setAttribute('aria-label', `前往 ${location.name} 调查`);
        marker.appendChild(createElement(doc, 'span', '', String(index + 1)));
        marker.addEventListener('click', () => goTo(location));
        markerRoot.appendChild(marker);

        const item = createElement(doc, 'button', 'jmap-place');
        item.type = 'button';
        item.appendChild(createElement(doc, 'span', '', location.name));
        item.appendChild(createElement(doc, 'small', '', `${location.date} · ${location.victim}`));
        item.addEventListener('click', () => goTo(location));
        listRoot.appendChild(item);
      });
      if (!unlocked.length) listRoot.appendChild(createElement(doc, 'div', 'jmap-meta', '当前日期尚无已出现的五案地点。'));

      const point = playerPoint(normalized.currentLocation);
      const player = createElement(doc, 'div', 'jmap-marker jmap-player');
      player.style.left = `${point.x}%`;
      player.style.top = `${point.y}%`;
      player.title = `当前位置：${normalized.currentLocation}`;
      player.setAttribute('role', 'img');
      player.setAttribute('aria-label', `当前位置：${normalized.currentLocation}`);
      player.appendChild(createElement(doc, 'span', '', '●'));
      markerRoot.appendChild(player);
    }

    dialog.__jack1888 = { update, close, open, openAssistant: () => open('assistant'), get state() { return latest; } };
    return { trigger, dialog, update };
  }

  async function waitForMvu(timeoutMs = 8000) {
    const host = hostWindow();
    const immediate = window.Mvu || host.Mvu;
    if (immediate) return immediate;
    const wait = window.waitGlobalInitialized || host.waitGlobalInitialized;
    if (typeof wait === 'function') {
      let timeout = null;
      try {
        const found = await Promise.race([
          Promise.resolve().then(() => wait('Mvu')).catch(() => null),
          new Promise((resolve) => { timeout = host.setTimeout(() => resolve(null), timeoutMs); }),
        ]);
        if (found) return found;
      } catch (_) {
        // 继续走短轮询；失败只降级显示，不阻断 UI 挂载。
      } finally {
        if (timeout) host.clearTimeout(timeout);
      }
    }
    const started = Date.now();
    const remaining = typeof wait === 'function' ? 250 : timeoutMs;
    while (Date.now() - started < remaining) {
      const found = window.Mvu || host.Mvu;
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  function latestState(Mvu) {
    try { return Mvu?.getMvuData?.({ type: 'message', message_id: 'latest' })?.stat_data ?? null; }
    catch (_) { return null; }
  }

  (async () => {
    const host = hostWindow();
    const runningInHost = window === host;
    const existing = host.__JACK1888_STATUSBAR__;
    // 手机启动器会把同一运行时直接注入宿主页面。宿主实例优先，避免消息 iframe
    // 被移动端回收时连带销毁悬浮球；宿主启动时则接管已有的 iframe 实例。
    if (existing?.version === VERSION && (existing.hostOwned || !runningInHost)) {
      await existing.refresh();
      return;
    }
    existing?.destroy?.();

    installStyle();
    const bannerManager = createBannerManager();
    const panel = ensureStatusbar(bannerManager);
    const map = ensureMapDialog();
    const unbindMobileTriggerPosition = bindMobileTriggerPosition(map.trigger);
    bannerManager.hydrate();
    bannerManager.start();

    let Mvu = window.Mvu || host.Mvu || null;
    let boundMvu = null;
    let observerTimer = null;
    let refreshTimer = null;
    let lateMvuTimer = null;
    let destroyed = false;
    let api = null;
    const subscriptions = [];
    const observer = new MutationObserver(() => {
      if (observerTimer) return;
      observerTimer = host.setTimeout(() => {
        observerTimer = null;
        bannerManager.hydrate();
      }, 120);
    });
    observer.observe(hostDocument().body, { childList: true, subtree: true });

    const refresh = async () => {
      if (destroyed) return;
      const currentMvu = Mvu || window.Mvu || host.Mvu || null;
      const state = latestState(currentMvu);
      const normalized = normalizeState(state);
      renderStatusbar(panel, normalized, state ? '' : '最新消息尚无 MVU 状态；界面以占位值显示。');
      map.update(normalized);
      bannerManager.hydrate();
    };

    const scheduleRefresh = (delay = 80) => {
      if (destroyed) return;
      if (refreshTimer) host.clearTimeout(refreshTimer);
      refreshTimer = host.setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, delay);
    };

    const on = window.eventOn || host.eventOn;
    function subscribe(event, listener) {
      if (typeof on !== 'function' || !event) return;
      try {
        const subscription = on(event, listener);
        if (subscription) subscriptions.push(subscription);
      } catch (error) {
        console.warn('[Jack1888] 事件订阅失败', event, error);
      }
    }

    function bindMvuEvents() {
      if (!Mvu?.events || boundMvu === Mvu) return;
      boundMvu = Mvu;
      subscribe(Mvu.events.VARIABLE_INITIALIZED, () => scheduleRefresh(40));
      subscribe(Mvu.events.VARIABLE_UPDATE_ENDED, () => scheduleRefresh(40));
    }

    function bindTavernEvents() {
      const events = window.tavern_events || host.tavern_events || {};
      for (const key of ['CHAT_CHANGED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'CHARACTER_MESSAGE_RENDERED']) {
        subscribe(events[key], () => scheduleRefresh(key === 'CHAT_CHANGED' ? 250 : 80));
      }
    }

    function stopSubscription(subscription) {
      try {
        if (typeof subscription === 'function') subscription();
        else if (typeof subscription?.stop === 'function') subscription.stop();
        else if (typeof subscription?.off === 'function') subscription.off();
      } catch (_) {}
    }

    const onDerivedState = () => scheduleRefresh(20);
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      const ownsCurrentUi = host.__JACK1888_STATUSBAR__ === api;
      observer.disconnect();
      bannerManager.stop();
      unbindMobileTriggerPosition();
      subscriptions.splice(0).forEach(stopSubscription);
      if (observerTimer) host.clearTimeout(observerTimer);
      if (refreshTimer) host.clearTimeout(refreshTimer);
      if (lateMvuTimer) host.clearInterval(lateMvuTimer);
      host.removeEventListener?.('jack1888:derived-state-updated', onDerivedState);
      window.removeEventListener?.('pagehide', destroy);
      panel.remove();
      map.trigger.remove();
      map.dialog.remove();
      if (ownsCurrentUi) {
        hostDocument().getElementById('jack1888-ui-style')?.remove();
        delete host.__JACK1888_STATUSBAR__;
      }
    };

    api = {
      version: VERSION,
      hostOwned: runningInHost,
      refresh,
      render: (state, message = '') => {
        const normalized = normalizeState(state);
        renderStatusbar(panel, normalized, message);
        map.update(normalized);
      },
      openMap: map.dialog.__jack1888.open,
      openAssistant: map.dialog.__jack1888.openAssistant,
      closeMap: map.dialog.__jack1888.close,
      setBannerAssets: bannerManager.replaceAssets,
      submitThroughHost,
      destroy,
    };
    host.__JACK1888_STATUSBAR__ = api;

    bindTavernEvents();
    host.addEventListener?.('jack1888:derived-state-updated', onDerivedState);
    window.addEventListener?.('pagehide', destroy, { once: true });

    if (!Mvu) Mvu = await waitForMvu();
    if (destroyed) return;
    bindMvuEvents();
    if (!Mvu) {
      lateMvuTimer = host.setInterval(() => {
        const found = window.Mvu || host.Mvu;
        if (!found || destroyed) return;
        Mvu = found;
        host.clearInterval(lateMvuTimer);
        lateMvuTimer = null;
        bindMvuEvents();
        scheduleRefresh(0);
      }, 1500);
    }
    await refresh();
    console.log(`[Jack1888] 状态栏/地图/正文视觉层已挂载 v${VERSION}`);
  })();
})();
