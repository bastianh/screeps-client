# Room Decorations — Ist-Analyse & Umsetzungsplan

Vergleich der aktuellen Implementierung im neuen Client gegen
`screeps-client-reference/docs/room-decorations.md` (alter AngularJS-/app2-Client + Referenz-Renderer).

Stand: 2026-07-27, Branch `main`.

## 1. Was heute existiert

### screeps-connectivity

| Baustein | Ort | Status |
| --- | --- | --- |
| `GET /api/game/room-decorations` | `src/http/endpoints/game.ts:78` | ✔ |
| Mock-Override (`decorationsMock`, `ROOM_DECORATIONS_MOCK`) | `src/ScreepsClient.ts:44`, `src/mocks/roomDecorations.ts` | ✔ |
| Typen `ApiRoomDecorationDef/Active/Graphic/Item/Response` | `src/types/api.ts:429-495` | ✔ (Def kennt alle 8 Typen bis auf `badge`/`landscape`) |
| Map-Stats-Dekorationen (`stat.decorations[]`) | `src/stores/MapStatsStore.ts:143` | teilweise |
| Alle `user/decorations/*`-Endpunkte | — | ✖ fehlt komplett |
| Steam-/Store-Endpunkte | — | ✖ fehlt komplett |

### screeps-client — Raumansicht

| Baustein | Ort | Status |
| --- | --- | --- |
| Fetch beim Raumwechsel | `src/components/RoomViewer.tsx:113` | ✔ (einmalig) |
| Parser | `src/renderer/roomDecorations.ts` | nur `floorLandscape` + `wallLandscape` |
| Bodenfarbe, Sumpffarbe/-kontur/-breite | `TerrainLayer.ts` | ✔ |
| Wandfüllung/-kontur/-breite | `TerrainLayer.ts` | ✔ |
| Boden-Foreground-Textur (Tint/Alpha/TileScale) | `TerrainLayer.ts:325` | ✔ |
| Wand-Foreground-Textur (auf Wände maskiert) | `TerrainLayer.ts:338` | ✔ |
| Straßenfarbe, `constructedWall`-Farbe | `ObjectLayer.ts:152/157` | ✔ |
| Setting-Toggle `showRoomDecorations` | `settingsStore.ts:15` | ✔ |

### screeps-client — Weltkarte

| Baustein | Ort | Status |
| --- | --- | --- |
| Terrain-Palette (plain/swamp/road) pro Raum | `MapStatsStore.ts:144`, `MapRenderer.ts:475` | ✔ |
| Toggle `setDecorationsVisible` | `MapRenderer.ts:488` | ✔ |
| Alles Übrige (Texturen, Graffiti, Wandfarbe) | — | ✖ |

### Setzen/Verwalten von Dekorationen

Vollständig abwesend: kein Inventar, keine Themes, keine Pixelization, keine Aktivierung,
kein Dialog, kein Positions-Editor, kein Aside-Panel, keine Badge-Auswahl.

## 2. Lücken im Rendering (Raumansicht)

### 2.1 Nicht unterstützte Dekorationstypen

| Typ | Referenz | Neuer Client |
| --- | --- | --- |
| `floorLandscape` | ✔ | ✔ |
| `wallLandscape` | ✔ | ✔ |
| `landscape` (kombiniert) | ✔ — Referenz matcht `['landscape','floorLandscape']` bzw. `['landscape','wallLandscape']` | ✖ Parser vergleicht exakt, `landscape` fällt durch |
| `wallGraffiti` | ✔ Sprites mit Maske, Tiling, Rotation, Flip, Animation | ✖ |
| `creep` | ✔ `creepDecoration`-Prozessor | ✖ |
| `object` | ✔ `objectDecoration`-Prozessor (`_all`) | ✖ |
| `metadata` (Skin) | nur Dialog-Vorschau | ✖ (niedrige Prio) |
| `badge` | Account-Badge-Auswahl | ✖ |

### 2.2 Fehlende Mechanik

