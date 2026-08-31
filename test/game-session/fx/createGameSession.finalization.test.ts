import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";

import { waitFor } from "./createGameSession.test/fixture";

describe("createGameSessionFx / final save lifecycle", () => {
	it("keeps a failed final save retryable until the same runtime is persisted", async () => {
		const failure = new Error("save target unavailable");
		let writes = 0;
		const savedItemIds: string[][] = [];
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.suspend(() => {
						writes += 1;
						savedItemIds.push(state.items.map(({ id }) => id));
						return writes === 1 ? Effect.fail(failure) : Effect.void;
					}),
			},
		});
		await session.run(
			spawnItemFx({
				id: "runtime:retry-final-save",
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

		await expect(Effect.runPromise(session.disposeFx)).rejects.toThrow(
			"save target unavailable",
		);
		await expect(
			session.run(
				spawnItemFx({
					id: "runtime:must-not-change-after-shutdown",
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
			),
		).rejects.toThrow("Game session is shutting down.");
		await expect(Effect.runPromise(session.disposeFx)).resolves.toBeUndefined();
		expect(writes).toBe(2);
		expect(savedItemIds).toEqual([
			[
				"runtime:retry-final-save",
			],
			[
				"runtime:retry-final-save",
			],
		]);
	});
	it("permits explicit discard cleanup after a failed final save", async () => {
		const failure = new Error("save target unavailable");
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: () => Effect.fail(failure),
			},
		});

		await expect(Effect.runPromise(session.disposeFx)).rejects.toThrow(
			"save target unavailable",
		);
		await expect(Effect.runPromise(session.disposeWithoutSaveFx)).resolves.toBeUndefined();
		await expect(Effect.runPromise(session.disposeWithoutSaveFx)).resolves.toBeUndefined();
	});
	it("runs the production Tick loop from Effect Clock and completes jobs", async () => {
		const config = createJobTestConfig();
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		forge.lines[0]!.runtimeMs = 25;
		const session = await createTestGameSession({
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
			await Effect.runPromise(session.disposeFx);
		}
	});
});
