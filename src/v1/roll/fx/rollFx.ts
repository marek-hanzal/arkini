import { Effect } from "effect";
import { match } from "ts-pattern";

import type { RollSchema } from "~/v1/roll/schema/RollSchema";
import { rollChanceFx } from "./rollChanceFx";
import { rollGuaranteedFx } from "./rollGuaranteedFx";
import { rollWeightFx } from "./rollWeightFx";

export namespace rollFx {
	export interface Props {
		roll: RollSchema.Type;
	}
}

/** Dispatches one roll to the specialized resolver selected by its type. */
export const rollFx = Effect.fn("rollFx")(function* ({ roll }: rollFx.Props) {
	return yield* match(roll)
		.with(
			{
				type: "guaranteed",
			},
			(roll) => {
				return rollGuaranteedFx({
					roll,
				});
			},
		)
		.with(
			{
				type: "chance",
			},
			(roll) => {
				return rollChanceFx({
					roll,
				});
			},
		)
		.with(
			{
				type: "weight",
			},
			(roll) => {
				return rollWeightFx({
					roll,
				});
			},
		)
		.exhaustive();
});