1. **`wallGraffiti`-Pipeline** — pro `graphics[]`-Eintrag ein Sprite:
   - `graphic.visible` → Prop-Name, blendet einzelne Grafiken aus
   - `graphic.color` → `tint = colorBrightness(active[name], brightness)`
   - `graphic.alpha` → Prop-Name für Sprite-Alpha
   - `decoration.tiling` → `TilingSprite` mit `tileScale`, `mipmap = false`
   - Position `x = floor((x - 0.5 + width/2) * CELL_SIZE)`, Anchor 0.5/0.5
   - `mask = wallMask` (Graffiti nur auf Wänden), `flip` (X-Spiegelung), `rotation` (Radiant)
   - Container-`alpha` aus `active.alpha`
2. **Animationen** — `slow`, `fast`, `blink`, `neon`, `flash` als Alpha-Sequenzen
   (`Repeat(Sequence(AlphaTo …))`). Aktuell keinerlei Äquivalent im Client.
3. **`lighting`-Prop** — Referenz legt ein zweites, identisches Sprite in den `lighting`-Layer;
   bei `wallLandscape` mit `lighting === 'disabled'` wird der Tint mit `0.6` multipliziert.
   Der Client hat einen `LightingLayer`, nutzt ihn dafür aber nicht. `strokeLighting` wird
   im Parser gar nicht gelesen.
4. **`creep`-Dekorationen** — Namensfilter (`nameFilter` als `!SEP!`-getrennter String) mit
   `exclude`-Invertierung, Besitzer-Match, `!spawning`-Bedingung, `syncRotate`
   (mitrotierender vs. drehungsfreier Container), `position === 'below'` (unter dem Creep,
   sonst in den `effects`-Layer), `flip` in Y.
5. **`object`-Dekorationen** — Match auf `decoration.objectType === state.type` plus
   optionaler Besitzer-Filter; Sprites in den `objects`-Layer.
6. **Mehrfach-Dekorationen** — mehrere `wallGraffiti` pro Raum sind erlaubt; der aktuelle
   Parser liefert *ein* flaches `RoomDecoration`-Objekt und kann das strukturell nicht abbilden.
   Zusätzlich gilt bei Landscapes in der Referenz **first-wins** (`find()`), im neuen Client
   dagegen **last-wins** (jede Iteration überschreibt `out`).
7. **Live-Updates** — der Referenzclient merged das `decorations`-Feld des Socket-Kanals
   `room:<shard>/<room>` dedupliziert per `_id` und ruft `setDecorations()` bei *jedem* Tick neu.
   Der neue Client lädt genau einmal beim Raumwechsel und ignoriert das Socket-Feld.
8. **Setting-Toggle einseitig** — `showRoomDecorations` von *aus* auf *an* zu schalten löst
   keinen Refetch aus (`RoomViewer.tsx:474` behandelt nur den Aus-Fall); es braucht einen
   Raumwechsel. Klarer Bug.
9. **History-/Replay-Modus** — `Game.decorationsOverride` (aus `seasons/replay/<code>`)
   hat kein Gegenstück.
10. **Texturhandling** — `Assets.load()` direkt in `TerrainLayer`, CORS nur über einen
    Dev-Proxy-Hack für `s3.amazonaws.com` (`TerrainLayer.ts:11`). Für Graffiti/Creep/Object
    braucht es einen gemeinsamen, cachenden Texturlader.
11. **Z-Order** — in `Z` (`RoomRenderer.ts:12`) fehlt ein Eintrag zwischen `terrain` und
    `objects` für den Dekorations-Container (Referenz: `zIndex 1` Landscape, `2` Graffiti).

## 3. Lücken im Rendering (Weltkarte)

1. **Definitionen werden nicht aufgelöst.** `map-stats` liefert `decoration` als *ID* plus ein
   Top-Level-Dictionary `decorations: { <id>: { type, graphics, tiling, foregroundUrl,
   floorForegroundUrl } }`. `MapStatsStore.flush()` liest nur `res.stats` und `res.users` —
   das Dictionary wird verworfen. Deshalb ist die Erkennung heuristisch
   (`active.world && (floorBackgroundColor || swampColor)`) statt typbasiert.
