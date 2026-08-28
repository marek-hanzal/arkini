import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { Deferred, Effect } from "effect";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";

import { emitCompletedEventFx, waitFor } from "./createGameSession.test/fixture";

describe("createGameSessionFx / unsubscribe and async delivery", () => {
	it("stops subscriptions synchronously before later commits", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;
		const unsubscribe = session.subscribeEvents(() => {
			notifications += 1;
		});
		const healthyDelivered = Effect.runSync(Deferred.make<void>());
		const unsubscribeHealthy = session.subscribeEvents(() => {
			Effect.runSync(Deferred.succeed(healthyDelivered, undefined));
		});

		try {
			unsubscribe();
			await session.run(emitCompletedEventFx("job:after-unsubscribe"));
			await Effect.runPromise(Deferred.await(healthyDelivered));
			expect(notifications).toBe(0);
		} finally {
			unsubscribeHealthy();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("does not let pending async listeners block the remaining delivery", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let releasePending: (() => void) | undefined;
		const pending = new Promise<void>((resolve) => {
			releasePending = resolve;
		});
		let healthyNotifications = 0;
		let eventNotifications = 0;
		const unsubscribePending = session.subscribe(async () => {
			await pending;
		});
		const unsubscribeHealthy = session.subscribe(() => {
			healthyNotifications += 1;
		});
		const unsubscribeEvents = session.subscribeEvents(() => {
			eventNotifications += 1;
		});

		try {
			const item = await session.run(
				spawnItemFx({
					id: "runtime:water:pending-listener",
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

			expect(session.getSnapshot().items.some((candidate) => candidate.id === item.id)).toBe(
				true,
			);
			await waitFor(() => healthyNotifications === 1);
			expect(eventNotifications).toBe(0);
		} finally {
			releasePending?.();
			unsubscribePending();
			unsubscribeHealthy();
			unsubscribeEvents();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
