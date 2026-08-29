import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readDropMaximumQuantitiesFx } from "~/engine/output/fx/readDropMaximumQuantitiesFx";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import { TypeSchema } from "~/engine/roll/schema/TypeSchema";

export namespace readRollMaximumQuantitiesFx {
	export interface Props {
		roll: RollSchema.Type;
	}
}

/** Reads the per-item worst-case quantity one authored roll may emit. */
export const readRollMaximumQuantitiesFx = Effect.fn("readRollMaximumQuantitiesFx")(function* ({
	roll,
}: readRollMaximumQuantitiesFx.Props) {
	return yield* match(roll)
		.with(
			{
				type: TypeSchema.enum.Guaranteed,
			},
			({ drop }) =>
				readDropMaximumQuantitiesFx({
					drop,
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Chance,
			},
			({ chance, drop }) =>
				chance === 0
					? Effect.succeed(new Map<IdSchema.Type, number>())
					: readDropMaximumQuantitiesFx({
							drop,
						}),
		)
		.with(
			{
				type: TypeSchema.enum.Weight,
			},
			(roll) =>
				Effect.gen(function* () {
					const selectionCount = roll.quantity.max;
					const quantities = new Map<IdSchema.Type, number>();

					for (const candidate of roll.drop) {
						const candidateQuantities = yield* readDropMaximumQuantitiesFx({
							drop: candidate.drop,
						});
						for (const [itemId, quantity] of candidateQuantities) {
							quantities.set(
								itemId,
								Math.max(quantities.get(itemId) ?? 0, quantity * selectionCount),
							);
						}
					}

					return quantities;
				}),
		)
		.exhaustive();
});
