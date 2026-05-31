# Screeps Renderer — Decoration System

> Dokumentation des Decoration-Systems aus dem `reference/renderer`. Das System erlaubt es, den kompletten visuellen Stil eines Raums zu überschreiben: Boden, Swamps, Walls, Roads, Creeps und einzelne Objekte können mit Texturen, Farben und Animationen versehen werden.

---

## 1. Überblick

Das Decoration-System ist eine deklarative Overlay-Schicht auf dem PixiJS-basierten Renderer. Es arbeitet mit einem Array von Decoration-Items, das über `GameRenderer.setDecorations(items)` an den Renderer übergeben wird. Jedes Item hat einen `type` und typ-spezifische Properties.

**Zentrale Dateien:**

| Datei | Verantwortung |
|-------|---------------|
| `engine/src/lib/decorations.js` | Globale Decorations (`wallGraffiti`, `landscape`, `wallLandscape`) |
| `engine/src/lib/processors/terrain.js` | Terrain-Integration: Boden, Walls, Swamps, Roads |
| `engine/src/lib/processors/road.js` | Straßen-Farb-Override durch `floorLandscape` |
| `engine/src/lib/processors/objectDecoration.js` | Objekt-spezifische Overlays |
| `engine/src/lib/processors/creepDecoration.js` | Creep-spezifische Overlays |
| `engine/src/lib/GameRenderer.js` | Öffentliche API: `setDecorations()` |

---

## 2. Decoration-Typen

### 2.1 `floorLandscape` — Kompletter Boden-Override

Überschreibt die komplette Boden- und Terrain-Darstellung eines Raums.

#### Properties

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `floorBackgroundColor` | `string` (hex) | Hintergrundfarbe der gesamten Zelle |
| `floorBackgroundBrightness` | `number` | Helligkeitsmultiplikator für den Hintergrund |
| `floorForegroundColor` | `string` (hex) | Tint-Farbe für die Vordergrund-Textur |
| `floorForegroundBrightness` | `number` | Helligkeit der Vordergrund-Tint |
| `floorForegroundAlpha` | `number` (0–1) | Transparenz der Vordergrund-Textur |
| `swampColor` | `string` (hex) | Füllfarbe von Swamps |
| `swampStrokeColor` | `string` (hex) | Randfarbe von Swamps |
| `swampStrokeWidth` | `number` | Strichstärke der Swamp-Ränder |
| `roadsColor` | `string` (hex) | Farbe von Straßen |
| `roadsBrightness` | `number` | Helligkeit der Straßen |
| `decoration.type` | `'floorLandscape'` | Typ-Identifikator |
| `decoration.floorForegroundUrl` | `string` | URL/Pfad zur Vordergrund-Textur |
| `decoration.tileScale` | `number` | Optional: Skalierung für `TilingSprite` |

#### Wie es funktioniert

Der `terrain.js`-Processor prüft bei jedem Tick, ob ein `floorLandscape`-Eintrag existiert:

```js
const decorationFloorLandscape = decorations.find(
  i => ['landscape', 'floorLandscape'].includes(i.decoration.type)
);
```

Wenn vorhanden, werden folgende Render-Schritte beeinflusst:

1. **Boden-Hintergrund**: Ein `PIXI.Graphics`-Rechteck wird mit `floorBackgroundColor` gefüllt.
2. **Boden-Vordergrund**: Ein `PIXI.Sprite` oder `PIXI.TilingSprite` mit `floorForegroundUrl` wird darüber gelegt und mit `floorForegroundColor` getintet.
3. **Swamps**: Die SVG-Pfade der Swamps erhalten `swampColor` als Fill und `swampStrokeColor` als Stroke.
4. **Roads**: Der `road.js`-Processor setzt die Füllfarbe der Straßen-Grafiken auf `roadsColor` mit `roadsBrightness`.

```js
// Beispiel aus reference/renderer/demo/src/config/decorations.js
{
  floorBackgroundColor: '#7777dd',
  floorBackgroundBrightness: 0.7,
  floorForegroundColor: '#9999ff',
  floorForegroundAlpha: 0.2,
  floorForegroundBrightness: 1.0,
  swampColor: '#0000ff',
  swampStrokeColor: '#0000cc',
  swampStrokeWidth: 50,
  roadsColor: '#ccccff',
  roadsBrightness: 0.8,
  decoration: {
    type: 'floorLandscape',
    floorForegroundUrl: 'decorations/landscape2.png',
    tileScale: 3,
  }
}
```