2. **Keine Overlay-Texturen** auf der Karte (`foregroundUrl` / `floorForegroundUrl`).
3. **Keine Wandfarbe** — Referenz färbt bei `wallLandscape` die Terrain-Bitmap ein
   (`[BLACK, BLACK, BLACK, wandFarbe]`).
4. **Kein Graffiti** auf der Karte (Referenz unterstützt es im normalisierten `[0,1]`-Raum).
5. **Keine Terrain-Maske und keine Zeichenreihenfolge** (Referenz: Floor → Wall → Graffiti,
   jeweils mit Maske „nur Wände" bzw. „alles außer Wänden").
6. **Falsches Farbmodell** — Referenz rechnet konsequent über HSL
   (Sättigung 0.48/0.5/0.75/0.35 je nach Ebene, Helligkeit skaliert), der Client multipliziert
   RGB-Kanäle. Sichtbar andere Optik.
7. **Kein `activatedAt`-Cache** für gezieltes Neuzeichnen.

## 4. Lücken beim Setzen von Dekorationen

Komplett fehlend — in aufsteigender Komplexität:

1. **API-Layer** (`screeps-connectivity`): `user/decorations/inventory`, `…/themes`,
   `…/pixelize`, `…/convert`, `…/activate`, `…/deactivate`; dazu `user/rooms?reservation`
   und `POST game/rooms` für die Raumauswahl.
2. **Inventar-Seite**: Liste, Filter (`active.room`, `type`, `theme`), Sortierung
   (`createdAt` ↕, `rarity` ↕, Gruppierung nach Raum), Mehrfachauswahl,
   Deactivate / Convert to pixels.
3. **Dekorations-Dialog**: Prop-Editor gruppiert nach `type`/`readonly`
   (`string`, `color`, `display`, `range`, `Animation`), `nameFilter`-Chips + `exclude`,
   Alpha-Props ausblenden wenn der Colorpicker bereits Alpha hat.
4. **Raumauswahl** mit Kollisionsregeln: `landscape` blockt `wallLandscape` *und*
   `floorLandscape`; `metadata`/`object` nur gegen sich selbst; `wallGraffiti` ohne Prüfung.
   Für `creep`/`badge` entfällt die Raumauswahl (global aktiv).
5. **Positions-Editor**: echte Raumvorschau, Move/Resize (4 Kanten + 4 Ecken)/Rotate,
   `proportional`, Grenzen `width/height ∈ [min ?? 1, max ?? 25]`, `x + width ≥ 1`, `x ≤ 49`,
   Bounding-Box-Neuberechnung bei Rotation.
6. **Aside-Panel „Decorations"** in der Raumansicht (Landscapes, Graffiti, Objects) und
   Dekorations-Anzeige im Creep-Panel.
7. **Erwerb**: Pixelization (`count ≤ 24`, 500 Pixel bzw. 2000 mit Theme), Convert (400/Item),
   `restricted` sperrt Convert und Steam-Transfer. Steam-Inventar und Xsolla-Store sind für
   einen Private-Server-orientierten Client vermutlich irrelevant.
8. **Feature-Gate**: Bereich nur zeigen, wenn `serverData.features` das Feature `inventory` meldet.

## 5. Umsetzungsplan

### Phase 0 — Fundament refaktorieren ✅ erledigt

- ✔ `RoomDecoration` ist jetzt `{ terrain, roadColor, graffiti[], creeps[], objects[] }`;
  Sprites mit aufgelösten `color`/`alpha`/`visible`-Prop-Referenzen, `!SEP!`-Split,
  validierte Animationsnamen.
- ✔ Landscape-Auswahl auf **first-wins** (`find`-Semantik der Referenz); `landscape`
  zählt als Floor **und** Wall.
- ✔ `colorBrightness` als HSL-Lightness-Skalierung portiert (`renderer/hsl.ts`) — die
  bisherige RGB-Multiplikation wich bei `brightness < 1` sichtbar ab.
