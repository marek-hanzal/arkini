import { Effect } from "effect";
import { expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:when-test",
		title: "When test",
		board: {
			width: 10,
			height: 10,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		source: {
			maxQueueSize: 1,
			lines: [],

			uid: "source",
			title: "Source",
			description: "A query origin.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:source",
				],
			},
		},
		tree: {
			maxQueueSize: 1,
			lines: [],

			uid: "tree",
			title: "Tree",
			description: "A living tree.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:tree",
				],
			},
		},
	},
});

const placeItemFx = ({
	id,
	itemUid,
	location,
}: {
	id: string;
	itemUid: "source" | "tree";
	location: BoardLocationSchema.Type;
}) => {
	return spawnItemFx({
		id,
		itemUid,
		location,
	});
};

it("evaluates exists, exact count, and inclusive range over matching identities", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const origin = yield* placeItemFx({
				id: "origin",
				itemUid: "source",

				location: {
					scope: "board",
					space: 0,
					position: {
						x: 5,
						y: 5,
					},
				},
			});
			yield* placeItemFx({
				id: "board-close",
				itemUid: "tree",

				location: {
					scope: "board",
					space: 0,
					position: {
						x: 6,
						y: 5,
					},
				},
			});
			yield* placeItemFx({
				id: "board-near",
				itemUid: "tree",

				location: {
					scope: "board",
					space: 0,
					position: {
						x: 7,
						y: 5,
					},
				},
			});
			yield* placeItemFx({
				id: "board-far",
				itemUid: "tree",

				location: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			});
			const exists = yield* whenFx({
				origin: {
					scope: "board",
					space: 0,
					position: origin.location.position,
				},
				when: {
					query: {
						distance: "far" as const,
						selector: {
							itemUid: "tree",
							type: "item",
						},
					},
					type: "exists",
				},
			});
			const count = yield* whenFx({
				origin: {
					scope: "board",
					space: 0,
					position: origin.location.position,
				},
				when: {
					count: 3,
					query: {
						distance: "far" as const,
						selector: {
							itemUid: "tree",
							type: "item",
						},
					},
					type: "count",
				},
			});
			const range = yield* whenFx({
				origin: {
					scope: "board",
					space: 0,
					position: origin.location.position,
				},
				when: {
					max: 1,
					min: 1,
					query: {
						distance: "close",
						selector: {
							itemUid: "tree",
							type: "item",
						},
					},
					type: "range",
				},
			});
			const rejected = yield* whenFx({
				origin: {
					scope: "board",
					space: 0,
					position: origin.location.position,
				},
				when: {
					count: 4,
					query: {
						distance: "far" as const,
						selector: {
							itemUid: "tree",
							type: "item",
						},
					},
					type: "count",
				},
			});

			return {
				count,
				exists,
				range,
				rejected,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

	expect(result).toEqual({
		count: true,
		exists: true,
		range: true,
		rejected: false,
	});
});
