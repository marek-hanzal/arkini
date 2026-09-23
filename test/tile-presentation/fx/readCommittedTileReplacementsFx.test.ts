import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readCommittedTileReplacementsFx } from "~/tile-presentation/fx/readCommittedTileReplacementsFx";
import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

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
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		stone: {
			maxQueueSize: 1,
			lines: [],

			uid: "stone",

			title: "Stone",
			description: "Stone",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:stone",
				],
			},
		},
		mud: {
			maxQueueSize: 1,
			lines: [],

			uid: "mud",

			title: "Mud",
			description: "Mud",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:mud",
				],
			},
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
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			{
				id: "runtime:target",
				revision: `revision:${item.uid}`,
				item,
				location,
			},
		],
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	});

const game = {
	getResourceUrlFn: (resourceUid: string) => `resource:${resourceUid}`,
};

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
					sourceItemUid: "water",
					targetItemId: "runtime:target",
					targetItemUid: "stone",
					action: "consume",
					effect: "replace",
					resultItemUid: "mud",
				},
			],
		} satisfies CommittedTransitionSchema.Type;

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
					artworkScale: 0.8,
					itemUid: "stone",
					sourceUrl: "resource:artwork:stone",
				},
			},
		]);
	});

	it("does not infer a crossfade from identity movement without a replace fact", () => {
		const transition = {
			sequence: 8,
			previousRuntime: runtime(config.items.stone),
			runtime: runtime(config.items.mud),
			events: [],
		} satisfies CommittedTransitionSchema.Type;

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
