import { match } from "ts-pattern";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readDropMaximumQuantitiesFn } from "~/production-output/fn/readDropMaximumQuantitiesFn";
import type { RollSchema } from "~/production-output/roll/schema/RollSchema";
import { TypeSchema } from "~/production-output/roll/schema/TypeSchema";

export namespace readRollMaximumQuantitiesFn {
	export interface Props {
		roll: RollSchema.Type;
	}
}

/** Reads the per-item worst-case quantity one authored roll may emit. */
export const readRollMaximumQuantitiesFn = ({ roll }: readRollMaximumQuantitiesFn.Props) => {
	return match(roll)
		.with(
			{
				type: TypeSchema.enum.Guaranteed,
			},
			({ drop }) =>
				readDropMaximumQuantitiesFn({
					drop,
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Chance,
			},
			({ chance, drop }) =>
				chance === 0
					? new Map<IdSchema.Type, number>()
					: readDropMaximumQuantitiesFn({
							drop,
						}),
		)
		.with(
			{
				type: TypeSchema.enum.Weight,
			},
			(roll) => {
				const selectionCount = roll.quantity.max;
				const quantities = new Map<IdSchema.Type, number>();

				for (const candidate of roll.drop) {
					const candidateQuantities = readDropMaximumQuantitiesFn({
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
			},
		)
		.exhaustive();
};
