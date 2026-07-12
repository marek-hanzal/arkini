import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { StateSchema } from "~/v1/state/schema/StateSchema";
import { getItemAtFx } from "~/v1/runtime/read/getItemAtFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:test",
		title: "Test game",
		board: {
			width: 3,
			height: 3,
		},
		inventory: {
			width: 2,
			height: 1,
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
				"nature",
				"forest",
			],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
	},
});

const state = StateSchema.parse({
	items: [
		{
			id: "runtime:board:tree",
			itemId: "tree",
			location: {
				scope: "board",
				position: {
					x: 1,
					y: 2,
				},
			},
			quantity: 1,
			revision: "revision:board-tree",
		},
		{
			id: "runtime:inventory:tree",
			itemId: "tree",
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 3,
			revision: "revision:inventory-tree",
		},
	],

	jobs: [],
	jobQueue: [],
});

describe("fromStateFx", () => {
	it("provides an empty layout-aware runtime at game startup", () => {
		const runtime = Effect.runSync(
			readRuntimeFx().pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items).toEqual([]);
	});

	it("atomically spawns and reads an item through its owned location", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const placed = yield* spawnItemFx({
					id: "runtime:placed:tree",
					itemId: "tree",
					location: {
						scope: "board",
						position: {
							x: 2,
							y: 1,
						},
					},
					quantity: 1,
				});
				const read = yield* getItemAtFx({
					location: placed.location,
				});

				return {
					placed,
					read,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.placed).toBe(result.read);
		expect(result.read.location).toEqual({
			scope: "board",
			position: {
				x: 2,
				y: 1,
			},
		});
	});

	it("uses the central item-not-found error for an empty runtime cell", () => {
		const result = Effect.runSync(
			Effect.either(
				getItemAtFx({
					location: {
						scope: "inventory",
						position: {
							x: 4,
							y: 3,
						},
					},
				}),
			).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "ItemNotFoundError",
				location: {
					scope: "inventory",
					position: {
						x: 4,
						y: 3,
					},
				},
			});
		}
	});

	it("builds every runtime item with the original canonical game object", () => {
		const runtime = Effect.runSync(
			fromStateFx({
				state,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		const canonicalTree = config.items.tree;
		const boardTree = runtime.items.find((item) => item.id === "runtime:board:tree");
		const inventoryTree = runtime.items.find((item) => item.id === "runtime:inventory:tree");

		expect(boardTree?.item).toBe(canonicalTree);
		expect(inventoryTree?.item).toBe(canonicalTree);
	});

	it("round-trips runtime through the state domain counterpart", () => {
		const dehydrated = Effect.runSync(
			fromStateFx({
				state,
			}).pipe(
				Effect.flatMap((runtime) => {
					return fromRuntimeFx({
						runtime,
					});
				}),
				useGameFx({
					config,
				}),
			),
		);

		expect(dehydrated).toEqual(state);
	});

	it("fails when state references an unknown canonical item", () => {
		const invalidState = StateSchema.parse({
			items: state.items.map((item) => {
				if (item.id !== "runtime:board:tree") {
					return item;
				}

				return {
					...item,
					itemId: "missing",
				};
			}),

			jobs: [],
		});
		const result = Effect.runSync(
			Effect.either(
				fromStateFx({
					state: invalidState,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "ItemNotFoundError",
				itemId: "missing",
			});
		}
	});
});
