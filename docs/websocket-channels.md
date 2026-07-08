# WebSocket Channels Used By The Client

This document describes the WebSocket protocol and channel set currently used by the legacy client and the `app2` client bundles in this repository.

It is intended as a rewrite reference for building a new client that remains compatible with the existing Screeps socket backend.

## Scope

This document is based on:

- [config.js](/Users/bastianh/Development/screeps-client-reference/config.js:11)
- [run.js](/Users/bastianh/Development/screeps-client-reference/run.js:7)
- [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1)
- [app2/main.js.map](/Users/bastianh/Development/screeps-client-reference/app2/main.js.map:1)
- [app2/5.js.map](/Users/bastianh/Development/screeps-client-reference/app2/5.js.map:1)

The old AngularJS app contains the canonical socket provider. `app2` uses wrapper services built on top of the same backend.

## Endpoint

The default socket endpoint is configured in [config.js](/Users/bastianh/Development/screeps-client-reference/config.js:11):

```js
var WEBSOCKET_URL = 'https://screeps.com/socket/';
```

At runtime the app passes it through `SocketProvider.options.websocketUrl` in [run.js](/Users/bastianh/Development/screeps-client-reference/run.js:7).

The transport is `SockJS`, not a raw browser `WebSocket`.

## Legacy Socket Protocol

The legacy client socket implementation lives inside the `app.socket` provider in [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1).

### Connection flow

After opening the SockJS connection, the client does the following:

1. If the user is authenticated, send:

```text
auth <token>
```

2. If gzip is enabled in socket options, send:

```text
gzip on
```

3. Once auth succeeds, subscribe to all pending channels by sending:

```text
subscribe <channel>
```

4. On unsubscribe:

```text
unsubscribe <channel>
```

### Server control messages

The client explicitly handles these text messages:

- `auth ok <token>`
- `auth failed`
- `time <unix_ms>`
- `protocol <version>`
- `package <version>`
- `server down`
- `cannot subscribe`

### Event payload format

Normal event messages are JSON arrays:

```json
["channel-name", payload]
```

Error events are encoded by prefixing the channel with `err@`:

```json
["err@room:shard3/W1N1", payload]
```

The client strips `err@` and exposes the event as an error for the same logical channel.

### Compression

Some messages are delivered with a `gz:` prefix. The legacy client base64-decodes and gunzips them before JSON parsing.

## Channel Naming Conventions

The code uses a few stable channel families.

### Shard-qualified channels

On official servers, some channel names include the shard in the channel itself:

- `room:shard3/W1N1`
- `roomMap2:shard3/W1N1`
- `user:<id>/memory/shard3/creeps.worker1`

On non-official servers, the same channels omit the shard prefix:

- `room:W1N1`
- `roomMap2:W1N1`
- `user:<id>/memory/creeps.worker1`

### User-scoped channels

Many channels are namespaced as:

```text
user:<userId>/<topic>
```

## Channel Catalog

The following channels are actively used by this repository.

