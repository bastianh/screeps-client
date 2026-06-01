---
"screeps-client": patch
---

Fix sprite atlas URL not resolving under `/client/` base path when running via `screeps-mod-client`. The atlas URL now uses `basePath()` so it is prefixed correctly for each build target.
