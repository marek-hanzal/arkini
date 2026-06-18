# Bottom sheet / inventory UI polish

Status: DONE
Date: 2026-06-18

## Scope

Follow-up to the first UI overhaul foundation pass, driven by the screenshot review.

## Completed

- Simplified sheet headers: the primary label is now a normal `title`, not a shouting eyebrow.
- Inventory sheet header is deliberately only `Inventory`; no placement-mode explainer or slot-count copy in the header.
- Replaced the text `Close` button with a top-right `✕` icon button with an accessible label.
- Reduced the large rounded bottom-sheet corners and pushed common UI radius values toward small/minimal rounding.
- Reduced board/inventory TileEngine surface radius and common card/pill/control radii touched by this pass.
- Fixed the inventory bottom-sheet horizontal scrollbar by making the width parent-relative; this was later converted from `.ak-game-width` to direct Tailwind `w-full max-w-[430px]`.
- Moved tile quantity/level badges to `bottom-0 right-[8px]`; this was later tightened to `bottom-0 right-0` after follow-up screenshot review.

## Notes

No gameplay rules changed. Inventory placement mode still works through the existing double-tap action; only the sheet header copy was removed because the UI should not narrate itself like a cursed tutorial popup.
