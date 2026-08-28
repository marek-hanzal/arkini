import { Effect } from "effect";
import { match } from "ts-pattern";

import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import { TypeSchema } from "~/engine/roll/schema/TypeSchema";

import { rollChanceFx } from "./rollChanceFx";
import { rollGuaranteedFx } from "./rollGuaranteedFx";
import { rollWeightFx } from "./rollWeightFx";

export namespace rollFx {
	export interface Props {
		roll: RollSchema.Type;
	}
}

/**
 * Dispatches one roll to the specialized resolver selected by its type.
 */
export const rollFx = Effect.fn("rollFx")(function* ({ roll }: rollFx.Props) {
	return yield* match(roll)
		.with(
			{
				type: TypeSchema.enum.Guaranteed,
			},
			(roll) => {
				return rollGuaranteedFx({
					roll,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.Chance,
			},
			(roll) => {
				return rollChanceFx({
					roll,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.Weight,
			},
			(roll) => {
				return rollWeightFx({
					roll,
				});
			},
		)
		.exhaustive();
});