---

### 2.2 `wallLandscape` — Kompletter Wall-Override

Überschreibt die Darstellung von natürlichen und konstruierten Walls.

#### Properties

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `backgroundColor` | `string` (hex) | Füllfarbe der Walls |
| `backgroundBrightness` | `number` | Helligkeit der Wall-Füllung |
| `strokeColor` | `string` (hex) | Randfarbe der Walls |
| `strokeBrightness` | `number` | Helligkeit des Rands |
| `strokeWidth` | `number` | Breite des Rands |
| `strokeLighting` | `number` (0–1) | Graustufen-Wert für den Beleuchtungs-Rand |
| `foregroundColor` | `string` (hex) | Tint für die Overlay-Textur |
| `foregroundAlpha` | `number` (0–1) | Transparenz der Overlay-Textur |
| `foregroundBrightness` | `number` | Helligkeit der Overlay-Tint |
| `decoration.type` | `'wallLandscape'` | Typ-Identifikator |
| `decoration.foregroundUrl` | `string` | URL/Pfad zur Overlay-Textur |

#### Wie es funktioniert

Walls werden als SVG-Pfade gerendert. Der `terrain.js`-Processor baut mehrere SVG-Layer:

1. **Base Layer**: Füllung mit `backgroundColor` und Rand mit `strokeColor`
2. **Bump/Noise Layer**: Ein `TilingSprite` mit Noise-Textur wird als Overlay gerendert (nur bei aktiver Beleuchtung)
3. **Shadow Layer**: Ein weichgezeichneter schwarzer Wall-Path für Tiefen-Schatten
4. **Lighting Layer**: Graustufen-Wall-Shape für die Beleuchtungsmaske
5. **Foreground Texture**: Ein `Sprite` mit `foregroundUrl`, getintet mit `foregroundColor`

```js
// Beispiel
{
  foregroundColor: '#3333ff',
  foregroundAlpha: 1.0,
  foregroundBrightness: 1.0,
  backgroundColor: '#0000ff',
  backgroundBrightness: 0.4,
  strokeColor: '#3333ff',
  strokeBrightness: 0.5,
  strokeLighting: 0.4,
  strokeWidth: 30,
  decoration: {
    type: 'wallLandscape',
    foregroundUrl: 'decorations/landscape.png',
  }
}
```

> **Hinweis**: Die `foregroundUrl`-Textur wird über `wallGraffiti` gelayer maskiert — sie erscheint nur dort, wo tatsächlich Walls sind.

---

### 2.3 `wallGraffiti` — Grafiken auf Walls

Erlaubt das Platzieren beliebiger Bilder/SVGs auf Wall-Flächen.

#### Properties

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `x` | `number` | Zellen-X-Position (links) |
| `y` | `number` | Zellen-Y-Position (oben) |
| `width` | `number` | Breite in Zellen |
| `height` | `number` | Höhe in Zellen |
| `alpha` | `number` (0–1) | Transparenz des Containers |
| `flip` | `boolean` | Horizontal spiegeln |
| `rotation` | `number` (rad) | Rotation des Sprites |
| `animation` | `string` | Animations-Key (`slow`, `fast`, `blink`, `neon`, `flash`) |
| `lighting` | `boolean` | Separater Lighting-Layer |
| `tileScale` | `number` | Skalierung für TilingSprite |
| `decoration.type` | `'wallGraffiti'` | Typ-Identifikator |
| `decoration.tiling` | `boolean` | Ob TilingSprite verwendet wird |
| `decoration.graphics` | `Array` | Liste der Grafiken |

#### Graphics-Item

```ts
interface WallGraffitiGraphic {
  url: string;       // Pfad/URL zur Textur
  color?: string;    // Property-Name für Tint-Farbe (z. B. "color1")
  alpha?: string;    // Property-Name für Alpha (z. B. "firstAlpha")
  visible?: string;  // Property-Name für Visibility-Boolean (z. B. "hasRing")
}
```

#### Wie es funktioniert

1. Für jedes `graphics`-Item wird ein `PIXI.Sprite` oder `PIXI.TilingSprite` erstellt
2. Das Sprite wird auf die Wall-Fläche zentriert:
   ```js
   x = (decorationItem.x + (-0.5) + (width / 2)) * CELL_SIZE
   ```
