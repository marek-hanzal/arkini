import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { Effect } from "effect";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";

import { emitCompletedEventFx } from "./createGameSession.test/fixture";

describe("createGameSessionFx / callback ordering", () => {
	it("updates the canonical runtime before delivering transition events", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let publishObservedStartedJob: ((observed: boolean) => void) | undefined;
		const observedStartedJob = new Promise<boolean>((resolve) => {
			publishObservedStartedJob = resolve;
		});
		const unsubscribe = session.subscribeEventsFn((batch) => {
			const started = batch.events.find(
				(event) => event.type === GameEventEnumSchema.enum.JobStarted,
			);
			if (started !== undefined) {
				publishObservedStartedJob?.(
					session.getSnapshotFn().jobs.some((job) => job.id === started.jobId),
				);
			}
		});

		try {
			const owner = await session.runFn(prepareJobLineFx());
			await session.runFn(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);

			expect(await observedStartedJob).toBe(true);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("exposes the canonical runtime to every callback for a combined transition", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		let markRuntimeDelivered: (() => void) | undefined;
		const runtimeDelivered = new Promise<void>((resolve) => {
			markRuntimeDelivered = resolve;
		});
		let publishEventSnapshot:
			| ((snapshot: ReturnType<typeof session.getSnapshotFn>) => void)
			| undefined;
		const eventSnapshot = new Promise<ReturnType<typeof session.getSnapshotFn>>((resolve) => {
			publishEventSnapshot = resolve;
		});
		const unsubscribeRuntime = session.subscribeFn(() => {
			runtimeNotifications += 1;
			markRuntimeDelivered?.();
		});
		const unsubscribeEvents = session.subscribeEventsFn(() => {
			eventNotifications += 1;
			publishEventSnapshot?.(session.getSnapshotFn());
		});

		try {
			const before = session.getSnapshotFn();
			await session.runFn(
				modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						{
							...runtime,
						},
						[
							{
								type: GameEventEnumSchema.enum.JobCompleted,
								jobId: "job:combined",
								ownerItemId: "owner:combined",
								lineId: "line:combined",
							},
						],
					] as const),
				),
			);
			const committed = session.getSnapshotFn();
			expect(committed).not.toBe(before);
			const observedSnapshot = await eventSnapshot;
			await runtimeDelivered;
			expect(runtimeNotifications).toBe(1);
			expect(eventNotifications).toBe(1);
			expect(observedSnapshot).toBe(committed);
		} finally {
			unsubscribeRuntime();
			unsubscribeEvents();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("does not deliver the current transition to listeners registered during its callbacks", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const nestedJobIds: string[] = [];
		let nestedUnsubscribe: (() => void) | undefined;
		let markNestedSubscribed: (() => void) | undefined;
		const nestedSubscribed = new Promise<void>((resolve) => {
			markNestedSubscribed = resolve;
		});
		let publishNestedJobIds: ((jobIds: ReadonlyArray<string>) => void) | undefined;
		const nestedEventsDelivered = new Promise<ReadonlyArray<string>>((resolve) => {
			publishNestedJobIds = resolve;
		});
		const unsubscribeRuntime = session.subscribeFn(() => {
			if (nestedUnsubscribe !== undefined) return;
			nestedUnsubscribe = session.subscribeEventsFn((batch) => {
				nestedJobIds.push(
					...batch.events.flatMap((event) =>
						"jobId" in event
							? [
									event.jobId,
								]
							: [],
					),
				);
				if (nestedJobIds.includes("job:nested:next")) {
					publishNestedJobIds?.([
						...nestedJobIds,
					]);
				}
			});
			markNestedSubscribed?.();
		});

		try {
			await session.runFn(
				modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						{
							...runtime,
						},
						[
							{
								type: GameEventEnumSchema.enum.JobCompleted,
								jobId: "job:nested:current",
								ownerItemId: "owner:nested",
								lineId: "line:nested",
							},
						],
					] as const),
				),
			);
			await nestedSubscribed;
			await session.runFn(emitCompletedEventFx("job:nested:next"));
			expect(await nestedEventsDelivered).toEqual([
				"job:nested:next",
			]);
		} finally {
			nestedUnsubscribe?.();
			unsubscribeRuntime();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("publishes ordered committed job event batches to the session event source", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batches: Array<ReadonlyArray<string>> = [];
		let publishBatches: ((batches: ReadonlyArray<ReadonlyArray<string>>) => void) | undefined;
		const batchesDelivered = new Promise<ReadonlyArray<ReadonlyArray<string>>>((resolve) => {
			publishBatches = resolve;
		});
		const unsubscribe = session.subscribeEventsFn((batch) => {
			const jobEvents = batch.events.flatMap((event) =>
				event.type === GameEventEnumSchema.enum.JobStarted ||
				event.type === GameEventEnumSchema.enum.JobCompleted
					? [
							event.type,
						]
					: [],
			);
			if (jobEvents.length > 0) {
				batches.push(jobEvents);
				if (batches.length === 2)
					publishBatches?.(
						batches.map((events) => [
							...events,
						]),
					);
			}
		});

		try {
			const owner = await session.runFn(prepareJobLineFx());
			await session.runFn(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);
			await session.runFn(
				enqueueLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);
			await session.runFn(
				advanceRuntimeElapsedFx({
					elapsedMs: 2_000,
				}),
			);
			expect(session.getSnapshotFn().jobs).toHaveLength(0);

			expect(await batchesDelivered).toEqual([
				[
					"job:started",
				],
				[
					"job:completed",
					"job:started",
					"job:completed",
				],
			]);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
