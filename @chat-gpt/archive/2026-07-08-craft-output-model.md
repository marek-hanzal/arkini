# Craft output model unification

Craft config no longer owns a separate `resultItemId`/`resultPlacement` path. Craft now uses the same producer-style `output` model as product lines. Source blueprints may still omit output only when the compiler can derive the guaranteed target from the blueprint id.

Runtime craft completion now removes the craft target and places rolled craft outputs through the shared `placeGameSaveItemsFx` pipe, seeded at the old craft target cell. This preserves producer-like board-first behavior, nearby placement, inventory fallback, and board stack merging for stackable rewards.

Quest rewards are just craft outputs. Keep quest guardrails intact: no blueprint rewards and no exact input item echo as reward.