- ✔ Gemeinsamer Texturlader mit Cache + Dev-Proxy (`renderer/decorationTextures.ts`).
- ✔ `Z.decorations = 5` zwischen `terrain` und `objects`.
- ✔ Bug fix: Toggle `showRoomDecorations` → an löst sofortigen Refetch aus.
- ✔ Tests: `screeps-client/tests/renderer/{hsl,roomDecorations}.test.ts`.

### Phase 1 — `wallGraffiti` rendern ✅ erledigt

- ✔ `DecorationLayer` (`renderer/DecorationLayer.ts`) mit zwei Containern: `base`
  (`Z.decorations`) und `lit` (`Z.decorationsLit`), beide über `createWallMask()` auf
  die Wände maskiert.
- ✔ Pro Item pro `graphics[]`: Sprite bzw. TilingSprite, Tint, Alpha, `tileScale`,
  Position/Größe/Anchor nach Referenzformel, `flip`, `rotation`.
- ✔ Animations-Runner (`renderer/decorationAnimation.ts`) mit den fünf Alpha-Sequenzen,
  ein einziger Ticker-Callback für alle Tweens.
- ✔ `lighting`: kein eigener Pass (siehe unten).
- ✔ Synthetischer `wallGraffiti`-Eintrag in `ROOM_DECORATIONS_MOCK`.
- ✔ Tests: `screeps-client/tests/renderer/decorationAnimation.test.ts`.

**Zu `lighting`:** Der `lighting`-Layer der Referenz ist eine **Lightmap**, kein sichtbarer
Layer — ambientes `0x808080` über den ganzen Raum, per MULTIPLY-Filter über die Szene
(`reference/renderer/metadata/src/index.js:92`). Die ungetönten Duplikat-Sprites darin sind
weiße Formen, die die Lightmap lokal aufhellen; sie werden nie als Grafik gesehen.

Unser `LightingLayer` funktioniert bereits genauso (Dunkelheit mit ausgestanzten Löchern),
deshalb gibt es hier keinen zweiten Pass: die Grafik wird einmal gezeichnet, getönt.
Ein erster Versuch zeichnete das Duplikat als normales Sprite über dem Dark-Overlay — das
legte eine ungetönte weiße Kopie über das Original und ließ farbige Graffiti weiß erscheinen.

### Phase 2 — Live-Updates & Verlässlichkeit ✅ erledigt

- ✔ `RoomStore` reicht das `decorations`-Feld des Room-Ticks als neues Event
  `room:decorations` durch (nur wenn nicht leer).
- ✔ `RoomViewer` hält die Rohitems als Signal und leitet die geparste Form als Memo ab;
  `mergeDecorationItems()` merged per `_id` und gibt die **bisherige Array-Referenz**
  zurück, wenn sich nichts geändert hat — sonst würde ein Server, der die Liste jeden
  Tick wiederholt, den Layer jeden Tick neu bauen.
- ✔ Race behoben: trifft ein Tick ein, bevor der HTTP-Fetch auflöst, werden dessen Items
  nicht überschrieben, sondern wieder aufgelegt.
- ✔ Tests: Merge-Fälle in `roomDecorations.test.ts`, Event-Emission in
  `screeps-connectivity/tests/stores/RoomStore.test.ts`.

**Abweichung zur Referenz:** Diese überspringt eingehende Items mit bekannter `_id`
komplett — eine Änderung an einer bereits sichtbaren Dekoration wird also erst beim
Reload übernommen. Wir ersetzen stattdessen bei echter Änderung; die Stabilität, um die
es der Referenz beim Dedupe ging, liefert der Identitätsvergleich.

**Entfallen:** `decorationsOverride` für Replays. Der Referenzclient bezieht das aus
`seasons/replay/<code>`; dieses Feature existiert im neuen Client nicht — sein
History-Modus ist tick-basiert (`/room-history`), kein Season-Replay. Es gibt also
nichts zu überschreiben.

### Phase 3 — `creep`- und `object`-Dekorationen ✅ erledigt

