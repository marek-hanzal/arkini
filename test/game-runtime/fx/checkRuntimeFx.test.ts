import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
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
	start: {
		currentSpace: 0,
	},
	items: {
		any: {
			uid: "any",
			id: "any",
			title: "Any item",
			description: "May occupy any grid.",
			asset: {
				default: [
					"asset:any",
				],
			},
			scope: "any",
			maxStackSize: 10,
			type: "simple",
		},
		limited: {
			uid: "limited",
			id: "limited",
			title: "Limited item",
			description: "Has count and stack limits.",
			asset: {
				default: [
					"asset:limited",
				],
			},
			scope: "any",
			maxCount: 3,
			maxStackSize: 2,
			type: "simple",
		},
		board: {
			uid: "board",
			id: "board",
			title: "Board item",
			description: "May occupy only the board.",
			asset: {
				default: [
					"asset:board",
				],
			},
			scope: "board",
			maxStackSize: 1,
			type: "simple",
		},
	},
});

const location = (scope: "board" | "inventory", x: number, y: number) => {
	return scope === "board"
		? ({
				scope: "board",
				space: 0,
				position: {
					x,
					y,
				},
			} as const)
		: ({
				scope: "inventory",
				position: {
					x,
					y,
				},
			} as const);
};

describe("checkRuntimeFx", () => {
	it("reports readable identity and location invariant violations", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
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
			jobs: [],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
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
				type: RuntimeCheckIssueEnumSchema.enum.DuplicateItemId,
			},
			{
				configuredScope: "board",
				itemId: "wrong-scope",
				location: location("inventory", 0, 0),
				type: RuntimeCheckIssueEnumSchema.enum.LocationScope,
			},
			{
				itemId: "outside",
				location: location("board", 2, 0),
				size: config.meta.board,
				type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
			},
			{
				itemIds: [
					"occupied:first",
					"occupied:second",
				],
				location: location("board", 1, 1),
				type: RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
			},
		]);
	});

	it("reports readable stack-size and max-count invariant violations", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
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
			jobs: [],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
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
				type: RuntimeCheckIssueEnumSchema.enum.ItemStackSize,
			},
			{
				itemId: "limited",
				itemIds: [
					"limited:first",
					"limited:second",
				],
				jobIds: [],
				liveQuantity: 4,
				reservedQuantity: 0,
				maxCount: 3,
				quantity: 4,
				type: RuntimeCheckIssueEnumSchema.enum.ItemMaxCount,
			},
		]);
	});

	it("rejects invalid command candidates atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const wrongScope = yield* Effect.result(
					spawnItemFx({
						id: "wrong-scope",
						itemId: "board",
						location: location("inventory", 0, 0),
						quantity: 1,
					}),
				);
				const outside = yield* Effect.result(
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

		expect(Result.isFailure(result.wrongScope)).toBe(true);
		if (Result.isFailure(result.wrongScope)) {
			expect(result.wrongScope.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: [
						{
							type: RuntimeCheckIssueEnumSchema.enum.LocationScope,
						},
					],
				},
			});
		}
		expect(Result.isFailure(result.outside)).toBe(true);
		if (Result.isFailure(result.outside)) {
			expect(result.outside.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
				result: {
					issues: [
						{
							type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
						},
					],
				},
			});
		}
		expect(result.runtime.items).toEqual([]);
	});
});
