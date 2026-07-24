import { Effect, Random } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/** Bump only when intentionally changing immediate charge-depletion random compatibility. */
export const ChargeSpendRandomVersion = 2;

/**
 * Runs the owned program with deterministic random for depletion resolved during one line start.
 *
 * Failed retries over the same payer state replay the same result. A successful spend
 * changes remaining charges, quantity, or runtime identity before the next use.
 */
export const makeChargeSpendRandomFx = Effect.fn("makeChargeSpendRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({
	cost,
	itemId,
	lineId,
	ownerItemId,
	program,
	quantity,
	remainingCharges,
}: {
	cost: PositiveIntegerSchema.Type;
	itemId: IdSchema.Type;
	lineId: IdSchema.Type;
	ownerItemId: IdSchema.Type;
	program: Effect.Effect<Result, Error, Requirements>;
	quantity: PositiveIntegerSchema.Type;
	remainingCharges: PositiveIntegerSchema.Type;
}) {
	return yield* program.pipe(
		Random.withSeed(
			`arkini:charge-spend:v${ChargeSpendRandomVersion}:${ownerItemId}:${lineId}:${itemId}:${quantity}:${remainingCharges}:${cost}`,
		),
	);
});
