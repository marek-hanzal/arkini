import { Effect, Random } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** Bump only when intentionally changing immediate charge-depletion random compatibility. */
const ActionChargeSpendRandomVersion = 2;

/** Runs charge-depletion work with deterministic random for one concrete action. */
export const makeActionChargeSpendRandomFx = Effect.fn("makeActionChargeSpendRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({
	actionId,
	cost,
	itemId,
	ownerItemId,
	program,
	quantity,
	remainingCharges,
}: {
	actionId: IdSchema.Type;
	cost: PositiveIntegerSchema.Type;
	itemId: IdSchema.Type;
	ownerItemId: IdSchema.Type;
	program: Effect.Effect<Result, Error, Requirements>;
	quantity: PositiveIntegerSchema.Type;
	remainingCharges: PositiveIntegerSchema.Type;
}) {
	return yield* program.pipe(
		Random.withSeed(
			`arkini:charge-spend:v${ActionChargeSpendRandomVersion}:${ownerItemId}:${actionId}:${itemId}:${quantity}:${remainingCharges}:${cost}`,
		),
	);
});
