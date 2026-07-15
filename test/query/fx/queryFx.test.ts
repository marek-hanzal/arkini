import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { queryFx } from "~/v1/query/fx/queryFx";
import type { QuerySchema } from "~/v1/query/schema/QuerySchema";

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

const createTreeRuntimeItem = ({
	id,
	location,
}: {
	id: string;
	location: LocationSchema.Type;
}): RuntimeItemSchema.Type => {
	return {
		id,
		item: config.items.tree,
		location,
		quantity: 1,
		revision: `revision:${id}`,
	};
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
					id: "other-space",
					location: {
						scope: "board",
						space: 1,
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
				const universe = yield* queryFx({
					origin: {
						scope: "board",
						space: 0,
						position: origin.location.position,
					},
					query: {
						scope: "universe",
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
					universe,
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
		expect(readIds(result.universe)).toEqual([
			"board",
			"other-space",
			"inventory",
		]);
		expect(result.empty).toEqual([]);
	});

	it("keeps hidden ownership scopes out of every grid query reach", () => {
		const origin = {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		} as const;
		const runtime = {
			currentSpace: 0,
			session: {
				speedMode: "normal",
			},
			jobs: [],
			items: [
				createTreeRuntimeItem({
					id: "board-visible",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				}),
				createTreeRuntimeItem({
					id: "other-space-visible",
					location: {
						scope: "board",
						space: 1,
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				createTreeRuntimeItem({
					id: "inventory-visible",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				createTreeRuntimeItem({
					id: "input-hidden",
					location: {
						scope: "input",
						ownerItemId: "owner:hidden",
						lineId: "line:hidden",
						inputIndex: 0,
					},
				}),
				createTreeRuntimeItem({
					id: "job-hidden",
					location: {
						scope: "job",
						jobId: "job:hidden",
					},
				}),
				createTreeRuntimeItem({
					id: "reserved-hidden",
					location: {
						scope: "reserved",
						jobId: "job:hidden",
					},
				}),
			],
		} satisfies RuntimeSchema.Type;
		const runQuery = (query: QuerySchema.Type) => {
			return queryFx({
				origin,
				query,
			}).pipe(
				Effect.provideService(RuntimeFx, {
					read: Effect.succeed(runtime),
				}),
			);
		};
		const selector = {
			itemId: "tree",
			type: "item",
		} as const;
		const result = Effect.runSync(
			Effect.gen(function* () {
				return {
					board: yield* runQuery({
						distance: "far",
						scope: "board",
						selector,
					}),
					any: yield* runQuery({
						scope: "any",
						selector,
					}),
					universe: yield* runQuery({
						scope: "universe",
						selector,
					}),
				};
			}),
		);

		expect(readIds(result.board)).toEqual([
			"board-visible",
		]);
		expect(readIds(result.any)).toEqual([
			"board-visible",
			"inventory-visible",
		]);
		expect(readIds(result.universe)).toEqual([
			"board-visible",
			"other-space-visible",
			"inventory-visible",
		]);
	});
});
