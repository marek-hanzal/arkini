# Game config soft-lock validation

Date: 2026-06-30

Added central `GameConfigSchema` validation for gameplay soft-lock risks.

Validation now builds a static reachability model from `startingState` through:

- starting board/inventory items,
- merge outputs,
- craft recipe results,
- producer/stash product outputs,
- passive item grants,
- active effect product grants,
- product/craft start requirements from grant and nearby effects.

Hard failures now cover:

- producer buildings that cannot be reached from the starting state through the authored progression graph,
- nearby requirements that match no board-placeable item,
- grant requirements that no passive item or active product can ever provide,
- product/craft lines that require a mandatory grant and also block start on that same grant set.

The default Arkini config currently passes the new hard soft-lock validation. Existing asset/resource audit warnings are unrelated and remain warnings.

Important boundary: this validation intentionally targets progression soft locks, especially buildable producer reachability. It does not fail every dead optional cleanup/sink line, because content like waste processors may exist before their byproduct sources are fully wired. Do not turn optional/dead-line audits into hard schema failures without an explicit gameplay policy.
