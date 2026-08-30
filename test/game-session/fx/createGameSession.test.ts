import { describe, expect, it } from "vitest";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { createTestGameSession } from "~test/support/game/createTestGameSession";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { createTickFailureTestConfig } from "~test/game-tick/support/createTickFailureTestConfig";
import { startLineFx } from "~test/production-job/support/startLineTestFx";

import { emitCompletedEventFx } from "./createGameSession.test/fixture";

describe("createGameSessionFx / fail-stop", () => {
	it("freezes the session when a runtime listener throws", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let runtimeNotifications = 0;
		let markRuntimeDelivered: (() => void) | undefined;
		const runtimeDelivered = new Promise<void>((resolve) => {
			markRuntimeDelivered = resolve;
		});
		let markFatalDelivered: (() => void) | undefined;
		const fatalDelivered = new Promise<void>((resolve) => {
			markFatalDelivered = resolve;
		});
		const unsubscribeThrowingRuntime = session.subscribe(() => {
			throw new Error("runtime listener exploded");
		});
		const unsubscribeHealthyRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
			markRuntimeDelivered?.();
		});
		const unsubscribeFatal = session.subscribeFatalError(() => {
			markFatalDelivered?.();
		});

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:water:listener",
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
			await Promise.all([
				fatalDelivered,
				runtimeDelivered,
			]);

			expect(runtimeNotifications).toBe(1);
			expect(session.getFatalError()?.source).toBe("subscription");
			await expect(
				session.run(emitCompletedEventFx("job:listener:rejected")),
			).rejects.toMatchObject({
				_tag: "GameSessionNotRunningError",
				state: "frozen",
			});
		} finally {
			unsubscribeThrowingRuntime();
			unsubscribeHealthyRuntime();
			unsubscribeFatal();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("freezes the session when an event listener rejects", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let markFatalDelivered: (() => void) | undefined;
		const fatalDelivered = new Promise<void>((resolve) => {
			markFatalDelivered = resolve;
		});
		const unsubscribeFatal = session.subscribeFatalError(() => {
			markFatalDelivered?.();
		});
		const unsubscribe = session.subscribeEvents(async () => {
			throw new Error("async event listener exploded");
		});

		try {
			await session.run(emitCompletedEventFx("job:listener:rejected"));
			await fatalDelivered;
			expect(session.getFatalError()?.source).toBe("subscription");
		} finally {
			unsubscribe();
			unsubscribeFatal();
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("freezes the session exactly once when Tick fails", async () => {
		const config = createTickFailureTestConfig();
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 5,
		});
		let notifications = 0;
		let markFatalDelivered: (() => void) | undefined;
		const fatalDelivered = new Promise<void>((resolve) => {
			markFatalDelivered = resolve;
		});
		const unsubscribe = session.subscribeFatalError(() => {
			notifications += 1;
			markFatalDelivered?.();
		});

		try {
			const owner = await session.run(
				spawnItemFx({
					id: "runtime:tick-reporter-forge",
					itemId: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			await session.run(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);
			delete (config.items as Record<string, unknown>).inventoryOutput;

			await fatalDelivered;
			const fatal = session.getFatalError();
			expect(fatal?.source).toBe("tick");
			session.failStop("presentation", new Error("later failure"));
			expect(session.getFatalError()).toBe(fatal);
			expect(notifications).toBe(1);
			await expect(session.run(Effect.void)).rejects.toMatchObject({
				_tag: "GameSessionNotRunningError",
				state: "frozen",
			});
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
