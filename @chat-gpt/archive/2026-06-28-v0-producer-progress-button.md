# v0 producer progress button

Producer product-line detail UI no longer inserts a separate running-progress panel after a producer job starts. The action button remains in the same grid slot, locks while the line has an active/queued job, and renders the runtime progress fill plus remaining/queued status directly inside the button.

Reason: inserting/removing a progress block caused large product-line card layout jumps when a job started or completed. Runtime truth is unchanged; this is strictly player-facing layout stabilization.

Shared UI primitive added:

- `src/v0/ui/UiProgressButton.tsx`

Product-line card behavior:

- idle/fill/start states use the normal label in the same button position
- running/paused lines show e.g. `Running · 1s` or `Paused · 4s`
- non-head queued jobs show `Queued` plus queued count
- the old standalone progress panel is gone from `ItemProducerProductLinesCard`
