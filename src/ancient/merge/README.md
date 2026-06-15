# merge engine

The merge engine resolves board item interaction intent from immutable view data and manifest rules.

Responsibilities:
- decide whether a source item can merge, imprint, feed craft progress, feed producer storage, swap, or reject,
- keep merge/craft/producer-input eligibility out of React UI and drag plumbing,
- return intent only; command execution remains in the action engine.

Non-responsibilities:
- do not mutate SQLite,
- do not own animation timing,
- do not read DOM nodes or React state.
