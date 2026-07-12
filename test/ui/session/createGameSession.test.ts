import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { startLineFx } from "~/v1/job/write/startLineFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { TickFx } from "~/v1/tick/context/TickFx";
import { runTickRuntimeFx } from "~/v1/tick/fx/runTickRuntimeFx";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

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
	it("does not notify React subscribers merely for attaching to the initial snapshot", async () => {
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		let notifications = 0;
		const unsubscribe = session.subscribe(() => {
			notifications += 1;
		});

		try {
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(notifications).toBe(0);
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
				Effect.gen(function* () {
					const tick = yield* TickFx;
					yield* tick.set({
						nowMs: 100,
						elapsedMs: 100,
					});
					yield* runTickRuntimeFx();
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(notifications).toBe(0);
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
				Effect.gen(function* () {
					const tick = yield* TickFx;
					yield* tick.set({
						nowMs: 2_000,
						elapsedMs: 2_000,
					});
					yield* runTickRuntimeFx();
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
