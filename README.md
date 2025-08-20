# DynOverlay

Plane und markiere Bauprojekte direkt auf der **Dynmap** – mit Formen, Text, Messen, Raster/Chunks, PNG-Export, Undo/Redo und nutzerbezogenem Autosave.

> **Highlights**
> - Map-Modus: Dynmap ist ganz normal bedienbar (Scroll/Drag/Marker/Zoom).
> - Bearbeiten-Modus: Overlay zum Zeichnen (Rechteck, Kreis, Linie, Text, Messen).
> - Kalibrieren: Linie auswählen → Blocklänge eingeben → korrekte Blockangaben.
> - Raster & Chunk-Grid zuschaltbar.
> - PNG-Export (nur Overlays, transparenter Hintergrund).
> - Nutzerlogin ohne Passwort, pro Nutzer persistente Daten (`data/user.json`).

---

## Anforderungen

- PHP 8.x (CLI/Web)
- Schreibrechte für `data/` (wird automatisch angelegt)

---

## Installation

1. Projekt in einen Webroot kopieren.
2. Stelle sicher, dass PHP Schreibrechte für `data/` hat.
3. Aufrufen: `index.php`
4. Benutzername eingeben → weiter → Karte.

---

## Dateien

- `index.php` – einfacher Login (nur Benutzername), initialisiert Nutzerdaten.
- `map.php` – Hauptapp mit Dynmap-Embed, Overlay, Tools, API (`?api=load/save`).
- `script.js` – Interaktionen (Tools, Render, Undo/Redo, Export, Kalibrieren, Save).
- `style.css` – Styles für Login, App, Toolbar, Panel, Shapes.
- `data/user.json` – Persistente Nutzerdaten/Shapes (wird beim ersten Speichern erstellt).

---

## Konfiguration

In `map.php` den Dynmap-Link anpassen (Hash-Teil mit Welt/Zoom):

```php
$dynmap = 'https://...;surface;-1,64,-1;2';