- ✔ `renderer/objectDecorations.ts` hängt die Overlays an die Objekt-Visuals;
  `ObjectLayer.setDecorations()` verteilt sie und baut sie bei Änderung neu auf.
- ✔ `creep`: Besitzerprüfung, `!spawning` (inkl. Neuaufbau beim Spawning-Übergang),
  `nameFilter`/`exclude`, `syncRotate` (Parent = `__bodyContainer`), `below`, `flip` in Y.
- ✔ `object`: Match über `decoration.objectType === obj.type` plus optionaler Besitzer.
- ✔ Animationen für beide; der Animator reapt zerstörte Tweens, weil Overlays neu
  aufgebaut werden.
- ✔ Größenumrechnung: `creep`/`object` liefern Pixel im Referenzraster (`CELL_SIZE: 100`),
  Graffiti dagegen Zellen. Alles wird auf Zellen normalisiert.
- ✔ Tests: Namensfilter-Matcher und Größenumrechnung in `roomDecorations.test.ts`.
- ✔ Nebenbei: die sechs identischen Visual-Erzeugungsblöcke im `ObjectLayer` zu einem
  Helper zusammengefasst.

**Bewusst abweichend:**
- `lighting` braucht hier kein Duplikat-Sprite. Jedes Objekt stanzt in
  `RoomRenderer.updateLighting()` ohnehin ein Lichtloch um sich herum — ein Overlay
  darauf ist also so oder so hell.
- Die Referenz legt Overlays mit `position !== 'below'` in einen globalen `effects`-Layer.
  Wir hängen sie stattdessen oben in den Container des jeweiligen Objekts: über dessen
  Körper, aber nicht über fremde Objekte. Ein globaler Effects-Layer wäre für diesen
  Unterschied unverhältnismäßig.

### Phase 4 — Weltkarte auf Referenzniveau ✅ erledigt

- ✔ `MapStatsStore` löst das Top-Level-`decorations`-Dictionary auf und liefert
  `MapRoomDecorations` (floor/wall/graffiti) statt der bisherigen Farb-Heuristik.
  Fällt auf Feld-Erkennung zurück, wenn ein Server das Dictionary nicht mitschickt.
- ✔ `renderer/mapDecorations.ts` rechnet die Referenz-HSL-Faktoren aus (Wand 0.48,
  Boden 0.5, Overlays 0.75/0.35; Sumpf = 0.7·Plain + 0.3·rohes Swamp).
- ✔ Wandfarbe auf der Karte — vorher gar nicht vorhanden.
- ✔ Overlay-Texturen beider Landscapes und Graffiti, im Bake-Worker komponiert:
  getönt, auf Wände bzw. Nicht-Wände maskiert, mit Textur-Cache.
- ✔ Straßenfarbe wird endlich verwendet (war gespeichert, aber tot).
- ✔ Tests: `buildRoomDecorations` (connectivity) und `buildMapDecoration` (client).

**Bewusst abweichend:** Die Referenz stapelt pro Dekoration eine eingefärbte Terrain-Bitmap
plus Maske übereinander. Wir backen ohnehin *eine* Bitmap pro Raum mit einer Farbe je
Terraintyp — dasselbe Bild, ohne Layer-Stack und ohne `cacheAsBitmap`.

**Entfallen:** der `activatedAt`-Cache. `MapRenderer.setRoomDecoration()` vergleicht bereits
die serialisierte Dekoration und backt nur bei echter Änderung neu — dieselbe Wirkung,
ohne auf ein Feld angewiesen zu sein, das nicht jeder Server liefert.

**Risiko:** Der Worker lädt Dekorationstexturen per `fetch`. Die erste Anfrage pro URL
kostet einen Roundtrip, bevor der Raum sichtbar wird; danach greift der Cache. Räume ohne
Dekoration warten nie. Schlägt ein Laden fehl, wird das Overlay übersprungen.

### Phase 5 — Anzeigen (Read-only) ✅ erledigt

