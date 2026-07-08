---
"screeps-connectivity": minor
"screeps-client": minor
---

Code panel branch management: create a new branch (clones the selected branch, with an inline name input) and set the selected branch to run on the server. The active-branch indicator now stays live via a new `set-active-branch` WebSocket subscription — `UserStore.subscribe('set-active-branch')` emits a `user:setActiveBranch` event whenever the active branch changes, including from another client or session.

The code panel can now add and delete modules: an add button in the module list opens an inline name input, and hovering a module reveals a delete button (the `main` entry module is protected). Both changes are staged locally and persisted on the next Save.

Also fixes a stale-response race in the code panel where switching branches while a previous branch's code fetch was still in flight could leave the editor showing the wrong branch's files.
