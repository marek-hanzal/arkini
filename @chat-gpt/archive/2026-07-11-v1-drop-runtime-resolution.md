# V1 drop runtime resolution

V1 resolves one selected `DropSchema` through schema-shaped runtime composition:

- `RuleEnableSchema` -> `dropRuleEnableFx` -> `RuleEnableResultSchema`;
- `RuleDisableSchema` -> `dropRuleDisableFx` -> `RuleDisableResultSchema`;
- `RuleSchema` -> exhaustive `dropRuleFx` -> `RuleResultSchema`;
- `RuleSchema[]` -> `dropRulesFx` -> `RulesResultSchema`;
- `DropSchema` -> `dropFx`;
- the concrete emitted value is `DropResultSchema`.

Drop-rule evaluators are neutral. `active` means every condition owned by that rule passed. They do not decide whether a drop is emitted.

`dropFx`, as the `DropSchema` consumer, interprets results:

- an enable result allows continuation only when active;
- an active disable result vetoes emission.

Rules run in authoring order and short-circuit at the first rejection. Rejection discards the selected drop without rerolling or choosing a replacement.

Rules run before quantity resolution, so discarded drops do not consume random quantity input. `dropFx` currently returns zero or one resolved drop as an array; a dedicated schema-backed `0..1` result collection remains documented as a follow-up.
