# screeps-client-proxy

## 0.1.9

### Patch Changes

- Updated dependencies [01a3551]
- Updated dependencies [7d2e2f4]
- Updated dependencies [40f5076]
- Updated dependencies [e74c83c]
  - screeps-client@0.24.0

## 0.1.8

### Patch Changes

- Updated dependencies [1accbd8]
- Updated dependencies [0b62464]
- Updated dependencies [3d31ab2]
- Updated dependencies [ae911fa]
- Updated dependencies [3020fec]
  - screeps-client@0.23.0

## 0.1.7

### Patch Changes

- b6b228d: Let server-hosted `/assets` requests through to the backend: the Vite dev server proxies `/assets` to `VITE_PROXY_TARGET`, and `screeps-client-proxy` forwards wrapped `/assets` paths instead of falling through to the SPA. Assets now load in dev and behind the proxy the same way they do when the client is served by the backend itself.
- Updated dependencies [0adbd5f]
- Updated dependencies [564ce4e]
- Updated dependencies [b510e92]
- Updated dependencies [b510e92]
- Updated dependencies [35df8bd]
- Updated dependencies [b6b228d]
  - screeps-client@0.22.0

## 0.1.6

### Patch Changes

- Updated dependencies [ef5eba7]
- Updated dependencies [5253263]
- Updated dependencies [afb753d]
- Updated dependencies [127adca]
- Updated dependencies [66bf09f]
- Updated dependencies [b6df4b5]
- Updated dependencies [682f31e]
- Updated dependencies [66bf09f]
  - screeps-client@0.21.0

## 0.1.5

### Patch Changes

- Updated dependencies [764b871]
- Updated dependencies [be68680]
- Updated dependencies [552bb32]
- Updated dependencies [e33e5fc]
- Updated dependencies [278230a]
- Updated dependencies [0e8b382]
- Updated dependencies [975c619]
- Updated dependencies [4d4167f]
- Updated dependencies [5a0355a]
- Updated dependencies [5173461]
- Updated dependencies [268b592]
- Updated dependencies [4d4167f]
- Updated dependencies [465a257]
- Updated dependencies [1a9556f]
- Updated dependencies [6e815d6]
- Updated dependencies [4b3412e]
- Updated dependencies [ecdadcf]
- Updated dependencies [f31e5c8]
- Updated dependencies [c4d9b82]
- Updated dependencies [47b7b75]
  - screeps-client@0.20.0

## 0.1.4

### Patch Changes

- Updated dependencies [6f45a4b]
  - screeps-client@0.19.0

## 0.1.3

### Patch Changes

- Updated dependencies [8e9f7ed]
- Updated dependencies [202bb3d]
- Updated dependencies [f218429]
- Updated dependencies [ddc2277]
- Updated dependencies [e678c10]
- Updated dependencies [114e4b1]
- Updated dependencies [3b2c531]
- Updated dependencies [7cc40b4]
  - screeps-client@0.18.0

## 0.1.2

### Patch Changes

- 0e3915e: Only proxy the backend paths the client actually requests (`/api`, `/socket`, `/room-history`). Navigating to a wrapped page URL like `/(https://screeps.com)/` no longer serves the backend's website — it redirects to the client, whose login screen picks the server. The startup log now prints the plain `http://host:port/` URL, and SPA deep links work in pinned-backend mode instead of being forwarded to the backend.

## 0.1.1

### Patch Changes

- Updated dependencies [38b4198]
- Updated dependencies [8e9bbd7]
- Updated dependencies [a6cb0b4]
- Updated dependencies [64b08e0]
  - screeps-client@0.17.0
