import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { GameFx } from "~/v1/game/context/GameFx";
import { GameSchema } from "~/v1/schema/GameSchema";
import { StateSchema } from "~/v1/state/schema/StateSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { fromStateFx } from "./fromStateFx";

const game = GameSchema.parse({
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
		items: [
			{
				id: "runtime:board:tree",
				itemId: "tree",
				quantity: 1,
				x: 1,
				y: 2,
			},
		],
	},
	inventory: {
		slots: [
			{
				id: "runtime:inventory:tree",
				itemId: "tree",
				quantity: 3,
			},
			null,
		],
	},
});

describe("fromStateFx", () => {
	it("builds every runtime item with the original canonical game object", () => {
		const runtime = Effect.runSync(
			fromStateFx({
				state,
			}).pipe(Effect.provideService(GameFx, game)),
		);
		const canonicalTree = game.items.tree;
		const inventoryTree = runtime.inventory.slots[0];

		expect(runtime.game).toBe(game);
		expect(runtime.board.items[0]?.item).toBe(canonicalTree);
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
				Effect.provideService(GameFx, game),
			),
		);

		expect(dehydrated).toEqual(state);
	});

	it("fails when state references an unknown canonical item", () => {
		const invalidState = StateSchema.parse({
			...state,
			board: {
				items: [
					{
						...state.board.items[0],
						itemId: "missing",
					},
				],
			},
		});
		const result = Effect.runSync(
			Effect.either(
				fromStateFx({
					state: invalidState,
				}).pipe(Effect.provideService(GameFx, game)),
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
