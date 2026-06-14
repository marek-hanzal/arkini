# action engine

The action engine is the single command boundary between UI/workflows and durable game mutations.

Responsibilities:
- accept typed `GameCommand` values from UI orchestration or interaction engines,
- bootstrap the local database before command execution,
- run the matching Effect/transaction-backed mutation,
- expose the query invalidation targets attached to each command.

Non-responsibilities:
- do not store board, inventory, producer, or upgrade state,
- do not decide drag/drop intent or animation details,
- do not render UI or own React state.
