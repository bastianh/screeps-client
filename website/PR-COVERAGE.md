# Feature-page PR coverage ledger

This file tracks which merged pull requests have been reviewed for the public
feature page ([`index.html`](index.html), deployed to GitHub Pages via
`.github/workflows/pages.yml`).

**Policy:** feature and extension PRs are documented on the page (bundled into
thematic entries, not one entry per PR); performance PRs are summarized in the
page's Performance section; bug fixes, chores, refactors, and internal plumbing
are intentionally not documented.

**How to update:** when new PRs merge, append them to the table with a
disposition and fold any new features into the matching section of
`index.html` (add a section if none fits). Every merged PR gets a row here —
that is how we know where documentation work left off.

Last processed PR: **#252** — all merged PRs from #1–#252 are reviewed below
(gaps in the numbering are PRs that were closed without merging).

| PR | Title | Disposition |
|---:|---|---|
| [#252](https://github.com/bastianh/screeps-client/pull/252) | feat(client): render portals and show their destination | ✅ Documented — Parity |
| [#251](https://github.com/bastianh/screeps-client/pull/251) | Keep focus in the Custom UI editor's option fields | 🐛 Bugfix — intentionally not documented |
| [#250](https://github.com/bastianh/screeps-client/pull/250) | Pin map custom UI to the bottom and label the RCL chip | ✅ Documented — Custom UI |
| [#249](https://github.com/bastianh/screeps-client/pull/249) | fix: stop custom UI buttons from losing clicks | 🐛 Bugfix — intentionally not documented |
| [#248](https://github.com/bastianh/screeps-client/pull/248) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#247](https://github.com/bastianh/screeps-client/pull/247) | feat: proxy server-hosted /assets in dev and via screeps-client-proxy | ✅ Documented — Run it anywhere |
| [#246](https://github.com/bastianh/screeps-client/pull/246) | fix(client): keep decoration editor inputs alive while editing | 🐛 Bugfix — intentionally not documented |
| [#245](https://github.com/bastianh/screeps-client/pull/245) | feat(client): carry map position and zoom in the URL | ✅ Documented — World map |
| [#244](https://github.com/bastianh/screeps-client/pull/244) | fix(client): group profile rooms by shard | 🐛 Bugfix — intentionally not documented |
| [#243](https://github.com/bastianh/screeps-client/pull/243) | feat(client): alliance overlay on the world map | ✅ Documented — World map |
| [#242](https://github.com/bastianh/screeps-client/pull/242) | perf(client): keep CodeMirror off the first load, drop solid-devtools | ⚡ Performance — summarized in the Performance section |
| [#241](https://github.com/bastianh/screeps-client/pull/241) | feat(client): persistent console history and TypeScript completion | ✅ Documented — Developer tools |
| [#240](https://github.com/bastianh/screeps-client/pull/240) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#239](https://github.com/bastianh/screeps-client/pull/239) | feat(client): keep decorate mode behind the decorations setting | ⏭️ Skipped — minor gating tweak, covered by the decorations entries |
| [#238](https://github.com/bastianh/screeps-client/pull/238) | Edit room decorations in-room instead of on a separate canvas | ✅ Documented — Room view |
| [#237](https://github.com/bastianh/screeps-client/pull/237) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#236](https://github.com/bastianh/screeps-client/pull/236) | feat: mark RCL-disabled structures with a pulsing red tile wash | ✅ Documented — Parity |
| [#235](https://github.com/bastianh/screeps-client/pull/235) | feat: room decorations — render, place and manage them | ✅ Documented — Room view |
| [#234](https://github.com/bastianh/screeps-client/pull/234) | fix: send the shard on flag-name, intent and invader endpoints | 🐛 Bugfix — intentionally not documented |
| [#233](https://github.com/bastianh/screeps-client/pull/233) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#232](https://github.com/bastianh/screeps-client/pull/232) | feat: add world and power leaderboards | ✅ Documented — Parity |
| [#231](https://github.com/bastianh/screeps-client/pull/231) | Seed embedded client version from host mod (skip /api/version fetch) | ✅ Documented — Run it anywhere |
| [#230](https://github.com/bastianh/screeps-client/pull/230) | docs: refresh package table and client source-structure map | 📝 Docs — not documented |
| [#229](https://github.com/bastianh/screeps-client/pull/229) | refactor(client): share login building blocks between the two login forms | ♻️ Refactor — not documented |
| [#228](https://github.com/bastianh/screeps-client/pull/228) | refactor(client): split SelectionList into selection/ detail modules | ♻️ Refactor — not documented |
| [#227](https://github.com/bastianh/screeps-client/pull/227) | refactor(client): central UI theme tokens + shared number formatters | ♻️ Refactor — not documented |
| [#226](https://github.com/bastianh/screeps-client/pull/226) | refactor(client): split ObjectLayer into per-object renderer modules | ♻️ Refactor — not documented |
| [#225](https://github.com/bastianh/screeps-client/pull/225) | feat(client): damage-graded hits bar in the selection panel | ✅ Documented — Room view |
| [#224](https://github.com/bastianh/screeps-client/pull/224) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#223](https://github.com/bastianh/screeps-client/pull/223) | feat(client): render room-view minerals as tinted disc + letter | ✅ Documented — Parity |
| [#222](https://github.com/bastianh/screeps-client/pull/222) | feat(client): drop l/c/y hotkeys for log, console, and memory panels | ⏭️ Skipped — hotkey removal, too minor |
| [#221](https://github.com/bastianh/screeps-client/pull/221) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#220](https://github.com/bastianh/screeps-client/pull/220) | fix(connectivity): share ref-counted UserStore channel subscription | 🐛 Bugfix — intentionally not documented |
| [#219](https://github.com/bastianh/screeps-client/pull/219) | refactor(client): drop the structure theme setting | ♻️ Refactor — not documented |
| [#218](https://github.com/bastianh/screeps-client/pull/218) | Draw tombstones procedurally, and repack the atlas without the dead frames | ✅ Documented — Parity |
| [#217](https://github.com/bastianh/screeps-client/pull/217) | Render storage and terminal from the official client's geometry | ✅ Documented — Parity |
| [#216](https://github.com/bastianh/screeps-client/pull/216) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#215](https://github.com/bastianh/screeps-client/pull/215) | fix(xxscreeps-mod): serve client via route allowlist, not backend blocklist | 🐛 Bugfix — intentionally not documented |
| [#214](https://github.com/bastianh/screeps-client/pull/214) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#213](https://github.com/bastianh/screeps-client/pull/213) | fix(proxy): don't forward wrapped page URLs to the backend | 🐛 Bugfix — intentionally not documented |
| [#212](https://github.com/bastianh/screeps-client/pull/212) | Add screeps-client-proxy: standalone local proxy for browser client | ✅ Documented — Run it anywhere |
| [#211](https://github.com/bastianh/screeps-client/pull/211) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#210](https://github.com/bastianh/screeps-client/pull/210) | feat(client): visual editor for the Custom UI config segment | ✅ Documented — Custom UI |
| [#209](https://github.com/bastianh/screeps-client/pull/209) | feat(client): console pause, error ordering, and regex filter | ✅ Documented — Developer tools |
| [#208](https://github.com/bastianh/screeps-client/pull/208) | feat(client): smooth animations toggle for Room View | ✅ Documented — Room view |
| [#207](https://github.com/bastianh/screeps-client/pull/207) | feat(client): memory segment editor overlay | ✅ Documented — Developer tools |
| [#206](https://github.com/bastianh/screeps-client/pull/206) | feat(client): custom UI panels driven by a memory segment | ✅ Documented — Custom UI |
| [#205](https://github.com/bastianh/screeps-client/pull/205) | feat(client): TypeScript editing in the code panel | ✅ Documented — Developer tools |
| [#204](https://github.com/bastianh/screeps-client/pull/204) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#203](https://github.com/bastianh/screeps-client/pull/203) | Code panel branch and file management | ✅ Documented — Developer tools |
| [#202](https://github.com/bastianh/screeps-client/pull/202) | chore(deps): clear Dependabot noise — stray lockfiles + transitive vuln patches | 🧹 Chore / CI / deps — not documented |
| [#201](https://github.com/bastianh/screeps-client/pull/201) | chore(deps): upgrade dev dependencies and tooling | 🧹 Chore / CI / deps — not documented |
| [#200](https://github.com/bastianh/screeps-client/pull/200) | feat(client): pre-fill market target room from the room you opened it… | ✅ Documented — Parity |
| [#199](https://github.com/bastianh/screeps-client/pull/199) | feat(client): read-only per-room overview page | ✅ Documented — Parity |
| [#198](https://github.com/bastianh/screeps-client/pull/198) | fix(flags): forward shard on remove-flag and change-flag-color | 🐛 Bugfix — intentionally not documented |
| [#197](https://github.com/bastianh/screeps-client/pull/197) | feat(client): pre-fill market target room from current room | ✅ Documented — Parity |
| [#196](https://github.com/bastianh/screeps-client/pull/196) | fix(client): switch to the correct room when clicked in Overview | 🐛 Bugfix — intentionally not documented |
| [#195](https://github.com/bastianh/screeps-client/pull/195) | feat(client): top-level /messages route + per-user conversation deep links | ✅ Documented — Parity |
| [#194](https://github.com/bastianh/screeps-client/pull/194) | Revamp public profile page + user/overview cross-links | ✅ Documented — Parity |
| [#193](https://github.com/bastianh/screeps-client/pull/193) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#192](https://github.com/bastianh/screeps-client/pull/192) | feat(client): give User Messages view its own /user/messages route | ✅ Documented — Parity |
| [#191](https://github.com/bastianh/screeps-client/pull/191) | feat(client): hide server password field for xxscreeps servers | ✅ Documented — Run it anywhere |
| [#190](https://github.com/bastianh/screeps-client/pull/190) | fix(client): history viewer terrain, no-data handling, playback | 🐛 Bugfix — intentionally not documented |
| [#189](https://github.com/bastianh/screeps-client/pull/189) | fix(connectivity): accept xxscreeps 'actually, it was fine' as success | 🐛 Bugfix — intentionally not documented |
| [#188](https://github.com/bastianh/screeps-client/pull/188) | feat(client): move room history button to top-left, gate on server support | ✅ Documented — Room view |
| [#187](https://github.com/bastianh/screeps-client/pull/187) | fix(client): only show non-public sayings to the creep owner | 🐛 Bugfix — intentionally not documented |
| [#186](https://github.com/bastianh/screeps-client/pull/186) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#185](https://github.com/bastianh/screeps-client/pull/185) | fix(client): don't show connection-lost modal on intentional disconnect | 🐛 Bugfix — intentionally not documented |
| [#184](https://github.com/bastianh/screeps-client/pull/184) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#183](https://github.com/bastianh/screeps-client/pull/183) | fix(xxscreeps-mod-client): serve /map/<shard> SPA route instead of 404 | 🐛 Bugfix — intentionally not documented |
| [#182](https://github.com/bastianh/screeps-client/pull/182) | fix(auth): adopt rotating X-Token for steam/password session tokens | ✅ Documented — Run it anywhere |
| [#181](https://github.com/bastianh/screeps-client/pull/181) | feat(client): carry shard in map/room URL path | ✅ Documented — World map |
| [#180](https://github.com/bastianh/screeps-client/pull/180) | feat(client): add Discord login button | ✅ Documented — Run it anywhere |
| [#179](https://github.com/bastianh/screeps-client/pull/179) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#178](https://github.com/bastianh/screeps-client/pull/178) | feat(client): add unified capabilities interface | ✅ Documented — Run it anywhere |
| [#177](https://github.com/bastianh/screeps-client/pull/177) | fix(client): recoverable-error popups, shard terrain fix, drop pre-login version cache | 🐛 Bugfix — intentionally not documented |
| [#176](https://github.com/bastianh/screeps-client/pull/176) | fix(client): handle brand-new OAuth account signups in Steam login | ✅ Documented — Run it anywhere |
| [#175](https://github.com/bastianh/screeps-client/pull/175) | feat(xxscreeps-mod-client): gate login UI by .screepsrc.yaml backend settings | ✅ Documented — Run it anywhere |
| [#174](https://github.com/bastianh/screeps-client/pull/174) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#173](https://github.com/bastianh/screeps-client/pull/173) | feat(client): render Source Keeper creeps as the red gem | ✅ Documented — Parity |
| [#172](https://github.com/bastianh/screeps-client/pull/172) | feat(client): render keeper lairs with a pulsing red glow | ✅ Documented — Parity |
| [#171](https://github.com/bastianh/screeps-client/pull/171) | fix(connectivity): cache namespace collision between worlds on same domain | 🐛 Bugfix — intentionally not documented |
| [#170](https://github.com/bastianh/screeps-client/pull/170) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#169](https://github.com/bastianh/screeps-client/pull/169) | fix(client): correct Screeps Season server URL | 🐛 Bugfix — intentionally not documented |
| [#168](https://github.com/bastianh/screeps-client/pull/168) | fix(desktop): ad-hoc sign macOS builds + enable devtools for Windows debugging | 🐛 Bugfix — intentionally not documented |
| [#167](https://github.com/bastianh/screeps-client/pull/167) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#166](https://github.com/bastianh/screeps-client/pull/166) | feat(client): world map improvements — overlays, decorations, shard select | ✅ Documented — World map |
| [#165](https://github.com/bastianh/screeps-client/pull/165) | feat(desktop): server list login screen with OS keychain credential saving | ✅ Documented — Run it anywhere |
| [#164](https://github.com/bastianh/screeps-client/pull/164) | feat(client): room decoration rendering improvements | ⏭️ Skipped — folded into the decorations entries |
| [#163](https://github.com/bastianh/screeps-client/pull/163) | fix(connectivity): TokenAuth always uses its static token | 🐛 Bugfix — intentionally not documented |
| [#162](https://github.com/bastianh/screeps-client/pull/162) | feat(client): messages view in Overview overlay | ✅ Documented — Parity |
| [#161](https://github.com/bastianh/screeps-client/pull/161) | feat(client): overlay navigation system + topbar cleanup | ⏭️ Skipped — internal navigation refactor |
| [#160](https://github.com/bastianh/screeps-client/pull/160) | feat(client): clickable usernames + full player profile pages | ✅ Documented — Parity |
| [#159](https://github.com/bastianh/screeps-client/pull/159) | feat: standalone Tauri desktop app | ✅ Documented — Run it anywhere |
| [#158](https://github.com/bastianh/screeps-client/pull/158) | feat(client): notification preferences UI | ✅ Documented — Parity |
| [#157](https://github.com/bastianh/screeps-client/pull/157) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#156](https://github.com/bastianh/screeps-client/pull/156) | feat(client): spawn energy fill, badge background, creep layering | ✅ Documented — Parity |
| [#155](https://github.com/bastianh/screeps-client/pull/155) | fix(xxscreeps-mod-client): default mount path to / | 🐛 Bugfix — intentionally not documented |
| [#154](https://github.com/bastianh/screeps-client/pull/154) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#153](https://github.com/bastianh/screeps-client/pull/153) | feat: standalone Tauri desktop app (WIP) | ✅ Documented — Run it anywhere |
| [#152](https://github.com/bastianh/screeps-client/pull/152) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#151](https://github.com/bastianh/screeps-client/pull/151) | chore: auto-cascade screeps-connectivity bumps to screeps-client | 🧹 Chore / CI / deps — not documented |
| [#150](https://github.com/bastianh/screeps-client/pull/150) | chore: bump screeps-client and mods to pick up screeps-connectivity 0.8.1 | 🧹 Chore / CI / deps — not documented |
| [#149](https://github.com/bastianh/screeps-client/pull/149) | docs: add README files for screeps-connectivity and screeps-client | 📝 Docs — not documented |
| [#148](https://github.com/bastianh/screeps-client/pull/148) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#147](https://github.com/bastianh/screeps-client/pull/147) | fix(connectivity): correct world bounds for single-quadrant maps | 🐛 Bugfix — intentionally not documented |
| [#146](https://github.com/bastianh/screeps-client/pull/146) | feat(client): add power bank rendering (#144) | ✅ Documented — Parity |
| [#144](https://github.com/bastianh/screeps-client/pull/144) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#143](https://github.com/bastianh/screeps-client/pull/143) | feat(client): add read-only Market section | ✅ Documented — Parity |
| [#142](https://github.com/bastianh/screeps-client/pull/142) | feat(client): add power-meter ring to the power spawn | ✅ Documented — Parity |
| [#141](https://github.com/bastianh/screeps-client/pull/141) | feat(client): pulse terminal triangles on send cooldown | ✅ Documented — Parity |
| [#140](https://github.com/bastianh/screeps-client/pull/140) | feat(client): power creep management pages | ✅ Documented — Parity |
| [#139](https://github.com/bastianh/screeps-client/pull/139) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#138](https://github.com/bastianh/screeps-client/pull/138) | feat(client): account Overview & Profile pages with room previews | ✅ Documented — Parity |
| [#137](https://github.com/bastianh/screeps-client/pull/137) | fix(client): remove debug logging from memory store handler | 🐛 Bugfix — intentionally not documented |
| [#136](https://github.com/bastianh/screeps-client/pull/136) | feat(client): render invader creeps as the vanilla red gem | ✅ Documented — Parity |
| [#135](https://github.com/bastianh/screeps-client/pull/135) | feat(client): pulse lab and factory cooldown glows | ✅ Documented — Parity |
| [#134](https://github.com/bastianh/screeps-client/pull/134) | fix(client): spin extractor ring only while on cooldown | 🐛 Bugfix — intentionally not documented |
| [#133](https://github.com/bastianh/screeps-client/pull/133) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#132](https://github.com/bastianh/screeps-client/pull/132) | feat(client): animate lab reactions | ✅ Documented — Parity |
| [#131](https://github.com/bastianh/screeps-client/pull/131) | feat(client): poll world status while awaiting respawn/first-spawn | ✅ Documented — Parity |
| [#129](https://github.com/bastianh/screeps-client/pull/129) | feat(client): user menu + settings cleanup | ✅ Documented — Parity |
| [#128](https://github.com/bastianh/screeps-client/pull/128) | fix(connectivity): deep-merge room-object diffs to preserve nested store resources | 🐛 Bugfix — intentionally not documented |
| [#127](https://github.com/bastianh/screeps-client/pull/127) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#126](https://github.com/bastianh/screeps-client/pull/126) | feat(client): procedural rotating mineral extractor ring | ✅ Documented — Parity |
| [#125](https://github.com/bastianh/screeps-client/pull/125) | feat(client): resource-typed store fills for terminal, lab, nuker, factory | ✅ Documented — Parity |
| [#124](https://github.com/bastianh/screeps-client/pull/124) | feat(client): rampart vanilla overlay + glowing rim, spawn progress ring | ✅ Documented — Parity |
| [#123](https://github.com/bastianh/screeps-client/pull/123) | feat(client): map tooltip shows reservation, RCL, and controller sign | ✅ Documented — World map |
| [#122](https://github.com/bastianh/screeps-client/pull/122) | fix(client): seed ObjectLayer from full map on first render | 🐛 Bugfix — intentionally not documented |
| [#121](https://github.com/bastianh/screeps-client/pull/121) | perf(client): gate per-tick wall and rampart redraws | ⚡ Performance — summarized in the Performance section |
| [#119](https://github.com/bastianh/screeps-client/pull/119) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#118](https://github.com/bastianh/screeps-client/pull/118) | feat(client): structure energy visuals + action beams | ✅ Documented — Parity |
| [#117](https://github.com/bastianh/screeps-client/pull/117) | feat(client): render towers from atlas with aim + action beams | ✅ Documented — Parity |
| [#116](https://github.com/bastianh/screeps-client/pull/116) | feat(client): support TexturePacker MultiPack sprite atlases | ⏭️ Skipped — internal sprite-atlas plumbing |
| [#115](https://github.com/bastianh/screeps-client/pull/115) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#114](https://github.com/bastianh/screeps-client/pull/114) | fix(client): keep flag name field stocked with a free unique name | 🐛 Bugfix — intentionally not documented |
| [#113](https://github.com/bastianh/screeps-client/pull/113) | feat(client): render minerals with type-specific spritesheet sprites | ✅ Documented — Parity |
| [#112](https://github.com/bastianh/screeps-client/pull/112) | Add Claude Code GitHub Workflow | 🧹 Chore / CI / deps — not documented |
| [#111](https://github.com/bastianh/screeps-client/pull/111) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#110](https://github.com/bastianh/screeps-client/pull/110) | feat(mods): send Cache-Control headers for embedded client assets | ⏭️ Skipped — asset caching infrastructure |
| [#109](https://github.com/bastianh/screeps-client/pull/109) | fix(client): cache-bust sprite atlas JSON by client version | 🐛 Bugfix — intentionally not documented |
| [#108](https://github.com/bastianh/screeps-client/pull/108) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#107](https://github.com/bastianh/screeps-client/pull/107) | feat(client): render deposits with tinted shape+fill sprites | ✅ Documented — Parity |
| [#106](https://github.com/bastianh/screeps-client/pull/106) | feat(map): make power banks and deposits prominent white dots | ✅ Documented — World map |
| [#105](https://github.com/bastianh/screeps-client/pull/105) | perf(screeps-client): light pools track creep motion via GPU lightmap | ⚡ Performance — summarized in the Performance section |
| [#104](https://github.com/bastianh/screeps-client/pull/104) | fix(screeps-client): blank map room when zoom (LOD) changes mid-bake | 🐛 Bugfix — intentionally not documented |
| [#103](https://github.com/bastianh/screeps-client/pull/103) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#102](https://github.com/bastianh/screeps-client/pull/102) | perf(screeps-client): fix slow/stuttering terrain loading on zoom-out | ⚡ Performance — summarized in the Performance section |
| [#101](https://github.com/bastianh/screeps-client/pull/101) | fix(screeps-client): Safari terrain cache blob origin taint | 🐛 Bugfix — intentionally not documented |
| [#100](https://github.com/bastianh/screeps-client/pull/100) | chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates | 🧹 Chore / CI / deps — not documented |
| [#99](https://github.com/bastianh/screeps-client/pull/99) | feat(screeps-client): show server MOTD over the map for guests | ✅ Documented — Run it anywhere |
| [#98](https://github.com/bastianh/screeps-client/pull/98) | feat(screeps-client): start in guest mode without login flash | ✅ Documented — Run it anywhere |
| [#97](https://github.com/bastianh/screeps-client/pull/97) | fix(screeps-client): Safari map tile caching and zoom-out crash | 🐛 Bugfix — intentionally not documented |
| [#96](https://github.com/bastianh/screeps-client/pull/96) | chore(deps-dev): bump the npm_and_yarn group across 2 directories with 1 update | 🧹 Chore / CI / deps — not documented |
| [#95](https://github.com/bastianh/screeps-client/pull/95) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#94](https://github.com/bastianh/screeps-client/pull/94) | fix(screeps-client): crisp RoomVisuals text via zoom-adaptive canvas | 🐛 Bugfix — intentionally not documented |
| [#90](https://github.com/bastianh/screeps-client/pull/90) | feat: Game.map.visual rendering, ruin details, map visual toggle | ✅ Documented — World map |
| [#89](https://github.com/bastianh/screeps-client/pull/89) | feat(screeps-client): animated container fill-level rendering | ✅ Documented — Parity |
| [#88](https://github.com/bastianh/screeps-client/pull/88) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#87](https://github.com/bastianh/screeps-client/pull/87) | feat(screeps-client): batched wall rendering, canvas overlay, UI polish | ✅ Documented — Parity |
| [#86](https://github.com/bastianh/screeps-client/pull/86) | feat: room decoration rendering — textures, dark overlay, light glows | ✅ Documented — Parity |
| [#85](https://github.com/bastianh/screeps-client/pull/85) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#84](https://github.com/bastianh/screeps-client/pull/84) | feat(screeps-client): transfer beam, verbose creep details, guest UI improvements | ✅ Documented — Room view |
| [#83](https://github.com/bastianh/screeps-client/pull/83) | fix(xxscreeps-mod-client): inject <base href> to fix asset 404s on SPA route reload | 🐛 Bugfix — intentionally not documented |
| [#82](https://github.com/bastianh/screeps-client/pull/82) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#81](https://github.com/bastianh/screeps-client/pull/81) | fix(screeps-client): fix /room accumulation and reload in xxscreeps build | 🐛 Bugfix — intentionally not documented |
| [#80](https://github.com/bastianh/screeps-client/pull/80) | feat(screeps-connectivity): add http.game.roomHistory endpoint | ⏭️ Skipped — connectivity endpoint backing the history feature |
| [#79](https://github.com/bastianh/screeps-client/pull/79) | fix(screeps-client): unclaim/suicide/safeMode intents and controller badge refresh | 🐛 Bugfix — intentionally not documented |
| [#78](https://github.com/bastianh/screeps-client/pull/78) | fix(screeps-client): cross-room flag move, fix rendering bug and zoom reset | 🐛 Bugfix — intentionally not documented |
| [#77](https://github.com/bastianh/screeps-client/pull/77) | fix(screeps-client): construction site delete, ctrl-click/right-click conflict, spawn name loop | 🐛 Bugfix — intentionally not documented |
| [#76](https://github.com/bastianh/screeps-client/pull/76) | feat(screeps-client): console input command history (arrow up/down) | ✅ Documented — Developer tools |
| [#75](https://github.com/bastianh/screeps-client/pull/75) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#74](https://github.com/bastianh/screeps-client/pull/74) | feat(screeps-client): creep say bubbles and tick-synced movement | ✅ Documented — Parity |
| [#73](https://github.com/bastianh/screeps-client/pull/73) | fix(screeps-client): use relative base for xxscreeps build to fix asset 404s | 🐛 Bugfix — intentionally not documented |
| [#72](https://github.com/bastianh/screeps-client/pull/72) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#71](https://github.com/bastianh/screeps-client/pull/71) | fix: rename client assets dir to _client to avoid game server conflict | 🐛 Bugfix — intentionally not documented |
| [#70](https://github.com/bastianh/screeps-client/pull/70) | feat(screeps-client): controller & structure detail panels, RCL progress | ✅ Documented — Room view |
| [#69](https://github.com/bastianh/screeps-client/pull/69) | fix(xxscreeps-mod-client): default mount to /client, add API prefix exclusions | 🐛 Bugfix — intentionally not documented |
| [#68](https://github.com/bastianh/screeps-client/pull/68) | feat(renderer): sprite atlas theme system — storage first slice | ⏭️ Skipped — internal sprite-theme system, later superseded |
| [#67](https://github.com/bastianh/screeps-client/pull/67) | fix(memory): auto-fetch on open, fix decompress deadlock, improve editing UX | 🐛 Bugfix — intentionally not documented |
| [#66](https://github.com/bastianh/screeps-client/pull/66) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#65](https://github.com/bastianh/screeps-client/pull/65) | docs | 📝 Docs — not documented |
| [#64](https://github.com/bastianh/screeps-client/pull/64) | feat(ui): mode hints overlay and right-click to exit build/flag mode | ✅ Documented — Room view |
| [#63](https://github.com/bastianh/screeps-client/pull/63) | feat(storage): fill level indicator and structured property panel | ✅ Documented — Parity |
| [#62](https://github.com/bastianh/screeps-client/pull/62) | fix: enable road/wall destroy in property viewer for room owners | 🐛 Bugfix — intentionally not documented |
| [#61](https://github.com/bastianh/screeps-client/pull/61) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#60](https://github.com/bastianh/screeps-client/pull/60) | fix(history): improve history mode stability and room view toggles | 🐛 Bugfix — intentionally not documented |
| [#59](https://github.com/bastianh/screeps-client/pull/59) | feat: room history mode with playback controls | ✅ Documented — Room view |
| [#58](https://github.com/bastianh/screeps-client/pull/58) | feat(console): add Memory tab to bottom panel | ✅ Documented — Developer tools |
| [#57](https://github.com/bastianh/screeps-client/pull/57) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#56](https://github.com/bastianh/screeps-client/pull/56) | fix(screeps-client): clamp visible rooms to world bounds, add terrain negative cache | 🐛 Bugfix — intentionally not documented |
| [#55](https://github.com/bastianh/screeps-client/pull/55) | fix: terrain sprite crash on fast zoom-out with uncached tiles | 🐛 Bugfix — intentionally not documented |
| [#54](https://github.com/bastianh/screeps-client/pull/54) | Fix creep ring tracking for destroyed visuals | 🐛 Bugfix — intentionally not documented |
| [#53](https://github.com/bastianh/screeps-client/pull/53) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#52](https://github.com/bastianh/screeps-client/pull/52) | [codex] automate mod changesets for client releases | 🧹 Chore / CI / deps — not documented |
| [#51](https://github.com/bastianh/screeps-client/pull/51) | feat(screeps-client): auto-open badge picker for new players | ✅ Documented — Parity |
| [#50](https://github.com/bastianh/screeps-client/pull/50) | feat: add ColorPicker, enhance BuildPanel and SelectionList | ✅ Documented — Parity |
| [#49](https://github.com/bastianh/screeps-client/pull/49) | chore: update ai files | 🧹 Chore / CI / deps — not documented |
| [#48](https://github.com/bastianh/screeps-client/pull/48) | Pre-render wall noise as texture sprite | ⚡ Performance — summarized in the Performance section |
| [#47](https://github.com/bastianh/screeps-client/pull/47) | feat: integrate lucide-solid icon library | ⏭️ Skipped — internal icon-library switch |
| [#46](https://github.com/bastianh/screeps-client/pull/46) | Improve map room ownership visualization | ✅ Documented — Parity |
| [#45](https://github.com/bastianh/screeps-client/pull/45) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#44](https://github.com/bastianh/screeps-client/pull/44) | feat: add clear caches button in settings panel | ⏭️ Skipped — minor settings utility (clear caches) |
| [#43](https://github.com/bastianh/screeps-client/pull/43) | Add terrain visual effects (swamp glow and wall noise) | ✅ Documented — Parity |
| [#42](https://github.com/bastianh/screeps-client/pull/42) | docs: add LLM documentation | 📝 Docs — not documented |
| [#41](https://github.com/bastianh/screeps-client/pull/41) | Add badge editor modal to settings | ✅ Documented — Parity |
| [#40](https://github.com/bastianh/screeps-client/pull/40) | fix: prevent missing nav zones after room change, clean up badge sprites on failure | 🐛 Bugfix — intentionally not documented |
| [#39](https://github.com/bastianh/screeps-client/pull/39) | fix: terrain renders swamp color in rooms without swamp tiles | 🐛 Bugfix — intentionally not documented |
| [#38](https://github.com/bastianh/screeps-client/pull/38) | fix: display foreign player badges and names in observed rooms | 🐛 Bugfix — intentionally not documented |
| [#37](https://github.com/bastianh/screeps-client/pull/37) | [codex] Show client and mod versions in settings | ⏭️ Skipped — minor version display in settings |
| [#35](https://github.com/bastianh/screeps-client/pull/35) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#34](https://github.com/bastianh/screeps-client/pull/34) | feat(dev): configure Vite for external hostname (tailscale serve) | ⏭️ Skipped — dev-environment tooling |
| [#33](https://github.com/bastianh/screeps-client/pull/33) | feat(renderer): pinch-to-zoom for room and map views on mobile | ✅ Documented — Run it anywhere |
| [#32](https://github.com/bastianh/screeps-client/pull/32) | Feat/terrain cache as texture | ⚡ Performance — summarized in the Performance section |
| [#31](https://github.com/bastianh/screeps-client/pull/31) | chore: add changeset and pre-pr skills | 🧹 Chore / CI / deps — not documented |
| [#30](https://github.com/bastianh/screeps-client/pull/30) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#29](https://github.com/bastianh/screeps-client/pull/29) | fix(connectivity): prevent guest session logout on null room objects field | 🐛 Bugfix — intentionally not documented |
| [#28](https://github.com/bastianh/screeps-client/pull/28) | perf(renderer): cache terrain layer as GPU texture | ⚡ Performance — summarized in the Performance section |
| [#27](https://github.com/bastianh/screeps-client/pull/27) | fix(renderer): batch terrain stroke/fill to fix Firefox Mobile rendering artifacts | ⚡ Performance — summarized in the Performance section |
| [#26](https://github.com/bastianh/screeps-client/pull/26) | feat(map): add Show Unclaimable Rooms toggle | ✅ Documented — World map |
| [#25](https://github.com/bastianh/screeps-client/pull/25) | refactor(mods): depend on screeps-client instead of bundling its dist | ♻️ Refactor — not documented |
| [#24](https://github.com/bastianh/screeps-client/pull/24) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#23](https://github.com/bastianh/screeps-client/pull/23) | feat(client): default dev login URL to window.location.origin | ⏭️ Skipped — dev-environment default |
| [#22](https://github.com/bastianh/screeps-client/pull/22) | Hide room mode switch in guest sessions | ✅ Documented — Run it anywhere |
| [#21](https://github.com/bastianh/screeps-client/pull/21) | Polish room rendering: terrain, sources, controller, minerals, tombstones, ruins | ✅ Documented — Parity |
| [#20](https://github.com/bastianh/screeps-client/pull/20) | ci: bump release workflow actions to v6 (Node 24) | 🧹 Chore / CI / deps — not documented |
| [#19](https://github.com/bastianh/screeps-client/pull/19) | chore: version packages | 🧹 Chore / CI / deps — not documented |
| [#18](https://github.com/bastianh/screeps-client/pull/18) | ci: add PR checks workflow (reviewdog ESLint + Vitest annotations) | 🧹 Chore / CI / deps — not documented |
| [#17](https://github.com/bastianh/screeps-client/pull/17) | chore: make xxscreeps/express optional peer deps to drop legacy transitive vulns | 🧹 Chore / CI / deps — not documented |
| [#16](https://github.com/bastianh/screeps-client/pull/16) | perf(client): lazy-load editor/map and split vendor chunks | ⚡ Performance — summarized in the Performance section |
| [#14](https://github.com/bastianh/screeps-client/pull/14) | ⚡ perf: eliminate intermediate array allocations in drawPoly | ⚡ Performance — summarized in the Performance section |
| [#12](https://github.com/bastianh/screeps-client/pull/12) | ⚡ [performance] eliminate redundant array reduce in ObjectLayer | ⚡ Performance — summarized in the Performance section |
| [#11](https://github.com/bastianh/screeps-client/pull/11) | ⚡ Optimize MapRenderer Zoom Scaling Overhead | ⚡ Performance — summarized in the Performance section |
| [#10](https://github.com/bastianh/screeps-client/pull/10) | 🧪 Add tests for roomName utility functions in screeps-client | ⏭️ Skipped — test-only change |
| [#9](https://github.com/bastianh/screeps-client/pull/9) | 🔒 Fix insecure storage of server password | 🐛 Bugfix — intentionally not documented |
| [#8](https://github.com/bastianh/screeps-client/pull/8) | perf(map2): optimize map rendering and visibility checks | ⚡ Performance — summarized in the Performance section |
| [#7](https://github.com/bastianh/screeps-client/pull/7) | Optimize performance by avoiding intermediate arrays in hot paths | ⚡ Performance — summarized in the Performance section |
| [#6](https://github.com/bastianh/screeps-client/pull/6) | Fix RoomViewer terrain navigation bug | 🐛 Bugfix — intentionally not documented |
| [#5](https://github.com/bastianh/screeps-client/pull/5) | Refactor Map View background to use Web Worker, Cache API and Sprite Pooling | ⚡ Performance — summarized in the Performance section |
| [#4](https://github.com/bastianh/screeps-client/pull/4) | feat: double click to enter room on map | ✅ Documented — Room view |
| [#3](https://github.com/bastianh/screeps-client/pull/3) | feat: custom renderer shapes to match official screeps game objects | ✅ Documented — Parity |
| [#2](https://github.com/bastianh/screeps-client/pull/2) | Bump the npm_and_yarn group across 1 directory with 2 updates | 🧹 Chore / CI / deps — not documented |
| [#1](https://github.com/bastianh/screeps-client/pull/1) | Fix repository-wide lint and type errors | 🐛 Bugfix — intentionally not documented |
