# screeps-client

## 0.24.1

### Patch Changes

- 3d0aa73: Match the official client's room-decoration geometry

  Landscape overlays diverged from the official renderer, so a decoration pack authored
  against one looked wrong on the other:

  - Floor and wall overlays always tiled. The official tiles the floor only when the
    _definition_ declares `tileScale`, otherwise stretching one copy over the room, and never
    tiles the wall half at all. A placement's `tileScale` prop no longer flips the branch —
    the official ignores it on landscapes.
  - Tile scales are now rebased from the official's 100-units-per-tile space onto ours
    instead of a magic `0.8`, so the same authored number gives the same density. The same
    fix applies to tiled `wallGraffiti`, which repeated roughly 8× too often.
  - `strokeWidth` and `swampStrokeWidth` were 1.25× too thin. They are SVG units at 100 per
    tile, and `paint-order: stroke` hides the inner half of the centred stroke, so the
    visible border is half the authored width.
  - The hardcoded green swamp glow is replaced by the official's additive, green-tinted
    swamp noise, leaving a pack's own `swampColor` readable underneath.
  - The procedural wall noise no longer disappears when a wall texture is present; the
    official draws both.

  Room lighting now follows the same reference, which changes how every room reads, not
  just decorated ones:

  - The dark overlay was a flat 20% black veil. It is now a light map — mid-grey ambient,
    multiplied over the world — so unlit ground sits at half brightness as it does
    officially, and lights screen it back towards white instead of erasing holes in it.
  - Walls cast a soft blurred shadow onto the floor, and their own faces are lit back up,
    so a room reads with depth rather than flat.
  - Wall noise was a flat grey wash at 50% that pulled decorated walls towards neutral and
    cost a landscape its colour. It is now additive at 20%, as officially.
  - `strokeLighting` is honoured: it sets how brightly a wall's rim reads in the light map.
  - Undecorated rooms use the reference's own terrain colours rather than a darker local
    palette, and gain the ground mottling the reference draws when no floor landscape
    applies — without which a plain room under the new light map read almost black.

- 677c063: Lighten the default road color in the room view so roads read as a lighter grey against the terrain instead of appearing too dark.
- f29d41a: Guest sessions and world-start-room lookup failures now center the map on the world's middle instead of leaving the camera at its raw uncentered default.
- 526e00c: Bring back the memory tree's per-node reload buttons and give the bottom bar a collapse toggle again.

  Since watch values moved to typed HTTP fetches, the reload button was gated on a WebSocket placeholder that no longer reaches the tree, so it never rendered. Every object and array node now has one, and it writes the refetched subtree back into the watch store instead of a node-local copy, so live change signals keep updating the node afterwards.

  The bottom bar gained a collapse/expand button next to the popout action, and collapsing it by hand sticks: the effect that mirrors the pane toggles no longer reacts to the bar's own height, which previously snapped a bar dragged shut back open and discarded a collapsed bar on reload.

- 4016760: Map visual text now matches the reference client: text renders opaque unless an explicit `opacity` is given (the documented 0.5 default only applies to shapes), a `stroke` colour without `strokeWidth` falls back to the reference default of 0.15, and the background box is sized from the font size instead of the measured glyph height so padding reads consistently across strings.
- d63cb89: Match the official client's RoomVisual style defaults: text is centered instead of left-aligned, and a `stroke` colour on its own now outlines text and shapes (`strokeWidth` defaults to 0.15 for text and 0.1 for circles, rects and polys). An unstyled `poly()` gets the reference's white outline.
- 7ec6fc4: Match the official client's light pools and wall shadows

  Every object punched the same three-tile pool at full alpha into the light map, which is
  the size and strength the official client reserves for a spawn — a base full of extensions
  therefore washed out into one bright cloud. Each type now contributes the pools its own
  metadata gives it: an extension's halo grows with its tier and only lights while it holds
  energy, a lab lights only for a non-energy payload, a storage's core only when it holds
  something, sources, minerals, deposits, portals and keeper lairs light in their own colour,
  and roads, walls, ramparts, construction sites and flags stay dark as they do officially.

  Wall shadows were twice as wide as the reference's. Both blur by the same fraction of the
  room, but PixiJS v7 spreads that figure across its passes and lands at half of it, where v8
  normalises its passes to hit it exactly.

## 0.24.0

### Minor Changes

- 01a3551: Offer badge symbols granted by decorations in the badge editor. A worn `badge`-type decoration (xxscreeps decorations mod) grants an svg symbol; the badge editor now lists those beside the 24 numbered shapes and saves them through the existing `/api/user/badge` route. `ApiRoomDecorationDef` gained the `badge` field and the `BadgeSymbol` type is exported.
- 7d2e2f4: Add a "Disable email notifications" checkbox to the OAuth registration form (Steam, Discord, ...). Mirrors the official client's registration option, but instead of dropping the email entirely it posts `{ disabled: true }` to `/api/user/notify-prefs` right after `set-username`, so the address stays on the account for login/recovery while notification emails are off from day one. `setNotifyPrefsWithToken` is exported from screeps-connectivity for bare-token use before a client session exists; the call is best-effort and never blocks the login.
- e74c83c: Upload and manage binary WebAssembly modules in the code editor. The module list gains an upload button for `.wasm` files; a binary module shows up as `<name>.wasm` and opens a summary panel (size, download, replace) instead of the text editor. On save it is sent through `/api/user/code` as a `{ binary: <base64> }` value, the format the official server stores WASM modules in. screeps-connectivity now types the code endpoints: `code.get` returns the new `ApiUserCodeResponse`, and `code.set` plus the `user:code` socket event carry `ApiCodeModule` (`string | { binary: string }`) — both types are exported.

### Patch Changes

- 40f5076: Room renderer fixes and cleanups:

  - Storage, container, terminal, lab, nuker, powerSpawn, extractor and factory visuals now update during history playback and full reconciles — the diff and full update paths share one per-object update function.
  - Right/middle clicks no longer count as tile clicks or start a pan; navigation arrows trigger on tap instead of pointer-down, so a touch drag starting on one pans instead of navigating.
  - The PixiJS application is destroyed instead of leaking a WebGL context when the room view unmounts while the renderer is still initialising.
  - Canvas selection rings/boxes now follow the selection store, so a selected creep dying or a sidebar deselect clears its overlay.
  - Room updates apply their signals in one batch, so the render effect runs once per tick instead of several times.
  - Enabling the dark overlay builds the lightmap immediately instead of waiting up to a tick.
  - A failed flag move restores the flag at its previous position instead of silently deleting it.
  - The per-frame ticker consolidates its object loops, and the zoom limit is a single constant.

## 0.23.0

### Minor Changes

- 1accbd8: Console, log and memory panes can now pop out into separate browser windows.
  Popouts don't open their own server connection: the main window serves them
  over a BroadcastChannel RPC bridge and they reattach automatically after a
  main-window reload. Memory watches now always load their values typed over
  HTTP — the string-coerced WS payload only acts as a change signal — fixing
  the display of strings vs numbers, arrays, and keys deleted from Memory.
  Array elements are editable: bracket paths (`list[3]`) map to the dot form
  the server's path resolution understands.
- 3d31ab2: The popped-out world map now shows the custom UI at the bottom of its sidebar,
  like the inline map does. The popout loads the config segment, sends commands
  and receives their console answers over the existing host bridge, shows the
  resulting toasts in its own window, and hands a response's room over to the
  main window's room view. A popout opened by hand in a new tab picks up the
  per-server custom UI setting from the host, which it previously could not see.
- ae911fa: The world map can now pop out into a separate browser window or tab, with a
  collapsible sidebar carrying the overlay controls and room info boxes. The
  popout replaces the inline map — only one map exists at a time: opening the
  map in the main window closes the popout and vice versa. Selecting a room
  twice on the popped-out map navigates the main window's room view, and
  navigating the room view moves the popout's highlighted room in return.
  Popout hosts now answer every ping with a heartbeat, so a popout no longer
  reports the main window as unreachable while that window sits in a throttled
  background tab.

### Patch Changes

- 0b62464: The Custom UI editor now offers only the options the respective sidebar actually
  evaluates. The map section drops the `selection` and `tile` requirements, which
  it can never satisfy, and the `showIf.selType` field, which it never tests — both
  previously produced elements that stayed disabled or never appeared at all. The
  objects section drops `needs` entirely, since an object card ignores it. Configs
  are normalized on load, so form, preview and JSON view always agree; the parser
  stays tolerant, so existing segments keep loading.
- 3020fec: Swamp tiles are drawn with their border again. The decoration's
  `swampStrokeColor` and `swampStrokeWidth` were parsed and resolved but never
  reached a draw call, so only the fill was painted — and at alpha 0.4 over a
  dark themed floor that fill is nearly invisible, which made swamps look as if
  they were hidden underneath the ground. The swamp shape now gets the same
  stroke-then-fill pass the wall shape already used. Its translucency comes from
  an `AlphaFilter` rather than `Graphics.alpha`, because plain alpha is applied
  per-vertex: the translucent fill would blend with the border strokes beneath it
  instead of covering them, outlining every quadrant sub-path and showing the
  seams through as a grid.

