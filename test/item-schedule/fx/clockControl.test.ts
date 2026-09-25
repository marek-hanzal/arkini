import { Effect } from "effect";
import { expect, it } from "vitest";
import { fillDefaultLineQueueFx } from "~/production-job/fx/fillDefaultLineQueueFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import {
	createLine,
	createOutput,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

it("admits production commands independently of the owner's UI presentation", () => {
	const config = createClockConfig({
		ui: "simple",
		lines: [
			{
				...createLine({
					uid: "a",
					default: true,
					clock: "clock-interval",
				}),
				runtimeMs: 400,
			},
		],
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* spawnClockItemFx();
			const before = yield* readRuntimeFx();
			const enqueue = yield* Effect.result(
				enqueueLineFx({
					lineUid: "a",
					ownerItemId: owner.id,
				}),
			);
			const setDefault = yield* Effect.result(
				setLineSelectionFx({
					selection: "default",
					ownerItemId: owner.id,
					lineUid: "a",
				}),
			);
			const after = yield* readRuntimeFx();
			const automatic = yield* tickClockFx(300);
			return {
				before,
				after,
				enqueue,
				setDefault,
				automatic,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.enqueue).toMatchObject({
		_tag: "Success",
	});
	expect(result.setDefault).toMatchObject({
		_tag: "Success",
	});
	expect(result.after.jobQueue).toMatchObject([
		{
			ownerItemId: "runtime:clock",
			lineUid: "a",
		},
	]);
	expect(result.after.defaultLineByOwnerItemId["runtime:clock"]).toBe("a");
	expect(result.automatic.jobs).toMatchObject([
		{
			lineUid: "a",
			remainingMs: 100,
		},
	]);
});

it("does not age a Clock created by a job completion until the next simulation boundary", () => {
	const config = createClockConfig({
		lines: [
			{
				...createLine({
					uid: "a",
					default: true,
					clock: "clock-interval",
					outcome: createOutput([
						{
							itemUid: "clock",
						},
					]),
				}),
				runtimeMs: 100,
			},
		],
		clock: {
			intervalMs: 1000,
		},
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

it("runs a manually chosen line ahead of the next pulse without shifting cadence, including manual production with no automated line", () => {
	const config = createClockConfig({
		maxQueueSize: 2,
		lines: [
			{
				...createLine({
					uid: "automatic",
					default: true,
					clock: "clock-interval",
				}),
				runtimeMs: 100,
			},
			{
				...createLine({
					uid: "manual",
				}),
				runtimeMs: 700,
			},
		],
		clock: {
			intervalMs: 500,
			durationMs: 2000,
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* spawnClockItemFx();
			const before = yield* tickClockFx(100);
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineUid: "manual",
			});
			const admitted = yield* readRuntimeFx();
			const pulse = yield* tickClockFx(400);
			yield* setLineSelectionFx({
				selection: "clock",
				lineUids: [],
				ownerItemId: owner.id,
			});
			const drained = yield* tickClockFx(400);
			yield* enqueueLineFx({
				ownerItemId: owner.id,
				lineUid: "manual",
			});
			const manualWhilePaused = yield* tickClockFx(100);
			return {
				before,
				admitted,
				pulse,
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
	expect(result.admitted.jobQueue.map((request) => request.lineUid)).toEqual([
		"manual",
	]);
	expect(result.pulse.jobs).toMatchObject([
		{
			lineUid: "manual",
			remainingMs: 300,
		},
	]);
	expect(result.pulse.jobQueue.map((request) => request.lineUid)).toEqual([
		"automatic",
	]);
	expect(result.pulse.items[0].schedule).toMatchObject({
		remainingIntervalMs: 500,
		remainingDurationMs: 1500,
	});
	expect(result.drained.jobs).toHaveLength(0);
	expect(result.drained.jobQueue).toHaveLength(0);
	expect(result.drained.items[0].schedule).toMatchObject({
		lineUids: [],
		remainingIntervalMs: 100,
		remainingDurationMs: 1100,
	});
	expect(result.manualWhilePaused.jobs).toMatchObject([
		{
			lineUid: "manual",
			remainingMs: 600,
		},
	]);
	expect(result.manualWhilePaused.items[0].schedule).toMatchObject({
		lineUids: [],
		remainingIntervalMs: 500,
		remainingDurationMs: 1000,
	});
});

it.each([
	true,
	false,
])("allows simple-item Board production only with an authored default (%s)", (defaultLine) => {
	const config = createClockConfig({
		ui: "simple",
		lines: [
			{
				...createLine({
					uid: "a",
					default: defaultLine,
				}),
				runtimeMs: 400,
			},
		],
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const owner = yield* spawnClockItemFx();
			const before = yield* readRuntimeFx();
			const enqueue = yield* Effect.result(
				enqueueDefaultLineFx({
					ownerItemId: owner.id,
				}),
			);
			const after = yield* readRuntimeFx();
			const fill = yield* Effect.result(
				fillDefaultLineQueueFx({
					ownerItemId: owner.id,
				}),
			);
			return {
				before,
				after,
				enqueue,
				fill,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(result.enqueue._tag).toBe(defaultLine ? "Success" : "Failure");
	expect(result.fill._tag).toBe(defaultLine ? "Success" : "Failure");
	if (defaultLine)
		expect(result.after.jobQueue).toMatchObject([
			{
				ownerItemId: "runtime:clock",
				lineUid: "a",
			},
		]);
	else expect(result.after).toEqual(result.before);
});