- ✔ `user.decorations.inventory()` + `.themes()` in connectivity, dazu die Anzeigefelder
  einer Definition (`name`, `rarity`, `theme`, `restricted`, `preview`, `groupDescription`)
  und die Typen `ApiUserDecorationItem` / `ApiDecorationTheme`.
- ✔ Sidebar-Panel „Decorations": listet Landscapes, Graffiti und Object-Overlays des
  Raums mit Vorschau, Typ und Besitzer.
- ✔ Creep-Panel zeigt die auf den gewählten Creep passenden Dekorationen — über
  `creepMatchesDecoration()` aus Phase 3 statt einer zweiten Filterimplementierung.
  (Genau die hatte der Referenzclient, weshalb Panel und Renderer dort auseinanderlaufen
  konnten.)
- ✔ Inventar-Seite `/inventory` mit Filter (Typ/Theme/Raum), Sortierung
  (new/old, rare/common) und Gruppierung nach Raum; aktivierte Items verlinken in den Raum.
- ✔ Feature-Gate `capabilities().hasInventory` über `getServerFeature(version, 'inventory')`.
- ✔ Tests: `tests/components/inventorySorting.test.ts`.

**Offen aus dieser Phase:** nichts — Aktionen (Deactivate, Convert, Transfer) gehören
bewusst zu Phase 6/7.

### Phase 6 — Aktivieren & Platzieren ✅ erledigt

- ✔ `user.decorations.activate()` / `.deactivate()`, `reservation`-Flag auf `user.rooms()`,
  Schema-Typen `ApiDecorationProp` / `ApiDecorationProps`.
- ✔ `components/inventory/activation.ts` (pure): `buildActiveState()`, `editorGroups()`,
  `blockedRooms()` mit den Kollisionsregeln, `!SEP!`-Helfer.
- ✔ `DecorationDialog` — Farben, Ranges, Checkboxen, Animation-Select,
  `nameFilter`-Chips mit `exclude`, Raumauswahl mit deaktivierten Kollisionsräumen.
- ✔ `components/inventory/positionEditor.ts` (pure) + `DecorationPositionEditor`:
  Move/Resize (8 Griffe)/Rotate über Terrain-Canvas, Fähigkeiten aus dem Schema,
  `proportional`, Grenzwerte `1…25` und „mindestens eine Zelle im Raum".
- ✔ Tests: 46 in `decorationActivation.test.ts` und `positionEditor.test.ts`.

**Bewusst abweichend:** Die Referenz bildet den proportionalen Skalierungsfaktor immer
als `min(wRatio, hRatio)`. Bei einem Kantengriff ist die andere Ratio konstant 1, das
Minimum also 1 — der Griff wäre wirkungslos. Kantengriffe skalieren hier über ihre
eigene Achse; Eckgriffe folgen der Referenz.

**Nicht übernommen:** `POST game/rooms` für die Raumvorschau. Die Referenz holt damit
Terrain und Objekte für ihre Vorschau; wir zeichnen flaches Terrain aus dem bestehenden
`RoomStore`-Cache, was für die Platzierung von Wand-Graffiti ausreicht.

### Phase 7 — Optional / niedrige Priorität

- Pixelization + Convert (`…/pixelize`, `…/convert`) — nur sinnvoll, wenn der Zielserver
  Pixel-Ökonomie hat.
- `badge`-Dekorationen in der Account-Badge-Auswahl.
- `metadata`-Skins (in der Referenz nur Dialog-Vorschau, in der Raumansicht wirkungslos).
- Steam-Inventar / Xsolla-Store — für private Server irrelevant.

## 6. Fallstricke (aus der Referenz)

- Listenwertige Props sind `!SEP!`-getrennte **Strings**, keine Arrays.
- `rotation` ist **Radiant**, die UI zeigt Grad.
- Zahlenfelder kommen teils als Strings — der bestehende `num()`-Helper muss überall greifen.
- Landscape: pro Raum wirkt jeweils nur die **erste** passende Dekoration.
- Farb-Alpha-Konvention: zu `mainColor`/`color` gehört `alpha`, zu `<name>Color` gehört
  `<name>Alpha`.
