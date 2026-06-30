# Item detail action controls

Moved item-detail action branching out of leaf UI cards and into `src/v1/item-detail/control`.

Why:
- UI cards had started deciding between start/claim handlers from runtime booleans (`canRunAction`, `canClaim`, progress flags, pending flags).
- That made the presentational components a tiny second runtime controller.
- Detail cards should render ready controls, not derive gameplay action contracts.

Current shape:
- `readDetailCraftControl` packages craft primary action and withdraw actions.
- `readDetailProducerLineControl` packages product/effect primary action, default toggle action, progress metadata, and withdraw actions.
- `ItemDetailSheet` is the bridge that builds card models from live runtime state plus action handlers.
- Leaf panels receive `control` / line models and render `label`, `disabled`, `tone`, `onClick`, and progress fields directly.

Guardrail:
- Do not reintroduce `runState.canClaim ? onClaim : onStart` or similar branching inside `src/v1/item-detail/ui` cards.
