import { Effect } from "effect";
import { expect, it } from "vitest";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { setItemScheduleRunningFx } from "~/item-schedule/fx/setItemScheduleRunningFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { setDefaultLineFx } from "~/production-line/fx/setDefaultLineFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import {
	createLine,
	createOutput,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

it("rejects player production commands atomically for automatic-only owners while autonomous admission succeeds", () => {
	const config = createClockConfig({
		control: "automatic-only",
		lines: [
			{
				...createLine({
					id: "a",
					default: true,
				}),
				runtimeMs: 400,
			},
			createLine({
				id: "material",
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: "permit",
						},
						quantity: {
							min: 1,
							max: 1,
						},
						mode: "consume",
						capacity: 0,
					},
				],
			}),
		],
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* spawnClockItemFx();
			const material = yield* spawnClockItemFx("permit", 5);
			const before = yield* readRuntimeFx();
			const enqueue = yield* Effect.result(
				enqueueDefaultLineFx({
					ownerItemId: owner.id,
				}),
			);
			const setDefault = yield* Effect.result(
				setDefaultLineFx({
					ownerItemId: owner.id,
					lineId: "material",
				}),
			);
			const store = yield* Effect.result(
				storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "material",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 1,
				}),
			);
			const after = yield* readRuntimeFx();
			const automatic = yield* tickClockFx(300);
			return {
				before,
				after,
				enqueue,
				setDefault,
				store,
				automatic,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.enqueue).toMatchObject({
		_tag: "Failure",
		failure: {
			_tag: "ItemProductionControlUnavailableError",
			reason: "automatic-only",
			ownerItemId: "runtime:clock",
		},
	});
	expect(result.setDefault).toMatchObject({
		_tag: "Failure",
		failure: {
			_tag: "ItemProductionControlUnavailableError",
			reason: "automatic-only",
			ownerItemId: "runtime:clock",
		},
	});
	expect(result.store).toMatchObject({
		_tag: "Failure",
		failure: {
			_tag: "LineInputClosedError",
		},
	});
	expect(result.after).toEqual(result.before);
	expect(result.automatic.jobs).toMatchObject([
		{
			lineId: "a",
			remainingMs: 400,
		},
	]);
});

it("does not age a Clock created by a job completion until the next simulation boundary", () => {
	const config = createClockConfig({
		intervalMs: 1000,
		lines: [
			{
				...createLine({
					id: "a",
					default: true,
					output: createOutput([
						{
							itemId: "clock",
						},
					]),
				}),
				runtimeMs: 100,
			},
		],
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const original = yield* spawnClockItemFx();
			yield* enqueueDefaultLineFx({
				ownerItemId: original.id,
			});
			return yield* tickClockFx(100);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.items).toHaveLength(2);
	expect(
		result.items.find((item) => item.id === "runtime:clock")?.schedule?.remainingIntervalMs,
	).toBe(900);
	expect(
		result.items.find((item) => item.id !== "runtime:clock")?.schedule?.remainingIntervalMs,
	).toBe(1000);
});

it("runs a manually chosen line ahead of the next pulse without shifting cadence, including manual production while paused", () => {
	const config = createClockConfig({
		intervalMs: 500,
		durationMs: 2000,
		maxQueueSize: 2,
		lines: [
			{
				...createLine({
					id: "automatic",
					default: true,
				}),
				runtimeMs: 100,
			},
			{
				...createLine({
					id: "manual",
				}),
				runtimeMs: 700,
			},
		],
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* spawnClockItemFx();
			const before = yield* tickClockFx(100);
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineId: "manual",
			});
			const admitted = yield* readRuntimeFx();
			const pulse = yield* tickClockFx(400);
			yield* setItemScheduleRunningFx({
				ownerItemId: owner.id,
				running: false,
			});
			const paused = yield* readRuntimeFx();
			const drained = yield* tickClockFx(400);
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineId: "manual",
			});
			const manualWhilePaused = yield* tickClockFx(100);
			return {
				before,
				admitted,
				pulse,
				paused,
				drained,
				manualWhilePaused,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.admitted.items[0].schedule).toEqual(result.before.items[0].schedule);
	expect(result.admitted.jobQueue.map((request) => request.lineId)).toEqual([
		"manual",
	]);
	expect(result.pulse.jobs).toMatchObject([
		{
			lineId: "manual",
			remainingMs: 300,
		},
	]);
	expect(result.pulse.jobQueue.map((request) => request.lineId)).toEqual([
		"automatic",
	]);
	expect(result.pulse.items[0].schedule).toMatchObject({
		remainingIntervalMs: 500,
		remainingDurationMs: 1500,
	});
	expect(result.drained.jobs).toHaveLength(0);
	expect(result.drained.jobQueue).toHaveLength(0);
	expect(result.drained.items[0].schedule).toEqual(result.paused.items[0].schedule);
	expect(result.manualWhilePaused.jobs).toMatchObject([
		{
			lineId: "manual",
			remainingMs: 600,
		},
	]);
	expect(result.manualWhilePaused.items[0].schedule).toEqual(result.paused.items[0].schedule);
});