## 0.22.0

### Minor Changes

- 35df8bd: Render portals in the room view — an animated well with a cyan ring welling up and being swallowed by a dark disc, plus a violet halo — and show their destination (linked, inter-shard aware) and decay countdown in the selection panel

### Patch Changes

- 0adbd5f: Stop the Custom UI editor's option fields from losing focus on every keystroke
- 564ce4e: Fix custom UI buttons often needing several presses before they react. The room's owner and controller reservation were rebuilt as fresh objects on every room update, so their signals fired once per tick; combined with the panel's per-run rebuild of its element list this recreated every button's DOM node each tick, and a button replaced between mousedown and mouseup never fires a click. Both signals now compare by value, and the sidebar panel and the per-object actions reuse stable entry objects.

  The structure counts and the room's user map are compared by value too, which stops the build panel and the room info panel from re-rendering on every tick of an idle room.

- b510e92: Pin the custom UI panel to the bottom of the sidebar in map view, matching room view
- b510e92: Label the controller level chip in the map sidebar's Selected/Cursor boxes as "RCL"
- b6b228d: Let server-hosted `/assets` requests through to the backend: the Vite dev server proxies `/assets` to `VITE_PROXY_TARGET`, and `screeps-client-proxy` forwards wrapped `/assets` paths instead of falling through to the SPA. Assets now load in dev and behind the proxy the same way they do when the client is served by the backend itself.

## 0.21.0

### Minor Changes

- 5253263: Carry the world map position in the URL so a view can be bookmarked.

  The map now writes its centre and zoom into the query as `?zoom=<z>&pos=<x>,<y>` — the same room
  coordinates the official client uses, where `.5` is a room's centre. Panning and zooming update the
  URL with `replaceState` once the view settles, so it never adds history entries and Back still leaves
  the map. Opening such a URL (or using Back/Forward) restores that exact view instead of dropping back
  to the account's start room, and switching shards keeps the position.

- afb753d: Give the console command line a persistent history and TypeScript autocompletion.

  The command history now survives a reload. It is stored per server — commands referencing a private
  server's creeps are meaningless on MMO — capped at 200 entries, and no longer records a command
  twice in a row. Failed commands are kept as well, since a rejected command is exactly the one worth
  recalling and fixing.

  Typing `.` opens a completion list drawn from the same in-browser TypeScript service the code editor
  uses, so `Game`, `Memory`, the room-object API and every game constant complete from
  `@types/screeps`. `Ctrl+Space` requests completions anywhere. The arrow keys drive the list while it
  is open and walk the history otherwise; `Escape` closes the list, or clears the input when there is
  no list.

  The TypeScript worker is only loaded once completions are actually requested, so a session that
  never uses them does not pay for it.

- 127adca: Add an alliance overlay to the world map, backed by the League of Automated Nations roster.

  A fourth overlay mode next to Owner / Mineral / None — on the official server only, since the
  roster describes nobody on a private one — tints each owned room in its alliance's colour and
  stamps the abbreviation along the room's bottom edge. Owner badges stay visible, so the tint
  says which alliance and the badge still says which player. The sidebar gains a colour legend
  while the mode is active, listing each alliance's rooms in the current viewport and sorted by
  them, so panning tells you who actually holds the region you're looking at. The room info box
  shows the owner's alliance for hover and selection regardless of overlay mode, and a player's
  profile page carries an alliance chip next to their name.

  The roster comes from `leagueofautomatednations.com/alliances.js`, fetched lazily the first
  time the overlay is selected — never for users who don't ask for it — and cached in
  `localStorage` for 6h, with a stale cache used as a fallback when the network fails. The feed
  ships `#000000` as the colour for every alliance, so colours are derived locally by hashing the
  abbreviation into a fixed palette, which keeps them stable across sessions.

### Patch Changes

- ef5eba7: Fix the decoration editor's inputs losing a drag or keystroke.

  The property list was rebuilt on every edit, so the browser lost the element it was dragging: a
  slider let go after a couple of pixels, a text field dropped focus after one character, and the
  colour picker closed itself. The controls now stay put while the values change, in the room
  sidebar's decorate panel and in the inventory dialog alike.

- 66bf09f: Drop solid-devtools and ship Solid's production runtime.

  The devtools are no longer used, so the `solid-devtools/vite` plugin, the `@solid-devtools/debugger`
  setup import in `index.tsx` and both dev dependencies are gone. With them goes
  `resolve.conditions: ['development']`, which was there to force Solid's `development` export for the
  debugger — it applied to production builds too, so releases shipped `solid-js/dist/dev.js` and the
  matching dev builds of `solid-js/web` and `solid-js/store`, with their warning paths and reactive
  bookkeeping. Builds now resolve `solid.js` / `web.js` / `store.js`.

  The dev server is unaffected: vite-plugin-solid adds the `development` condition itself when the
  command is `serve`.

- b6df4b5: Hide the room sidebar's Decorate button while room decorations are switched off.

  With the decorations setting off the room draws none of them and the client fetches none, so the
  editor's entry point led into an empty view. The mode button and its `4` shortcut are now gone
  along with the decorations, and the inventory's "edit in room" hand-off is offered only while they
  are on.

  Turning the setting off with the editor already open closes it back to view mode instead of leaving
  it stranded.

  The list of decorations placed in the room moved into decorate mode's sidebar as well — it is the
  counterpart to the picker's unplaced ones, and no longer takes up room above the selection, flag and
  build panels.

- 682f31e: Group the player profile's owned rooms by shard.

  The public profile listed every room in one flat grid, so on a multishard server a player's rooms
  from different shards sat side by side with nothing to tell them apart. They are now grouped under a
  shard heading, the same as the account overview already did. Single-shard servers still render one
  unlabeled grid.

- 66bf09f: Keep the CodeMirror bundle off the first load — it is roughly 162 kB gzip that no longer blocks
  startup.

  The three editor panels (script, segments, custom UI) were already `lazy()`, but the `vendor-codemirror`
  manual chunk also claimed `solid-codemirror`, which pulled solid-js in with it. Since the whole app
  needs solid-js, the entry chunk ended up statically importing the vendor chunk and `index.html`
  preloaded it, so every visitor paid for CodeMirror whether or not they opened an editor. Leaving
  `solid-codemirror` unassigned keeps solid-js in the eager graph and CodeMirror behind the dynamic
  imports it belongs to.

## 0.20.0

### Minor Changes

- be68680: Add the decoration inventory page at `/inventory`.

  Lists every decoration the account owns with its preview, rarity and type, filterable by type,
  theme and target room, and sortable new/old, rare/common or grouped by room. Activated items link
  straight to the room they sit in.

  The nav entry appears only when the server advertises the `inventory` feature in `/api/version`,
  which is the same gate the reference client uses — private servers without decorations keep the
  section hidden.

  Placing and removing decorations is not wired up yet; this view is read-only.

- 552bb32: Render `wallGraffiti` room decorations.

  Graffiti images now draw between the terrain and the objects, masked to the room's walls, with
  tint, per-graphic alpha, tiling, rotation and horizontal flip applied. The five alpha animations of
  the official renderer (`slow`, `fast`, `blink`, `neon`, `flash`) are driven off a single ticker
  callback, and `lighting`-enabled items are drawn a second time above the darkness overlay so they
  stay bright — the same trick the reference renderer's separate lighting layer performs.

  `ROOM_DECORATIONS_MOCK` gained a synthetic `wallGraffiti` entry so the path can be exercised
  without owning one.

- e33e5fc: Keep room decorations live.

  Room tick messages can carry a `decorations` field. `RoomStore` now forwards it as a new
  `room:decorations` event, and the room view merges those items by `_id` into the list it fetched
  over HTTP — so a decoration placed or edited while you are watching the room appears without a
  reload. The merge returns the previous list untouched when nothing actually differs, so a server
  that repeats the same payload every tick does not rebuild the decoration layer.

- 278230a: Mark structures disabled by the controller level with a pulsing red tile wash, matching the official client. Structures beyond the RCL cap (the ones farthest from the controller) and everything in an unowned or downgraded room now read as switched off in the room view.
- 0e8b382: Render `creep` and `object` room decorations.

  Creep overlays now apply to their owner's creeps, honouring the `!SEP!` name filter and its
  `exclude` inversion, skipping creeps that are still spawning, and following the body rotation when
  `syncRotate` is set. Object overlays apply to every object of their target type. Both support the
  alpha animations and per-graphic tint and alpha.

  Sizes for these two types arrive in the reference renderer's pixels rather than room cells, so they
  are converted on the way in — a 256 is 2.56 cells, not 256.

  The six identical object-visual creation blocks in `ObjectLayer` were collapsed into one helper.

