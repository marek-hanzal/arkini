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

const stoneDrop: DropSchema.Type = {
	itemId: "item:stone",
	quantity: {
		min: 1,
		max: 1,
	},
	placement: "drop",
	rules: [],
};

const clayDrop: DropSchema.Type = {
	itemId: "item:clay",
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

	it("composes a chance roll with the isolated probability check", () => {
		const result = Effect.runSync(
			rollFx({
				roll: {
					type: "chance",
					chance: 0.5,
					drop: [
						logDrop,
					],
				},
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.25,
					]),
				),
			),
		);

		expect(result.drop).toEqual([
			logDrop,
		]);
	});

	it("composes repeated weighted rolls with cumulative relative weights", () => {
		const result = Effect.runSync(
			rollFx({
				roll: {
					type: "weight",
					quantity: {
						min: 2,
						max: 2,
					},
					drop: [
						{
							weight: 1,
							drop: [
								logDrop,
							],
						},
						{
							weight: 2,
							drop: [
								stoneDrop,
							],
						},
						{
							weight: 1,
							drop: [
								clayDrop,
							],
						},
					],
				},
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0.5,
					]),
				),
			),
		);

		expect(result.drop).toEqual([
			stoneDrop,
			stoneDrop,
		]);
	});
});
