import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { readDropMaximumQuantitiesFx } from "~/v1/output/fx/readDropMaximumQuantitiesFx";
import { readQuantityMaximumFx } from "~/v1/quantity/fx/readQuantityMaximumFx";
import type { RollSchema } from "~/v1/roll/schema/RollSchema";

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
				type: "guaranteed",
			},
			({ drop }) =>
				readDropMaximumQuantitiesFx({
					drop,
				}),
		)
		.with(
			{
				type: "chance",
			},
			({ drop }) =>
				readDropMaximumQuantitiesFx({
					drop,
				}),
		)
		.with(
			{
				type: "weight",
			},
			(roll) =>
				Effect.gen(function* () {
					const selectionCount = yield* readQuantityMaximumFx({
						quantity: roll.quantity,
					});
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
