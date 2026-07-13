import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { startLineFx } from "~/v1/job/write/startLineFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";
import { createInvalidReplacementTestConfig } from "~test/tick/support/createInvalidReplacementTestConfig";

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the game session.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

describe("createGameSession", () => {
	it("keeps the initial committed transition harmless for React snapshots", async () => {
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
			expect(notifications).toBeLessThanOrEqual(1);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});

	it("keeps one managed runtime for commands and synchronous UI snapshots", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
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

			await waitFor(() =>
				session.getSnapshot().items.some((candidate) => candidate.id === item.id),
			);
			expect(session.getSnapshot().items).toHaveLength(1);
			expect(notifications).toBeGreaterThan(0);
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});

	it("does not notify React subscribers for a no-op Tick commit", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
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

	it("updates the synchronous runtime snapshot before delivering transition events", async () => {
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

	it("keeps the committed-transition bridge alive when runtime and event listeners throw", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		let runtimeNotifications = 0;
		let eventNotifications = 0;
		const unsubscribeThrowingRuntime = session.subscribe(() => {
			throw new Error("runtime listener exploded");
		});
		const unsubscribeHealthyRuntime = session.subscribe(() => {
			runtimeNotifications += 1;
		});
		const unsubscribeThrowingEvent = session.subscribeEvents(() => {
			throw new Error("event listener exploded");
		});
		const unsubscribeHealthyEvent = session.subscribeEvents(() => {
			eventNotifications += 1;
		});
		const emit = (jobId: string) =>
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

		try {
			await session.run(emit("job:listener:first"));
			await session.run(emit("job:listener:second"));
			await waitFor(() => runtimeNotifications === 2 && eventNotifications === 2);

			expect(runtimeNotifications).toBe(2);
			expect(eventNotifications).toBe(2);
		} finally {
			unsubscribeThrowingRuntime();
			unsubscribeHealthyRuntime();
			unsubscribeThrowingEvent();
			unsubscribeHealthyEvent();
			await session.dispose();
		}
	});

	it("keeps retrying Tick failures when the reporting callback throws", async () => {
		let reports = 0;
		const session = await createGameSession({
			config: createInvalidReplacementTestConfig(),
			tickIntervalMs: 1,
			onTickError: () => {
				reports += 1;
				throw new Error("tick reporter exploded");
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

			await waitFor(() => reports >= 2, 2_000);
			expect(reports).toBeGreaterThanOrEqual(2);
		} finally {
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
			expect(session.getSnapshot().items.some((item) => item.location.scope === "job")).toBe(
				false,
			);
		} finally {
			await session.dispose();
		}
	});
});
