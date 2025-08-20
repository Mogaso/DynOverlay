<?php
// index.php
session_start();
$DATA_FILE = __DIR__ . '/data/user.json';
if (!is_dir(__DIR__ . '/data')) { mkdir(__DIR__ . '/data', 0775, true); }
if (!file_exists($DATA_FILE)) { file_put_contents($DATA_FILE, json_encode(new stdClass(), JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)); }

if ($_SERVER['REQUEST_METHOD']==='POST') {
  $name = trim($_POST['username'] ?? '');
  $name = preg_replace('~[^a-zA-Z0-9_\-\.]~','',$name);
  if ($name==='') { header('Location: index.php?e=1'); exit; }
  $_SESSION['user'] = $name;

  $db = json_decode(file_get_contents($DATA_FILE), true) ?? [];
  if (!isset($db[$name])) {
    $db[$name] = [
      'updatedAt' => time(),
      'zoom'      => 2,
      'pan'       => ['x'=>0,'y'=>0],
      'baseBPP'   => 1.0,
      'baseZoom'  => 2,
      'shapes'    => []
    ];
    file_put_contents($DATA_FILE, json_encode($db, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
  }
  header('Location: map.php');
  exit;
}

$db = json_decode(file_get_contents($DATA_FILE), true) ?? [];
$users = array_keys($db);
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DynOverlay • Login</title>
<link rel="stylesheet" href="style.css">
<link rel="manifest" href="map.php?manifest=1">
</head>
<body class="auth-body">
  <div class="auth-card">
    <div class="brand">
      <div class="brand-logo">🗺️</div>
      <div class="brand-text">
        <h1>DynOverlay</h1>
        <p>Plane deine Builds direkt auf der Dynmap</p>
      </div>
    </div>

    <?php if (isset($_GET['e'])): ?>
      <div class="alert">Bitte gib einen gültigen Nutzernamen ein.</div>
    <?php endif; ?>

    <form method="post" class="auth-form">
      <label for="username">Benutzername</label>
      <input id="username" name="username" placeholder="z. B. Mogaso" autocomplete="username" required>
      <button class="btn primary" type="submit">Weiter zur Karte</button>
    </form>

    <?php if ($users): ?>
      <div class="divider">oder wähle bestehend</div>
      <div class="user-list">
        <?php foreach ($users as $u): ?>
          <form method="post" class="user-pill">
            <input type="hidden" name="username" value="<?=htmlspecialchars($u)?>">
            <button type="submit">👤 <?=htmlspecialchars($u)?></button>
          </form>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <footer class="auth-foot">Keine Passwörter. Alles lokal in <code>data/user.json</code>.</footer>
  </div>
</body>
</html>
