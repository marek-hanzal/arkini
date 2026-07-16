# Audio historical status

**Status:** Reference for task 15.

Sound selection, batching, limits, and synthesis are useful product knowledge. The current implementation must consume canonical transient events and remain non-blocking and failure-isolated.

Do not reconstruct events from previous/current runtime snapshots or create another event bus.
