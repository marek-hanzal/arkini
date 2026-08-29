import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { Deferred, Effect } from "effect";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";

import { emitCompletedEventFx } from "./createGameSession.test/fixture";

describe("createGameSessionFx / subscription visibility", () => {
	it("does not replay transitions committed before event subscription", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const jobIds: string[] = [];
		const afterSubscribeDelivered = Effect.runSync(Deferred.make<void>());

		try {
			await session.run(emitCompletedEventFx("job:event:before-subscribe"));
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
				if (jobIds.includes("job:event:after-subscribe")) {
					Effect.runSync(Deferred.succeed(afterSubscribeDelivered, undefined));
				}
			});

			try {
				expect(jobIds).toEqual([]);

				await session.run(emitCompletedEventFx("job:event:after-subscribe"));
				await Effect.runPromise(Deferred.await(afterSubscribeDelivered));
				expect(jobIds).toEqual([
					"job:event:after-subscribe",
				]);
			} finally {
				unsubscribe();
			}
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("does not invalidate runtime subscribers for commits completed before registration", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;
		let markAfterSubscribeDelivered: (() => void) | undefined;
		const afterSubscribeDelivered = new Promise<void>((resolve) => {
			markAfterSubscribeDelivered = resolve;
		});

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:before-subscribe",
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
			const unsubscribe = session.subscribe(() => {
				notifications += 1;
				if (
					session
						.getSnapshot()
						.items.some((item) => item.id === "runtime:after-subscribe")
				) {
					markAfterSubscribeDelivered?.();
				}
			});

			try {
				expect(notifications).toBe(0);

				await session.run(
					spawnItemFx({
						id: "runtime:after-subscribe",
						itemId: "water",
						location: {
							scope: "inventory",
							position: {
								x: 1,
								y: 0,
							},
						},
						quantity: 1,
					}),
				);
				await afterSubscribeDelivered;
				expect(notifications).toBe(1);
			} finally {
				unsubscribe();
			}
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("does not notify runtime subscribers for event-only transitions", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		let markEventDelivered: (() => void) | undefined;
		const eventDelivered = new Promise<void>((resolve) => {
			markEventDelivered = resolve;
		});
		const unsubscribeRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeEvents = session.subscribeEvents(() => {
			eventNotifications += 1;
			markEventDelivered?.();
		});

		try {
			const before = session.getSnapshot();
			await session.run(emitCompletedEventFx("job:event-only"));
			expect(session.getSnapshot()).toBe(before);
			await eventDelivered;
			expect(eventNotifications).toBe(1);
			expect(runtimeNotifications).toBe(0);
		} finally {
			unsubscribeRuntime();
			unsubscribeEvents();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("does not notify React subscribers for a no-op Tick commit", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;
		let markMarkerDelivered: (() => void) | undefined;
		const markerDelivered = new Promise<void>((resolve) => {
			markMarkerDelivered = resolve;
		});
		const unsubscribe = session.subscribe(() => {
			notifications += 1;
			if (
				session.getSnapshot().items.some((item) => item.id === "runtime:no-op-tick:marker")
			) {
				markMarkerDelivered?.();
			}
		});

		try {
			await session.run(
				runTickRuntimeByFx({
					elapsedMs: 100,
				}),
			);
			await session.run(
				spawnItemFx({
					id: "runtime:no-op-tick:marker",
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
			await markerDelivered;
			expect(notifications).toBe(1);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
