---
"screeps-connectivity": minor
"screeps-client": minor
---

Render mod-defined custom objects from server metadata

Private-server mods can describe their own object types with
`config.backend.renderer.metadata['mytype']`, and the description arrives at the
client through `/api/version` → `serverData.renderer`. Until now those objects
drew as a plain grey rectangle.

`screeps-connectivity` types `serverData.renderer` and
`serverData.customObjectTypes` instead of carrying them as `unknown`.

`screeps-client` interprets the description: the expression mini-language
(`$state`, `$calc`, `$if`, arithmetic, comparisons) plus the `draw`, `sprite`,
`text`, `circle` and `container` processors, with `resources` textures resolved
against the server. Metadata that only vanilla objects use is not implemented,
and neither is the action/tween system — animated metadata renders in its resting
state. Types this client already draws itself keep their built-in visuals; only
types with no built-in creator are read from metadata.
