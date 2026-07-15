import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { queryFx } from "~/v1/query/fx/queryFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:query-test",
		title: "Query test",
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
	categories: {},
	items: {
		tree: {
			id: "tree",
			title: "Tree",
			description: "A living tree.",
			asset: {
				source: [
					"asset:tree",
				],
			},
			tags: [
				"forest",
			],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

const placeTreeFx = ({ id, location }: { id: string; location: GridLocationSchema.Type }) => {
	return spawnItemFx({
		id,
		itemId: "tree",
		location,
		quantity: 1,
	});
};

const readIds = (items: ReadonlyArray<RuntimeItemSchema.Type>) => {
	return items.map((item) => {
		return item.id;
	});
};

describe("queryFx", () => {
	it("selects exact board distance rings and excludes the origin", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* placeTreeFx({
					id: "origin",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 5,
							y: 5,
						},
					},
				});
				yield* placeTreeFx({
					id: "close",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 6,
							y: 5,
						},
					},
				});
				yield* placeTreeFx({
					id: "near",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 7,
							y: 5,
						},
					},
				});
				yield* placeTreeFx({
					id: "far",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 8,
							y: 5,
						},
					},
				});
				const close = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						distance: "close",
						scope: "board",
						selector: {
							tag: "forest",
							type: "tag",
						},
					},
				});
				const near = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						distance: "near",
						scope: "board",
						selector: {
							tag: "forest",
							type: "tag",
						},
					},
				});
				const far = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						distance: "far",
						scope: "board",
						selector: {
							tag: "forest",
							type: "tag",
						},
					},
				});

				return {
					close,
					far,
					near,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(readIds(result.close)).toEqual([
			"close",
		]);
		expect(readIds(result.near)).toEqual([
			"near",
		]);
		expect(readIds(result.far)).toEqual([
			"close",
			"near",
			"far",
		]);
	});

	it("selects inventory or both grids according to query scope", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* placeTreeFx({
					id: "board",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* placeTreeFx({
					id: "inventory",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const inventory = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						scope: "inventory",
						selector: {
							itemId: "tree",
							type: "item",
						},
					},
				});
				const any = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						scope: "any",
						selector: {
							itemId: "tree",
							type: "item",
						},
					},
				});
				const empty = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						scope: "inventory",
						selector: {
							itemId: "missing",
							type: "item",
						},
					},
				});

				return {
					any,
					empty,
					inventory,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(readIds(result.inventory)).toEqual([
			"inventory",
		]);
		expect(readIds(result.any)).toEqual([
			"board",
			"inventory",
		]);
		expect(result.empty).toEqual([]);
	});
});
