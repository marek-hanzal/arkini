import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { startLineFx } from "~/engine/job/write/startLineFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createGameSession } from "~/ui/session/createGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for autosave.");
		}
		await sleep(5);
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
					ownerItemId: "owner:save",
					lineId: "line:save",
				},
			],
		] as const),
	);

describe("RuntimeSaveLayerFx", () => {
	it("debounces committed snapshots and ignores failed mutations", async () => {
		const saves: StateSchema.Type[] = [];
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 15,
				write: (state) =>
					Effect.sync(() => {
						saves.push(state);
					}),
			},
		});

		try {
			const first = await session.run(
				spawnItemFx({
					id: "runtime:save:first",
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
			await session.run(
				spawnItemFx({
					id: "runtime:save:second",
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

			await sleep(50);
			expect(saves).toHaveLength(1);
			expect(saves[0]?.items).toHaveLength(2);
			for (const item of saves[0]?.items ?? []) {
				expect(item).not.toHaveProperty("revision");
			}

			await expect(
				session.run(
					removeItemFx({
						itemId: first.id,
						revision: "revision:stale",
					}),
				),
			).rejects.toBeDefined();
			await sleep(30);
			expect(saves).toHaveLength(1);
		} finally {
			await session.dispose();
		}
	});

	it("does not let event-only traffic wake or postpone runtime autosave", async () => {
		const savedItemCounts: number[] = [];
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 40,
				write: (state) =>
					Effect.sync(() => {
						savedItemCounts.push(state.items.length);
					}),
			},
		});

		try {
			await waitFor(() => savedItemCounts.length === 1);
			expect(savedItemCounts).toEqual([
				0,
			]);

			await session.run(
				spawnItemFx({
					id: "runtime:save:event-isolation",
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

			for (let index = 0; index < 5; index += 1) {
				await sleep(15);
				await session.run(emitCompletedEventFx(`job:save:event:${index}`));
			}

			expect(savedItemCounts).toEqual([
				0,
				1,
			]);

			await session.run(emitCompletedEventFx("job:save:event:after-save"));
			await sleep(60);
			expect(savedItemCounts).toEqual([
				0,
				1,
			]);
		} finally {
			await session.dispose();
		}
	});

	it("serializes autosave and explicit flush so an older write cannot win", async () => {
		const savedItemCounts: number[] = [];
		let releaseFirstSave: (() => void) | undefined;
		let markFirstSaveStarted: (() => void) | undefined;
		const firstSaveStarted = new Promise<void>((resolve) => {
			markFirstSaveStarted = resolve;
		});
		const firstSaveGate = new Promise<void>((resolve) => {
			releaseFirstSave = resolve;
		});
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				write: (state) =>
					Effect.promise(async () => {
						if (state.items.length === 1) {
							markFirstSaveStarted?.();
							await firstSaveGate;
						}
						savedItemCounts.push(state.items.length);
					}),
			},
		});

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:save:race:first",
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
			await firstSaveStarted;
			await session.run(
				spawnItemFx({
					id: "runtime:save:race:second",
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

			const flush = session.flushSave();
			releaseFirstSave?.();
			await flush;

			expect(savedItemCounts).toEqual([
				0,
				1,
				2,
			]);
		} finally {
			releaseFirstSave?.();
			await session.dispose();
		}
	});

	it("keeps the autosave consumer alive when its reporting callback throws", async () => {
		let writes = 0;
		let reports = 0;
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				onError: () => {
					reports += 1;
					throw new Error("save reporter exploded");
				},
				write: () =>
					Effect.sync(() => {
						writes += 1;
					}).pipe(Effect.zipRight(Effect.fail(new Error("save failed")))),
			},
		});

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:save:reporter:first",
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
			await sleep(30);
			await session.run(
				spawnItemFx({
					id: "runtime:save:reporter:second",
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
			await sleep(30);

			expect(writes).toBeGreaterThanOrEqual(2);
			expect(reports).toBeGreaterThanOrEqual(2);
		} finally {
			await expect(session.dispose()).rejects.toThrow("save failed");
		}
	});

	it("keeps the autosave consumer alive when its async reporting callback rejects", async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => {
			unhandledRejections.push(reason);
		};
		process.on("unhandledRejection", onUnhandledRejection);
		let writes = 0;
		let reports = 0;
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				onError: async () => {
					reports += 1;
					throw new Error("async save reporter exploded");
				},
				write: () =>
					Effect.sync(() => {
						writes += 1;
					}).pipe(Effect.zipRight(Effect.fail(new Error("save failed")))),
			},
		});

		try {
			await waitFor(() => writes >= 1 && reports >= 1);
			const initialWrites = writes;
			const initialReports = reports;

			await session.run(
				spawnItemFx({
					id: "runtime:save:async-reporter:first",
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
			await waitFor(() => writes > initialWrites && reports > initialReports);
			const firstWrites = writes;
			const firstReports = reports;

			await session.run(
				spawnItemFx({
					id: "runtime:save:async-reporter:second",
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
			await waitFor(() => writes > firstWrites && reports > firstReports);
			await sleep(20);

			expect(unhandledRejections).toEqual([]);
		} finally {
			try {
				await expect(session.dispose()).rejects.toThrow("save failed");
				await sleep(20);
				expect(unhandledRejections).toEqual([]);
			} finally {
				process.off("unhandledRejection", onUnhandledRejection);
			}
		}
	});

	it("makes concurrent dispose callers await the same final cleanup", async () => {
		let markSaveStarted: (() => void) | undefined;
		let releaseSave: (() => void) | undefined;
		const saveStarted = new Promise<void>((resolve) => {
			markSaveStarted = resolve;
		});
		const saveGate = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: () =>
					Effect.promise(async () => {
						markSaveStarted?.();
						await saveGate;
					}),
			},
		});

		const first = session.dispose();
		await saveStarted;
		const second = session.dispose();
		let secondSettled = false;
		void second.finally(() => {
			secondSettled = true;
		});

		try {
			expect(second).toBe(first);
			await sleep(20);
			expect(secondSettled).toBe(false);
		} finally {
			releaseSave?.();
			await Promise.all([
				first,
				second,
			]);
		}
	});

	it("stops the production Tick loop before flushing the final runtime", async () => {
		const config = createJobTestConfig();
		const forge = config.items.forge;
		if (forge.type !== "producer") throw new Error("Expected producer fixture.");
		forge.lines[0]!.runtimeMs = 10_000;
		const savedRemainingMs: Array<number | undefined> = [];
		let markSaveStarted: (() => void) | undefined;
		let releaseSave: (() => void) | undefined;
		const saveStarted = new Promise<void>((resolve) => {
			markSaveStarted = resolve;
		});
		const saveGate = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const session = await createGameSession({
			config,
			tickIntervalMs: 5,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.promise(async () => {
						savedRemainingMs.push(state.jobs[0]?.remainingMs);
						markSaveStarted?.();
						await saveGate;
					}),
			},
		});

		try {
			const owner = await session.run(prepareJobLineFx());
			await session.run(
				startLineFx({
					ownerItemId: owner.id,
					lineId: "line:forge:run",
				}),
			);

			const dispose = session.dispose();
			await saveStarted;
			await sleep(30);
			releaseSave?.();
			await dispose;

			expect(savedRemainingMs).toHaveLength(1);
			expect(savedRemainingMs[0]).toBeGreaterThan(0);
		} finally {
			releaseSave?.();
			await session.dispose();
		}
	});

	it("interrupts in-flight session commands before the final save", async () => {
		const saves: StateSchema.Type[] = [];
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.sync(() => {
						saves.push(state);
					}),
			},
		});
		const command = session
			.run(
				Effect.sleep("50 millis").pipe(
					Effect.zipRight(
						spawnItemFx({
							id: "runtime:save:late-command",
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
					),
				),
			)
			.then(
				() => "completed" as const,
				() => "interrupted" as const,
			);

		await session.dispose();

		expect(await command).toBe("interrupted");
		expect(saves).toHaveLength(1);
		expect(saves[0]?.items).toHaveLength(0);
	});

	it("flushes the latest committed runtime when the session is disposed", async () => {
		const saves: StateSchema.Type[] = [];
		const session = await createGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.sync(() => {
						saves.push(state);
					}),
			},
		});

		await session.run(
			spawnItemFx({
				id: "runtime:save:dispose",
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
		await session.dispose();

		expect(saves).toHaveLength(1);
		expect(saves[0]?.items).toHaveLength(1);
	});
});
