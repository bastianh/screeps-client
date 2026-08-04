# Custom UI — player-defined sidebar buttons

The client can render buttons you define yourself in the map and room sidebars.
Clicking a button calls a handler function in **your bot code** through the
console API; your code answers through a console log line, and the client shows
a toast or navigates to a room.

Enable it in **Settings → Custom UI**: pick the memory segment that holds your
UI definition (and optionally the shard to read it from).

The `map` elements also render in a popped-out world map, at the bottom of its
sidebar. Commands sent from there run against the same session; a response that
carries a `room` navigates the main window.

## Config segment format

The segment holds one JSON object. Keep it small — segments are capped at 100 KB
and you may want to share the segment with other data of your own.

```json
{
  "v": 1,
  "handler": "uiCommand",
  "map": [
    { "label": "Scout room", "cmd": "scout", "needs": ["room"] },
    { "label": "Claim room", "cmd": "claim", "needs": ["room"], "confirm": true }
  ],
  "room": [
    { "type": "header", "label": "Economy", "showIf": { "room": "own" }, "items": [
      { "type": "status", "label": "Energy", "path": "stats.energy" },
      { "label": "Evacuate room", "cmd": "evacuate", "confirm": true }
    ]},
    { "type": "select", "label": "Assign", "cmd": "assignSquad", "options": ["alpha", "beta"], "needs": ["selection"] },
    { "label": "Rally to tile", "cmd": "rally", "needs": ["tile", "selection"] },
    { "label": "Heal", "cmd": "heal", "showIf": { "selType": "creep" } },
    { "label": "Reserve", "cmd": "reserve", "showIf": { "room": ["empty", "reserved"] } }
  ],
  "objects": [
    { "label": "Harvest", "cmd": "harvestPB", "obj": "powerBank" },
    { "label": "Recycle", "cmd": "recycle", "obj": "creep", "owner": "own", "confirm": true },
    { "type": "select", "label": "Role", "cmd": "setRole", "options": ["harvester", "hauler"], "obj": "creep", "owner": "own" }
  ]
}
```

| Field | Meaning |
|---|---|
| `v` | Format version, must be `1`. |
| `handler` | Global function in your bot code that receives every command. Identifier path only (e.g. `uiCommand` or `global.ui`). |
| `map` / `room` | Elements for the world-map sidebar / the room-view sidebar. Max 32 each. |
| `objects` | Buttons/selects rendered inside each matching selected object's card in the room sidebar (max 32). Each entry needs `obj`: one object type or an array (e.g. `"creep"`, `["powerBank", "deposit"]`). Optional `owner`: `own` or `foreign` — only matches objects that carry a user (creeps, owned structures); it never matches neutral objects. The command carries the object as `ctx.target` (`{id, type, name?, x?, y?}`). Hidden in history mode. |
| `type` | `button` (default), `select`, `status`, or `header`. |
| `label` | Display text (max 40 chars, plain text). |
| `cmd` | Command name passed to your handler (button/select, max 64 chars). |
| `options` | Choices of a `select` element; the picked one is sent as `value` in the payload. |
| `path` | Memory path a `status` element displays live (subscribed on the shard you are viewing). |
| `items` | Child elements of a `header` (one level, no nested headers). They render indented, and the header's `showIf` gates the whole group; a header whose children are all hidden disappears too. |
| `needs` | Context the element requires; it is disabled otherwise. Any of `room` (selected room on the map / current room), `selection` (selected objects, room view), `tile` (marked tile, room view). `selection` and `tile` can never be met on the map, and `objects` entries ignore `needs` altogether — their context is implied by the object they hang on. |
| `confirm` | `true` → the element asks for a second click before firing. |
| `showIf` | Visibility conditions; the element is hidden when unmet. `selType`: at least one selected object of this type — room sidebar only, never met on the map, and superseded by `obj` in `objects`. `room`: the room's standing from your perspective — one value or an array of `own` (owned by you), `reserved` (reserved by you), `empty` (unclaimed), `foreign` (owned or reserved by someone else); on the map this applies to the selected room, in room view to the visited room. Works in all three sections. |

The editor (Settings → Custom UI) only offers the fields the respective sidebar
evaluates, so these restrictions are hard to run into from the form. Configs
written by hand may still contain the ineffective combinations — the parser
accepts them; opening such a config in the form view drops them.

While a command awaits its response, the triggering element is disabled and
shows an ellipsis; it re-enables when the response, an error, or the timeout
arrives.

Write the segment from your bot, e.g.:

```js
RawMemory.setActiveSegments([7])          // one tick earlier
RawMemory.segments[7] = JSON.stringify(uiConfig)
```

## Command payload

The client executes `<handler>(payload)` as a console command on the shard you
are currently viewing. `payload` is one JSON object:

```json
{
  "id": "9f3c1a2b",
  "cmd": "rally",
  "ctx": {
    "view": "room",
    "shard": "shard0",
    "room": "W7N7",
    "selection": [{ "id": "5f0a…", "type": "creep", "name": "Harvester1" }],
    "tile": { "x": 24, "y": 30 }
  }
}
```

`ctx.view` is `"map"` or `"room"`. On the map, `ctx.room` is the selected room
(if any); `selection`/`tile` only appear in room view when present. For a
`select` element the chosen option is included as a top-level `value` field.
Commands from an `objects` element additionally carry the clicked object as
`ctx.target` — use `Game.getObjectById(msg.ctx.target.id)` in your handler.

## Responding

Log a single line starting with `SCUI ` followed by JSON echoing the `id`:

```js
global.uiCommand = (msg) => {
  switch (msg.cmd) {
    case 'scout':
      startScout(msg.ctx.room)
      console.log('SCUI ' + JSON.stringify({ id: msg.id, msg: `Scout → ${msg.ctx.room}` }))
      break
    case 'rally':
      Memory.rally = { room: msg.ctx.room, ...msg.ctx.tile }
      console.log('SCUI ' + JSON.stringify({ id: msg.id, msg: 'Rally point set', room: msg.ctx.room }))
      break
    default:
      console.log('SCUI ' + JSON.stringify({ id: msg.id, err: `Unknown command ${msg.cmd}` }))
  }
}
```

Response fields (all optional, combinable):

| Field | Effect |
|---|---|
| `msg` | Success toast with this text. |
| `err` | Error toast with this text (wins over `msg`). |
| `room` (+ `shard`) | Client navigates to this room. `shard` defaults to the shard the command was sent to. |
| `console` | Text inserted into the console input (not executed) — useful for prepared commands the player finishes by hand. |
| `reload` | `true` → the client re-reads the config segment, so your bot can rebuild its own UI. |

A response with only the `id` shows a generic "done" toast. The response may
arrive later than the triggering tick (multi-tick operations) — the client
waits 15 seconds before reporting "no response". `SCUI` lines are hidden from
the Log/Console panes while Custom UI is enabled; turn "Hide protocol lines"
off in Settings → Custom UI to see them while debugging your handler.