3. **`mask: world.stage.terrainObjects.wallMask`** sorgt dafür, dass das Bild nur auf Wall-Pixeln sichtbar ist
4. Optional wird das Sprite mit einer dynamischen Farbe getintet:
   ```js
   sprite.tint = colorBrightness(parseInt(decorationItem[graphic.color].substr(1), 16), decorationItem.brightness)
   ```
5. Wenn `lighting: true`, wird ein identisches Sprite auf dem `lighting`-Layer erzeugt
6. Animationen laufen über den `ActionManager` als Alpha-Sequenzen

```js
// Beispiel: Mehrfarbiges Graffiti mit Animation
{
  x: 20.5, y: 12,
  width: 14, height: 14,
  flip: true,
  rotation: 10 * Math.PI / 180,
  color1: '#8888ff',
  color2: '#aa55aa',
  color3: '#ff9999',
  brightness: 1.0,
  hasRing: false,
  alpha: 0.9,
  animation: 'neon',
  lighting: true,
  decoration: {
    type: 'wallGraffiti',
    graphics: [
      { url: 'decorations/test1.svg', color: 'color1' },
      { url: 'decorations/test2.svg', color: 'color2', visible: 'hasRing' },
      { url: 'decorations/test3.svg', color: 'color3', visible: 'hasRing' }
    ]
  }
}
```

---

### 2.4 `creep` — Creep-Overlays

Fügt Creeps zusätzliche Grafiken hinzu — z. B. Aura-Effekte, Rang-Abzeichen oder Season-Skins.

#### Properties

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `user` | `string` | Owner-User-ID (Pflicht) |
| `nameFilter` | `string` | Pipe-getrennte (!SEP!) Namens-Filter |
| `exclude` | `boolean` | Wenn `true`, wird der Filter invertiert |
| `width` | `number` | Breite des Overlays in Pixel |
| `height` | `number` | Höhe des Overlays in Pixel |
| `brightness` | `number` | Helligkeitsmultiplikator für Tint |
| `lighting` | `boolean` | Separater Lighting-Layer |
| `animation` | `string` | Animations-Key |
| `position` | `'below' \| undefined` | `'below'` legt das Overlay unter den Creep |
| `syncRotate` | `boolean` | Overlay rotiert mit dem Creep |
| `flip` | `boolean` | Vertikal spiegeln |
| `decoration.type` | `'creep'` | Typ-Identifikator |
| `decoration.graphics` | `Array` | Grafiken (wie bei `wallGraffiti`) |

#### Filter-Logik

```js
const isNameFilter = i.nameFilter.split(/!SEP!/).some(str => state.name.includes(str));
if ((!i.exclude && !isNameFilter) || (i.exclude && isNameFilter)) {
  return; // Decoration nicht anwenden
}
```

#### Wie es funktioniert

1. Der `creepDecoration`-Processor wird während des Creep-Renderings aufgerufen
2. Es wird ein `PIXI.Container` erzeugt
3. Mit `syncRotate: true` wird der Container als Child des Creeps angehängt (rotiert mit)
4. Ohne `syncRotate` wird der Container absolut im Root platziert
5. Grafiken werden als Sprites geladen, getintet und optional auf dem `effects`-Layer platziert
6. Lighting-Sprites werden auf dem `lighting`-Layer gerendert

```js
// Beispiel: Aura um EnergyHauler-Creeps
{
  user: '58901b93730b9dab5857f7a6',
  nameFilter: 'EnergyHauler',
  exclude: false,
  firstColor: '#A4FF99',
  firstAlpha: 1.0,
  secondColor: '#FFFFFF',
  secondAlpha: 0.5,
  brightness: 0.3,
  lighting: true,
  animation: 'fast',
  position: 'below',
  width: 184, height: 184,
  syncRotate: true,
  decoration: {
    type: 'creep',
    graphics: [
      { url: 'decorations/creep_effect1.svg', color: 'firstColor', alpha: 'firstAlpha' },
      { url: 'decorations/creep_effect2.svg', color: 'secondColor', alpha: 'secondAlpha' }
    ]
  }
}
```

---

### 2.5 `object` — Objekt-Overlays

Ähnlich wie `creep`, aber für stationäre Objekte (Controller, Spawns, Towers, etc.).

#### Properties

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `user` | `string` | Optional: Owner-User-ID |
| `width` | `number` | Breite in Pixel |
| `height` | `number` | Höhe in Pixel |
| `brightness` | `number` | Helligkeit |
| `lighting` | `boolean` | Lighting-Layer |
| `animation` | `string` | Animations-Key |
| `decoration.type` | `'object'` | Typ-Identifikator |
| `decoration.objectType` | `string` | Objekt-Typ (z. B. `'controller'`) |
| `decoration.graphics` | `Array` | Grafiken |

