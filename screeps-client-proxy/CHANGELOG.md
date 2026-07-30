# screeps-client-proxy

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
