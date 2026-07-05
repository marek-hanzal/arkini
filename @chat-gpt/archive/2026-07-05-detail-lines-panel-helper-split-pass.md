# Detail lines panel helper split pass

## Commit intent

Split the oversized item detail lines UI panel into small, named view components and presentation readers.

## Why

The previous `DetailLinesPanel.tsx` mixed tab grouping, line card header presentation, output formatting, effect requirement summaries, input rows, note boxes, and action buttons in one ~439 line component. That made UI copy/layout changes unnecessarily expensive for both humans and LLMs.

## What changed

- Kept `DetailLinesPanel.tsx` as the public panel and tab/group orchestrator.
- Moved line card rendering to `DetailLineCard.tsx`.
- Moved action buttons to `DetailLineActions.tsx`.
- Moved input rows to `DetailLineInputs.tsx`.
- Moved output rows/effect lines to `DetailLineOutputs.tsx`.
- Moved note box rendering to `DetailLineNoteList.tsx`.
- Moved output meta, effect requirement summaries, polarity access, group building, and meta formatting into named readers/formatters.

## Behavior

No intended behavior change. Existing detail panel tests cover visible labels, ordering, default labels, output odds, fulfilled/hidden requirements, target limits, inputs, and separators.

## Follow-up candidates

- Split the oversized producer test file by scenario family.
- Consider `RuntimeGameEngineAdapter.ts` or `validateGameSaveProducerState.ts` next if continuing production-code splits.
