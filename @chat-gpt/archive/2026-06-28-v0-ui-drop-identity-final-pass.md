# V0 UI drop identity final pass

Completed a final UI/runtime/backend consistency pass around board and inventory interactions.

Current rule: UI drop feedback, drop resolution, and committed runtime drop actions must all validate live source/target identity. Resolver outputs now carry expected item/stack IDs, and runtime drop actions re-check those expected identities immediately before dispatching gameplay actions.

This prevents stale drag/tap closures from moving, merging, swapping, feeding, or placing a different live item that happens to reuse the same board item id or inventory slot after the drag started. If identity changed, the UI action no-ops instead of dispatching against the wrong live state.

Docs were clarified so producer board-click default means an explicitly player-selected default line only. Without that explicit default, board click opens item detail; config order must not imply a default line.
