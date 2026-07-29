# Multi-slot authority audit

Temporary implementation map captured from `0.5.x` at `5bf54cad`. It assigns each active
one-cell assumption to the issue that replaces it; it is not a second architecture guide.

| Active owner | Baseline one-cell assumption | Shared input | Task | Obsolete path |
| --- | --- | --- | --- | --- |
| `BaseItemSchema`, completed-game compiler | Every definition implies one Board cell | Canonical parsed footprint with a `1 × 1` default | #432 | Downstream optional-size fallbacks |
| `readGridLocationClaimsFx`, `checkRuntimeLocationsFx` | One anchor is one occupancy claim and one bounds check | Effective surface cells / Board rectangle | #433 | Anchor-only claims and checks |
| `readGridLocationOccupantsFx`, stack candidate readers | Occupants are indexed by anchor and may repeat after projection | Effective surface cells plus identity deduplication | #433 | Anchor-only occupant scan |
| start/bootstrap placement | Each authored Board anchor is independently valid | Shared exact rectangle admission | #433 | Final-runtime validation as the only overlap guard |
| material placement plan/apply | An empty anchor is enough and batch spawns reserve one cell | Candidate rectangle admission plus evolving claims | #433 | Anchor-only empty filtering |
| `placeRuntimeItemFx`, `readRuntimeItemDropLocationFx` | Returned identity needs one free anchor near a point | Captured Board origin rectangle plus exact-identity admission | #434 | Reconstructing origin after owner removal |
| `moveItemFx` | Destination anchor alone establishes availability | Shared exact rectangle admission | #433 | Anchor-only collision read |
| `swapItemsFx` | Exactly two anchors exchange | Engine-issued destination collision set plus exact-identity placement | #435 | Pair-only destination-drop assumption; destination-less direct exchange remains compatible |
| `orderStackItemsFx` | Anchor Manhattan distance orders candidates | Minimum Manhattan rectangle gap | #436 | Anchor-distance comparator |
| `resolveInputDepositRunFx`, `planLineInputAutofillFx` | Anchor distance ranks eligible sources | Minimum Manhattan rectangle gap | #436 | Inline anchor-distance comparator |
| output and completion owners | Output origin survives as an anchor after owner removal | Immutable captured Board origin rectangle | #434 | Late origin reconstruction |
| merge replacement and remainder output | Replacement always fits the target anchor | Exact target-anchor admission, then deterministic identity fallback | #434 | Unconditional anchor replacement |
| `dropItemFx`, preview and commit leaves | Hovered cell, destination anchor, and sole target are identical | Requested anchor, hit cell, and exact collision identities/revisions | #435 | Renderer-reconstructed swap facts |
| isolation and pure remainder placement | Remainders order around an owner anchor | Captured Board origin rectangle | #434 | Point-origin fallback after isolation |
| Delivery origin lease | One origin cell is reserved | Effective occupancy on the exact origin surface | #433 | Single-cell Board lease |
| `distanceFx`, effects and input proximity | Chebyshev distance is measured anchor-to-anchor | Minimum Chebyshev rectangle distance | #436 | Inline coordinate distance |
| bridge tile projection | Actor identity has no canonical footprint | Definition footprint on one projected identity | #437 | Presentation-side definition lookup |
| committed swap result and cue compilation | A destination drop always has one counterpart | Ordered committed relocation facts | #435, #437 | Exact-two drop cue; rectangular optimistic exact cue remains for the async direct-command race |
| Pixi actor layout and hit testing | One scalar slot size defines face and hit area | Surface-effective rectangular actor bounds | #437 | Scalar actor size |
| Pixi target preview | One cell is the complete candidate and target | Requested rectangle plus engine preview facts | #437 | Single-slot feedback path |
| Pixi motion and magnetism | Actors and endpoints are square | Live rectangular pose / AABB | #437 | Scalar-size motion and magnetic samples |

The ownership distinctions remain deliberate:

- material placement may normalize quantities; direct exact-anchor movement may not;
- returned stateful identities keep their runtime ID, quantity, state, and owned subtree;
- gameplay proximity is Chebyshev, while deterministic placement ordering is Manhattan;
- Pixi presents geometry and committed facts but never authorizes gameplay placement.
