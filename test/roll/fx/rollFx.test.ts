import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { rollFx } from "~/engine/roll/fx/rollFx";

const logDrop: DropSchema.Type = {
	itemId: "item:log",
	quantity: {
		type: "value",
		value: 1,
	},
	placement: "drop",
	rules: [],
};

const stoneDrop: DropSchema.Type = {
	itemId: "item:stone",
	quantity: {
		type: "value",
		value: 1,
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
				Effect.withRandom(
					Random.fixed([
						0.25,
					]),
				),
			),
		);

		expect(result.drop).toEqual([
			logDrop,
		]);
	});

	it("composes weighted rolls from quantity and weighted-selection blocks", () => {
		const result = Effect.runSync(
			rollFx({
				roll: {
					type: "weight",
					quantity: {
						type: "value",
						value: 2,
					},
					drop: [
						{
							weight: 1,
							drop: [
								logDrop,
							],
						},
						{
							weight: 1,
							drop: [
								stoneDrop,
							],
						},
					],
				},
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.75,
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
