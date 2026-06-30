# 2026-06-23 stash status card removal

Removed the low-value stash status block from item detail.

The stash detail now shows only useful stash-specific content:
- summary hero
- drop preview when the stash has configured drops
- stash input/rule rows

Deleted the old `ItemActivationCard` and `activationStatusLabel` because the only active usage was the stash status block.