- 975c619: Place decorations by dragging them around the room.

  Once a target room is picked, the decoration dialog shows the room's terrain with a frame over it:
  drag to move, eight handles to resize, and a grip to rotate. Which of the three is offered comes
  from the decoration's own schema — a read-only `rotation` means no rotate grip — and `proportional`
  decorations keep their aspect ratio while resizing.

  The room is drawn as flat terrain rather than a full render: walls are what matters when placing
  graffiti, which only shows on them.

- 4d4167f: Place and edit room decorations in the room view itself, instead of on a separate 2D canvas.

  A new Decorate mode (the palette button beside View / Flag / Build, or `4`) lists the decorations
  the account owns but has not placed; picking one drops it into the middle of the room, where it is
  visible before it is ever activated. Clicking one of your already-placed decorations in the room
  sidebar opens the same editor for it.

  Either way the frame is dragged, resized and turned over the live, ticking room, with the artwork
  following it wall-masked and tinted as it will really look. The sidebar carries the same numbers
  and properties the dialog offers, so colours, alpha and animation update live too.

  While editing, the camera parks on the whole room and stops panning and zooming — the decoration
  stays reachable end to end, and the frame can sit as HTML over the canvas. Right-click leaves the
  mode, a room change abandons the draft, and saving keeps the editor open rather than closing it
  under the re-read it triggers.

  Only rooms the account owns or reserves offer placement, and a type the room already holds — a
  second wall landscape, say — is greyed out in the list rather than failing on the server. While a
  graffiti is being placed, the hint over the room says it only shows where it covers walls, which
  is otherwise easy to read as nothing having happened.

  The dialog's 2D editor stays for decorations whose room is not the one on screen, and history
  playback still edits through the inventory — it is a read-only view of a past tick.

- 5a0355a: Bring world-map decorations up to the reference client.

  `map-stats` returns decoration definitions in a top-level dictionary keyed by the id each room
  stat references. That dictionary was previously discarded, so the map had to guess what a
  decoration was from its colour properties and could only ever tint plains and swamps. It is now
  resolved, which brings the map wall colour, both landscape overlay textures and graffiti.

  Colours follow the reference map layer's maths: each layer is desaturated by its own factor (0.48
  for walls, 0.5 for floors, 0.75 and 0.35 for the overlay textures) so a decorated room still reads
  as a map tile. Swamps mix 70% of the already-desaturated plain colour with 30% of the raw swamp
  colour.

  The road colour was being stored but never drawn — it now tints the map's road overlay.

  **Breaking (`screeps-connectivity`):** `MapStatsRoomData.terrainColors` and the `TerrainColors` type
  are replaced by `MapStatsRoomData.decorations` and the `MapRoomDecorations` / `MapLandscape` /
  `MapGraffiti` types. The store now reports raw decoration values and leaves the colour maths to the
  renderer.

- 5173461: Open the decoration editor straight from the room sidebar.

  Clicking one of your own decorations in the room's Decorations panel opens its editor. Decorations
  belonging to other players stay inert, since there is nothing to edit.

  The open editor now lives in the URL as `/inventory/<id>`, the way the reference client addresses
  it. That is what lets a link from the room open it at all — the dialog needs the inventory and the
  room list, which the inventory page already has.

- 268b592: Show room decorations in the sidebar and on the selected creep.

  The sidebar lists the decorations placed in the current room — landscapes, graffiti and object
  overlays — with their preview image, type and owner. Selecting a creep now shows which creep
  decorations actually apply to it, reusing the renderer's own owner and `!SEP!` name-filter matching
  so the panel cannot drift away from what is drawn.

  `screeps-connectivity` gained `user.decorations.inventory()` and `user.decorations.themes()`, plus
  the `ApiUserDecorationItem` and `ApiDecorationTheme` types and the display fields of a decoration
  definition (`name`, `rarity`, `theme`, `restricted`, `preview`, `groupDescription`).

- 4b3412e: Place and remove decorations from the inventory.

  Clicking a decoration opens an editor for its properties — colours, ranges, checkboxes, the
  animation preset, and the creep name filter with its `exclude` inversion — plus the target room,
  and activates or deactivates it.

  The room picker disables rooms that already hold a clashing decoration, following the reference
  client's rules: the combined `landscape` type blocks both halves, a wall and a floor landscape
  coexist, skins and object overlays clash only with their own type, and graffiti is unrestricted.
  Creep and badge decorations are account-wide and skip the room picker entirely.

  Geometry shows as numeric controls for now; dragging a decoration around a room preview follows.

  `screeps-connectivity` gained `user.decorations.activate()` / `.deactivate()`, a `reservation`
  flag on `user.rooms()`, and the `ApiDecorationProp` / `ApiDecorationProps` schema types.

- c4d9b82: Room decorations: rework the parsing foundation ahead of graffiti/creep/object rendering.

  - Decoration `brightness` props now scale HSL lightness like the official renderer instead of
    multiplying RGB channels — floor, wall, road and texture colours were visibly off whenever
    brightness was below 1.
  - Landscapes are first-wins per room (matching the reference renderer) instead of last-wins, and
    the combined `landscape` type is finally recognised as both a floor and a wall landscape.
  - Graffiti, creep and object decorations are parsed into typed lists (sprites with their
    `color`/`alpha`/`visible` prop references resolved, `!SEP!` name filters split, animation names
    validated). Rendering for them follows in a later change.
  - Turning the "room decorations" setting back on now re-fetches immediately instead of waiting for
    the next room change.
  - Decoration textures load through a shared, deduplicating cache.
  - `ApiRoomDecorationDef` gained the `landscape` and `badge` types plus `tiling`/`objectType`;
    `ApiRoomDecorationActive` gained the geometry, animation and targeting fields.

### Patch Changes

- 764b871: Fix moving an already-placed decoration failing with "Decoration already activated".

  The server rejects `activate` on a decoration that is already active, so editing one now takes it
  down first — the same two-step the reference client performs behind its "back edit" button. Because
  that leaves a moment where the decoration sits nowhere, a failure in the second step says the old
  placement is gone instead of reading as if nothing happened.

- 4d4167f: Show decoration changes in the room view without reloading the room.

  Placing or removing a decoration now re-reads `game/room-decorations` straight away. The room
  socket only carries decorations when the server volunteers them, so an activation made from the
  inventory — which leaves the room view mounted behind it — stayed invisible until the room was
  reloaded.

  Removals propagate as well. The re-read treats its response as authoritative instead of merging
  it onto everything seen so far, which could only ever add decorations: a deactivated one kept
  being drawn. Items that arrive over the socket while the read is in flight are still layered back
  on top, so the race that guarded against is unaffected.

- 465a257: Preselect the open room when placing an unplaced decoration from the inventory.

  Opening the inventory while a room is on screen is a strong hint about where a decoration is meant
  to go, so its room picker now starts there instead of on "Select a room…" — and the position editor
  comes up with that room's terrain straight away.

  Only for decorations that are not placed anywhere: one that already sits in a room keeps pointing
  at it, and a room chosen by hand is never overwritten. Rooms the account does not hold, and rooms
  whose decoration of that type is already taken, are skipped.

- 1a9556f: Fix the decoration editor crashing on open.

  A memo evaluated at setup read an accessor declared further down the component, so opening any
  decoration that offers a position editor threw `Cannot access 'selectedRoomName' before
initialization`. The room accessors now sit above their first use.

- 6e815d6: Keep the owner badge upright on a moving creep.

  The badge sits inside the creep's rotating body container so the store fill can cover it, and
  counter-rotated by a fixed quarter turn — which only cancelled the idle heading. Once the creep
  moved, the badge tilted with it. Facing changes now go through one helper that keeps the badge
  level at any heading, including a badge that arrives after the creep is already on screen.

- ecdadcf: Fix `syncRotate` creep decorations rendering a quarter turn counter-clockwise.

  The artwork is drawn for the reference renderer, whose creep container faces
  `atan2(dy, dx) + π/2` — zero means "moving up". Ours faces plain `atan2(dy, dx)`, so an
  overlay inheriting that rotation landed 90° off.

- f31e5c8: Send the shard with flag-name lookups. `genUniqueFlagName()` and `checkUniqueFlagName()` now take an optional `shard`, and the client passes the shard of the room being viewed. Without it, official multi-shard servers rejected both calls with `invalid shard`, so the flag form could not generate or validate a name.

  `addGlobalIntent()`, `setNotifyWhenAttacked()`, `createInvader()` and `removeInvader()` gained the same optional `shard` argument — the official client sends one on all four, and they were previously unusable on multi-shard servers for the same reason.

  `tick()` also takes an optional `shard`, and with one it queries the official server's per-shard route `/api/game/shards/tick` instead of the shardless `/api/game/tick`, which only private servers provide. Calls without a shard are unchanged.

- 47b7b75: Fix the inventory's room, theme and decoration lists never loading or refreshing.

  All three took their dependency by reading it inside the fetcher, which `createResource` runs
  exactly once — so whatever wasn't ready when the page mounted stayed missing for the rest of the
  session. The room picker was hit hardest, since it also needs the user id. They now take their
  dependency as a source signal, and the room list refreshes when the editor opens so claiming or
  losing a room mid-session can't leave a stale picker.

