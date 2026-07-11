import { Effect, Either, Ref } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { StateSchema } from "~/v1/state/schema/StateSchema";
import { getItemFx } from "./getItemFx";
import { setItemFx } from "./setItemFx";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { fromStateFx } from "./fromStateFx";

const config = GameConfigSchema.parse({
	version: "1.0",
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
	board: {
		cells: {
			"1:2": {
				id: "runtime:board:tree",
				itemId: "tree",
				quantity: 1,
				location: {
					scope: "board",
					position: {
						x: 1,
						y: 2,
					},
				},
			},
		},
	},
	inventory: {
		cells: {
			"0:0": {
				id: "runtime:inventory:tree",
				itemId: "tree",
				quantity: 3,
				location: {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				},
			},
		},
	},
});

describe("fromStateFx", () => {
	it("provides an empty layout-aware runtime at game startup", () => {
		const runtime = Effect.runSync(
			RuntimeFx.pipe(
				Effect.flatMap((runtime) => {
					return Ref.get(runtime);
				}),
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.board.cells).toEqual({});
		expect(runtime.inventory.cells).toEqual({});
	});

	it("atomically writes and reads an item through synchronized coordinates", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const placed = yield* setItemFx({
					item: {
						id: "runtime:placed:tree",
						item: config.items.tree,
						quantity: 1,
						location: {
							scope: "inventory",
							position: {
								x: 99,
								y: 99,
							},
						},
					},
					location: {
						scope: "board",
						position: {
							x: 2,
							y: 1,
						},
					},
				});
				const read = yield* getItemFx({
					location: {
						scope: "board",
						position: {
							x: 2,
							y: 1,
						},
					},
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
		expect(result.read).toMatchObject({
			location: {
				scope: "board",
				position: {
					x: 2,
					y: 1,
				},
			},
		});
	});

	it("uses the central item-not-found error for an empty runtime cell", () => {
		const result = Effect.runSync(
			Effect.either(
				getItemFx({
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
		const inventoryTree = runtime.inventory.cells["0:0"];

		expect(runtime.board.cells["1:2"]?.item).toBe(canonicalTree);
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
			...state,
			board: {
				cells: {
					"1:2": {
						...state.board.cells["1:2"],
						itemId: "missing",
					},
				},
			},
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
