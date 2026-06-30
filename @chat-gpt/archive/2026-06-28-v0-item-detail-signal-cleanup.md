# 2026-06-28 · v0 item detail signal cleanup

Item detail is intentionally backward-facing after this pass.

Player-facing item detail should show what the selected board item instance needs, stores, can run, can withdraw, and may output. It should not show forward usage encyclopedias such as `Used in crafts`, `Can merge into`, or `Can be merged with`. Those lists spam common materials and blueprints badly once the content set grows.

Normal requirement/rule sections omit satisfied rows by default. If all expectations are already fulfilled, the whole section disappears. Diagnostic views may opt into `hideSatisfied={false}` on `ItemRequirementRulesCard`, but the regular item sheet should keep fulfilled expectations out of the way.
