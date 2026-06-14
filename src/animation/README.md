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
