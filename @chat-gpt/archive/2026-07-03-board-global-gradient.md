# Board global gradient pass

- Moved board visual gradient back to the board/grid background instead of rendering a per-cell gradient.
- Board cells now use only a subtle translucent fill plus stronger inset grid lines, so the shared board gradient remains visible behind tiles/cells.
- Kept all styling in component Tailwind classes to respect the layer-system invariant that global CSS only owns tokens/layers, not component selectors.
- No config/runtime changes.
