import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { StateSchema } from "~/v1/state/schema/StateSchema";
import { checkRuntimeFx } from "~/v1/runtime/check/checkRuntimeFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	meta: {
		id: "game:runtime-check",
		title: "Runtime check",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {},
	categories: {},
	items: {
		any: {
			id: "any",
			title: "Any item",
			description: "May occupy any grid.",
			asset: {
				source: [
					"asset:any",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
		limited: {
			id: "limited",
			title: "Limited item",
			description: "Has count and stack limits.",
			asset: {
				source: [
					"asset:limited",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxCount: 3,
			maxStackSize: 2,
			type: "simple",
		},
		board: {
			id: "board",
			title: "Board item",
			description: "May occupy only the board.",
			asset: {
				source: [
					"asset:board",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
	},
});

const location = (scope: "board" | "inventory", x: number, y: number) => {
	return {
		scope,
		position: {
			x,
			y,
		},
	} as const;
};

describe("checkRuntimeFx", () => {
	it("reports readable identity and location invariant violations", () => {
		const runtime = {
			items: [
				{
					id: "duplicate",
					item: config.items.any,
					location: location("board", 0, 0),
					quantity: 1,
					revision: "revision:test",
				},
				{
					id: "duplicate",
					item: config.items.any,
					location: location("board", 1, 0),
					quantity: 1,
					revision: "revision:test",
				},
				{
					id: "wrong-scope",
					item: config.items.board,
					location: location("inventory", 0, 0),
					quantity: 1,
					revision: "revision:test",
				},
				{
					id: "outside",
					item: config.items.any,
					location: location("board", 2, 0),
					quantity: 1,
					revision: "revision:test",
				},
				{
					id: "occupied:first",
					item: config.items.any,
					location: location("board", 1, 1),
					quantity: 1,
					revision: "revision:test",
				},
				{
					id: "occupied:second",
					item: config.items.any,
					location: location("board", 1, 1),
					quantity: 1,
					revision: "revision:test",
				},
			],
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.issues).toEqual([
			{
				itemId: "duplicate",
				type: "item:id:duplicate",
			},
			{
				configuredScope: "board",
				itemId: "wrong-scope",
				location: location("inventory", 0, 0),
				type: "location:scope",
			},
			{
				itemId: "outside",
				location: location("board", 2, 0),
				size: config.meta.board,
				type: "location:out-of-bounds",
			},
			{
				itemIds: [
					"occupied:first",
					"occupied:second",
				],
				location: location("board", 1, 1),
				type: "location:occupied",
			},
		]);
	});

	it("reports readable stack-size and max-count invariant violations", () => {
		const runtime = {
			items: [
				{
					id: "limited:first",
					item: config.items.limited,
					location: location("board", 0, 0),
					quantity: 3,
					revision: "revision:test",
				},
				{
					id: "limited:second",
					item: config.items.limited,
					location: location("board", 1, 0),
					quantity: 1,
					revision: "revision:test",
				},
			],
		} satisfies RuntimeSchema.Type;
		const result = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.issues).toEqual([
			{
				canonicalItemId: "limited",
				itemId: "limited:first",
				maxStackSize: 2,
				quantity: 3,
				type: "item:stack-size",
			},
			{
				itemId: "limited",
				itemIds: [
					"limited:first",
					"limited:second",
				],
				maxCount: 3,
				quantity: 4,
				type: "item:max-count",
			},
		]);
	});

	it("rejects invalid command candidates atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const wrongScope = yield* Effect.either(
					spawnItemFx({
						id: "wrong-scope",
						itemId: "board",
						location: location("inventory", 0, 0),
						quantity: 1,
					}),
				);
				const outside = yield* Effect.either(
					spawnItemFx({
						id: "outside",
						itemId: "any",
						location: location("board", 2, 0),
						quantity: 1,
					}),
				);
				const runtime = yield* readRuntimeFx();

				return {
					outside,
					runtime,
					wrongScope,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result.wrongScope)).toBe(true);
		if (Either.isLeft(result.wrongScope)) {
			expect(result.wrongScope.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: [
						{
							type: "location:scope",
						},
					],
				},
			});
		}
		expect(Either.isLeft(result.outside)).toBe(true);
		if (Either.isLeft(result.outside)) {
			expect(result.outside.left).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: [
						{
							type: "location:out-of-bounds",
						},
					],
				},
			});
		}
		expect(result.runtime.items).toEqual([]);
	});

	it("rejects invalid persisted state before it becomes runtime", () => {
		const state = StateSchema.parse({
			items: [
				{
					id: "wrong-scope",
					itemId: "board",
					location: location("inventory", 0, 0),
					quantity: 1,
					revision: "revision:test",
				},
			],
		});
		const result = Effect.runSync(
			Effect.either(
				fromStateFx({
					state,
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
				_tag: "RuntimeInvalidError",
				result: {
					issues: [
						{
							type: "location:scope",
						},
					],
				},
			});
		}
	});
});
