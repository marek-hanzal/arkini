# 2026-07-06 — visual event pairing refactor pass

Context: recent stack/restore/depletion bugs were repeatedly traced through event pairing and board stack visual replay code.

Changes:
- Added `findNextUnskippedEventIndex` as the shared visual event cursor helper.
- Rewired activation input, board stack, and merge-result event pairing helpers through the shared cursor.
- Removed consumed-source support from `appendBoardStackCreatedVisuals`; board DnD stack merges must not be able to accidentally replay a source-origin transient again.
- Documented the two stack visual modes in code: origin-backed created stack increments fly, manual board DnD stack increments only bounce the target.

Why it helps:
- Future event-pairing helpers have one obvious primitive instead of duplicating `findIndex` cursor logic.
- Board stack visuals now encode the recent teleport bug constraint in the type surface: created stack visuals can only animate from `originItemInstanceId`, not a consumed board source.
