# Drop effect second review

After the drop-owned effect refactor, ran another engine/UI parity pass.

Findings/fixes:
- Producer start readiness now rejects current `effectiveProductLine.blocked` and `product.output` with zero enabled `lootPlan.baseOutput` before planning/consuming inputs. Runtime constraints already rejected these later, but doing it after input consumption was the wrong boundary and made readiness less truthful.
- Producer realtime start gates now treat zero enabled drop output as a pause condition, same as missing grants/blockers. A running job whose only visible drop becomes disabled now pauses instead of finishing with no output and spending charges.
- Generated bonus chance drops now respect the source drop effect `display` rule. `display: "never"` still rolls the bonus, but the bonus row/summary does not leak the hidden effect label.

Tests added:
- current blocked product rejects before input planning
- running producer pauses/resumes when all drop-owned outputs become disabled/enabled via nearby requirement
- bonus chance display rules are preserved on chance drop rows and summary lines
