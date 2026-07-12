import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { startLineFx } from "~/v1/job/write/startLineFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
				1,
				2,
			]);
		} finally {
			releaseFirstSave?.();
			await session.dispose();
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
