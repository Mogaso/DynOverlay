<?php
/* /custom-map/map.php */
session_start();
if (!isset($_SESSION['user'])) { header('Location: index.php'); exit; }
$user = $_SESSION['user'];

$DATA_FILE = __DIR__ . '/data/user.json';
if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0775, true);
if (!file_exists($DATA_FILE)) file_put_contents($DATA_FILE, json_encode(new stdClass(), JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));

/* Simple JSON API for autosave/load */
if (isset($_GET['api'])) {
  header('Content-Type: application/json; charset=utf-8');
  $db = json_decode(file_get_contents($DATA_FILE), true) ?? [];
  if ($_GET['api']==='load') {
    echo json_encode($db[$user] ?? [
      'updatedAt'=>time(),'zoom'=>2,'pan'=>['x'=>0,'y'=>0],'baseBPP'=>1,'baseZoom'=>2,'shapes'=>[]
    ], JSON_UNESCAPED_SLASHES);
    exit;
  }
  if ($_GET['api']==='save' && $_SERVER['REQUEST_METHOD']==='POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $db[$user] = [
      'updatedAt'=>time(),
      'zoom'     => (int)($body['zoom']??2),
      'pan'      => ['x'=>(float)($body['pan']['x']??0), 'y'=>(float)($body['pan']['y']??0)],
      'baseBPP'  => (float)($body['baseBPP']??1),
      'baseZoom' => (float)($body['baseZoom']??2),
      'shapes'   => $body['shapes']??[],
    ];
    file_put_contents($DATA_FILE, json_encode($db, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
    echo '{"ok":true}';
    exit;
  }
  http_response_code(400); echo '{"ok":false}'; exit;
}

/* Set your Dynmap URL here */
$dynmap = 'https://...;surface;-1,64,-1;2';
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>DynOverlay • Karte</title>

<link rel="stylesheet" href="/custom-map/style.css">

<!-- PWA -->
<link rel="manifest" href="/custom-map/manifest.webmanifest">
<meta name="theme-color" content="#0b0f14">

<!-- iOS PWA -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="DynOverlay">
<link rel="apple-touch-icon" sizes="180x180" href="/custom-map/img/ios/180.png">
<link rel="apple-touch-icon" sizes="152x152" href="/custom-map/img/ios/152.png">
<link rel="apple-touch-icon" sizes="120x120" href="/custom-map/img/ios/120.png">

<!-- Favicons -->
<link rel="icon" type="image/png" sizes="32x32" href="/custom-map/img/ios/32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/custom-map/img/ios/16.png">

<style>
iframe.map { pointer-events:auto !important; }
#overlay   { pointer-events:none !important; }
#shield    { pointer-events:none !important; }
body.editing iframe.map { pointer-events:none !important; }
body.editing #overlay   { pointer-events:auto !important; }
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="left">
      <button id="btnMenu" class="btn ghost">☰</button>
      <span class="badge">User: <?=htmlspecialchars($user)?></span>
    </div>
    <div class="middle">
      <div class="seg zseg">
        <button id="zoomOut" title="Zoom -">−</button>
        <button id="zoomIn"  title="Zoom +">+</button>
      </div>
      <span class="zmeta" id="zoomInfo">Zoom: 2 • Maßstab: 1.0000 Blöcke/px</span>
    </div>
    <div class="right">
      <button class="btn ghost cal" id="calibrate">🎯 Kalibrieren</button>
      <button class="btn ghost" id="btnSave">💾 Speichern</button>
      <a class="btn ghost" href="/custom-map/index.php">← Nutzer wechseln</a>
    </div>
  </div>

  <aside id="side" class="side">
    <div class="side-head">
      <h3>Panel</h3>
      <button id="closeSide" class="btn ghost">✕</button>
    </div>
    <div class="tabs">
      <button data-tab="objects" class="active">Objekte</button>
      <button data-tab="props">Eigenschaften</button>
      <button data-tab="help">Hilfe</button>
      <button data-tab="cal">Kalibrieren</button>
    </div>

    <div class="tab" id="tab-objects">
      <div id="objList" class="list"></div>
    </div>

    <div class="tab hide" id="tab-props">
      <div class="props">
        <div class="field full"><label>Name</label><input id="p_name" placeholder="optional"></div>
        <div class="field"><label>Linie</label><input id="p_stroke" type="color" value="#dc3545"></div>
        <div class="field"><label>Füllung</label><input id="p_fill" type="color" value="#dc3545"></div>
        <div class="field"><label>Strich</label><input id="p_width" type="number" value="3" min="0" step="1"></div>
        <div class="field"><label>Deckung</label><input id="p_op" type="range" min="0" max="1" step="0.05" value="0.15"></div>
        <div class="field"><label>Rotation</label><input id="p_rot" type="number" value="0" step="1"></div>
        <div class="field"><label>Lock</label><input id="p_lock" type="checkbox"></div>
        <div class="field"><label>Hide</label><input id="p_hide" type="checkbox"></div>
        <div class="row-inline full">
          <button class="btn" id="toFront">Nach vorn</button>
          <button class="btn" id="toBack">Nach hinten</button>
        </div>
      </div>
    </div>

    <div class="tab hide" id="tab-help">
      <div class="help">
        <h4>Shortcuts</h4>
        <ul>
          <li>Strg+Z / Strg+Y – Rückgängig / Wiederholen</li>
          <li>Entf – Löschen</li>
          <li>Pfeile (Shift = 10px) – Bewegen</li>
          <li>+ / − Buttons – Zoom</li>
        </ul>
        <p>Map-Modus: Dynmap normal benutzen. Bearbeiten-Modus: Map „eingefroren“, Overlay bearbeitbar.</p>
      </div>
    </div>

    <div class="tab hide" id="tab-cal">
      <div class="cal">
        <p>Wähle eine Linie aus und gib die Blocklänge ein, um den Maßstab zu kalibrieren.</p>
        <div class="row-inline">
          <input id="calBlocks" type="number" min="1" step="1" placeholder="Blöcke">
          <button id="doCal" class="btn primary">🎯 Kalibrieren</button>
        </div>
      </div>
    </div>
  </aside>

  <div id="viewport" class="viewport">
    <iframe id="dynmap" class="map" src="<?=htmlspecialchars($dynmap)?>" referrerpolicy="no-referrer"></iframe>
    <canvas class="grid" id="grid" aria-hidden="true"></canvas>
    <canvas class="chunkgrid" id="chunkgrid" aria-hidden="true"></canvas>
    <div id="overlay" class="overlay"></div>
    <div id="shield" class="shield" aria-hidden="true"></div>
  </div>

  <div class="toolbar" id="toolbar">
    <div class="seg" id="modeSeg">
      <button id="modeEdit">✏️ Bearbeiten</button>
      <button id="modeMap" class="active">🖱️ Map</button>
    </div>
    <div class="seg" id="toolSeg">
      <button data-tool="select" class="active">🖐️ Auswahl</button>
      <button data-tool="rect">⬛ Viereck</button>
      <button data-tool="circle">⚪ Kreis</button>
      <button data-tool="text">🔤 Text</button>
      <button data-tool="measure">📏 Messen</button>
      <button data-tool="line">〰️ Linie</button>
    </div>
    <div class="seg">
      <button id="undoBtn">↶</button>
      <button id="redoBtn">↷</button>
    </div>
    <div class="group">
      <label class="chk"><input id="gridToggle" type="checkbox"> Raster</label>
      <label class="chk"><input id="chunkToggle" type="checkbox"> Chunks</label>
      <label>G:</label><input id="gridSize" type="number" min="1" value="8">
    </div>
    <button class="btn" id="exportPng">🖼️ PNG</button>
    <button class="btn danger" id="clearAll">🗑️</button>
    <button class="btn" id="openSide">☰ Panel</button>
  </div>
</div>

<script>
  window.APP_USER = <?=json_encode($user)?>;
  window.API = { load: '/custom-map/map.php?api=load', save: '/custom-map/map.php?api=save' };
  window.DYNMAP_URL = <?=json_encode($dynmap)?>;
</script>
<script src="/custom-map/script.js"></script>
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/custom-map/sw.js', { scope: '/custom-map/' }).catch(()=>{});
}
(function(){
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('standalone');
})();
/* Ensure pointer-events toggle matches mode */
(function(){
  function applyMode(edit){
    document.body.classList.toggle('editing', !!edit);
    const map     = document.querySelector('iframe.map');
    const overlay = document.getElementById('overlay');
    const shield  = document.getElementById('shield');
    if (edit) {
      if (map)     map.style.pointerEvents     = 'none';
      if (overlay) overlay.style.pointerEvents = 'auto';
      if (shield)  shield.style.pointerEvents  = 'none';
    } else {
      if (map)     map.style.pointerEvents     = 'auto';
      if (overlay) overlay.style.pointerEvents = 'none';
      if (shield)  shield.style.pointerEvents  = 'none';
    }
  }
  const wrap = ()=>{
    if (typeof window.setMode === 'function') {
      const orig = window.setMode;
      window.setMode = (edit)=>{ try{orig(edit);}catch(e){} applyMode(edit); };
    } else {
      window.setMode = (edit)=>applyMode(edit);
    }
    window.setMode(false);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap); else wrap();
})();
</script>
</body>
</html>
