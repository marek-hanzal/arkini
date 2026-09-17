import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { DropSchema } from "~/production-output/schema/DropSchema";
import { rollFx } from "~/production-output/fx/rollFx";

const logDrop: DropSchema.Type = {
	itemId: "item:log",
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
					drop: [
						logDrop,
					],
				},
			}),
		);

		expect(result.drop).toEqual([
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
					drop: [
						logDrop,
						{
							...logDrop,
							itemId: "item:stone",
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

		expect(result.drop).toEqual(
			passed
				? [
						logDrop,
						{
							...logDrop,
							itemId: "item:stone",
						},
					]
				: [],
		);
	});
});
