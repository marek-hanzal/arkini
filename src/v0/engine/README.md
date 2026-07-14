# Engine historical status

**Status:** Superseded architecture.

Current engine already replaces:

- `GameSave` subsystem maps;
- action dispatch as the write boundary;
- readiness with hidden Tick catch-up;
- runtime adapter/store mirrors;
- world processing after arbitrary actions;
- wall-clock job scheduling.

Do not study this directory to design current runtime architecture. Open specific tests only when a numbered task names a missing behavior. Final deletion owner: task 17.
