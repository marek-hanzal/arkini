# animation engine

The animation engine converts completed domain/action results into visual runtime plans and DOM-backed flyer effects.

Responsibilities:
- map producer placement results to flyer animations,
- resolve temporary UI source ids that should be hidden during animation,
- centralize non-React DOM lookup conventions used by visual feedback.

Non-responsibilities:
- do not mutate durable game data,
- do not decide whether an action is valid,
- do not own React state; hooks own the render lifecycle and call these functions.

Current board merge/feed rules:
- same-item merge is pre-commit, but the domain commit runs in parallel after the first paint so the result is ready under the flyer,
- same-item merge renders only one result cross-fade at the target cell; the dragged source only fades out at its drop position,
- consumed dragged sources use an in-place scale-down + fade-out flyer with no target pulse,
- flyers unmount as soon as their timeline completes; do not keep finished flyers over committed state,
- animation helpers must not decide validity; `src/interaction` chooses the visual plan from merge intent.
