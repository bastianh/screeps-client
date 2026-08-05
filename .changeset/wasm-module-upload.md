---
'screeps-connectivity': minor
'screeps-client': minor
---

Upload and manage binary WebAssembly modules in the code editor. The module list gains an upload button for `.wasm` files; a binary module shows up as `<name>.wasm` and opens a summary panel (size, download, replace) instead of the text editor. On save it is sent through `/api/user/code` as a `{ binary: <base64> }` value, the format the official server stores WASM modules in. screeps-connectivity now types the code endpoints: `code.get` returns the new `ApiUserCodeResponse`, and `code.set` plus the `user:code` socket event carry `ApiCodeModule` (`string | { binary: string }`) — both types are exported.
