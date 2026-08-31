import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/game/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { Effect } from "effect";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";

import { waitFor } from "./createGameSession.test/fixture";

describe("createGameSessionFx / synchronous admission", () => {
	it("opens runtime subscriptions synchronously while a mutation is still planning", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let markPlanningEntered: (() => void) | undefined;
		let releasePlanning: (() => void) | undefined;
		const planningEntered = new Promise<void>((resolve) => {
			markPlanningEntered = resolve;
		});
		const planningGate = new Promise<void>((resolve) => {
			releasePlanning = resolve;
		});
		let notifications = 0;

		try {
			const pending = session.run(
				modifyRuntimeFx((runtime) =>
					Effect.promise(async () => {
						markPlanningEntered?.();
						await planningGate;

						return [
							undefined,
							{
								...runtime,
							},
						] as const;
					}),
				),
			);
			await planningEntered;

			const unsubscribe = session.subscribe(() => {
				notifications += 1;
			});

			try {
				releasePlanning?.();
				await pending;
				await waitFor(() => notifications === 1);
			} finally {
				unsubscribe();
			}
		} finally {
			releasePlanning?.();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("opens event subscriptions synchronously while a mutation is still planning", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let markPlanningEntered: (() => void) | undefined;
		let releasePlanning: (() => void) | undefined;
		const planningEntered = new Promise<void>((resolve) => {
			markPlanningEntered = resolve;
		});
		const planningGate = new Promise<void>((resolve) => {
			releasePlanning = resolve;
		});
		const jobIds: string[] = [];

		try {
			const pending = session.run(
				modifyRuntimeFx((runtime) =>
					Effect.promise(async () => {
						markPlanningEntered?.();
						await planningGate;

						return [
							undefined,
							runtime,
							[
								{
									type: GameEventEnumSchema.enum.JobCompleted,
									jobId: "job:event:planned",
									ownerItemId: "owner:event:planned",
									lineId: "line:event:planned",
								},
							],
						] as const;
					}),
				),
			);
			await planningEntered;

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

			try {
				releasePlanning?.();
				await pending;
				await waitFor(() => jobIds.length === 1);
				expect(jobIds).toEqual([
					"job:event:planned",
				]);
			} finally {
				unsubscribe();
			}
		} finally {
			releasePlanning?.();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("exposes a committed command runtime synchronously when run resolves", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const initial = session.getSnapshot();
		let notifications = 0;
		const unsubscribe = session.subscribe(() => {
			notifications += 1;
		});

		try {
			const item = await session.run(
				spawnItemFx({
					id: "runtime:water:ui",
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

			const committed = session.getSnapshot();
			expect(committed).not.toBe(initial);
			expect(committed.items.some((candidate) => candidate.id === item.id)).toBe(true);
			expect(committed.items).toHaveLength(1);
			await waitFor(() => notifications === 1);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
