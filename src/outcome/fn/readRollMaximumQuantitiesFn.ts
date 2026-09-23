import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemOutcomeMaximumQuantitiesFn } from "~/outcome/fn/readItemOutcomeMaximumQuantitiesFn";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import { RollTypeSchema } from "~/outcome/schema/RollTypeSchema";

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
			({ outcome }) =>
				readItemOutcomeMaximumQuantitiesFn({
					outcome,
				}),
		)
		.with(
			{
				type: RollTypeSchema.enum.Chance,
			},
			({ chance, outcome }) =>
				chance === 0
					? new Map<IdSchema.Type, number>()
					: readItemOutcomeMaximumQuantitiesFn({
							outcome,
						}),
		)
		.exhaustive();
};
