# Speed cheat historical status

**Status:** Presentation reference only.

Current v1 runtime behavior is canonical:

```text
runtime.session.speedMode
→ normal | accelerated
→ newly observed wall time feeds one fixed-step Tick engine at 1× or 30×
```

The speed item owns no toggle state and is not required to enable the mode. Save omits the session mode and hydration starts in `normal`.

Do not consult or port the historical timestamp retiming, active-job rewriting, item-owned truth, or alternate time model. Retain this tree only for board-control presentation, ordered asset intent, and sound intent needed by tasks 13 and 15. Dependency-safe deletion belongs to task 17 after those requirements are represented.
