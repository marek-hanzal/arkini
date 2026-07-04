# Limited deposit validator warning

Added config audit warning `limited-deposit-softlock` for finite capacity deposits used by `nearby.capacity.spend` when no sustainable production/replacement path can recreate the deposit.

The audit builds a simple production dependency graph from producer/stash outputs, crafts, merge results/outputs, and removal outputs. Starting state does not count as sustainable. Craft results depend on the craft target item plus consumed inputs; merge results/outputs depend on both merge participants; producer outputs depend on consumed inputs plus spent capacity sources.

Current Arkini validation intentionally warns for `item:tree`, `item:double-tree`, `item:micro-forest`, and `item:rock` until gameplay gets renewable replacement sources.
