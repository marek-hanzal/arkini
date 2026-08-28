import { Deferred, Effect, Fiber, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";

import { GameLayerFx } from "~/engine/game/layer/GameLayerFx";
import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

describe("committed transition events", () => {
	it.effect("replays the current transition and then every later commit", () =>
		Effect.gen(function* () {
			const transitions = yield* CommittedTransitionsFx;
			const replaySeen = yield* Deferred.make<void>();
			const transitionsFiber = yield* transitions.changes.pipe(
				Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
				Stream.take(2),
				Stream.runCollect,
				Effect.forkChild,
			);
			yield* Deferred.await(replaySeen);
			const item = yield* spawnItemFx({
				id: "runtime:subscription:first-tail",
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
			const [current, next] = Array.from(yield* Fiber.join(transitionsFiber));
			if (current === undefined || next === undefined) {
				return yield* Effect.die("Expected current replay and one committed transition.");
			}

			expect(current.sequence).toBe(0);
			expect(current.previousRuntime).toBeNull();
			expect(current.runtime.items).toEqual([]);
			expect(next.sequence).toBe(1);
			expect(next.previousRuntime).toBe(current.runtime);
			expect(next.runtime.items.some(({ id }) => id === item.id)).toBe(true);
		}).pipe(
			Effect.provide(
				GameLayerFx({
					config: createJobTestConfig(),
				}),
			),
		),
	);

	it("does not publish events for a candidate runtime that fails validation", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batchesBeforeBarrier: GameEventBatchSchema.Type[] = [];
		let markBarrierDelivered: (() => void) | undefined;
		const barrierDelivered = new Promise<void>((resolve) => {
			markBarrierDelivered = resolve;
		});
		const unsubscribe = session.subscribeEvents((batch) => {
			if (
				batch.events.some(
					(event) => "jobId" in event && event.jobId === "job:event:validation-barrier",
				)
			) {
				markBarrierDelivered?.();
				return;
			}
			batchesBeforeBarrier.push(batch);
		});

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:event:duplicate",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			await expect(
				session.run(
					modifyRuntimeFx((runtime) =>
						Effect.succeed([
							runtime,
							{
								...runtime,
								items: [
									...runtime.items,
									...runtime.items,
								],
							},
							[
								{
									type: GameEventEnumSchema.enum.JobCompleted,
									jobId: "job:fake",
									ownerItemId: "owner:fake",
									lineId: "line:fake",
								},
							],
						] as const),
					),
				),
			).rejects.toBeDefined();
			await session.run(
				modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						runtime,
						[
							{
								type: GameEventEnumSchema.enum.JobCompleted,
								jobId: "job:event:validation-barrier",
								ownerItemId: "owner:event:validation-barrier",
								lineId: "line:event:validation-barrier",
							},
						],
					] as const),
				),
			);
			await barrierDelivered;
			expect(batchesBeforeBarrier).toEqual([]);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("delivers concurrent event metadata in committed transition order", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const jobIds: string[] = [];
		let markEventsDelivered: ((deliveredJobIds: ReadonlyArray<string>) => void) | undefined;
		const eventsDelivered = new Promise<ReadonlyArray<string>>((resolve) => {
			markEventsDelivered = resolve;
		});
		const unsubscribe = session.subscribeEvents((batch) => {
			jobIds.push(
				...batch.events.flatMap((event) =>
					"jobId" in event
						? [
								event.jobId,
							]
						: [],
				),
			);
			if (jobIds.length === 2)
				markEventsDelivered?.([
					...jobIds,
				]);
		});
		let markFirstEntered: (() => void) | undefined;
		let releaseFirst: (() => void) | undefined;
		const firstEntered = new Promise<void>((resolve) => {
			markFirstEntered = resolve;
		});
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		try {
			const first = session.run(
				modifyRuntimeFx((runtime) =>
					Effect.promise(async () => {
						markFirstEntered?.();
						await firstGate;
						return [
							undefined,
							runtime,
							[
								{
									type: GameEventEnumSchema.enum.JobCompleted,
									jobId: "job:event:first",
									ownerItemId: "owner:event:first",
									lineId: "line:event:first",
								},
							],
						] as const;
					}),
				),
			);
			await firstEntered;
			const second = session.run(
				modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						runtime,
						[
							{
								type: GameEventEnumSchema.enum.JobCompleted,
								jobId: "job:event:second",
								ownerItemId: "owner:event:second",
								lineId: "line:event:second",
							},
						],
					] as const),
				),
			);
			releaseFirst?.();
			await Promise.all([
				first,
				second,
			]);
			const deliveredJobIds = await eventsDelivered;

			expect(deliveredJobIds).toEqual([
				"job:event:first",
				"job:event:second",
			]);
		} finally {
			releaseFirst?.();
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
