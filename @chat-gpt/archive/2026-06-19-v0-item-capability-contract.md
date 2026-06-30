# Item capability contract guardrail

## Decision

Do not introduce a separate item capability whitelist/matrix as an engine/runtime legality layer.

`GameConfigSchema` defines what item/capability combinations are legal. If validated `GameConfig` accepts a combination, engine/runtime/UI must treat it as part of the gameplay contract and support it deterministically.

## Rationale

Arkini intentionally allows config authors to combine item capabilities in unusual ways. Some combinations may be wild, but they are legal when schema validation accepts them. Adding a second capability-policy layer would create two sources of truth and invite drift.

## Allowed future work

- Add or change legality only inside `GameConfigSchema` / config validation when there is an intentional game-rule decision.
- Fix concrete runtime/UI bugs where an accepted config combination behaves inconsistently.
- Add tests for specific accepted combinations when a bug or risky feature appears.

## Guardrail

Do not reopen generic capability matrix audits as cleanup work. Source of truth is config validation first, engine implementation second. Runtime is not a design police layer.
