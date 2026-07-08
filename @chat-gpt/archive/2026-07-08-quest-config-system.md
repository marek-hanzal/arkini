# Quest config system

Quest items are intentionally implemented as existing craft targets, not a new runtime subsystem.

Invariants:
- quest items carry tag `quest` and `craft-target`
- quest items use `storage: "both"` and `maxStackSize: 1`
- quest completion is a normal craft replacement into one modest reward item
- quest rewards must not be blueprints
- quest inputs must not include the exact reward item
- producers spawn quests as low-probability chance outputs
- quest icon is shared through `asset:item:quest` / `game/arkini/assets/item-quest.png`

Keep quests conservative. The board-slot annoyance is part of the cost, so rewards should be interesting, not a loot piñata wearing parchment cosplay.
