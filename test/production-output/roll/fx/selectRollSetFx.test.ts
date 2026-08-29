import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { SetSchema } from "~/production-output/roll/schema/SetSchema";
import { selectRollSetFx } from "~/production-output/roll/fx/selectRollSetFx";

const createSet = (itemId: string, weight = 1): SetSchema.Type => {
	return {
		weight,
		roll: [
			{
				type: "guaranteed",
				drop: [
					{
						itemId,
						quantity: {
							min: 1,
							max: 1,
						},
						placement: "drop",
						rules: [],
					},
				],
			},
		],
	};
};

describe("selectRollSetFx", () => {
	it("normalizes authored shorthand to the canonical weight one", () => {
		const { weight: _weight, ...source } = createSet("item:first");

		expect(SetSchema.parse(source).weight).toBe(1);
	});

	it("selects a candidate from the middle cumulative weight range", () => {
		const first = createSet("item:first", 1);
		const middle = createSet("item:middle", 2);
		const last = createSet("item:last", 1);
		const result = Effect.runSync(
			selectRollSetFx({
				set: [
					first,
					middle,
					last,
				],
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.5,
					]),
				),
			),
		);

		expect(result).toBe(middle);
	});

	it("selects according to explicit relative weights", () => {
		const frequent = createSet("item:frequent", 3);
		const rare = createSet("item:rare", 1);
		const result = Effect.runSync(
			selectRollSetFx({
				set: [
					frequent,
					rare,
				],
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.9,
					]),
				),
			),
		);

		expect(result).toBe(rare);
	});

	it("returns the only configured set without consuming random input", () => {
		const only = createSet("item:only");
		const result = Effect.runSync(
			Effect.gen(function* () {
				const selected = yield* selectRollSetFx({
					set: [
						only,
					],
				});
				const nextRandom = yield* Random.next;

				return {
					nextRandom,
					selected,
				};
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.5,
					]),
				),
			),
		);

		expect(result).toEqual({
			nextRandom: 0.5,
			selected: only,
		});
	});
});
