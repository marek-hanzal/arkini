# upgrade engine

The upgrade engine is the command-facing boundary for upgrade purchases.

Responsibilities:
- buy upgrades through the transactional upgrade Effect layer,
- keep purchase commands separate from upgrade sheet UI.

Non-responsibilities:
- do not render upgrade cards,
- do not calculate producer readiness in UI,
- do not mutate manifest configuration directly.
