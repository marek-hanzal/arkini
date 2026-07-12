# V1 gameplay flow testing

Tick-based runtime tests may now model complete gameplay sequences without wall-clock waits.

Preferred flow-test shape:

1. build a valid game config;
2. create real board/runtime items through public write commands;
3. fill producer inputs through the normal input path;
4. start work through `startLineFx`;
5. queue later work through the same command;
6. inject deterministic elapsed time through `TickFx`;
7. run `runTickRuntimeFx`;
8. assert the complete board, inventory, inputs, jobs, queue and quantities.

Current coverage in `test/flow/jobBoardInventoryFlow.test.ts` proves:

- a long tick can complete an active job and its queued chain;
- reserved resources and outputs use normal placement and stack in inventory when the board is full;
- a late placement failure rolls back the entire tick, including earlier reservation releases;
- a broken live rule pauses work without consuming elapsed time;
- restored rules let the next tick resume and complete the whole queued chain.

Use isolated unit tests for narrow policies, but prefer gameplay flow tests for cross-domain contracts such as jobs, Tick, placement, board/inventory capacity and runtime atomicity.
