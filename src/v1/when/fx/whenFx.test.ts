import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { whenFx } from "./whenFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:when-test",
		title: "When test",
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
		source: {
			id: "source",
			title: "Source",
			description: "A query origin.",
			asset: {
				source: [
					"asset:source",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
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

const placeItemFx = ({
	id,
	itemId,
	quantity,
	location: {
		scope,
		position: { x, y },
	},
}: {
	id: string;
	itemId: "source" | "tree";
	quantity: number;
	location: {
		scope: Exclude<ScopeEnumSchema.Type, "any">;
		position: {
			x: number;
			y: number;
		};
	};
}) => {
	return spawnItemFx({
		id,
		itemId,
		location: {
			scope,
			position: {
				x,
				y,
			},
		},
		quantity,
	});
};

describe("whenFx", () => {
	it("evaluates exists, exact count, and inclusive range over query quantities", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* placeItemFx({
					id: "origin",
					itemId: "source",
					quantity: 1,
					location: {
						scope: "board",
						position: {
							x: 5,
							y: 5,
						},
					},
				});
				yield* placeItemFx({
					id: "board-close",
					itemId: "tree",
					quantity: 2,
					location: {
						scope: "board",
						position: {
							x: 6,
							y: 5,
						},
					},
				});
				yield* placeItemFx({
					id: "board-near",
					itemId: "tree",
					quantity: 4,
					location: {
						scope: "board",
						position: {
							x: 7,
							y: 5,
						},
					},
				});
				yield* placeItemFx({
					id: "inventory",
					itemId: "tree",
					quantity: 3,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const exists = yield* whenFx({
					origin: origin.location.position,
					when: {
						query: {
							scope: "inventory",
							selector: {
								tag: "forest",
								type: "tag",
							},
						},
						type: "exists",
					},
				});
				const count = yield* whenFx({
					origin: origin.location.position,
					when: {
						count: 9,
						query: {
							scope: "any",
							selector: {
								itemId: "tree",
								type: "item",
							},
						},
						type: "count",
					},
				});
				const range = yield* whenFx({
					origin: origin.location.position,
					when: {
						max: 2,
						min: 2,
						query: {
							distance: "close",
							scope: "board",
							selector: {
								itemId: "tree",
								type: "item",
							},
						},
						type: "range",
					},
				});
				const rejected = yield* whenFx({
					origin: origin.location.position,
					when: {
						count: 8,
						query: {
							scope: "any",
							selector: {
								itemId: "tree",
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
});