## 0.19.0

### Minor Changes

- 6f45a4b: Add the world and power leaderboards.

  **screeps-client** — a new Leaderboard page (`/leaderboard/<mode>`) reachable from
  the header, modeled on the official client's Expansion Rank and Power Rank lobby
  pages: season picker, paged ranking table with badges linking through to player
  profiles, a name search that jumps to a player's page, and a "your rank" chip.
  Opening it without a page lands on the row of the player you're looking for —
  yours, or the one you searched or linked to. The account Overview and public
  Profile pages now show clickable current-month rank tiles that open the table on
  that row.

  **screeps-connectivity** — `http.leaderboard.list()` now takes an options object
  (`{ mode, season, limit, offset }`) instead of four positional arguments,
  `seasons()` accepts an optional mode, and `find()` omits `season` rather than
  sending an empty one so it returns every ranked season. All three routes are
  silent, since not every private server keeps ranking tables. Adds the
  `currentLeaderboardSeason()` and `normalizeLeaderboardRank()` helpers plus
  `LeaderboardMode`, `ApiLeaderboardEntry` and `ApiLeaderboardUser` types.

## 0.18.0

### Minor Changes

- 114e4b1: Render room-view minerals as a colour-tinted disc with a letter glyph (matching the reference client) instead of the spritesheet sprite: a bright stroked ring plus a dark fill and the mineral's letter in the ring colour, with per-mineral colours for H/O/U/L/K/Z/X. The spritesheet mineral frames are now used only for the map overlay, so room-view minerals stay crisp at every zoom level.
- 3b2c531: Show a damage-graded hits bar in the object property view. When a selected creep, structure, power bank or ruin is below full health, the selection panel now renders a thin fill bar beneath the numeric hits — green above ~66%, amber in the mid range, red when critical — so damage reads at a glance instead of only from the raw `hits / hitsMax` text. Full-health objects are unchanged. The RCL and store-fill bars now share a single reusable `MeterBar` component.

### Patch Changes

- 8e9f7ed: Centralize the HTML UI's GitHub-dark palette in `components/theme.ts`. The market and power section themes now re-export the shared tokens (unifying the near-duplicate raised-panel tone `#1c2129`/`#1c2128` on one value) and keep only their own accents; the market's `fmtAmount`/`fmtPrice` number formatters move to `utils/formatNumber.ts` next to `formatLargeNumber`. `MeterBar` consumes the shared tokens instead of hardcoded hex.
- 202bb3d: Remove the `l`/`c`/`y` keyboard shortcuts for the log, console, and memory panels. The `c` shortcut clashed with copy/paste; the panels remain toggleable via their toolbar buttons.
- f218429: Embedded clients are now configured from the first frame with no `/api/version` round-trip: both the xxscreeps mod and the classic server mod prefetch the version payload and inline it into the page (`window.__SCREEPS_BOOTSTRAP__`), and the client seeds it into both the pre-login UI and the connection. `ScreepsClient` gains an `initialVersion` option and `ServerStore` a `seedVersion()` method to support this.
- ddc2277: Deduplicate the two login screens: `components/login/shared.tsx` now holds the input styles, the password/token toggle, the server-password field, the error line, the connect button, the Steam/Discord buttons, and the shared server-capability probes (`serverHasSteam`, `serverHasDiscord`, `serverShowsServerPassword`). `LoginForm` and `DesktopLoginForm` consume these instead of carrying parallel copies. No behavior change.
- e678c10: Split the 4200-line `renderer/ObjectLayer.ts` into per-object modules under `renderer/objects/` — one file per object type (creep, spawn, tower, storage, terminal, lab, …) plus shared helpers, types and a `createObjectVisual` dispatcher. Pure internal refactor: the rendering output, the `ObjectLayer` class API and its animation/update logic are unchanged.
- 7cc40b4: Split the 1280-line `SelectionList.tsx` into `components/selection/` — one file per detail view (creep, flag, controller, extension, store structures, power bank, ruin, default), shared lookup tables/styles in `shared.ts`, and the type→component registry in `registry.ts`. `SelectionList.tsx` keeps only the list and item chrome. Pure internal refactor, no behavior change.

## 0.17.1

### Patch Changes

- e83d9da: Repack the sprite atlas without the storage and tombstone frames, which no longer have any code behind them. The spritesheet drops from 25 frames to 21 and gets a little smaller.
- 06a2c65: Remove the "Structure theme" setting. The default theme was the only complete one — the alternative, "Vector (procedural)", dropped every sprite-backed object down to a plain fallback — so the default becomes the only rendering path and the room view now looks the same for everyone.
- cafe90b: Draw storage procedurally instead of from the spritesheet. The shape now follows the official client's art — a rounded "barrel" shell with an owner-tinted outline over a grey inner box — replacing the old octagon, with the arcs transcribed from upstream's `storage-border.svg`. Resource bands are unchanged. The structure is scaled down to just over one tile rather than upstream's half-tile overhang in every direction, via a single `STORAGE_SCALE` constant.
- 0abba53: Redraw the terminal to follow the official client's art. The light inner octagon is replaced by the four arrows it stood in for, the plate is now a dark frame around a grey face, and the octagon outline picks up upstream's proportions. On send cooldown the arrows dim and the ring between octagon and plate pulses, rather than the arrow tabs glowing. The store fill is unchanged, but now fills the grey face exactly at capacity. Sized to just over a tile, matching storage.
- 3a68c21: Draw tombstones procedurally instead of from the spritesheet, and drop the black backing so the terrain shows through the headstone — only the outline and its mark remain. Tombstones now also fade out over their lifetime, from full opacity at death to nothing when they decay, on servers that report those times.

## 0.17.0

### Minor Changes

- 38b4198: Console improvements: the Log pane pause button now actually stops the feed (incoming messages are buffered while paused and flushed on resume, instead of just pausing the scroll), error lines are shown inline in arrival order at the bottom next to surrounding logs (previously every error was pinned above all log output), and a new regex filter button hides log/error lines that don't match the entered pattern.
- 8e9bbd7: Custom UI editor: a visual editor for the Custom UI ("SCUI") config segment, opened from Settings → Custom UI → "Open editor". Instead of hand-writing the JSON, build the map, room and object-action sidebars through a form — add/reorder/remove elements, pick each element's type (`button`, `select`, `status`, `header`), and set `label`, `cmd`, `options`, `path`, header `items`, object `obj`/`owner`, `needs`, `confirm`, and `showIf` (`selType`, room standing) with dedicated controls. A live preview column mirrors how the elements render in the sidebar, and a toggleable raw-JSON view (CodeMirror) stays in sync for power users. The editor loads and saves the configured segment directly, validates against the same schema the client enforces before saving, respects the 100 KB segment limit, and reloads the live sidebar config on save. If the segment holds non-Custom-UI JSON it opens the raw contents so you can fix them by hand.
- a6cb0b4: Add a "Smooth animations" toggle in Settings → Room View. When turned off, tick-driven animations snap to their new state instantly instead of interpolating between game ticks: creep movement, structure fill tweens (extensions, towers, storage, links, etc.), build glows, controller progress flashes, say bubbles, and the lab/terminal cooldown pulse. This reuses the renderer's existing instant mode (previously only engaged while scrubbing history). Wall-clock ambient effects that are not tied to tick timing — the source glow, tower barrel sweep, and keeper-lair pulse — keep animating.
- 64b08e0: Add `screeps-client-proxy`: a standalone local proxy that serves the browser client and forwards `/api` + `/socket` (including the game WebSocket) to any Screeps server, bypassing browser CORS — the same idea as the steamless client, but for the new client. Open `http://localhost:8080/` and the client shows the desktop-style server-list login; the selected backend is embedded in the request path (`/(https://server)/…`) so no library changes are needed. Content-hashed assets are served immutable and stable-URL assets revalidate (`304`), so caching is correct. In proxy mode the client persists its server list, token and saved credentials in `localStorage` so logins survive a restart.

## 0.16.0

### Minor Changes

- 66f88f8: Code panel branch management: create a new branch (clones the selected branch, with an inline name input) and set the selected branch to run on the server. The active-branch indicator now stays live via a new `set-active-branch` WebSocket subscription — `UserStore.subscribe('set-active-branch')` emits a `user:setActiveBranch` event whenever the active branch changes, including from another client or session.

  The code panel can now add and delete modules: an add button in the module list opens an inline name input, and hovering a module reveals a delete button (the `main` entry module is protected). Both changes are staged locally and persisted on the next Save.

  Also fixes a stale-response race in the code panel where switching branches while a previous branch's code fetch was still in flight could leave the editor showing the wrong branch's files.

