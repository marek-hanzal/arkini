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
	},
	start: {
		currentSpace: 0,
	},
	items: {
		any: {
			maxQueueSize: 1,
			lines: [],

			uid: "any",
			id: "any",
			title: "Any item",
			description: "May occupy any grid.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:any",
				],
			},
			maxStackSize: 10,
		},
		limited: {
			maxQueueSize: 1,
			lines: [],

			uid: "limited",
			id: "limited",
			title: "Limited item",
			description: "Has count and stack limits.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:limited",
				],
			},
			maxStackSize: 2,
		},
		board: {
			maxQueueSize: 1,
			lines: [],

			uid: "board",
			id: "board",
			title: "Board item",
			description: "May occupy only the board.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:board",
				],
			},
			maxStackSize: 1,
		},
	},
});

const boardLocationFn = (x: number, y: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});

describe("checkRuntimeFx", () => {
	it("reports readable stack-size invariant violations", () => {
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			items: [
				{
					id: "limited:first",
					item: config.items.limited,
					location: boardLocationFn(0, 0),
					quantity: 3,
					revision: "revision:test",
				},
				{
					id: "limited:second",
					item: config.items.limited,
					location: boardLocationFn(1, 0),
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
		]);
	});
});

it("reports readable identity and location invariant violations", () => {
	const runtime = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "duplicate",
				item: config.items.any,
				location: boardLocationFn(0, 0),
				quantity: 1,
				revision: "revision:test",
			},
			{
				id: "duplicate",
				item: config.items.any,
				location: boardLocationFn(1, 0),
				quantity: 1,
				revision: "revision:test",
			},

			{
				id: "outside",
				item: config.items.any,
				location: boardLocationFn(2, 0),
				quantity: 1,
				revision: "revision:test",
			},
			{
				id: "occupied:first",
				item: config.items.any,
				location: boardLocationFn(1, 1),
				quantity: 1,
				revision: "revision:test",
			},
			{
				id: "occupied:second",
				item: config.items.board,
				location: boardLocationFn(1, 1),
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
			itemId: "outside",
			location: boardLocationFn(2, 0),
			size: config.meta.board,
			type: RuntimeCheckIssueEnumSchema.enum.LocationOutOfBounds,
		},
		{
			itemIds: [
				"occupied:first",
				"occupied:second",
			],
			location: boardLocationFn(1, 1),
			type: RuntimeCheckIssueEnumSchema.enum.LocationOccupied,
		},
	]);
});
it("rejects invalid command candidates atomically", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const outside = yield* Effect.result(
				spawnItemFx({
					id: "outside",
					itemId: "any",
					location: boardLocationFn(2, 0),
					quantity: 1,
				}),
			);
			const runtime = yield* readRuntimeFx();

			return {
				outside,
				runtime,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);

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
