import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { Deferred, Effect } from "effect";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

describe("createGameSessionFx / planner disposal", () => {
	it("disposes an in-flight planner without committing runtime or events", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const planningEntered = await Effect.runPromise(Deferred.make<void>());
		const planningGate = await Effect.runPromise(Deferred.make<void>());
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		const unsubscribeRuntime = session.subscribeFn(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeEvents = session.subscribeEventsFn(() => {
			eventNotifications += 1;
		});
		const pending = session.runFn(
			modifyRuntimeFx((runtime) =>
				Deferred.succeed(planningEntered, undefined).pipe(
					Effect.andThen(Deferred.await(planningGate)),
					Effect.as([
						undefined,
						{
							...runtime,
						},
						[
							{
								type: GameEventEnumSchema.enum.JobCompleted,
								jobId: "job:dispose:pending",
								ownerItemId: "owner:dispose:pending",
								lineId: "line:dispose:pending",
							},
						],
					] as const),
				),
			),
		);

		try {
			await Effect.runPromise(Deferred.await(planningEntered));
			const disposing = Effect.runPromise(session.disposeFx);

			await expect(pending).rejects.toBeDefined();
			await disposing;
			expect(runtimeNotifications).toBe(0);
			expect(eventNotifications).toBe(0);
		} finally {
			unsubscribeRuntime();
			unsubscribeEvents();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