- 47c34f1: Code panel TypeScript support: modules can now be authored in TypeScript with full in-browser IntelliSense — completion, hover type info, and inline diagnostics for the Screeps API — powered by a TypeScript language service running in a Web Worker. When creating a module you choose `.ts` or `.js` (a branch can mix both); the module list and tab show each module's language, and a Convert to TS / Convert to JS button switches an existing module's language in place (including the protected `main` entry module).

  TypeScript sources are transpiled to JavaScript on Save and pushed to the server as the runnable module, while the original `.ts` source is persisted alongside as a sibling `<name>.ts` module — hidden from the module list and never `require`d at runtime, so it survives reload without affecting the running code. The entry module still compiles to `main`. Type errors surface as squiggles but never block a Save (transpilation always emits). Each TS module also gets a read-only `<name>.js` (generated) entry that shows the transpiled output, live from the current source.

  The TypeScript compiler and standard-library typings are bundled offline (no CDN) and loaded lazily in a worker only when a TS module is first opened, so pure-JavaScript branches are unaffected.

- eb6f864: Custom UI: player-defined sidebar buttons driven by a memory segment. Pick a config segment (and optionally the shard to read it from) in Settings → Custom UI; the client renders the buttons it declares in the map and room sidebars. Clicking a button calls a single handler function in your bot code via the console API, passing a JSON payload with a correlation id and the current view context (shard, selected/current room, selected object ids and types, marked tile). Buttons can declare required context (`needs`) — they render disabled until it is present — and destructive ones can require a confirmation click (`confirm`).

  Beyond plain buttons there are `select` elements (dropdown + trigger, the chosen option travels as `value`), `header` separators — optionally with nested `items` whose visibility they gate — and `status` elements showing a live memory value (subscribed on the shard being viewed). `showIf` conditions hide elements contextually: `selType` requires a selected object of that type, `room` matches the room's standing from the player's perspective (`own`, `reserved`, `empty`, `foreign`). An `objects` section attaches buttons/selects to matching selected objects' cards in the selection list — filtered by object type and optionally by ownership (`own`/`foreign`) — passing the clicked object as `ctx.target`. While a command awaits its response the triggering element renders disabled with an ellipsis.

  Your bot answers by logging a line starting with the `SCUI` marker that echoes the id; the client turns it into a success/error toast, navigates to a room, inserts text into the console input (`console`), and/or re-reads the config segment (`reload`) — and reports "no response" after 15 seconds. Protocol lines are hidden from the Log/Console panes while the feature is enabled (toggleable in Settings for debugging). The segment format, payload shape, and a bot-side handler example are documented in docs/custom-ui.md.

- 1b547e3: Memory segment editor: a new "Segments" button in the console bar (next to Memory) opens a full-canvas overlay — like the code editor — for viewing and editing raw memory segments. Pick any of the 100 segments from the list (loaded sizes are shown alongside), switch shards on multi-shard servers, and edit the content in a CodeMirror editor with JSON highlighting. Header buttons pretty-print or minify the content as JSON and compress/decompress it with lz-string (`compressToUTF16`, with a raw-`compress` fallback on decompress). A live character counter tracks the 100 KB segment limit and blocks saving oversized content; switching segments or reloading with unsaved changes asks for confirmation.

## 0.15.0

### Minor Changes

- 57a7e1d: Hide the connection ("server") password field for xxscreeps servers.

  `screeps-connectivity` adds a `hasOfficialLike(version)` capability helper that
  detects the `official-like` feature advertised at `/api/version`. The login
  screens (web and desktop) now use it to hide the server-password field on
  xxscreeps servers, where the screepsmod-auth connection password does not apply.

- 3b9b951: Revamp the public profile page (`/profile/<username>`):

  - Header now mirrors the self Overview chrome — small badge, the player's name
    as the title, and a compact GCL/GPL readout rendered as rounded chips bordered
    in the rank color (teal / red).
  - The "Last 7 days" stat block is now a dropdown (1 hour / 24 hours / 7 days);
    the tiles refetch the user's public stats for the selected window.
  - Stat tiles now render correctly on servers that return `/api/user/stats`
    metrics as a single pre-summed total per interval, not just per-tick buckets
    (`ApiUserStatsResponse.stats` widened to `number | bucket[]`).
  - Cross-links between the two account views: the username on the self Overview
    links to the public profile, and your own public profile links back to your
    private Overview.
  - The top-bar Overview button no longer appears active while a profile is open —
    a profile is a separate view.

- 79bd3d0: Add a read-only per-room overview page at `/room-overview/<shard>/<room>` (or
  `/room-overview/<room>` on single-shard servers):

  - Header with the room name, owner (badge + profile link, or "Unclaimed room"),
    and a room minimap thumbnail that opens the live room view.
  - The same seven stat tiles as the account Overview, summed over a selectable
    interval (1 hour / 24 hours / 7 days).
  - A history graph rendering the six per-bucket metrics (energy harvested,
    construction, control, energy on creeps, creeps produced/lost) as
    opacity-scaled dot strips.
  - Entry points: a chart button next to each room name on the self Overview and
    public Profile pages, plus a button in the in-game room view's left toolbar
    (between the World Map and History buttons).
  - `screeps-connectivity`: the existing `game.roomOverview` endpoint is now typed
    with the new exported `ApiRoomOverviewResponse` (was `unknown`).

- 851580d: Add a top-level Messages screen with per-user conversation deep links. Messages now lives at `/messages` (moved out from under the User hub), and a specific conversation is deep-linkable at `/messages/<username>` — resolving the username to the user id for the message list/send endpoints, with browser back/forward support. Other players' profile pages gain a "Message" button (on messaging-capable servers) that opens the conversation with them, complete with the send box. The User overview's Mail button now navigates to the new route.

### Patch Changes

- 5d46b8e: Fix flag removal and color changes failing with "invalid shard" on multi-shard servers. `removeFlag` and `changeFlagColor` now accept and forward the current shard, matching the other room-scoped game endpoints.
- 7d5747c: Market: remember the room you opened it from (carried in the `?room` URL query) and pre-fill it into the resource "Target room" box, so shipping-range distances are calculated against your current room right away. Still freely editable.
- d136a15: Fix clicking a room in the Overview updating the URL but not switching to that room. Returning to the game view from an overlay route now re-syncs the room/shard/map view from the URL.

## 0.14.2

### Patch Changes

