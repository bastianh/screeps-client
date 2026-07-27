---
'screeps-connectivity': minor
'screeps-client': minor
---

Show room decorations in the sidebar and on the selected creep.

The sidebar lists the decorations placed in the current room — landscapes, graffiti and object
overlays — with their preview image, type and owner. Selecting a creep now shows which creep
decorations actually apply to it, reusing the renderer's own owner and `!SEP!` name-filter matching
so the panel cannot drift away from what is drawn.

`screeps-connectivity` gained `user.decorations.inventory()` and `user.decorations.themes()`, plus
the `ApiUserDecorationItem` and `ApiDecorationTheme` types and the display fields of a decoration
definition (`name`, `rarity`, `theme`, `restricted`, `preview`, `groupDescription`).
