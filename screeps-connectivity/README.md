# screeps-connectivity

TypeScript library for connecting to [Screeps](https://screeps.com) servers. Handles HTTP, WebSocket, authentication, data stores, caching, and persistent storage — with **zero production dependencies**.

Works in the browser and Node.js. Ships as ESM + CJS via tsup.

---

## Install

```sh
npm install screeps-connectivity
```

`FileStorage` (Node.js only) is a separate entry point so browser bundles stay clean:

```ts
import { FileStorage } from 'screeps-connectivity/file-storage'
```

---

## Quick start

```ts
import { ScreepsClient, TokenAuth, IndexedDBStorage } from 'screeps-connectivity'

const client = new ScreepsClient({
  url: 'https://screeps.com',
  auth: new TokenAuth({ token: 'your-auth-token' }),
  storage: new IndexedDBStorage('my-app'),
})

// Subscribe before connecting — fires once the eager fetch completes
client.stores.user.on('user:me', (info) => {
  console.log('Connected as', info.username)
})

await client.connect()

// Load terrain
const terrain = await client.stores.room.terrain('W7N7', 'shard0')

// Subscribe to live room updates
const roomSub = client.stores.room.subscribe('W7N7', 'shard0')
client.stores.room.on('room:update', ({ gameTime, objects }) => {
  console.log('Tick', gameTime, '— objects:', Object.keys(objects).length)
})

// Cleanup
roomSub.dispose()
client.disconnect()
```

---

## Features

### Authentication

Three built-in strategies, or implement your own via the `AuthStrategy` interface:

```ts
// Pre-issued token (official server, private servers with token auth)
new TokenAuth({ token: 'your-token' })

// Email + password — exchanged for a token on connect
new PasswordAuth({ email: 'user@example.com', password: 'secret' })

// Read-only guest access (xxscreeps-compatible private servers only)
new GuestAuth()
```

Screeps servers rotate the session token on every request. `ScreepsClient` tracks the latest token across both HTTP and WebSocket transports, keeps them in sync, and issues an idle keep-alive if no traffic has been seen for 30 seconds.

### Stores (event-based data layer)

All stores extend `EventTarget`. `store.on(type, handler)` returns a `Subscription` with a `dispose()` method. `SubscriptionGroup` composes multiple subscriptions for batch teardown.

| Store | `client.stores.*` | What it manages |
|---|---|---|
| `UserStore` | `user` | Identity, CPU stats, console output, code change events |
| `ServerStore` | `server` | Server version, shard list, world bounds, connection lifecycle |
| `RoomStore` | `room` | Terrain (binary), live object state + diffs, subscriptions |
| `MapStore` | `map` | `roomMap2` mini-map data, diff detection, LRU cache |
| `NavigationStore` | `navigation` | Bounded room-navigation history with back/forward |

### Room subscriptions

```ts
// Terrain — Uint8Array(2500), one byte per tile (values 0–3)
const terrain = await client.stores.room.terrain('W7N7', 'shard0')

// Live objects — first message is full state; subsequent messages are diffs
const sub = client.stores.room.subscribe('W7N7', 'shard0')
client.stores.room.on('room:update', ({ gameTime, objects, diff }) => { /* … */ })
```

### World map subscriptions

```ts
// Subscribe up to 500 concurrent roomMap2 channels (configurable)
// Excess rooms queue on a FIFO waitlist and are promoted as slots free
client.stores.map.subscribe('W7N7', 'shard0')
client.stores.map.on('map:roomMap2', ({ roomName, data }) => { /* … */ })
```

### World bounds

```ts
// Detects which quadrants (E/W, N/S) actually contain rooms
// Works for standard servers, private servers, and single-quadrant maps
const info = await client.stores.server.worldInfo()
// → { width, height, minX, maxX, minY, maxY }
```

### Storage adapters

| Adapter | Environment | Notes |
|---|---|---|
| `IndexedDBStorage` | Browser | Persists terrain and map cache across reloads |
| `FileStorage` | Node.js | Import from `screeps-connectivity/file-storage` |
| `NullStorage` | Any | Disables persistence (in-memory only) |

Implement `StorageAdapter` (`get`, `set`, `delete`, `keys`) to plug in any backend.

### Pre-login server info

```ts
import { fetchServerVersion, getScreepsmodAuth } from 'screeps-connectivity'

const version = await fetchServerVersion('http://my-server:21025')
const auth = getScreepsmodAuth(version)
// auth?.authTypes → ['password', 'steam']
```

---

## Architecture

```
ScreepsClient           — facade; wires everything together
  ├─ HttpClient         — fetch wrapper, auth headers, rate limiting, gzip
  │    └─ endpoints/    — auth · game · user · leaderboard · experimental
  └─ SocketClient       — WebSocket lifecycle, exponential-backoff reconnect
       └─ MessageParser — plain-text commands + JSON-array messages, gzip
DataStores              — UserStore · ServerStore · RoomStore · MapStore · NavigationStore
Cache                   — two-tier: in-memory Map + optional StorageAdapter
StorageAdapter          — binary interface (Uint8Array)
```

---

## Node.js usage

Pass a custom `WebSocket` constructor for Node 18/20 compatibility:

```ts
import { WebSocket } from 'ws'
import { ScreepsClient, TokenAuth, FileStorage } from 'screeps-connectivity'
// FileStorage is a separate entry point:
// import { FileStorage } from 'screeps-connectivity/file-storage'

const client = new ScreepsClient({
  url: 'https://screeps.com',
  auth: new TokenAuth({ token: 'your-token' }),
  storage: new FileStorage('./screeps-cache'),
  WebSocket,
})
```

---

## API reference

Full documentation — all stores, events, options, and types — is in [`docs/screeps-connectivity.md`](../docs/screeps-connectivity.md).

---

## License

ISC