- 661a53f: Don't show the "Connection lost" modal after an intentional disconnect. A guest hitting Login (or any user logging out) tore the session down synchronously, but the socket's async `onclose` still fired `server:disconnected` with `willReconnect: false`, which re-raised a fatal session error over the login screen. The disconnected event now carries an `intentional` flag so the client can distinguish a user-initiated close from a genuinely lost connection.
- 96de46b: Move the room-view History toggle to the top-left below the World Map button, end history mode when switching rooms, and only show the button when the server advertises history support (`historyChunkSize` in `/api/version`).
- 9bc39f8: History viewer fixes and a couple of supporting connectivity additions:

  - Render terrain when reloading directly into history mode. Terrain loading was gated behind the room-subscription effect, which is skipped in history mode, so a fresh reload into a `#tick=` URL showed no terrain. Terrain/decoration loading now runs independently of history mode.
  - Open the history view at the start of the previous, fully-written chunk instead of the current tick (whose chunk isn't flushed yet), avoiding an immediate 404 + fallback round-trip.
  - Suppress the red failure toast when a history chunk is missing (404). `roomHistory` requests are now `silent`, and the viewer shows an in-room "No data available for this tick" hint instead, prompting the user to pick another tick from the timeline.
  - During playback, skip to the start of the next chunk when the current chunk is missing, instead of re-fetching the same non-existent file on every tick.
  - Expose `serverData.historyKeepTicks` (non-official field from the xxscreeps history mod) on the version types, used to size the history timeline's replayable range (falls back to a default window when absent).
  - HTTP errors thrown by `HttpClient` now carry a `status` property so callers can distinguish a 404 from other failures.
  - Dev-only: proxy `/room-history` to `VITE_PROXY_TARGET` in the Vite dev server.

- 76902c0: Only render non-public creep sayings to the creep's owner. The renderer previously drew every `say` bubble regardless of the `isPublic` flag, so private sayings could leak to other players on servers that don't filter them out. It now shows a saying only when `isPublic` is true or the creep belongs to the logged-in user.

## 0.14.1

### Patch Changes

- 23ed626: Consolidate scattered isTauri/isEmbedded/isXxscreepsMode checks behind a single capabilities() interface, with hasMarket/hasMessaging placeholders for future server-feature gating; dedupe the pre-login server-info hook shared by LoginForm and DesktopLoginForm.
- 94a6658: Add Discord OAuth login: getDiscordFeature() helper in screeps-connectivity, and a "Login with Discord" button in the web and desktop login forms.
- 0296bdf: Carry the shard as a URL path segment for the map and room views
  (`/map/shard0`, `/room/shard0/W11N11`) instead of a `?shard` query param. The
  shard segment is optional, so private servers reporting a single shard keep bare
  `/map` and `/room/W11N11` URLs. Old `?shard=` bookmarks still resolve.
- 46b5e2d: Fix Steam/password logins silently expiring after ~5 minutes on screepsmod-auth servers. These logins reconnect via a rotating, TTL-limited session token, but `TokenAuth` was hard-coded to ignore the server-issued `X-Token`, so the client kept replaying the original token until the server expired it — surfacing as a sudden `401` on `/api/user/world-status` (and every other authed request) even while actively using the client.

  `TokenAuth` now accepts `supportsTokenRefresh` (default `false`, preserving durable personal-API-token behavior). The client enables it for Steam/password-derived session tokens so the rotated `X-Token` is adopted on every response, keeping the session alive.

## 0.14.0

### Minor Changes

- 3ca699d: Render Source Keeper creeps as a red gem, matching invaders.
- 27b092e: Render keeper lairs as a dark disc with a pulsing red glow.
- 15d0c1f: Show a dismissable popup (reload/logout) instead of silently bouncing to the login screen when an already-connected session hits a fatal socket error or disconnect. Add a similar popup for 429 rate-limit responses from official servers, with a button to open the server's "disable rate limiting" link (opens the OS browser in the desktop app). Fix the map view not reloading terrain when switching shards — room names collide across shards, so the renderer's terrain cache was serving stale terrain from the previously viewed shard. Also removes the 5-minute sessionStorage cache on `fetchServerVersion` so the pre-login welcome screen always reflects the server's current `/api/version`.

### Patch Changes

- 8fd1a08: Fix Steam login failing with "auth failed" on brand-new accounts (e.g. xxscreeps). Some servers hand back a provisional token for a first-time OAuth signup that can't authenticate the websocket until a username is chosen; the login flow now detects this via `/api/auth/me` and prompts for a username before connecting. Adds `fetchAuthMeWithToken` and `completeProviderRegistration` to `screeps-connectivity`.
- 594073a: Rebuild client bundle to include screeps-connectivity update.
- b26940a: xxscreeps-mod-client now publishes an `xxscreeps-mod-client` server feature at `/api/version` reflecting `.screepsrc.yaml`'s `backend.allowGuestAccess`, `backend.allowEmailRegistration`, and `backend.steamApiKey`. screeps-client reads this via the new `getXxscreepsModClientFeature` helper (screeps-connectivity) to show or hide the Guest, "Create account", and "Login with Steam" options to match what the server actually allows, instead of guessing.

## 0.13.1

### Patch Changes

- cc7f5be: Add `MapStatName`, `MapStatPrefix`, `MapStatInterval` const objects and `mapStat()` helper for typed map-stats API access; add `TerrainColors` interface and decoration fields to `MapStatsRoomData`; expose `MapStatsStoreEvents` and `statName` in room events.

  Client: world map shard selector, "out of borders" black overlay, reveal-when-ready terrain/stats sync, mineral overlay on demand, room terrain decorations from player themes.

## 0.13.0

### Minor Changes

- 1539f52: Add Notifications section to Settings panel with email notification preferences: master enable/disable toggle, send interval, send-when-online, error notification interval, and new-message notification controls.
- e5b16a1: Refactor top-level navigation to use an overlay system: overview, profile, market, and settings now slide over the game canvas (preserving map position/zoom) instead of replacing the full page. Adds a shared `OverlayPage` template component. The map button moves into the room view as a floating corner button. Badge picker is accessible directly from the user menu dropdown.
- de39cf0: Make player usernames clickable everywhere they're shown (room selection panel, map room-info box, room-info panel) and rebuild the public profile into a full account dashboard: GCL/GPL rings, current-month leaderboard ranks, last-7-days stat tiles, and owned-room minimaps.
- abe0e3d: Spawn shows owner-badge background, energy-scaled core, and layers spawning creeps behind it.

### Patch Changes

- 4b8f9d9: Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.

## 0.12.2

### Patch Changes

- e73c85f: Add `setFetch()` to `screeps-connectivity` so consumers can supply a custom fetch implementation (e.g. Tauri's HTTP plugin) without patching `window.fetch`. `screeps-client` uses this to enable CORS-free HTTP in the standalone Tauri desktop app without affecting the browser runtime.

## 0.12.1

### Patch Changes

- db24504: Rebuild against screeps-connectivity 0.8.1 to include the single-quadrant world-bounds fix.

## 0.12.0

### Minor Changes

- fb4ab0a: Add a read-only Market section — all orders, my orders, and history — matching the vanilla client.
- 6d383dc: Add power bank room rendering (animated red ellipse inside an octagonal shell, sized by stored power) and a property panel showing power amount, hits, and ticks until decay.
- 620f551: Add Power Creeps pages — list, create, and per-creep power upgrades — from the Overview page.
- e0dac0b: Show stored power as a sweeping ring on the power spawn, matching the vanilla client.
- 3c7b10f: Pulse a terminal's four triangles while it's on send cooldown, matching the vanilla client.

## 0.11.0

### Minor Changes

- 58ba2bc: Render invader creeps as a red gem, matching the vanilla client.
- 2e21be5: Pulse a lab ring glow during reaction cooldown, and key the factory glow off absolute cooldownTime.
- 69d132d: Add an account Overview page (GCL/GPL rings, lifetime stats, per-room minimap previews) and a public Profile page with routing between them; optional dashboard endpoints (`user/overview`, `user/rooms`) now fail silently on servers that don't implement them.

### Patch Changes

- 97d6fdf: Spin the extractor ring only while on cooldown, matching vanilla.
- 2e67d21: Remove leftover debug logging from the memory store's user:memory handler.

## 0.10.0

### Minor Changes

- cb2129e: Animate lab reactions with converging white beams from the input labs to the output lab.

## 0.9.0

### Minor Changes

- e020835: Render mineral extractors as a continuously rotating ring (one full turn every 12s) drawn above the mineral: three gapped arc segments drawn procedurally with Graphics — no atlas frame, so it stays crisp at every zoom level. The ring is tinted by room ownership — owner green when the room is yours, hostile red when owned by someone else, and neutral grey when the room is unowned.
- 71ce50f: Show reservation vs. owner, RCL, and the controller sign in the world-map tooltip.
- 70c7dfb: Draw ramparts as a translucent overlay above structures and creeps with a glowing rim, plus a spawn progress ring.
- 0e72b67: Fill terminals, labs, nukers, and factories by stored resource, with storage/container resource bands sharing the mineral colour palette.
- f525f2b: Replace the top-right logout button with a username chip (badge + name) that opens an account dropdown. The dropdown holds Settings, Respawn (with a destructive confirmation dialog), Change/Set password, and Logout. Password management works for email/password and Steam sessions — Steam-only accounts without a password get a "Set password" flow — while pasted API-token and guest sessions hide it. Settings now opens from the dropdown (guests keep the header gear); the panel's existing close button is the only toggle. Trimmed the Settings panel of options already available directly in the room/map views (creep labels, map view options) and removed the "Verbose creep details" toggle — the body-part breakdown is now always shown.

  `screeps-connectivity`: `UserInfo` gains an optional `password?: boolean` field, surfaced from `/api/auth/me`, indicating whether the account has a password set.

### Patch Changes

- 8e12def: Only redraw walls and ramparts when they change, not every tick.
- dcc67d2: Fix room only partially loading when opened from the world map.
- d4dbba3: Poll world status frequently while waiting on a respawn or first-spawn placement so the client reacts almost immediately. When status is `lost` or `empty` the client now refreshes once a second instead of relying on the slow idle path, and triggering a respawn opens a short force-poll window that catches the state change even while the server still reports the old status.

## 0.8.0

### Minor Changes

- a40445a: Add structure energy visuals (spawn/link/source) plus link-transfer and creep-repair beams with impact glow.

## 0.7.4

### Patch Changes

- fc2a8e0: Keep the flag-creation name field stocked with a free name. After a flag is
  created the draft name is regenerated via `gen-unique-flag-name`, retrying with
  a short backoff so the server has time to register the new flag instead of
  handing back the name just used. When re-entering flag mode, the existing draft
  name is re-validated via `check-unique-flag-name` and regenerated if it has
  since been taken.
- 2e1c7fc: Support TexturePacker MultiPack sprite atlases. The default theme now loads only
  `sprite-0.json`; PixiJS follows `related_multi_packs` to pull in linked sheets,
  and `AtlasCache` merges frames from the spritesheet and its `linkedSheets` into
  one lookup so sprites split across multiple atlas pages render correctly.

  Render towers from the sprite atlas: a static `ring` tinted by ownership and a
  rotating `body` (the cannon), with the energy level drawn as a procedural rounded
  rect scaled by fill. When a tower attacks, heals, or repairs it now turns its
  barrel toward the target and draws a colored beam (red/green/cyan) for the action,
  then resumes its idle sweep from that position.

## 0.7.3

### Patch Changes

- 6262ce2: Cache-bust the sprite atlas JSON by client version. `public/` assets aren't
  content-hashed by Vite, so `themes/default/test.json` keeps a stable URL across
  releases and the embedded mod serves it without `Cache-Control` — browsers then
  cache it heuristically and keep stale frames after a spritesheet update (only
  the image inside the JSON carried a `?v=` hash). This left newly added sprites
  (e.g. deposits) blank on deployed servers while everything worked locally.
  Appending `?v=<clientVersion>` to the atlas URL forces a fresh fetch on each
  release; Pixi propagates the query to the atlas image, so resolution is
  unaffected.
- c7cf4bf: Use spritesheet sprites for minerals in both the room view and the map overlay.
  In the room view each mineral displays its type-specific sprite at 1.3× tile size.
  In the map overlay the sprite scales with density (density 1 is small, density 4 fills the room tile), replacing the previous coloured circle + letter glyph.

## 0.7.2

### Patch Changes

- b8cf7ec: Render deposits with proper artwork in the room view. The sprite atlas gains
  shape + fill frames for all four commodity types (biomass, metal, mist,
  silicon), and the renderer now draws a deposit as two stacked layers tinted by
  type using the official commodity colors. The fill layer is kept mostly
  transparent so the rock shape reads through. Falls back to the previous colored
  rectangle when no theme/atlas or an unknown deposit type is present.
- 3e90c89: Fix map rooms staying permanently black when zooming while terrain is still loading. `setRoomTerrain` captured the LOD at the start of the bake and only applied the texture if the LOD was still the same when the (async) bake finished — so zooming across the LOD threshold mid-bake left the sprite empty, yet the room was marked baked and never re-requested. Recovery was impossible because the raw terrain bytes were only kept at LOD 0, so `applyLOD` could never bake the missing LOD-0 texture for a room first baked at LOD 1.

  Raw bytes are now kept for every baked room (freed in `clearRoom`), and a shared `ensureCurrentLod` helper applies — or lazily bakes from raw — the texture for whatever LOD is current, both right after a bake and on every LOD change, in either zoom direction.

- 9523f3c: Make highway resources easier to spot on the world map. Power banks are now
  drawn as larger bright-red dots (radius 1.5 → 2.5) instead of small orange ones,
  and deposits — previously rendered as tiny muted-red "foreign" dots because
  their `d` map2 key fell through to the generic user-object path — now show as
  prominent white dots. The deposit key is documented on `RoomMap2Data`.
- b48571a: Make the room dark-overlay light pools follow creeps smoothly during movement.
  Lighting is now a GPU lightmap (a RenderTexture composited from a dark rect plus
  `erase`-blend light sprites) instead of a canvas re-baked once per tick, so each
  light tracks its creep's interpolated motion every frame instead of snapping at
  tick end — with no per-frame canvas redraw or texture re-upload.

## 0.7.1

### Patch Changes

- 36b7d97: Fix Safari/WebKit terrain tile caching (the real root cause this time). Reading a cached tile back via `Response.blob()` from the Cache API produced a blob whose `blob:` URL WebKit treats as cross-origin, so every decode — both `createImageBitmap(blob)` and the `HTMLImageElement` fallback — failed with `Cannot load blob:… due to access control checks`. On reload this surfaced as a flood of console errors and a stalling map. `getTerrainCacheBlob` now copies the cached bytes into a fresh, page-origin `Blob` (`arrayBuffer()` → `new Blob([...])`), which strips the taint so decoding works in every browser.
- 9581eb2: Fix slow, stuttering map terrain loading when zooming far out.

  - **No more main-thread freeze.** The cache-copy encode (`OffscreenCanvas` + `convertToBlob`) ran on the main thread once per baked tile; a batch of up to 200 rooms could lock up or completely hang the tab. The terrain worker now encodes the cache copy itself, off the main thread.
  - **Visible tiles no longer wait for caching.** The worker posts the baked bitmap back immediately and encodes + sends the cache copy as a separate follow-up message, so rendering is never gated behind the encode.
  - **No more duplicate fetches/bakes.** `hasRoom()` only turns true once a bake completes, so rooms already being fetched/baked were re-queued on every `visibleRooms` change, multiplying terrain requests and worker bakes. In-flight rooms are now tracked and excluded until their bake finishes.

  The now-unused `imageBitmapToBlob` helper is removed.

## 0.7.0

### Minor Changes

- cb3a324: Start directly in guest mode without flashing the login screen. When the client knows at boot that it will auto-connect — embedded xxscreeps mode (guest), a `?guest=` param, or a returning user with a stored token — it now shows a lightweight connecting splash instead of the `LoginForm` until the connection settles. The login form is only shown once the auto-connect attempt fails or when there is nothing to auto-connect.
- 9826156: Show the server message-of-the-day over the map in guest sessions. After connecting as a guest, the server's welcome text (the same HTML already shown on the login screen) appears centered over the map view, with a close button and a 15s auto-dismiss timer that pauses while the pointer is over it. It is shown once per session and never reappears after being dismissed.

### Patch Changes

- 67dc748: Fix blurry RoomVisuals text: replace PixiJS Text objects with a 2D canvas texture sized to `world.scale × devicePixelRatio × ROOM_SIZE`, giving a 1:1 physical pixel mapping at any zoom level. Eliminates GPU upsampling/downsampling that caused extreme text blur. Also fixes a crash (`source is null`) caused by `Texture.from` cache sharing; solved by always passing `skipCache: true` when recreating the texture on zoom changes.
- 2685f44: Fix two Safari/Firefox map view rendering bugs:

  - **Terrain tile caching never worked in Safari.** The Cache API write succeeded, but reading the cached WebP blob back via `createImageBitmap(blob)` failed in WebKit with an "access control checks" error (the internal `blob:` URL is treated as cross-origin). The error was swallowed and surfaced as a permanent cache miss, so every tile was re-baked. `blobToImageBitmap` now detects the gap once and falls back to decoding via an `HTMLImageElement` object URL, which works in every browser.
  - **Map view crashed when zoomed far out after a view switch** (`TypeError: null is not an object (evaluating 'r.addressModeU')`). `MapRenderer.destroy()` passed `texture: true` to `app.destroy()`, which also destroyed the globally shared `Texture.EMPTY` referenced by every empty/unbaked terrain sprite. The next renderer instance then crashed on rendering those tiles. Terrain textures are already destroyed manually, so `texture: true` was removed.

## 0.6.1

### Patch Changes

- 18c30de: Add animated fill-level rendering for containers. The container visual now shows a dark background with a filled rectangle that animates smoothly when store contents change.
- 6dd8ad7: Fix sprite atlas URL not resolving under `/client/` base path when running via `screeps-mod-client`. The atlas URL now uses `basePath()` so it is prefixed correctly for each build target.
- 36673a3: Add `Game.map.visual` rendering support. The map view now subscribes to the `mapVisual` WebSocket channel and renders player-drawn map visuals (lines, circles, rects, polys, text) on the world map canvas using PixiJS.

## 0.6.0

### Minor Changes

- d61f26f: - Add transfer action beam animation — creeps performing `transfer` now show an animated beam like harvest/build/upgrade
  - Add "Verbose creep details" toggle in Settings; when enabled the selection panel shows the full creep property list
  - Guest UI improvements: Code Editor button is hidden for guests; the Logout button becomes a green Login button in guest mode
  - Fix race condition in room URL effect when switching between map and room views

## 0.5.1

### Patch Changes

- f576993: Fix URL accumulation when navigating between room and map views in the xxscreeps build. The relative `BASE_URL` (`./`) used for the xxscreeps bundle was causing `basePath()` to return `'.'`, which made `history.pushState` calls use relative URLs that compounded `/room/` into the path on every navigation. Page reload also failed to parse the room from the URL for the same reason.
- 1e7161f: Add `http.game.roomHistory(room, time, shard?)` to `GameEndpoints` — handles both official server (path-based URL) and private server (query-param URL) automatically. `HistoryPlayer` in `screeps-client` is refactored to use this endpoint instead of a raw `fetch()` with manual token injection.

## 0.5.0

### Minor Changes

- de4fd47: Add memory watch panel with live WebSocket subscriptions, persistent watchlist, temp creep watch, and inline editing.

  `screeps-connectivity` gains `UserStore.subscribeMemory(path, shard?)` and a new `user:memory` event on `UserStoreEvents`. `screeps-client` adds a full Memory pane to the bottom bar: a persistent watchlist, a temporary per-creep watch triggered from the Eye button on the selection panel, a recursive type-aware `MemoryTree` with expand/collapse, insert-to-console, and inline leaf editing.

### Patch Changes

- f87b2a4: Fix unclaim, activateSafeMode and suicide buttons: all three sent an empty intent and a missing/undefined room. Now correctly sends room (currentRoom()), shard and intent: { id } as the official client does. Fix controller badge not updating when the room owner changes: the visual is now rebuilt whenever the owner field changes so the inner circle style and badge appear/disappear correctly.
- e018214: Render creep.say() messages as speech bubbles anchored to the creep, and interpolate creep movement linearly over the tick duration so motion stays smooth across slow ticks and history playback.
- 4e838c1: Use relative base path (`./`) for the xxscreeps embedded build so that asset references in `index.html` resolve relative to the served page URL. This ensures assets under `_client/` are requested at the correct subpath (e.g. `/client/_client/...`) regardless of where the mod mounts the client.
- 14a4f03: Fix flag move mode: setting the overlay action no longer re-triggers the room-change effect (was calling r.clear() + objLayer.destroy(), breaking rendering). Zoom is now preserved when navigating between rooms during a move. A "Target room" input in the flag detail panel lets you move flags to any room without navigating there first.

## 0.4.1

### Patch Changes

- 973e831: Rename Vite assets output directory from `assets/` to `_client/` to avoid collision with the game server's `/assets/` endpoint. The directory name is overridable via the `VITE_ASSETS_DIR` environment variable.

## 0.4.0

### Minor Changes

- 1f571fb: Add dedicated detail panels for controllers, extensions, and store structures in the selection sidebar. Controller panel shows RCL progress bar, safe-mode activation, and unclaim action. Extensions show energy fill and notify-when-attacked toggle. Storage, terminal, container, lab, factory, nuker, and powerSpawn show a fill level bar with per-resource breakdown. RoomInfoPanel now displays the current RCL percentage inline. Adds `y` keyboard shortcut for the memory panel.
- 9c24c2f: Add memory watch panel with live WebSocket subscriptions, persistent watchlist, temp creep watch, and inline editing.

  `screeps-connectivity` gains `UserStore.subscribeMemory(path, shard?)` and a new `user:memory` event on `UserStoreEvents`. `screeps-client` adds a full Memory pane to the bottom bar: a persistent watchlist, a temporary per-creep watch triggered from the Eye button on the selection panel, a recursive type-aware `MemoryTree` with expand/collapse, insert-to-console, and inline leaf editing.

### Patch Changes

- 31e9570: Fix destroying roads and walls in the property viewer when the user owns the room.

  Roads and walls carry no `user` field, so the destroy button was never shown.
  The fix falls back to `roomOwner().userId` for ownerless structures and
  correctly passes `room`, `roomName`, and an optional `shard` in the
  `destroyStructure` intent — matching the format the official client sends.
  `addObjectIntent` in `screeps-connectivity` now accepts an optional `shard`
  parameter.

## 0.3.5

### Patch Changes

- 31d438d: Fix stale visuals, selection data and duplicate chunk downloads in history mode; add instant-mode animations, debounced slider, URL hash permalinks (#tick=N), unified mode button row with Clock icon, and read-only action buttons in history mode. Restore road and rampart graphics after ObjectLayer.clear() so they remain visible when leaving history mode. Add Creep-Namen and Room-Visuals toggles to the room info panel. Fall back to the previous history chunk when the current one has not been written yet.

## 0.3.4

### Patch Changes

- 010e8c4: Add Memory tab to console panel with keyboard shortcut and flex-based split layout.
- 5e8af08: Fix crash when tracking creep ring overlays for destroyed PixiJS containers.
- cf6c9d7: Fix rooms outside world bounds being marked with the red unclaimable overlay and triggering unnecessary terrain/stats fetches. The visible-room list is now clamped to the world bounds rectangle, and a negative cache prevents re-fetching rooms the server returns no terrain data for.
- 7a20f8c: Fix crash when zooming out fast with uncached terrain tiles. A race condition caused the map renderer to destroy a terrain texture while the sprite still referenced it, leading to a PixiJS crash reading `alphaMode` from a null source. The sprite is now cleared before any texture it references is destroyed.
- 046b25c: Add room history mode: replay historical ticks via the screepsmod-history API with playback controls (step, play/pause, speed) in the sidebar and a timeline slider on the room canvas. Fix SPA catch-all in screeps-mod-client shadowing backend routes such as `/room-history` when the client is mounted at `/`.

## 0.3.3

### Patch Changes

- 0bd54f3: Add badge editor modal to settings panel with color picker, design selector, and variation controls. Export badge color utilities from library for use in UI components.
- c6cb87f: Add clear caches button in settings panel. Users can now clear IndexedDB, Cache API, and localStorage from the settings UI, with the page reloading afterwards. Session tokens are preserved.
- aa05da7: Integrate lucide-solid icon library. Replace Unicode fallback glyphs (✕ close buttons, ✓/✗ field indicators) with proper SVG icons from Lucide. Replace text labels in the dashboard header (Map, Code, Settings, Logout, nav arrows) with icon-only buttons and native browser tooltips.
- 45471d4: Improve map room ownership visualization with distinct overlays and enhanced room detail colors. Own rooms display with a blue overlay and green-tinted creeps/structures, while enemy-owned rooms display with a red overlay and muted red creeps/structures. Own walls render in green, foreign walls in red. Also fixes map mode to display by default when loading without a room and ensures map zoom persists only when viewing a specific room.
- 4375f2f: Add terrain visual effects: swamp glow (green atmospheric blur) and wall noise (rough stone grain overlay) with user-togglable setting in Settings panel.
- de6f984: Pre-render wall noise terrain as a texture sprite using the renderer. This improves rendering performance by avoiding per-frame NoiseFilter application on the wall noise graphics, and ensures proper cleanup of the generated texture on destroy.

## 0.3.2

### Patch Changes

- 64fcb46: Show the current client version in Settings and expose the embedded wrapper version for screeps-mod and xxscreeps deployments.
- f31f69e: Add two-finger pinch-to-zoom for the room view and world map view on touch devices. Zoom and pan work simultaneously during the pinch gesture. Also enables `touch-action: none` on the room canvas so the browser no longer interferes with pointer events.
- d86e8df: Fix rooms with no swamp tiles rendering entirely in swamp color.

  Calling `fill()`/`stroke()` on an empty PixiJS 8 path can reapply the style
  to the previous path context. Added a `pathDrawn` guard so the terrain
  stroke/fill is only applied when at least one tile was actually drawn.

- b14a86d: Fix foreign creep badge and username display in observed rooms.

  When observing a room from another player, newly spawned creeps weren't showing
  the owner's badge and displayed player ID instead of username. Fixed by:

  - Merging user data across ticks instead of replacing, preserving player info
  - Adding `badge?: Badge` to the users type throughout the codebase
  - Adding `refreshForeignCreepBadges()` to update creep visuals when badge data arrives

## 0.3.1

### Patch Changes

- 90ad28c: Batch terrain stroke/fill into a single call per terrain type to fix rendering artifacts on Firefox Mobile.
- 8e6e369: Enable antialiasing and render badges and structure textures at device pixel ratio scale for crisp output on HiDPI/retina displays.

## 0.3.0

### Minor Changes

- 464f9c3: Mods now depend on `screeps-client` instead of bundling their own copy of the client bundle.

  `screeps-client` ships three build variants under its published `dist/`:

  - `dist/standalone/` — `base=/`, no embedded flag (used for plain hosting)
  - `dist/embedded/` — `base=/client/`, embedded mode (used by `screepsmod-client-new`)
  - `dist/xxscreeps-mod/` — `base=/`, embedded + xxscreeps mode (used by `xxscreeps-mod-client`)

  `screepsmod-client-new` and `xxscreeps-mod-client` resolve the appropriate variant from the installed `screeps-client` package at runtime — they no longer carry their own `dist/` directory or build step. This removes the duplicate copy-into-mod step and makes the version coupling explicit.

### Patch Changes

- e761c02: Add `status` field to `MapStatsRoomData` so consumers can detect out-of-borders and restricted rooms. The client gains a "Show unclaimable rooms" toggle that highlights corridors, sector centres, owned rooms, and restricted areas on the world map.
- 421b330: Guest sessions are read-only: hide the View/Flag/Build mode switch (and its `2` / `3` keyboard shortcuts) when connected as guest. Snap the room view mode back to `view` whenever a guest session starts.
- bb05c68: In dev mode, default the login form's server URL to `window.location.origin` instead of a hard-coded `http://localhost:21025`. This makes the Vite proxy (`/api`, `/socket` → `VITE_PROXY_TARGET`) the default path for local development, regardless of which port Vite picks.
- 3043eac: Room rendering polish:

  - Terrain tweaks: darker wall/swamp fills + bolder borders for stronger silhouettes
  - Sources pulse gently from gold to near-white, in addition to the existing energy-driven size animation
  - Controllers in unowned rooms get a brighter octagon outline and a neutral center indicator so they remain legible without a badge
  - Minerals render as a colored disc + bold letter glyph (canonical Screeps palette: H/O/U/L/K/Z/X)
  - Tombstones rendered as a dome silhouette with an X glyph, tinted green (own) or red (foreign)
  - Ruins rendered as a broken-ring silhouette with an X glyph, same green/red ownership tinting

## 0.2.1

### Patch Changes

- d0af12a: Lazy-load the code editor and map viewer panels, and split `pixi.js` and CodeMirror into dedicated vendor chunks. Reduces the initial download by ~36% (319 kB → 204 kB gzipped) and fully defers CodeMirror until the code panel is opened. The mod packages re-ship the new client bundle.
