import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameTransition } from "~/bridge/game/GameSession";
import { readCommittedTileReplacementsFx } from "~/bridge/tile/motion/readCommittedTileReplacementsFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:replacement-cue",
		title: "Replacement cue",
		board: {
			width: 2,
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
	items: {
		stone: {
			uid: "stone",
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "Stone",
			asset: {
				default: [
					"asset:stone",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		mud: {
			uid: "mud",
			id: "mud",
			type: "simple",
			title: "Mud",
			description: "Mud",
			asset: {
				default: [
					"asset:mud",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const location = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const runtime = (item: (typeof config.items)["stone"] | (typeof config.items)["mud"]) =>
	RuntimeSchema.parse({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:target",
				revision: `revision:${item.id}`,
				item,
				location,
				quantity: 1,
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

const game = {
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
} as GameEngine;

describe("readCommittedTileReplacementsFx", () => {
	it("retains the outgoing face only for an exact same-slot replace merge", () => {
		const transition = {
			sequence: 7,
			previousRuntime: runtime(config.items.stone),
			runtime: runtime(config.items.mud),
			events: [
				{
					type: "item:merged",
					sourceItemId: "runtime:source",
					sourceCanonicalItemId: "water",
					targetItemId: "runtime:target",
					targetCanonicalItemId: "stone",
					action: "consume",
					effect: "replace",
					resultCanonicalItemId: "mud",
				},
			],
		} satisfies GameTransition;

		expect(
			Effect.runSync(
				readCommittedTileReplacementsFx({
					game,
					transition,
				}),
			),
		).toEqual([
			{
				actorId: "runtime:target",
				key: "7:0:replacement",
				previous: {
					itemId: "stone",
					title: "Stone",
					sourceUrl: "resource:asset:stone",
				},
				previousQuantity: 1,
			},
		]);
	});

	it("does not infer a crossfade from identity movement without a replace fact", () => {
		const transition = {
			sequence: 8,
			previousRuntime: runtime(config.items.stone),
			runtime: runtime(config.items.mud),
			events: [],
		} satisfies GameTransition;

		expect(
			Effect.runSync(
				readCommittedTileReplacementsFx({
					game,
					transition,
				}),
			),
		).toEqual([]);
	});
});
