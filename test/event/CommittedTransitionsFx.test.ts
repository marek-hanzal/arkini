import { Effect, Fiber, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";

import { GameLayerFx } from "~/engine/game/layer/GameLayerFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for committed transition events.");
		}
		await sleep(5);
	}
};

describe("committed transition events", () => {
	it("opens an atomic current-plus-tail subscription without replaying current", async () => {
		const [current, next, itemId] = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const transitions = yield* CommittedTransitionsFx;
					const subscription = yield* transitions.subscribe;
					const nextFiber = yield* subscription.changes.pipe(Stream.runHead, Effect.fork);
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
					const next = Option.getOrThrow(yield* Fiber.join(nextFiber));

					return [
						subscription.current,
						next,
						item.id,
					] as const;
				}),
			).pipe(
				Effect.provide(
					GameLayerFx({
						config: createJobTestConfig(),
					}),
				),
			),
		);

		expect(current.sequence).toBe(0);
		expect(current.previousRuntime).toBeNull();
		expect(current.runtime.items).toEqual([]);
		expect(next.sequence).toBe(1);
		expect(next.previousRuntime).toBe(current.runtime);
		expect(next.runtime.items.some((item) => item.id === itemId)).toBe(true);
	});

	it("does not publish events for a candidate runtime that fails validation", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batches: unknown[] = [];
		const unsubscribe = session.subscribeEvents((batch) => {
			batches.push(batch);
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
			await sleep(20);
			expect(batches).toEqual([]);
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
			await waitFor(() => jobIds.length === 2);

			expect(jobIds).toEqual([
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
