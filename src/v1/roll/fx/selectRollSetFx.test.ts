import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { RollSetSchema } from "~/v1/roll/schema/RollSetSchema";
import { selectRollSetFx } from "./selectRollSetFx";

const createSet = (itemId: string, weight?: number): RollSetSchema.Type => {
	return {
		...(weight === undefined
			? {}
			: {
					weight,
				}),
		roll: [
			{
				type: "guaranteed",
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
			},
		],
	};
};

describe("selectRollSetFx", () => {
	it("treats omitted weights as one", () => {
		const first = createSet("item:first");
		const second = createSet("item:second");
		const result = Effect.runSync(
			selectRollSetFx({
				set: [
					first,
					second,
				],
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.75,
					]),
				),
			),
		);

		expect(result).toBe(second);
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
		const frequent = createSet("item:frequent", 3);
		const rare = createSet("item:rare", 1);
		const result = Effect.runSync(
			selectRollSetFx({
				set: [
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
				Effect.withRandom(
					Random.fixed([
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
