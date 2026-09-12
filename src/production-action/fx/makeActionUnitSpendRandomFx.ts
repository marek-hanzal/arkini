import { Effect, Random } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** Bump only when intentionally changing immediate unit-depletion random compatibility. */
const ActionUnitSpendRandomVersion = 3;

/** Runs unit-depletion work with deterministic random for one concrete action. */
export const makeActionUnitSpendRandomFx = Effect.fn("makeActionUnitSpendRandomFx")(function* <
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
	remainingUnits,
}: {
	actionId: IdSchema.Type;
	cost: PositiveIntegerSchema.Type;
	itemId: IdSchema.Type;
	ownerItemId: IdSchema.Type;
	program: Effect.Effect<Result, Error, Requirements>;
	quantity: PositiveIntegerSchema.Type;
	remainingUnits: PositiveIntegerSchema.Type;
}) {
	// The seed namespace is stable gameplay identity; terminology changes must not reroll output.
	return yield* program.pipe(
		Random.withSeed(
			`arkini:charge-spend:v${ActionUnitSpendRandomVersion}:${ownerItemId}:${actionId}:${itemId}:${quantity}:${remainingUnits}:${cost}`,
		),
	);
});
