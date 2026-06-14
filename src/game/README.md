# game engines

Game engines are small functional subsystems that sit between React UI/XState workflows and the durable SQLite/Effect layer.

Shared rules:
- engines are functions and namespaces, not classes,
- engines do not own durable game state,
- UI sends intent/commands; engines resolve or execute them,
- SQLite remains the source of truth, React Query remains the read cache, XState remains workflow orchestration.

The intended flow is:

1. UI gesture or sheet action creates intent.
2. Interaction/merge engines resolve the intent into a `GameCommand` and visual plan.
3. The action engine executes the command through the domain engine facade.
4. React Query invalidates affected views.
5. Animation helpers visualize the already accepted result.
