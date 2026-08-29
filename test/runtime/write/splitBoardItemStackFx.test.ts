import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { splitBoardItemStackFx } from "~/engine/runtime/write/splitBoardItemStackFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { purityTestConfig } from "~test/production-line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const boardOnlyConfig = GameConfigSchema.parse({
	...purityTestConfig,
	meta: {
		...purityTestConfig.meta,
		id: "game:split-board-stack",
		board: {
			height: 1,
			width: 2,
		},
	},
	items: {
		...purityTestConfig.items,
		material: {
			...purityTestConfig.items.material,
			scope: "board",
		},
	},
});

describe("splitBoardItemStackFx", () => {
	it.each([
		{
			quantity: 6,
			retained: 3,
			split: 3,
		},
		{
			quantity: 5,
			retained: 3,
			split: 2,
		},
	])(
		"retains $retained of $quantity at the origin and places $split nearby",
		({ quantity, retained, split }) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					const source = yield* spawnItemFx({
						id: "runtime:source",
						itemId: "material",
						location: board(0),
						quantity,
					});
					const command = yield* splitBoardItemStackFx({
						itemId: source.id,
						location: board(0),
						revision: source.revision,
					});
					return {
						command,
						runtime: yield* readRuntimeFx(),
						transition: yield* (yield* CommittedTransitionsFx).read,
					};
				}).pipe(
					useGameFx({
						config: boardOnlyConfig,
					}),
				),
			);

			expect(result.command.sourceAfter).toMatchObject({
				id: "runtime:source",
				location: board(0),
				quantity: retained,
			});
			expect(result.command.sourceAfter.revision).not.toBe(
				result.command.sourceBefore.revision,
			);
			expect(result.runtime.items).toHaveLength(2);
			expect(result.runtime.items).toEqual(
				expect.arrayContaining([
					result.command.sourceAfter,
					expect.objectContaining({
						item: expect.objectContaining({
							id: "material",
						}),
						location: board(1),
						quantity: split,
					}),
				]),
			);
			expect(result.transition.events).toEqual([
				{
					type: GameEventEnumSchema.enum.ItemSplit,
					itemId: "runtime:source",
					canonicalItemId: "material",
					location: board(0),
					previousQuantity: quantity,
					quantity: retained,
				},
				expect.objectContaining({
					type: GameEventEnumSchema.enum.ItemSpawned,
					canonicalItemId: "material",
					originItemId: "runtime:source",
					location: board(1),
					quantity: split,
				}),
			]);
		},
	);

	it("uses canonical stack-first placement without stacking the detached half back into itself", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 6,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 4,
				});
				const command = yield* splitBoardItemStackFx({
					itemId: source.id,
					location: board(0),
					revision: source.revision,
				});
				return {
					command,
					runtime: yield* readRuntimeFx(),
					target,
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: boardOnlyConfig,
				}),
			),
		);

		expect(result.command.sourceAfter.quantity).toBe(3);
		expect(result.runtime.items).toHaveLength(2);
		expect(result.runtime.items.find((item) => item.id === "runtime:target")).toMatchObject({
			quantity: 7,
		});
		expect(result.transition.events.map((event) => event.type)).toEqual([
			GameEventEnumSchema.enum.ItemSplit,
			GameEventEnumSchema.enum.ItemStacked,
		]);
	});

	it("rejects an unsplittable identity without committing a transition", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					splitBoardItemStackFx({
						itemId: source.id,
						location: board(0),
						revision: source.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: boardOnlyConfig,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "ItemStackSplitUnavailableError",
				itemId: "runtime:source",
				quantity: 1,
			});
		}
		expect(result.after).toBe(result.before);
	});

	it("keeps the original runtime untouched when no standard placement can fit the half", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 6,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "producer",
					location: board(1),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					splitBoardItemStackFx({
						itemId: source.id,
						location: board(0),
						revision: source.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: boardOnlyConfig,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: PlacementUnavailableError.Reason.BoardFull,
				remainingQuantity: 3,
			});
		}
		expect(result.after).toBe(result.before);
	});
});
