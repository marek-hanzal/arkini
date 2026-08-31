import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { placeOutputForTestFx } from "~test/item-placement/support/placeOutputForTestFx";

interface PlaceDropForTestProps {
	readonly drop: DropSchema.Type;
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
					roll: [
						{
							drop: [
								drop,
							],
							type: "guaranteed",
						},
					],
				},
			],
		} satisfies OutputSchema.Type,
	});
	return output.drop[0];
});
