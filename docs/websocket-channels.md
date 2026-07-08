# WebSocket Channels Used By The Client

This document describes the WebSocket protocol and channel set used to talk to the Screeps socket backend.

It is intended as a rewrite reference for building a new client that remains compatible with the existing Screeps socket backend. Everything below — the handshake, the control messages, the channel names, and the payload shapes — is observable on the wire: connect a client, watch the WebSocket traffic, and the same protocol is visible.

## Endpoint

The default socket endpoint is:

```text
https://screeps.com/socket/
```

Private servers expose the same path on their own host.

The transport is `SockJS`. When a raw browser `WebSocket` is available, it connects to the SockJS raw-WebSocket endpoint at `/socket/websocket`, which speaks plain WebSocket without the SockJS session framing.

## Socket Protocol

### Connection flow

After the connection opens, the client does the following:

1. If the user is authenticated, send:

```text
auth <token>
```

2. If compression is enabled, send:

```text
gzip on
```

3. Once auth succeeds, subscribe to each desired channel:

```text
subscribe <channel>
```

4. To stop receiving a channel:

```text
unsubscribe <channel>
```

### Server control messages

The following text control messages are observed on the stream:

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

The `err@` prefix marks an error for the same logical channel.

### Compression

When compression is enabled, some messages are delivered with a `gz:` prefix. These are base64-encoded, deflate-compressed payloads that must be base64-decoded and inflated before JSON parsing.

## Channel Naming Conventions

The protocol uses a few stable channel families.

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

The following channels are actively used.

| Channel pattern | Used for |
| --- | --- |
| `server-message` | Global server maintenance or operator message dialog |
| `room:<shard/>?<room>` | Main room state updates in the room view |
| `roomMap2:<shard/>?<room>` | World/minimap room object overlay updates |
| `mapVisual:<userId>/<shard>` or `mapVisual:<userId>` | Map visual stream for the world map |
| `user:<me>/code` | Code branch/module update notifications |
| `user:<me>/set-active-branch` | Active code branch switch notification |
| `user:<me>/console` | Console output and evaluation results |
| `user:<me>/cpu` | Live CPU and memory usage pulse |
| `user:<me>/newMessage` | Unread message notification |
| `user:<me>/message:<otherUserId>` | Conversation thread updates with another user |
| `user:<userId>/resources` | User credits/resources refresh after auth |
| `user:<userId>/memory/<shard/>?<path>` | Memory path watch |
| `user:<userId>/steam-purchase` | Steam purchase update hook |

## Per-Channel Notes

### `server-message`

Purpose:

- Display a dismissible server message dialog.

Observed behavior:

- The payload is a message object rendered directly by a dialog.

### `room:<shard/>?<room>`

Purpose:

- Drive the primary room view.

Observed behavior:

- The room view subscribes to this channel.
- Subscription errors surface as `err@room:...` on the same channel.
- This is the highest-value channel for a rewrite because it powers the main in-room state.

Payload expectations:

- Represents room state sufficient to render objects, users, flags, visuals, and game info in the room view.

### `roomMap2:<shard/>?<room>`

Purpose:

- Drive room overlay/minimap data outside the main room channel.

Observed channel format:

- Official (multi-shard): `roomMap2:<shard>/<room>`
- Non-official: `roomMap2:<room>`

Observed payload handling:

- The event payload is a JSON array whose second element is the object collection for the room.

### `mapVisual:<userId>/<shard>`

Purpose:

- Stream world map visuals.

Observed channel format:

- Official (multi-shard): `mapVisual:<userId>/<shard>`
- Non-official: `mapVisual:<userId>`

Observed payload handling:

- The event payload is a JSON array whose second element is a newline-separated string.
- Each line is parsed as JSON.
- Parsed items are one of:
  - line
  - circle
  - poly
  - rect
  - text

### `user:<me>/code`

Purpose:

- Notify the editor/code UI about remote code changes.

Observed behavior:

- The payload carries an identifier plus a hash that lets the client tell whether the change matches its own most recent submit.

### `user:<me>/set-active-branch`

Purpose:

- Notify the client that the active branch changed for a named active slot.

Observed payload shape:

```json
{
  "activeName": "activeWorld",
  "branch": "<branch name>"
}
```

Observed behavior:

- The consumer checks `activeName` (`activeWorld` or `activeSim`) and applies the new `branch`.

### `user:<me>/console`

Purpose:

- Deliver console logs, eval results, and errors.

Observed payload shape:

- `messages.log`
- `messages.results`
- `error`
- `userId`

Observed behavior:

- Logs and errors are surfaced to the console UI.
- Listeners are notified when `userId` matches the authenticated user.

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

- The UI shows `cpu` and `memory`, resetting the displayed values after a short interval.

### `user:<me>/newMessage`

Purpose:

- Notify the UI about new private messages.

Observed behavior:

- Triggers a messages reload and an unread-counter increment.

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

- An existing message is updated by `_id`, or appended if new.

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

- Updates the user's credits and resources.

### `user:<userId>/memory/<shard/>?<path>`

Purpose:

- Watch a single Memory path.

Observed behavior:

- The path watch is only used for live updates.
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

- Purchase-related update hook.

Observed behavior:

- Subscribed to signal purchase state changes.

## Recommended Rewrite Model

If you are building a new client, keep the socket layer separate from feature code.

### Minimum compatibility requirements

Implement:

1. SockJS transport (or the raw `/socket/websocket` endpoint when WebSocket is available)
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

The following payload schemas are only partially characterized:

- Full payload schema for `room:<...>`
- Full payload schema for `roomMap2:<...>`
- Final payload contract for `steam-purchase`

The channel names and subscription patterns are reliable. The payload schemas above are documented only where they are directly visible on the stream.

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
