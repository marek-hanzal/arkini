import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { DropWeightSchema } from "~/engine/roll/schema/DropWeightSchema";
import { selectDropWeightFx } from "~/engine/roll/fx/selectDropWeightFx";

const createDrop = (itemId: string, weight: number): DropWeightSchema.Type => {
	return {
		weight,
		drop: [
			{
				itemId,
				quantity: {
					type: "value",
					value: 1,
				},
				placement: "drop",
				rules: [],
			},
		],
	};
};

describe("selectDropWeightFx", () => {
	it("selects a candidate from the middle cumulative weight range", () => {
		const first = createDrop("item:first", 1);
		const middle = createDrop("item:middle", 2);
		const last = createDrop("item:last", 1);
		const result = Effect.runSync(
			selectDropWeightFx({
				drop: [
					first,
					middle,
					last,
				],
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.5,
					]),
				),
			),
		);

		expect(result).toBe(middle);
	});

	it("selects according to explicit relative weights", () => {
		const frequent = createDrop("item:frequent", 3);
		const rare = createDrop("item:rare", 1);
		const result = Effect.runSync(
			selectDropWeightFx({
				drop: [
					frequent,
					rare,
				],
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.9,
					]),
				),
			),
		);

		expect(result).toBe(rare);
	});
});
