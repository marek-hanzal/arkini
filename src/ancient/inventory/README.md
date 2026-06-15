# inventory engine

The inventory engine is the command-facing boundary for inventory mutations.

Responsibilities:
- place an inventory stack onto the board,
- stash board items into inventory,
- swap inventory slots.

Non-responsibilities:
- do not choose UI animation targets,
- do not render inventory cells,
- do not decide drag intent; interaction engines translate gestures into commands.
