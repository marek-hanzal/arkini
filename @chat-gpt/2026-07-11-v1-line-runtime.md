# V1 line runtime evaluation

Implemented after query, when, drop, roll-set, and output resolution.

## Contract

- `lineRuleShowFx`, `lineRuleHideFx`, `lineRuleEnableFx`, `lineRuleDisableFx`, and `lineRuleRuntimeMultiplierFx` each consume their matching rule schema and return a matching result schema.
- `lineRuleFx` is the exhaustive `RuleSchema` dispatcher.
- `lineFx` consumes `LineSchema` plus the owning runtime item and returns `LineResultSchema` with only dynamic values: `id`, `show`, `enable`, and concrete `runtimeMs`.
- Input and output remain outside this evaluator. In particular, `lineFx` must never resolve output randomness.

## Locked semantics

```text
show = no active hide && (line.show || any active show)

enable = no active disable
         && (all configured enable rules pass, or line.enable when none exist)

runtimeMs = ceil(line.runtimeMs * product(active runtime multipliers))
```

Enable rules can therefore enable a default-disabled line, but once any enable rules exist they replace the default as positive gates. Hide and disable retain veto power in their own domains.

## Likely next boundary

Implement input resolution/planning by following the `InputSchema` variants. Keep read/validation results schema-backed and separate planning from state mutation or consumption.
