import { Deferred, Effect } from "effect";
import { describe, expect, it } from "vitest";

import { startLineFx } from "~/v1/job/write/startLineFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { createTickFailureTestConfig } from "~test/tick/support/createTickFailureTestConfig";

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the game session.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

const emitCompletedEventFx = (jobId: string) =>
	modifyRuntimeFx((runtime) =>
		Effect.succeed([
			undefined,
			runtime,
			[
				{
					type: "job:completed" as const,
					jobId,
					ownerItemId: "owner:listener",
					lineId: "line:listener",
				},
			],
		] as const),
	);

describe("createGameSession", () => {
	it("does not replay the initial committed transition to React subscribers", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const initial = session.getSnapshot();
		let notifications = 0;
		const unsubscribe = session.subscribe(() => {
			notifications += 1;
		});

		try {
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(session.getSnapshot()).toBe(initial);
			expect(notifications).toBe(0);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});

	it("opens runtime subscriptions synchronously while a mutation is still planning", async () => {
		const session = await createGameSession({
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
			await session.dispose();
		}
	});

	it("opens event subscriptions synchronously while a mutation is still planning", async () => {
		const session = await createGameSession({
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
									type: "job:completed" as const,
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
			await session.dispose();
		}
	});

	it("exposes a committed command runtime synchronously when run resolves", async () => {
		const session = await createGameSession({
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
			await session.dispose();
		}
	});

	it("does not replay transitions committed before event subscription", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const jobIds: string[] = [];

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
			});

			try {
				await new Promise((resolve) => setTimeout(resolve, 20));
				expect(jobIds).toEqual([]);

				await session.run(emitCompletedEventFx("job:event:after-subscribe"));
				await waitFor(() => jobIds.length === 1);
				expect(jobIds).toEqual([
					"job:event:after-subscribe",
				]);
			} finally {
				unsubscribe();
			}
		} finally {
			await session.dispose();
		}
	});

	it("does not invalidate runtime subscribers for commits completed before registration", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;

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
			});

			try {
				await new Promise((resolve) => setTimeout(resolve, 20));
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
				await waitFor(() => notifications === 1);
			} finally {
				unsubscribe();
			}
		} finally {
			await session.dispose();
		}
	});

	it("does not notify runtime subscribers for event-only transitions", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		const unsubscribeRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeEvents = session.subscribeEvents(() => {
			eventNotifications += 1;
		});

		try {
			const before = session.getSnapshot();
			await session.run(emitCompletedEventFx("job:event-only"));
			expect(session.getSnapshot()).toBe(before);
			await waitFor(() => eventNotifications === 1);
			expect(runtimeNotifications).toBe(0);
		} finally {
			unsubscribeRuntime();
			unsubscribeEvents();
			await session.dispose();
		}
	});

	it("does not notify React subscribers for a no-op Tick commit", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;
		const unsubscribe = session.subscribe(() => {
			notifications += 1;
		});

		try {
			await session.run(
				runTickRuntimeByFx({
					elapsedMs: 100,
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(notifications).toBe(0);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});

	it("updates the canonical runtime before delivering transition events", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let observedStartedJob = false;
		const unsubscribe = session.subscribeEvents((batch) => {
			const started = batch.events.find((event) => event.type === "job:started");
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
			await session.dispose();
		}
	});

	it("exposes the canonical runtime to every callback for a combined transition", async () => {
		const session = await createGameSession({
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
								type: "job:completed" as const,
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
			await session.dispose();
		}
	});

	it("does not deliver the current transition to listeners registered during its callbacks", async () => {
		const session = await createGameSession({
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
								type: "job:completed" as const,
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
			await session.dispose();
		}
	});

	it("stops subscriptions synchronously before later commits", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;
		const unsubscribe = session.subscribeEvents(() => {
			notifications += 1;
		});

		try {
			unsubscribe();
			await session.run(emitCompletedEventFx("job:after-unsubscribe"));
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(notifications).toBe(0);
		} finally {
			await session.dispose();
		}
	});

	it("does not let pending async listeners block the remaining delivery", async () => {
		const session = await createGameSession({
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
			await session.dispose();
		}
	});

	it("disposes an in-flight planner without committing runtime or events", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const planningEntered = await Effect.runPromise(Deferred.make<void>());
		const planningGate = await Effect.runPromise(Deferred.make<void>());
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		const unsubscribeRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeEvents = session.subscribeEvents(() => {
			eventNotifications += 1;
		});
		const pending = session.run(
			modifyRuntimeFx((runtime) =>
				Deferred.succeed(planningEntered, undefined).pipe(
					Effect.zipRight(Deferred.await(planningGate)),
					Effect.as([
						undefined,
						{
							...runtime,
						},
						[
							{
								type: "job:completed" as const,
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
			const disposing = session.dispose();

			await expect(pending).rejects.toBeDefined();
			await disposing;
			expect(runtimeNotifications).toBe(0);
			expect(eventNotifications).toBe(0);
		} finally {
			unsubscribeRuntime();
			unsubscribeEvents();
			await session.dispose();
		}
	});

	it("publishes ordered committed job event batches to the session event source", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batches: Array<ReadonlyArray<string>> = [];
		const unsubscribe = session.subscribeEvents((batch) => {
			batches.push(
				batch.events.map(
					(event) => `${event.type}:${"source" in event ? event.source : ""}`,
				),
			);
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
				startLineFx({
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
					"job:started:explicit",
				],
				[
					"job:completed:",
					"job:started:queue",
					"job:completed:",
				],
			]);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});

	it("isolates throwing and rejected listeners without losing later transitions", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => {
			unhandledRejections.push(reason);
		};
		process.on("unhandledRejection", onUnhandledRejection);
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		const unsubscribeThrowingRuntime = session.subscribe(() => {
			throw new Error("runtime listener exploded");
		});
		const unsubscribeHealthyRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeRejectedEvent = session.subscribeEvents(async () => {
			throw new Error("async event listener exploded");
		});
		const unsubscribeHealthyEvent = session.subscribeEvents(() => {
			eventNotifications += 1;
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
			await session.run(emitCompletedEventFx("job:listener:first"));
			await session.run(emitCompletedEventFx("job:listener:second"));
			await waitFor(() => runtimeNotifications === 1 && eventNotifications === 2);
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(runtimeNotifications).toBe(1);
			expect(eventNotifications).toBe(2);
			expect(unhandledRejections).toEqual([]);
		} finally {
			process.off("unhandledRejection", onUnhandledRejection);
			unsubscribeThrowingRuntime();
			unsubscribeHealthyRuntime();
			unsubscribeRejectedEvent();
			unsubscribeHealthyEvent();
			await session.dispose();
		}
	});

	it("keeps retrying Tick failures when an async reporting callback rejects", async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => {
			unhandledRejections.push(reason);
		};
		process.on("unhandledRejection", onUnhandledRejection);
		let reports = 0;
		const config = createTickFailureTestConfig();
		const session = await createGameSession({
			config,
			tickIntervalMs: 5,
			onTickError: async () => {
				reports += 1;
				throw new Error("async tick reporter exploded");
			},
		});

		try {
			const owner = await session.run(
				spawnItemFx({
					id: "runtime:tick-reporter-forge",
					itemId: "forge",
					location: {
						scope: "board",
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

			await waitFor(() => reports >= 2, 2_000);
			await session.dispose();
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(reports).toBeGreaterThanOrEqual(2);
			expect(unhandledRejections).toEqual([]);
		} finally {
			process.off("unhandledRejection", onUnhandledRejection);
			await session.dispose();
		}
	});

	it("runs the production Tick loop from Effect Clock and completes jobs", async () => {
		const config = createJobTestConfig();
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		forge.lines[0]!.runtimeMs = 25;
		const session = await createGameSession({
			config,
			tickIntervalMs: 5,
		});

		try {
			const owner = await session.run(prepareJobLineFx());
			await session.run(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);
			await waitFor(() => session.getSnapshot().jobs.length === 0);
			expect(
				session
					.getSnapshot()
					.items.some(
						(item) =>
							item.location.scope === "job" || item.location.scope === "reserved",
					),
			).toBe(false);
		} finally {
			await session.dispose();
		}
	});
});