#### Filter-Logik

```js
if (i.decoration.type !== 'object' ||
    i.decoration.objectType !== state.type ||
    (!!i.user && state.user !== `${i.user}`)) {
  return;
}
```

```js
// Beispiel: Controller-Skin für einen bestimmten User
{
  user: '54bff72ab32a10f73a57d017',
  width: 350, height: 350,
  animation: 'fast',
  decoration: {
    type: 'object',
    objectType: 'controller',
    graphics: [
      { url: 'https://s3.amazonaws.com/.../controller_season1.svg' }
    ]
  }
}
```

---

## 3. Animationen

Das System bringt 5 vordefinierte Alpha-Animationen mit (`engine/src/lib/decorations.js`):

| Key | Beschreibung |
|-----|--------------|
| `slow` | Langsames Pulsieren (0.3 → 1.0 über 5s) |
| `fast` | Schnelles Pulsieren (0.3 → 1.0 über 1s) |
| `blink` | Unregelmäßiges Blitzen |
| `neon` | Neon-Flackern mit mehreren schnellen Dips |
| `flash` | Kurzer Blitz, dann Ausblenden |

Jede Animation ist ein Array von `[targetAlpha, durationInSeconds]`-Paaren. Sie laufen als Endlosschleife (`Repeat` + `Sequence` + `AlphaTo`).

---

## 4. Farb- & Beleuchtungssystem

### HSL-Utils

Das System arbeitet intern mit HSL-Farbwerten. Die Utility `engine/src/lib/utils/hsl.js` stellt bereit:

- **`colorBrightness(color, brightness)`** — Multipliziert die HSL-Lightness mit einem Faktor
- **`multiply(color, factor)`** — Multipliziert RGB-Komponenten direkt
- **`hslToRgbStr(h, s, l)`** — Konvertiert zu RGB-String

### Lighting-Modes

Der Renderer kennt drei Beleuchtungsmodi, die über `world.options.lighting` gesetzt werden:

| Modus | Auswirkung |
|-------|------------|
| `'normal'` | Volle Farben, Bump-Mapping aktiv |
| `'low'` | Gedimmte Farben (ca. 65% Helligkeit) |
| `'disabled'` | Stark abgedunkelt (ca. 50% Helligkeit), keine Bump/Noise-Effekte |

Bei `lighting === 'disabled'` wird der Wall-Hintergrund z. B. auf `#181818` statt `#111111` gesetzt und alle Landscape-Tints mit `0.5` multipliziert.

---

## 5. Rendering Pipeline

### 5.1 Initialisierung

```
GameRenderer.init() → World.init() → Layer-Aufbau (terrain, lighting, effects, wallGraffiti)
```

### 5.2 Decorations setzen

```js
// Benutzer-Code
renderer.setDecorations(decorationItems);

// Intern
// 1. decorations.set(items, { world }) wird aufgerufen
// 2. Alte decorationsContainer werden destroyed
// 3. Neue Sprites/Container werden erzeugt und zum Stage hinzugefügt
// 4. wallGraffiti-Sprites bekommen wallMask als mask
// 5. landscape/wallLandscape-Sprites bekommen parentLayer zugewiesen
```

### 5.3 State Apply (pro Tick)

```
World.applyState(state) →
  terrain-Preprocessor →
    decorationFloorLandscape = decorations.find(...)
    decorationWallLandscape = decorations.find(...)
    → Swamps, Walls, Floor werden mit Decoration-Farben neu gerendert
  
  GameObject.applyState() →
    object.processors[] →
      creepDecoration / objectDecoration →
        decorations.forEach(...) → Filter → Sprite-Erzeugung
```

### 5.4 Layer-Struktur

Die `World` verwendet `@pixi/layers` für Z-Sorting und Lighting:

| Layer | Nutzung |
|-------|---------|
| `terrain` | Boden, Swamps, Walls, Roads |
| `wallGraffiti` | Graffiti- und Landscape-Texturen auf Walls |
| `lighting` | Multiply/Add-Overlays für Schatten und Glow |
| `effects` | Ramparts, Creep-Auras, Objekt-Effekte |

---

## 6. API-Referenz

### `GameRenderer.setDecorations(decorationItems)`

