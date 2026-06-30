# Item detail scroll contract

- Removed nested scroll ownership from `src/v1/item-detail/ui` panels after the v1 detail rework.
- The item detail sheet/body remains the only vertical scroll owner.
- Detail tabs wrap instead of using horizontal scrolling.
- Added a source-level regression test so UI leaf panels do not reintroduce `overflow-y-auto`, `overflow-x-auto`, or local scrollbar styling.
