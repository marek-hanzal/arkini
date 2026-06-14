# producer engine

The producer engine is the command-facing boundary for producer and stash activations.

Responsibilities:
- activate producers/stashes for single or exhaust runs,
- withdraw stored producer inputs back into inventory/board state,
- return placement/depletion results that animation code can visualize.

Non-responsibilities:
- do not animate produced drops,
- do not own cooldown timers in React,
- do not decide if a dragged item can feed a producer; merge/interaction engines resolve that intent.
