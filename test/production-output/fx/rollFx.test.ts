import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import type { DropSchema } from "~/production-output/schema/DropSchema";
import { rollFx } from "~/production-output/fx/rollFx";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";

const origin = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
const provideConfigFx = Effect.provideService(
	GameConfigFx,
	GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:roll-test",
			title: "Roll test",
			board: {
				width: 1,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		items: {},
	}),
);
const provideUnusedRuntimeFx = Effect.provideService(RuntimeFx, {
	read: Effect.die("This test must not read Runtime."),
});

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
				origin,
				roll: {
					type: "guaranteed",
					drop: [
						logDrop,
					],
				},
			}).pipe(provideUnusedRuntimeFx, provideConfigFx),
		);

		expect(result.drop).toEqual([
			logDrop,
		]);
	});

	it("composes a chance roll with the isolated probability check", () => {
		const result = Effect.runSync(
			rollFx({
				origin,
				roll: {
					type: "chance",
					chance: 0.5,
					drop: [
						logDrop,
					],
				},
			}).pipe(
				provideUnusedRuntimeFx,
				provideConfigFx,
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
				origin,
				roll: {
					type: "weight",
					quantity: {
						min: 2,
						max: 2,
					},
					drop: [
						{
							rules: [],
							weight: 1,
							drop: [
								logDrop,
							],
						},
						{
							rules: [],
							weight: 2,
							drop: [
								stoneDrop,
							],
						},
						{
							rules: [],
							weight: 1,
							drop: [
								clayDrop,
							],
						},
					],
				},
			}).pipe(
				provideUnusedRuntimeFx,
				provideConfigFx,
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
