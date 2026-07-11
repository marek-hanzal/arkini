import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { setItemFx } from "~/v1/runtime/fx/setItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { queryFx } from "./queryFx";

const config = GameConfigSchema.parse({
	version: "1.0",
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
	start: {},
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

const placeTreeFx = ({
	id,
	scope,
	x,
	y,
}: {
	id: string;
	scope: Exclude<ScopeEnumSchema.Type, "any">;
	x: number;
	y: number;
}) => {
	const item = {
		id,
		item: config.items.tree,
		quantity: 1,
		scope,
		x,
		y,
	} satisfies RuntimeItemSchema.Type;

	return setItemFx({
		item,
		scope,
		x,
		y,
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
					scope: "board",
					x: 5,
					y: 5,
				});
				yield* placeTreeFx({
					id: "close",
					scope: "board",
					x: 6,
					y: 5,
				});
				yield* placeTreeFx({
					id: "near",
					scope: "board",
					x: 7,
					y: 5,
				});
				yield* placeTreeFx({
					id: "far",
					scope: "board",
					x: 8,
					y: 5,
				});
				const close = yield* queryFx({
					origin,
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
					origin,
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
					origin,
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
					scope: "board",
					x: 0,
					y: 0,
				});
				yield* placeTreeFx({
					id: "inventory",
					scope: "inventory",
					x: 0,
					y: 0,
				});
				const inventory = yield* queryFx({
					origin,
					query: {
						scope: "inventory",
						selector: {
							itemId: "tree",
							type: "item",
						},
					},
				});
				const any = yield* queryFx({
					origin,
					query: {
						scope: "any",
						selector: {
							itemId: "tree",
							type: "item",
						},
					},
				});
				const empty = yield* queryFx({
					origin,
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
