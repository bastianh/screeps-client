---
"screeps-client": patch
---

The Custom UI editor now offers only the options the respective sidebar actually
evaluates. The map section drops the `selection` and `tile` requirements, which
it can never satisfy, and the `showIf.selType` field, which it never tests — both
previously produced elements that stayed disabled or never appeared at all. The
objects section drops `needs` entirely, since an object card ignores it. Configs
are normalized on load, so form, preview and JSON view always agree; the parser
stays tolerant, so existing segments keep loading.
