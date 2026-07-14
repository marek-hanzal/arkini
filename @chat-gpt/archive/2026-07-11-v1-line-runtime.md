# V1 line rule evaluation

Implemented after query, when, drop, roll-set, and output resolution.

## Contract

- `lineRuleShowFx`, `lineRuleHideFx`, `lineRuleEnableFx`, `lineRuleDisableFx`, and `lineRuleRuntimeMultiplierFx` each consume their matching rule schema and return a matching result schema.
- `lineRuleFx` is the exhaustive standalone `RuleSchema` dispatcher.
- `lineRulesFx` evaluates an ordered `RuleSchema[]` and returns `RulesResultSchema`.
- Rule results preserve authoring order and are not interpreted into line visibility, availability, runtime, or any other consumer-specific state.
- `lineFx` and `LineResultSchema` were intentionally removed. A caller that needs a line projection must interpret rule results for its own use case instead of coupling evaluation to one premature read model.

## Boundary

```text
RuleSchema
→ lineRuleFx
→ RuleResultSchema

RuleSchema[]
→ lineRulesFx
→ RulesResultSchema
```

This keeps runtime-dependent condition evaluation reusable and independently testable. UI, job start validation, debug tooling, or future line projections may consume the same evaluated rule results without rerunning or embedding their interpretation into the evaluator.

## Likely next boundary

Implement input resolution/planning by following the `InputSchema` variants. Keep read/validation results schema-backed and separate planning from state mutation or consumption.
