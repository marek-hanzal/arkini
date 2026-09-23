import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { placeOutputForTestFx } from "~test/item-placement/support/placeOutputForTestFx";

interface PlaceDropForTestProps {
	readonly drop: OutcomeSchema.Type;
	readonly originItemId: IdSchema.Type;
}

/**
 * Projects a single guaranteed drop through the canonical output placement test path.
 */
export const placeDropForTestFx = Effect.fn("placeDropForTestFx")(function* ({
	drop,
	originItemId,
}: PlaceDropForTestProps) {
	const output = yield* placeOutputForTestFx({
		originItemId,
		output: {
			set: [
				{
					weight: 1,
					rules: [],
					roll: [
						{
							outcome: [
								drop,
							],
							type: "guaranteed",
						},
					],
				},
			],
		} satisfies OutcomeTableSchema.Type,
	});
	return output.item[0];
});
