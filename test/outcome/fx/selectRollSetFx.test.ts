import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { useGameFx } from "~test/support/useGameFx";
import type { RollSetSchema } from "~/outcome/schema/RollSetSchema";
import { selectRollSetFx } from "~/outcome/fx/selectRollSetFx";

const origin = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};
const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:set-test",
		title: "Set test",
		board: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {},
});

const createSet = (itemId: string, weight = 1): RollSetSchema.Type => {
	return {
		weight,
		rules: [],
		roll: [
			{
				type: "guaranteed",
				outcome: [
					{
						type: "item",
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
	it("selects a candidate from the middle cumulative weight range", () => {
		const first = createSet("item:first", 1);
		const middle = createSet("item:middle", 2);
		const last = createSet("item:last", 1);
		const result = Effect.runSync(
			selectRollSetFx({
				origin,
				set: [
					first,
					middle,
					last,
				],
			}).pipe(
				useGameFx({
					config,
				}),
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
				origin,
				set: [
					frequent,
					rare,
				],
			}).pipe(
				useGameFx({
					config,
				}),
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
					origin,
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
				useGameFx({
					config,
				}),
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
