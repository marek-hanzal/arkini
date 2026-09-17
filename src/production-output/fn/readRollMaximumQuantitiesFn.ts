import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readDropMaximumQuantitiesFn } from "~/production-output/fn/readDropMaximumQuantitiesFn";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { RollTypeSchema } from "~/production-output/schema/RollTypeSchema";

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
				type: RollTypeSchema.enum.Guaranteed,
			},
			({ drop }) =>
				readDropMaximumQuantitiesFn({
					drop,
				}),
		)
		.with(
			{
				type: RollTypeSchema.enum.Chance,
			},
			({ chance, drop }) =>
				chance === 0
					? new Map<IdSchema.Type, number>()
					: readDropMaximumQuantitiesFn({
							drop,
						}),
		)
		.exhaustive();
};
