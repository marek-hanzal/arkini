# Town Hall upgrade input: selected line state must not block consumption

Context: Town Hall II blueprint is produced from Town Hall I, then needs Town Hall I as a craft input to finish the upgrade.

Bug: selecting the Town Hall I default production line writes `save.lines[itemInstanceId]`. That state was treated as producer runtime state, so the input resolver/UI availability considered the Town Hall I busy/preservable and rejected it as a craft input. This hard-locked progress after producing the Town Hall II blueprint.

Decision: `save.lines` default line selection is control/UI state, not real runtime state. It must be cleaned up when the item is consumed, but it must not block consumption as a craft input.

Still blocking as real runtime state:
- running producer jobs
- stored producer inputs
- producer charges
- craft jobs / craft inputs
- item capacity state
- stash runtime state

Regression guardrails:
- manual `craft.input.store` must accept a producer item with only selected default line state
- auto-fill `craft.start` must accept the same item
- runtime board view must count the item as available input so UI/DnD/autofill stay aligned
