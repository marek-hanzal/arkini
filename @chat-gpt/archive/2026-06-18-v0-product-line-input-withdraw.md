# Product-line input withdraw

Status: DONE
Commit: pending
Date: 2026-06-18

Product-line inputs are not a one-way storage sink. Each stored product-line input row in the item sheet can now withdraw the entire stored quantity at once.

Rules:

- Withdraw targets a concrete producer item instance, product line and input item id.
- The action removes the whole stored quantity for that input row, not one unit per click.
- Placement uses the same board-then-inventory rule as producer output through `placeGameSaveItemsFx` with the producer tile as `seedCell`.
- If placement is unavailable, the action rejects and keeps the stored input untouched.
- Product-line input storage remains in `save.producerInputs[producerItemInstanceId].productInputs[productId].items` and save integrity stays owned by `GameSaveConfigSchema`.

Implementation notes:

- Engine action: `producer.input.withdraw`.
- Engine effect: `withdrawProducerInputFx`.
- Readiness effect: `checkProducerInputWithdrawReadinessFx`.
- Created item reason: `producer-input-withdraw`, mapped to producer-style visual cause so board spawns behave like producer output.
- Domain event: `producer_input.withdrawn` records the source storage quantity change; the actual returned items are represented by normal `item.created` events.
- UI button is intentionally small and local to stored input rows. Filling still happens via DnD; withdraw is an escape hatch for already stored line inputs.
