import { makeFixedRandomFx } from "~test/support/makeFixedRandomFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { dropFx } from "~/engine/output/fx/dropFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:drop-test",
		title: "Drop test",
		board: {
			width: 10,
			height: 10,
		},
		inventory: {
			width: 2,
			height: 2,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		source: {
			uid: "source",
			id: "source",
			title: "Source",
			description: "A drop origin.",
			asset: {
				default: [
					"asset:source",
				],
			},
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
	},
});

const createOriginFx = () => {
	return spawnItemFx({
		id: "origin",
		itemId: "source",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 5,
				y: 5,
			},
		},
		quantity: 1,
	});
};

const missingPermitWhen = {
	type: "exists" as const,
	query: {
		scope: "any" as const,
		selector: {
			type: "item" as const,
			itemId: "permit",
		},
	},
};

const sourceExistsWhen = {
	type: "exists" as const,
	query: {
		scope: "any" as const,
		selector: {
			type: "item" as const,
			itemId: "source",
		},
	},
};

describe("dropFx", () => {
	it("composes every enable gate with every disable veto", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const accepted = yield* dropFx({
					drop: {
						itemId: "item:accepted",
						placement: "drop",
						quantity: {
							min: 1,
							max: 1,
						},
						rules: [
							{
								type: "enable",
								when: [
									sourceExistsWhen,
								],
							},
							{
								type: "disable",
								when: [
									missingPermitWhen,
								],
							},
						],
					},
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
				});
				const rejected = yield* dropFx({
					drop: {
						itemId: "item:rejected",
						placement: "drop",
						quantity: {
							min: 1,
							max: 1,
						},
						rules: [
							{
								type: "enable",
								when: [
									sourceExistsWhen,
								],
							},
							{
								type: "disable",
								when: [
									sourceExistsWhen,
								],
							},
						],
					},
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
				});

				return {
					accepted,
					rejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			accepted: {
				itemId: "item:accepted",
				placement: "drop",
				quantity: 1,
			},
			rejected: undefined,
		});
	});

	it("evaluates rules before quantity and does not consume random input for rejected drops", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* createOriginFx();
				const rejected = yield* dropFx({
					drop: {
						itemId: "item:rejected",
						placement: "drop",
						quantity: {
							min: 2,
							max: 4,
						},
						rules: [
							{
								type: "enable",
								when: [
									missingPermitWhen,
								],
							},
						],
					},
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
				});
				const accepted = yield* dropFx({
					drop: {
						itemId: "item:accepted",
						placement: "random",
						quantity: {
							min: 2,
							max: 4,
						},
						rules: [],
					},
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
				});

				return {
					accepted,
					rejected,
				};
			}).pipe(
				Effect.provideServiceEffect(
					Random.Random,
					makeFixedRandomFx([
						0,
						0.75,
					]),
				),
				useGameFx({
					config,
				}),
			),
		);

		expect(result).toEqual({
			accepted: {
				itemId: "item:accepted",
				placement: "random",
				quantity: 2,
			},
			rejected: undefined,
		});
	});
});