| Channel pattern | Used for | Source |
| --- | --- | --- |
| `server-message` | Global server maintenance or operator message dialog | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `room:<shard/>?<room>` | Main room state updates in the legacy room view | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `roomMap2:<shard/>?<room>` | World/minimap room object overlay updates | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1), [app2/main.js.map](/Users/bastianh/Development/screeps-client-reference/app2/main.js.map:1) |
| `mapVisual:<userId>/<shard>` or `mapVisual:<userId>` | New map visual stream used by `app2` world map | [app2/main.js.map](/Users/bastianh/Development/screeps-client-reference/app2/main.js.map:1) |
| `user:<me>/code` | Code branch/module update notifications | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<me>/set-active-branch` | Active code branch switch notification | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<me>/console` | Console output and evaluation results | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<me>/cpu` | Live CPU and memory usage pulse | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<me>/newMessage` | Unread message notification | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<me>/message:<otherUserId>` | Conversation thread updates with another user | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<userId>/resources` | User credits/resources refresh after auth | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<userId>/memory/<shard/>?<path>` | Memory path watch | [build.min.js](/Users/bastianh/Development/screeps-client-reference/build.min.js:1) |
| `user:<userId>/steam-purchase` | Steam purchase update hook in `app2` | [app2/main.js.map](/Users/bastianh/Development/screeps-client-reference/app2/main.js.map:1), [app2/5.js.map](/Users/bastianh/Development/screeps-client-reference/app2/5.js.map:1) |

## Per-Channel Notes

### `server-message`

Purpose:

- Display a dismissible server message dialog.

Observed consumer:

- `app.dlg-server-message`

Observed behavior:

- Payload is assigned directly to `message` and rendered by the dialog component.

### `room:<shard/>?<room>`

Purpose:

- Drive the primary legacy room view.

Observed behavior:

- The room controller subscribes to this channel.
- The error handler checks for `err@room:...` to detect room subscription errors.
- This appears to be the highest-value channel for a rewrite because it powers the main in-room state.

Payload expectations:

- Not fully decoded in this pass, but it represents room state sufficient to render objects, users, flags, visuals, and game info in the classic room view.

### `roomMap2:<shard/>?<room>`

Purpose:

- Drive room overlay/minimap data outside the main room channel.

Observed consumers:

- Legacy AngularJS map room objects directive
- `app2` decoration dialog room object overlay
- `app2` world map units service

Observed construction:

```ts
const url = this._shard ? `${ this._shard }/${ room }` : room;
this._socket.on(`roomMap2:${ url }`);
```

Source:

- [app2/main.js.map](/Users/bastianh/Development/screeps-client-reference/app2/main.js.map:1)

Observed payload handling:

- `app2` treats the event as `({ data: [, objects] }) => objects`
- The decoration directive passes `objects` to `drawObjects(...)`

Implication:

- The socket wrapper used in `app2` likely exposes the raw parsed JSON array as `data`, unlike the legacy AngularJS provider which dispatches by channel first.

### `mapVisual:<userId>/<shard>`

Purpose:

- Stream world map visuals in `app2`.

Observed construction:

```ts
const url = this._apiSrv.options.official ? `${ this._authSrv.Me._id }/${ shard }` : this._authSrv.Me._id;
return this._socket.on(`mapVisual:${ url }`)
```

Source:

- [app2/main.js.map](/Users/bastianh/Development/screeps-client-reference/app2/main.js.map:1)

Observed payload handling:

- `({ data: [, objects] }) => objects`
- `objects` is a newline-separated string
- Each line is parsed as JSON
- Parsed items are validated as one of:
  - line
  - circle
  - poly
  - rect
  - text

This is enough to reimplement the stream consumer without reverse-engineering the entire client.

### `user:<me>/code`

Purpose:

- Notify the editor/code UI about remote code changes.

Observed behavior:

- The callback receives an event object plus a boolean indicating whether the payload hash matches the local submit hash.

Used by:

- Code branch management and NW local file sync.

### `user:<me>/set-active-branch`

Purpose:

- Notify the client that the active branch changed for a named active slot.

Observed behavior:

- The callback checks `activeName` and applies the new `branch`.

### `user:<me>/console`

Purpose:

- Deliver console logs, eval results, and errors.

Observed payload shape:

- `messages.log`
- `messages.results`
- `error`
- `userId`

Observed behavior:

- Logs are printed to `window.console.log`
- Errors are printed to `window.console.error`
- Registered listeners are notified when `userId` matches the authenticated user

Related write path:

- Console commands are sent through HTTP `POST user/console`, not via the socket.

### `user:<me>/cpu`

Purpose:

- Deliver short-lived live CPU and memory usage.

Observed payload shape:

```json
{
  "cpu": <number>,
  "memory": <number>
}
```

Observed behavior:

- The top UI stores `cpuUsed` and `memoryUsed`
- The displayed values are reset after 10 seconds

### `user:<me>/newMessage`

Purpose:

- Notify the UI about new private messages.

Observed behavior:

- Messages index reload
- Top menu unread counter increment
- Optional UI attention marker

### `user:<me>/message:<otherUserId>`

Purpose:

- Deliver updates for a specific conversation.

Observed payload shape:

```json
{
  "message": {
    "_id": "...",
    "unread": true
  }
}
```

Observed behavior:

- Existing message is updated by `_id`, or appended if new
- Used both in the message thread and in the messages index unread-state watcher

### `user:<userId>/resources`

Purpose:

- Refresh authenticated user resource balances.

Observed payload shape:

```json
{
  "credits": <number>,
  "resources": { ... }
}
```

Observed behavior:

- Updates `Me.money` from `credits`
- Updates `Me.resources`

### `user:<userId>/memory/<shard/>?<path>`

Purpose:

- Watch a single Memory path.

Observed behavior:

- The path watch is only used for live updates
- Full reads and writes happen through HTTP:
  - `GET user/memory`
  - `POST user/memory`

Observed path construction:

```text
user:<userId>/memory/<path>
user:<userId>/memory/<shard>/<path>
```

### `user:<userId>/steam-purchase`

Purpose:

- Purchase-related update hook in `app2`.

Observed consumers:

- Enter page
- Inventory page

Observed behavior:

- The current code subscribes but does not yet process the payload.

## Recommended Rewrite Model

If you are building a new client, keep the socket layer separate from feature code.

### Minimum compatibility requirements

Implement:

1. SockJS transport
2. `auth <token>` handshake
3. Optional gzip decoding for `gz:` payloads
4. `subscribe <channel>` / `unsubscribe <channel>`
5. Support for control messages:
   - `auth ok`
   - `auth failed`
   - `time`
   - `protocol`
   - `package`
   - `server down`
   - `cannot subscribe`
6. Normal event parsing from `["channel", payload]`
7. Error event parsing from `["err@channel", payload]`
8. Automatic resubscribe after reconnect

### Recommended internal API

Expose something close to:

```ts
type SocketEvent<T = unknown> = {
  channel: string;
  payload: T;
  error: boolean;
};

interface SocketClient {
  connect(token?: string): Promise<void>;
  on<T>(channel: string): Observable<SocketEvent<T>>;
  off(channel: string): void;
  reconnect(): void;
}
```

### Recommended feature adapters

Build separate adapters for:

- room state
- roomMap2 overlays
- map visuals
- console stream
- code branch updates
- private messages
- cpu pulse
- memory path watches

That keeps channel-specific payload decoding out of the transport layer.

## Gaps And Unknowns

The following are still only partially decoded from this pass:

- Full payload schema for `room:<...>`
- Full payload schema for `roomMap2:<...>`
- Final payload contract for `steam-purchase`

The channel names and subscription patterns are reliable. The payload schemas above are only documented where the client code made them explicit.

## Quick Reference

```text
server-message
room:<shard/>?<room>
roomMap2:<shard/>?<room>
mapVisual:<userId>/<shard>
user:<me>/code
user:<me>/set-active-branch
user:<me>/console
user:<me>/cpu
user:<me>/newMessage
user:<me>/message:<otherUserId>
user:<userId>/resources
user:<userId>/memory/<shard/>?<path>
user:<userId>/steam-purchase
```
