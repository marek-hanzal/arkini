import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import type { GameSession } from "~/v1/ui/session/GameSession";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { nukeGameSessionFx } from "~/v1/ui/session/nukeGameSessionFx";
import { createDestructiveUtilityTestConfig } from "~test/utility/support/createDestructiveUtilityTestConfig";

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the save operation.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

describe("nukeGameSessionFx", () => {
	it("discards the live session save, deletes persisted state and returns a fresh session", async () => {
		const config = createDestructiveUtilityTestConfig();
		const order: string[] = [];
		const writes: number[] = [];
		const session = await createGameSession({
			config,
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.sync(() => {
						writes.push(state.items.length);
					}),
			},
		});
		await session.run(
			spawnItemFx({
				id: "runtime:doomed",
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

		let fresh: GameSession | undefined;
		try {
			fresh = await Effect.runPromise(
				nukeGameSessionFx({
					session,
					deletePersistedState: Effect.sync(() => {
						order.push("delete");
					}),
					createFreshSession: Effect.tryPromise({
						try: async () => {
							order.push("create");
							return createGameSession({
								config,
								tickIntervalMs: 60_000,
							});
						},
						catch: (cause) => cause,
					}),
				}),
			);

			expect(order).toEqual([
				"delete",
				"create",
			]);
			expect(writes).toEqual([]);
			await expect(session.run(Effect.void)).rejects.toThrow("Game session is disposed");
			expect(fresh.getSnapshot().items).toEqual([]);
		} finally {
			await fresh?.dispose();
		}
	});

	it("waits for an in-flight save before deleting persisted state", async () => {
		const config = createDestructiveUtilityTestConfig();
		const order: string[] = [];
		let releaseSave: (() => void) | undefined;
		const saveGate = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const session = await createGameSession({
			config,
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				write: (state) =>
					Effect.promise(async () => {
						if (state.items.length !== 1) return;
						order.push("save:start");
						await saveGate;
						order.push("save:end");
					}),
			},
		});
		await session.run(
			spawnItemFx({
				id: "runtime:in-flight",
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
		await waitFor(() => order.includes("save:start"));

		let fresh: GameSession | undefined;
		const nuked = Effect.runPromise(
			nukeGameSessionFx({
				session,
				deletePersistedState: Effect.sync(() => {
					order.push("delete");
				}),
				createFreshSession: Effect.tryPromise({
					try: async () => {
						order.push("create");
						return createGameSession({
							config,
							tickIntervalMs: 60_000,
						});
					},
					catch: (cause) => cause,
				}),
			}),
		);

		try {
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(order).toEqual([
				"save:start",
			]);
			releaseSave?.();
			fresh = await nuked;
			expect(order).toEqual([
				"save:start",
				"save:end",
				"delete",
				"create",
			]);
		} finally {
			releaseSave?.();
			await fresh?.dispose();
		}
	});

	it("reports deletion failure and never creates a fake fresh session", async () => {
		const config = createDestructiveUtilityTestConfig();
		const session = await createGameSession({
			config,
			tickIntervalMs: 60_000,
		});
		let creates = 0;

		await expect(
			Effect.runPromise(
				nukeGameSessionFx({
					session,
					deletePersistedState: Effect.fail(new Error("delete failed")),
					createFreshSession: Effect.sync(() => {
						creates += 1;
						return session;
					}),
				}),
			),
		).rejects.toThrow("delete failed");
		expect(creates).toBe(0);
		await expect(session.run(Effect.void)).rejects.toThrow("Game session is disposed");
	});
});
