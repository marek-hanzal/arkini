# V1 drop runtime resolution

V1 now resolves one selected `DropSchema` through the same schema-shaped runtime composition:

- `RuleEnableSchema` -> `dropRuleEnableFx`;
- `RuleDisableSchema` -> `dropRuleDisableFx`;
- `RuleSchema` -> exhaustive `dropRuleFx` dispatch;
- `DropSchema` -> `dropFx`;
- the concrete emitted value is `DropResultSchema`.

Every condition inside one rule is flat AND. Enable rules are positive gates, disable rules are vetoes, and all configured rules compose in authored order. The first rejection discards the selected drop without rerolling or choosing a replacement.

Rules run before quantity resolution, so discarded drops do not consume random quantity input. `dropFx` returns zero or one resolved drop. Roll-set and output orchestration remain the next independent layer.
