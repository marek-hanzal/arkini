import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { Effect } from "effect";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";

import { emitCompletedEventFx, waitFor } from "./createGameSession.test/fixture";

describe("createGameSessionFx / callback ordering", () => {
	it("updates the canonical runtime before delivering transition events", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let observedStartedJob = false;
		const unsubscribe = session.subscribeEvents((batch) => {
			const started = batch.events.find(
				(event) => event.type === GameEventEnumSchema.enum.JobStarted,
			);
			if (started !== undefined) {
				observedStartedJob = session
					.getSnapshot()
					.jobs.some((job) => job.id === started.jobId);
			}
		});

		try {
			const owner = await session.run(prepareJobLineFx());
			await session.run(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);

			await waitFor(() => observedStartedJob);
			expect(observedStartedJob).toBe(true);
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
		let observedSnapshot = session.getSnapshot();
		const unsubscribeRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeEvents = session.subscribeEvents(() => {
			eventNotifications += 1;
			observedSnapshot = session.getSnapshot();
		});

		try {
			const before = session.getSnapshot();
			await session.run(
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
			const committed = session.getSnapshot();
			expect(committed).not.toBe(before);
			await waitFor(() => runtimeNotifications === 1 && eventNotifications === 1);
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
		const unsubscribeRuntime = session.subscribe(() => {
			nestedUnsubscribe ??= session.subscribeEvents((batch) => {
				nestedJobIds.push(
					...batch.events.flatMap((event) =>
						"jobId" in event
							? [
									event.jobId,
								]
							: [],
					),
				);
			});
		});

		try {
			await session.run(
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
			await waitFor(() => nestedUnsubscribe !== undefined);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(nestedJobIds).toEqual([]);

			await session.run(emitCompletedEventFx("job:nested:next"));
			await waitFor(() => nestedJobIds.length === 1);
			expect(nestedJobIds).toEqual([
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
		const unsubscribe = session.subscribeEvents((batch) => {
			const jobEvents = batch.events.flatMap((event) =>
				event.type === GameEventEnumSchema.enum.JobStarted ||
				event.type === GameEventEnumSchema.enum.JobCompleted
					? [
							event.type,
						]
					: [],
			);
			if (jobEvents.length > 0) batches.push(jobEvents);
		});

		try {
			const owner = await session.run(prepareJobLineFx());
			await session.run(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);
			await session.run(
				enqueueLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);
			await session.run(
				runTickRuntimeByFx({
					elapsedMs: 2_000,
				}),
			);
			expect(session.getSnapshot().jobs).toHaveLength(0);

			await waitFor(() => batches.length === 2);
			expect(batches).toEqual([
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
