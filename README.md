# DynOverlay 🗺️

Plane und markiere Bauprojekte direkt auf der **Dynmap** – mit Formen, Text, Messen, Raster/Chunks, PNG-Export, Undo/Redo und nutzerbezogenem Autosave.  
Zusätzlich ist die App **PWA-ready** für Android und iOS und kann wie eine native App installiert werden.



![image](https://github.com/user-attachments/assets/3d7bfe96-b91b-46b2-874e-3ba633b3b302)


![image](https://github.com/user-attachments/assets/0a165e40-d985-4a73-adf8-7dbfbca55b25)

---

## ✨ Highlights

- **Map-Modus**: Dynmap ist ganz normal bedienbar (Scroll / Drag / Marker / Zoom).
- **Bearbeiten-Modus**: Overlay zum Zeichnen (Rechteck, Kreis, Linie, Text, Messen).
- **Kalibrieren**: Linie auswählen → Blocklänge eingeben → korrekte Blockangaben.
- **Raster & Chunk-Grid** zuschaltbar.
- **PNG-Export** (nur Overlays, transparenter Hintergrund).
- **Undo / Redo** für alle Bearbeitungen.
- **Autosave pro Benutzer**: Shapes, Zoom-Level, Pan und Kalibrierung werden automatisch gespeichert (`data/user.json`).
- **Benutzerlogin ohne Passwort**, pro Nutzer persistente Daten.
- **PWA-Unterstützung**: Android & iOS Homescreen-Installation, Vollbildmodus, Offline-Cache.
- **Modernes, responsives UI** für Desktop und Mobile.

---

## 📦 Anforderungen

- PHP 8.x (CLI/Web)
- Schreibrechte für `data/` (wird automatisch angelegt)
- Dynmap muss öffentlich erreichbar sein

---

## ⚙️ Installation

1. Projekt in einen Webroot (z. B. `httpdocs/custom-map/`) kopieren.
2. Stelle sicher, dass PHP Schreibrechte für `data/` hat.
3. Rufe `index.php` auf.
4. Benutzername eingeben → weiter → Karte.

---

## 📂 Dateien

- `index.php` – Login mit Benutzername, initialisiert Nutzerdaten.
- `map.php` – Hauptapp mit Dynmap-Embed, Overlay, Toolbar und API (`?api=load/save`).
- `script.js` – Interaktionen (Zeichen-Tools, Undo/Redo, Export, Kalibrieren, Autosave).
- `style.css` – Styles für Login, App, Toolbar, Panel, Shapes.
- `data/user.json` – Speichert alle Benutzer inkl. Shapes, Zoom/Pan, Kalibrierung.
- `manifest.webmanifest` – PWA Manifest (Icons, Name, Theme Color).
- `sw.js` – Service Worker für Offline-Cache.
- `img/android/*` – Android App-Icons.
- `img/ios/*` – iOS App-Icons.

---

## ⚙️ Konfiguration

In `map.php` den Dynmap-Link anpassen (Hash-Teil mit Welt/Zoom):

```php
$dynmap = 'https://map.deinserver.de/main/dynmap/#welt;surface;-1,64,-1;2';

