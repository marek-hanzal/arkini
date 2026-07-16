import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { createGameSession } from "~/bridge/game/createGameSession";
import { consumeItemIntoCheatInventoryFx } from "~/engine/utility/write/consumeItemIntoCheatInventoryFx";
import { createDestructiveUtilityTestConfig } from "~test/utility/support/createDestructiveUtilityTestConfig";

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the cheat-inventory event.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

const spawnCheatFx = () =>
	spawnItemFx({
		id: "runtime:cheat",
		itemId: "cheat",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 1,
	});

const prepareIdleLoadedForgeFx = Effect.fn("prepareIdleLoadedForgeFx")(function* () {
	const forge = yield* spawnItemFx({
		id: "runtime:forge",
		itemId: "forge",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
		quantity: 1,
	});
	const water = yield* spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		},
		quantity: 3,
	});
	const tool = yield* spawnItemFx({
		id: "runtime:tool",
		itemId: "tool",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		},
		quantity: 1,
	});
	yield* storeInputMaterialFx({
		ownerItemId: forge.id,
		lineId: "line:forge:run",
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 3,
	});
	yield* storeInputMaterialFx({
		ownerItemId: forge.id,
		lineId: "line:forge:run",
		inputIndex: 1,
		sourceItemId: tool.id,
		sourceItemRevision: tool.revision,
		quantity: 1,
	});

	return forge;
});

describe("consumeItemIntoCheatInventoryFx", () => {
	it("consumes the complete source identity, preserves the sink and emits removal feedback", async () => {
		const session = await createGameSession({
			config: createDestructiveUtilityTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batches: GameEventBatchSchema.Type[] = [];
		const unsubscribe = session.subscribeEvents((batch) => {
			batches.push(batch);
		});

		try {
			const cheat = await session.run(spawnCheatFx());
			const source = await session.run(
				spawnItemFx({
					id: "runtime:source",
					itemId: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 3,
				}),
			);
			const removed = await session.run(
				consumeItemIntoCheatInventoryFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: cheat.id,
					targetRevision: cheat.revision,
				}),
			);
			await waitFor(() => batches.length === 1);

			expect(removed).toEqual(source);
			expect(session.getSnapshot().items.some((item) => item.id === source.id)).toBe(false);
			expect(session.getSnapshot().items.find((item) => item.id === cheat.id)).toEqual(cheat);
			expect(batches[0]?.events).toEqual([
				{
					type: "cheat-inventory:consumed",
					sourceItemId: source.id,
					sourceCanonicalItemId: "water",
					targetItemId: cheat.id,
					targetCanonicalItemId: "cheat",
					quantity: 3,
				},
			]);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});

	it("uses the ordinary idle-owner removal lifecycle and releases buffered roots", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const cheat = yield* spawnCheatFx();
				const forge = yield* prepareIdleLoadedForgeFx();
				yield* consumeItemIntoCheatInventoryFx({
					sourceItemId: forge.id,
					sourceRevision: forge.revision,
					targetItemId: cheat.id,
					targetRevision: cheat.revision,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: createDestructiveUtilityTestConfig(),
				}),
			),
		);

		expect(result.items.some((item) => item.id === "runtime:forge")).toBe(false);
		expect(result.items.some((item) => item.id === "runtime:cheat")).toBe(true);
		expect(result.items.some((item) => item.location.scope === "input")).toBe(false);
		expect(
			result.items
				.filter((item) => item.item.id === "water" || item.item.id === "tool")
				.every((item) => item.location.scope === "board"),
		).toBe(true);
	});

	it("rejects busy owners without mutating the sink or source", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const cheat = yield* spawnCheatFx();
				const forge = yield* prepareIdleLoadedForgeFx();
				yield* startLineFx({
					ownerItemId: forge.id,
					lineId: "line:forge:run",
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					consumeItemIntoCheatInventoryFx({
						sourceItemId: forge.id,
						sourceRevision: forge.revision,
						targetItemId: cheat.id,
						targetRevision: cheat.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createDestructiveUtilityTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: "runtime:forge",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects protected job material before treating it as a board drop", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const cheat = yield* spawnCheatFx();
				const forge = yield* prepareIdleLoadedForgeFx();
				yield* startLineFx({
					ownerItemId: forge.id,
					lineId: "line:forge:run",
				});
				const runtime = yield* readRuntimeFx();
				const protectedItem = runtime.items.find(
					(item) => item.location.scope === "job" || item.location.scope === "reserved",
				);
				if (protectedItem === undefined)
					throw new Error("Expected protected job material.");
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					consumeItemIntoCheatInventoryFx({
						sourceItemId: protectedItem.id,
						sourceRevision: protectedItem.revision,
						targetItemId: cheat.id,
						targetRevision: cheat.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createDestructiveUtilityTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "ItemJobScopedError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects inventory sources atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const cheat = yield* spawnCheatFx();
				const source = yield* spawnItemFx({
					id: "runtime:inventory-source",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					consumeItemIntoCheatInventoryFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: cheat.id,
						targetRevision: cheat.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createDestructiveUtilityTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "ItemNotOnBoardError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects non-cheat targets atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:wrong-target",
					itemId: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					consumeItemIntoCheatInventoryFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: target.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createDestructiveUtilityTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "CheatInventoryTargetInvalidError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects cross-space board drops atomically", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const cheat = yield* spawnCheatFx();
				const source = yield* spawnItemFx({
					id: "runtime:remote-source",
					itemId: "water",
					location: {
						scope: "board",
						space: 1,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.either(
					consumeItemIntoCheatInventoryFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: cheat.id,
						targetRevision: cheat.revision,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createDestructiveUtilityTestConfig(),
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "CrossSpaceBoardOperationError",
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
