# Multi-slot experiment route

This unsigned branch-only Arkpack is an interaction fixture, not balanced content.

The initial `8 × 6` Board deliberately has no free `3 × 3` rectangle:

1. inspect the Output Yard's default line: the Survey Peg at `(2, 3)` is exactly
   `close` to the nearest edge/corner of the Yard's `2 × 3` rectangle, so the
   authored `enable` effect passes; move that peg farther away and back to make the
   rectangle-edge query disable and re-enable the line;
2. start the Output Yard's default line and wait two seconds; the ready completion
   must remain blocked without publishing a partial result;
3. drag the `3 × 1` Relocation Beam to anchor `(1, 3)`, across both Survey Pegs at
   `(2, 3)` and `(3, 3)`; both initial collisions must relocate without recursive
   eviction;
4. move the beam and the relocated blockers into passive storage or elsewhere until
   `(2, 2)` through `(4, 4)` is free; the pending `3 × 3` Landmark completion can
   then retry;
5. drop Inventory Water onto the `2 × 2` Tree Plot at `(4, 0)`; the Survey Peg at
   `(6, 0)` blocks the `3 × 1` result's target anchor, so replacement must keep the
   target runtime identity and use deterministic fallback placement;
6. move the stacked `2 × 2` Pallets and a large item through Inventory/Toolbar and
   back to Board; storage always consumes one slot while Board uses authored area;

The asset reuse is intentional: this fixture evaluates geometry and interaction
truth, not finished art or official-content balance.
