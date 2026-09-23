import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import { rollFx } from "~/outcome/fx/rollFx";

const logDrop: OutcomeSchema.Type = {
	type: "item",
	itemUid: "item:log",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
};

describe("rollFx", () => {
	it("dispatches guaranteed rolls without asking for random input", () => {
		const result = Effect.runSync(
			rollFx({
				roll: {
					type: "guaranteed",
					outcome: [
						logDrop,
					],
				},
			}),
		);

		expect(result).toEqual([
			logDrop,
		]);
	});

	it.each([
		[
			0.25,
			true,
		],
		[
			0.75,
			false,
		],
	])("shares one chance check across all drops (%s)", (random, passed) => {
		const result = Effect.runSync(
			rollFx({
				roll: {
					type: "chance",
					chance: 0.5,
					outcome: [
						logDrop,
						{
							...logDrop,
							itemUid: "item:stone",
						},
					],
				},
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						random,
					]),
				),
			),
		);

		expect(result).toEqual(
			passed
				? [
						logDrop,
						{
							...logDrop,
							itemUid: "item:stone",
						},
					]
				: [],
		);
	});
});