```ts
interface DecorationItem {
  // Gemeinsame Properties
  decoration: {
    type: 'floorLandscape' | 'wallLandscape' | 'wallGraffiti' | 'creep' | 'object';
    [key: string]: any;
  };

  // floorLandscape / wallLandscape
  floorBackgroundColor?: string;
  floorBackgroundBrightness?: number;
  floorForegroundColor?: string;
  floorForegroundBrightness?: number;
  floorForegroundAlpha?: number;
  swampColor?: string;
  swampStrokeColor?: string;
  swampStrokeWidth?: number;
  roadsColor?: string;
  roadsBrightness?: number;
  backgroundColor?: string;
  backgroundBrightness?: number;
  strokeColor?: string;
  strokeBrightness?: number;
  strokeWidth?: number;
  strokeLighting?: number;
  foregroundColor?: string;
  foregroundBrightness?: number;
  foregroundAlpha?: number;

  // wallGraffiti / creep / object
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  alpha?: number;
  flip?: boolean;
  rotation?: number;
  animation?: 'slow' | 'fast' | 'blink' | 'neon' | 'flash';
  lighting?: boolean;
  tileScale?: number;
  user?: string;
  nameFilter?: string;
  exclude?: boolean;
  syncRotate?: boolean;
  position?: 'below';
  brightness?: number;
}
```

---

## 7. Beispiel: Vollständiger Raum-Theme

```js
const myRoomTheme = [
  // 1. Boden
  {
    floorBackgroundColor: '#1a1a2e',
    floorForegroundColor: '#16213e',
    floorForegroundAlpha: 0.15,
    swampColor: '#0f3460',
    swampStrokeColor: '#533483',
    roadsColor: '#e94560',
    roadsBrightness: 0.6,
    decoration: {
      type: 'floorLandscape',
      floorForegroundUrl: 'themes/dark/grid.png',
      tileScale: 2,
    }
  },

  // 2. Walls
  {
    backgroundColor: '#16213e',
    backgroundBrightness: 0.5,
    strokeColor: '#0f3460',
    strokeBrightness: 0.8,
    strokeWidth: 20,
    foregroundColor: '#e94560',
    foregroundAlpha: 0.3,
    decoration: {
      type: 'wallLandscape',
      foregroundUrl: 'themes/dark/circuit.png',
    }
  },

  // 3. Controller-Skin
  {
    width: 300,
    height: 300,
    decoration: {
      type: 'object',
      objectType: 'controller',
      graphics: [{ url: 'themes/dark/controller_aura.svg' }]
    }
  }
];

renderer.setDecorations(myRoomTheme);
```

---

## 8. Technische Details

### 8.1 Wall-Masking

Walls werden nicht als einzelne Sprites gerendert, sondern als SVG-Pfad über den gesamten Raum. Ein `wallMask`-Sprite (`PIXI.Sprite(Texture.EMPTY)`) wird mit diesem Pfad als Textur befüllt. Alle `wallGraffiti`-Sprites setzen `mask = wallMask`, wodurch sie nur auf Wall-Pixeln sichtbar sind.

### 8.2 RenderTexture-Caching

Für Walls werden `PIXI.RenderTexture`-Objekte verwendet, um die komplexen SVG-Layer (Base, Bump, Shadow) vorzuberechnen:

```js
wallObjects[0] = RenderTexture.create({ width, height });
app.renderer.render(base, { renderTexture: wallObjects[0] });
```

Dies vermeidet teure Neuberechnungen pro Frame.

### 8.3 ActionManager

Animationen werden nicht über Pixi-Ticker direkt gesteuert, sondern über einen eigenen `ActionManager` (`engine/src/lib/actions`). Dieser unterstützt:

- `AlphaTo(targetAlpha, duration)`
- `Sequence([...actions])`
- `Repeat(action)`
- `Spawn([...actions])`

---

## 9. Zusammenfassung

Das Decoration-System ist ein deklarativer, leistungsfähiger Ansatz, um den Screeps-Renderer vollständig umzuskinnen. Es deckt alle visuellen Ebenen ab:

- **Global**: Boden, Swamps, Walls, Roads
- **Semi-Global**: Grafiken auf Wall-Flächen (Graffiti)
- **Objekt-Spezifisch**: Creeps und einzelne Gebäude

Durch die Kombination aus Farb-Overrides, Texturen, Masking, Lighting-Layern und Animationen lassen sich komplexe visuelle Themes realisieren, ohne den Core-Renderer anzufassen.
