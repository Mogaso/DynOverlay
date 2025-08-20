<?php
// map.php
session_start();
if (!isset($_SESSION['user'])) { header('Location: index.php'); exit; }
$user = $_SESSION['user'];

$DATA_FILE = __DIR__ . '/data/user.json';
if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0775, true);
if (!file_exists($DATA_FILE)) file_put_contents($DATA_FILE, json_encode(new stdClass(), JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));

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

if (isset($_GET['manifest'])) {
  header('Content-Type: application/manifest+json; charset=utf-8');
  echo json_encode([
    "name"=>"DynOverlay","short_name"=>"DynOverlay","id"=>"./","start_url"=>"./index.php",
    "display"=>"standalone","background_color"=>"#0b0f14","theme_color"=>"#0b0f14",
    "icons"=>[["src"=>"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='64' fill='%230b0f14'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' font-size='240' fill='%23ffffff' font-family='Arial,Helvetica,sans-serif'%3E%F0%9F%97%BA%EF%B8%8F%3C/text%3E%3C/svg%3E","sizes"=>"512x512","type"=>"image/svg+xml","purpose"=>"any maskable"]]
  ], JSON_UNESCAPED_SLASHES); exit;
}
if (isset($_GET['sw'])) { header('Content-Type: application/javascript; charset=utf-8'); ?>
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>self.clients.claim());
self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>new Response('',{status:504}))));
<?php exit; }

$dynmap = 'https://...;surface;-1,64,-1;2';
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>DynOverlay • Karte</title>
<link rel="stylesheet" href="style.css">
<style>
iframe.map { pointer-events:auto !important; }
#overlay   { pointer-events:none !important; }
#shield    { pointer-events:none !important; }

body.editing iframe.map { pointer-events:none !important; }
body.editing #overlay   { pointer-events:auto !important; }
/* shield bleibt auch im Edit-Modus auf none */
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
      <a class="btn ghost" href="index.php">← Nutzer wechseln</a>
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
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('map.php?sw=1').catch(()=>{}); }
  window.APP_USER = <?=json_encode($user)?>;
  window.API = { load: 'map.php?api=load', save: 'map.php?api=save' };
  window.DYNMAP_URL = <?=json_encode($dynmap)?>;
</script>
<script src="script.js"></script>
<script>
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

  function initCal(){
    const btnCal = document.getElementById('calibrate');
    if (!btnCal) return;
    btnCal.addEventListener('click', ()=>{
      document.getElementById('side')?.classList.add('open');
      document.querySelectorAll('.tabs > button').forEach(b=>b.classList.toggle('active', b.dataset.tab==='cal'));
      document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('hide', t.id!=='tab-cal'));
      setTimeout(()=>document.getElementById('calBlocks')?.focus(), 50);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCal); else initCal();
})();
</script>
</body>
</html>
