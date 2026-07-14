import { Effect, Random } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** Bump only when intentionally changing immediate charge-depletion random compatibility. */
export const ChargeSpendRandomVersion = 1;

/**
 * Creates a deterministic random stream for depletion resolved during one line start.
 *
 * Failed retries over the same payer state replay the same result. A successful spend
 * changes remaining charges, quantity, or runtime identity before the next use.
 */
export const makeChargeSpendRandomFx = Effect.fn("makeChargeSpendRandomFx")(function* ({
	cost,
	itemId,
	lineId,
	ownerItemId,
	quantity,
	remainingCharges,
}: {
	cost: PositiveIntegerSchema.Type;
	itemId: IdSchema.Type;
	lineId: IdSchema.Type;
	ownerItemId: IdSchema.Type;
	quantity: PositiveIntegerSchema.Type;
	remainingCharges: PositiveIntegerSchema.Type;
}) {
	return Random.make(
		`arkini:charge-spend:v${ChargeSpendRandomVersion}:${ownerItemId}:${lineId}:${itemId}:${quantity}:${remainingCharges}:${cost}`,
	);
});
