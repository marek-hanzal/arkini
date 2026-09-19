import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceItemSchedulesFx } from "~/item-schedule/fx/advanceItemSchedulesFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";
import { createTemporaryMaterialLifecycleTestConfig } from "./temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

describe("Clock lifetime boundaries", () => {
	it("admits a tied pulse after the completing job frees the only queue slot", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const first = yield* tickClockFx(100);
				const second = yield* tickClockFx(100);
				return {
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						maxQueueSize: 1,
						clock: {
							intervalMs: 100,
						},
						lines: [
							{
								...createLine({
									id: "pulse",
									clock: true,
								}),
								runtimeMs: 100,
							},
						],
					}),
				}),
			),
		);
		expect(result.first.jobs).toHaveLength(1);
		expect(result.second.jobs).toHaveLength(1);
		expect(result.second.jobs[0].id).not.toBe(result.first.jobs[0].id);
		expect(result.second.jobs[0].remainingMs).toBe(100);
	});

	it("ages phase and lifetime outside Board and across a scope transition", () => {
		const base = createTemporaryMaterialLifecycleTestConfig();
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				temporary: {
					...base.items.temporary,
					clock: {
						intervalMs: 100,
						durationMs: 600,
					},
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "owner",
					itemId: "owner",
					quantity: 1,
					location: board(0),
				});
				const material = yield* spawnItemFx({
					id: "material",
					itemId: "temporary",
					quantity: 1,
					location: board(1),
				});
				yield* storeInputMaterialFx({
					ownerItemId: "owner",
					lineId: "line:owner",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 1,
				});
				const stored = yield* readRuntimeFx();
				const aging = yield* advanceItemSchedulesFx({
					stepStart: stored,
					runtime: stored,
				});
				const returned = {
					...stored,
					items: stored.items.map((item) =>
						item.id === material.id
							? {
									...item,
									location: board(1),
								}
							: item,
					),
				};
				const returnStep = yield* advanceItemSchedulesFx({
					stepStart: stored,
					runtime: returned,
				});
				return {
					aging,
					returnStep,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		for (const resultStep of [
			result.aging,
			result.returnStep,
		]) {
			expect(
				resultStep.runtime.items.find((item) => item.id === "material")?.schedule,
			).toEqual({
				remainingIntervalMs: 100,
				pulseSequence: 1,
				remainingDurationMs: 500,
			});
			expect(resultStep.dispatched).toBe(true);
		}
	});
	it("expires a buffered Clock owner and returns its buffered roots from the outer owner", () => {
		const base = createTemporaryMaterialLifecycleTestConfig();
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				temporary: {
					...base.items.temporary,
					clock: {
						durationMs: 100,
					},
					lines: [
						createLine({
							id: "buffer",
							input: [
								{
									type: "materials",
									query: {
										scope: "any",
										selector: {
											type: "item",
											itemId: "residue",
										},
									},
									quantity: {
										min: 1,
										max: 1,
									},
									mode: "consume",
								},
							],
						}),
					],
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "owner",
					itemId: "owner",
					quantity: 1,
					location: board(0),
				});
				const material = yield* spawnItemFx({
					id: "material",
					itemId: "temporary",
					quantity: 1,
					location: board(1),
				});
				const child = yield* spawnItemFx({
					id: "child",
					itemId: "residue",
					quantity: 1,
					location: board(2),
				});
				yield* storeInputMaterialFx({
					ownerItemId: material.id,
					lineId: "buffer",
					inputIndex: 0,
					sourceItemId: child.id,
					sourceItemRevision: child.revision,
					quantity: 1,
				});
				const current = (yield* readRuntimeFx()).items.find(
					(item) => item.id === material.id,
				);
				if (current === undefined) throw new Error("Missing material owner.");
				yield* storeInputMaterialFx({
					ownerItemId: "owner",
					lineId: "line:owner",
					inputIndex: 0,
					sourceItemId: current.id,
					sourceItemRevision: current.revision,
					quantity: 1,
				});
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.items.some((item) => item.id === "material")).toBe(false);
		expect(result.items.find((item) => item.item.id === "residue")).toMatchObject({
			location: {
				scope: "board",
				space: 0,
			},
		});
	});

	it("expires a buffered Clock before the next queued request can use it", () => {
		const base = createTemporaryMaterialLifecycleTestConfig();
		const owner = base.items.owner;
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				owner: {
					...owner,
					maxQueueSize: 2,
					units: {
						amount: 5,
					},
					lines: [
						{
							...createLine({
								id: "first",
							}),
							runtimeMs: 100,
						},
						{
							...owner.lines[0],
							input: owner.lines[0].input.map((input) => ({
								...input,
								units: {
									from: "self",
									cost: 1,
								},
							})),
						},
					],
				},
				temporary: {
					...base.items.temporary,
					clock: {
						durationMs: 100,
					},
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "owner",
					itemId: "owner",
					quantity: 1,
					location: board(0),
				});
				const material = yield* spawnItemFx({
					id: "material",
					itemId: "temporary",
					quantity: 1,
					location: board(1),
				});
				yield* storeInputMaterialFx({
					ownerItemId: "owner",
					lineId: "line:owner",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: "owner",
					lineId: "first",
				});
				yield* enqueueLineFx({
					ownerItemId: "owner",
					lineId: "line:owner",
				});
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.items.find((item) => item.id === "owner")?.remainingUnits).toBeUndefined();
		expect(result.items.some((item) => item.id === "material")).toBe(false);
		expect(result.jobs).toEqual([]);
		expect(result.jobQueue).toMatchObject([
			{
				ownerItemId: "owner",
				lineId: "line:owner",
			},
		]);
	});
});
