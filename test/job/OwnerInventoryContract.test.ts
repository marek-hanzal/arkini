import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { readOwnerJobQueueFx } from "~/engine/job/read/readOwnerJobQueueFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { releaseInventoryItemFx } from "~/engine/runtime/write/releaseInventoryItemFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { storeItemInInventoryFx } from "~/engine/runtime/write/storeItemInInventoryFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";

const ownerItemId = "runtime:forge";
const lineId = "line:forge:run";

const createInventoryOpenerJobConfig = () => {
	const base = createJobTestConfig(2, "any");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			backpack: {
				id: "backpack",
				type: "inventory",
				title: "Backpack",
				description: "Stores items.",
				asset: {
					default: [
						"asset:backpack",
					],
				},
				tags: [],
				categoryId: "utility",
			},
		},
	});
};

const moveOwnerFx = Effect.fn("moveOwnerFx")(function* (scope: "board" | "inventory") {
	const runtime = yield* readRuntimeFx();
	const owner = runtime.items.find((item) => item.id === ownerItemId);
	if (owner === undefined) throw new Error("Expected forge owner.");
	return yield* moveItemFx({
		itemId: owner.id,
		revision: owner.revision,
		location:
			scope === "board"
				? {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					}
				: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
	});
});

const removeBufferedWaterFx = Effect.fn("removeBufferedWaterFx")(function* () {
	const runtime = yield* readRuntimeFx();
	const water = runtime.items.find(
		(item) => item.item.id === "water" && item.location.scope === "input",
	);
	if (water === undefined) throw new Error("Expected buffered water.");
	yield* removeItemFx({
		itemId: water.id,
		revision: water.revision,
	});
});

const refillBufferedWaterFx = Effect.fn("refillBufferedWaterFx")(function* () {
	const water = yield* spawnItemFx({
		id: "runtime:water:inventory-contract",
		itemId: "water",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		},
		quantity: 3,
	});
	yield* storeInputMaterialFx({
		ownerItemId,
		lineId,
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 3,
	});
});

describe("job owner inventory contract", () => {
	it("rejects an explicit start while the owner is in inventory", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* moveOwnerFx("inventory");
				const before = yield* readRuntimeFx();
				const started = yield* Effect.result(
					startLineFx({
						ownerItemId,
						lineId,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					before,
					started,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2, "any"),
				}),
			),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "ItemNotOnBoardError",
				itemId: ownerItemId,
				location: {
					scope: "inventory",
				},
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("pauses an active job in inventory and resumes it on the board", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId,
					lineId,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 400,
				});
				yield* moveOwnerFx("inventory");
				yield* runTickRuntimeByFx({
					elapsedMs: 5_000,
				});
				const paused = yield* readOwnerJobQueueFx({
					ownerItemId,
				});
				yield* moveOwnerFx("board");
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return {
					paused,
					resumed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2, "any"),
				}),
			),
		);

		expect(result.paused).toEqual([
			expect.objectContaining({
				status: JobStatusEnumSchema.enum.Paused,
				job: expect.objectContaining({
					remainingMs: 600,
				}),
			}),
		]);
		expect(result.resumed.jobs).toEqual([]);
		expect(
			result.resumed.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});

	it("preserves an active owner through opener storage and Inventory release", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const opener = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 4,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId,
					lineId,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 400,
				});
				const activeRuntime = yield* readRuntimeFx();
				const activeOwner = activeRuntime.items.find((item) => item.id === ownerItemId);
				if (activeOwner === undefined || activeOwner.location.scope !== "board") {
					throw new Error("Expected active Board owner.");
				}
				yield* storeItemInInventoryFx({
					sourceItemId: activeOwner.id,
					sourceRevision: activeOwner.revision,
					sourceLocation: activeOwner.location,
					inventoryItemId: opener.id,
					inventoryRevision: opener.revision,
					inventoryLocation: opener.location,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 5_000,
				});
				const pausedRuntime = yield* readRuntimeFx();
				const pausedOwner = pausedRuntime.items.find((item) => item.id === ownerItemId);
				if (pausedOwner === undefined || pausedOwner.location.scope !== "inventory") {
					throw new Error("Expected paused Inventory owner.");
				}
				yield* releaseInventoryItemFx({
					itemId: pausedOwner.id,
					location: pausedOwner.location,
					revision: pausedOwner.revision,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 600,
				});
				return {
					completed: yield* readRuntimeFx(),
					paused: pausedRuntime,
				};
			}).pipe(
				useGameFx({
					config: createInventoryOpenerJobConfig(),
				}),
			),
		);

		expect(result.paused.jobs).toEqual([
			expect.objectContaining({
				ownerItemId,
				remainingMs: 600,
			}),
		]);
		expect(result.paused.items.find((item) => item.id === ownerItemId)?.location.scope).toBe(
			"inventory",
		);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.find((item) => item.id === ownerItemId)?.location.scope).toBe(
			"board",
		);
	});

	it("keeps a ready job paused in inventory until the owner returns to the board", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId,
					lineId,
				});
				yield* moveOwnerFx("inventory");
				yield* runTickRuntimeByFx({
					elapsedMs: 2_000,
				});
				const paused = yield* readOwnerJobQueueFx({
					ownerItemId,
				});
				const inventoryRuntime = yield* readRuntimeFx();
				yield* moveOwnerFx("board");
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					completed: yield* readRuntimeFx(),
					inventoryRuntime,
					paused,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2, "any", 0),
				}),
			),
		);

		expect(result.paused).toEqual([
			expect.objectContaining({
				status: JobStatusEnumSchema.enum.Paused,
				job: expect.objectContaining({
					remainingMs: 0,
				}),
			}),
		]);
		expect(result.inventoryRuntime.jobs).toHaveLength(1);
		expect(
			result.inventoryRuntime.items.map((item) =>
				item.location.scope === "job" || item.location.scope === "reserved"
					? item.location.scope
					: undefined,
			),
		).toEqual(
			expect.arrayContaining([
				"job",
				"reserved",
			]),
		);
		expect(result.completed.jobs).toEqual([]);
		expect(
			result.completed.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});

	it("keeps a queue-only owner blocked in inventory and dispatches it after returning", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* startLineFx({
					ownerItemId,
					lineId,
				});
				yield* enqueueLineFx({
					ownerItemId,
					lineId,
				});
				yield* removeBufferedWaterFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 1_000,
				});
				yield* refillBufferedWaterFx();
				yield* moveOwnerFx("inventory");
				yield* runTickRuntimeByFx({
					elapsedMs: 400,
				});
				const paused = yield* readRuntimeFx();
				yield* moveOwnerFx("board");
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					paused,
					resumed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2, "any"),
				}),
			),
		);

		expect(result.paused.jobs).toEqual([]);
		expect(result.paused.jobQueue).toHaveLength(1);
		expect(result.resumed.jobs).toHaveLength(1);
		expect(result.resumed.jobs[0]?.remainingMs).toBe(800);
		expect(result.resumed.jobQueue).toEqual([]);
	});
});
