# Merge historical status

**Status:** Partial presentation oracle for tasks 11 and 14.

Canonical directional gameplay merge execution now lives in `src/v1/merge/` and is covered by current contract, lifecycle, atomicity, event, and authored-flow tests. Ordinary same-item stack placement remains a separate capability.

Do not inspect or port the historical runtime mutation path again. Preserve only drag/drop feedback and animation intent until tasks 11 and 14 capture them, then remove this historical directory.
