import { Cause, Deferred, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "@effect/vitest";
import { createTestGameSession } from "~test/support/game/createTestGameSession";

import { RuntimeSaveFx } from "~/game-persistence/service/RuntimeSaveFx";
import { RuntimeSaveLayerFx } from "~/game-persistence/layer/RuntimeSaveLayerFx";
import { GameRuntimeLayerFx } from "~/game-runtime/layer/GameRuntimeLayerFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { removeRuntimeItemForTestFx } from "~test/support/item-interaction/removeRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

const emitCompletedEventFx = (jobId: string) =>
	modifyRuntimeFx((runtime) =>
		Effect.succeed([
			undefined,
			runtime,
			[
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					jobId,
					ownerItemId: "owner:save",
					lineId: "line:save",
				},
			],
		] as const),
	);

describe("RuntimeSaveLayerFx", () => {
	it("preserves an exact mixed autosave Cause", async () => {
		const mixedCause = Cause.combine(
			Cause.fail(new Error("save typed failure")),
			Cause.die(new Error("save defect")),
		);
		const releaseWrite = Effect.runSync(Deferred.make<void>());
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				write: () =>
					Deferred.await(releaseWrite).pipe(Effect.andThen(Effect.failCause(mixedCause))),
			},
		});
		let publishFatal:
			| ((fatal: NonNullable<ReturnType<typeof session.getFatalError>>) => void)
			| undefined;
		const fatalObserved = new Promise<NonNullable<ReturnType<typeof session.getFatalError>>>(
			(resolve) => {
				publishFatal = resolve;
			},
		);
		const unsubscribe = session.subscribeFatalError(() => {
			const fatal = session.getFatalError();
			if (fatal !== null) publishFatal?.(fatal);
		});

		try {
			Effect.runSync(Deferred.succeed(releaseWrite, undefined));
			expect((await fatalObserved).cause).toBe(mixedCause);
			expect(Cause.hasFails(mixedCause)).toBe(true);
			expect(Cause.hasDies(mixedCause)).toBe(true);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeWithoutSaveFx);
		}
	});

	it("preserves the full autosave Cause when the writer defects", async () => {
		const releaseWrite = Effect.runSync(Deferred.make<void>());
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				write: () =>
					Deferred.await(releaseWrite).pipe(
						Effect.andThen(Effect.die(new Error("save defect"))),
					),
			},
		});
		let publishFatal:
			| ((fatal: NonNullable<ReturnType<typeof session.getFatalError>>) => void)
			| undefined;
		const fatalObserved = new Promise<NonNullable<ReturnType<typeof session.getFatalError>>>(
			(resolve) => {
				publishFatal = resolve;
			},
		);
		const unsubscribe = session.subscribeFatalError(() => {
			const fatal = session.getFatalError();
			if (fatal !== null) publishFatal?.(fatal);
		});

		try {
			Effect.runSync(Deferred.succeed(releaseWrite, undefined));
			const cause = (await fatalObserved).cause;
			expect(Cause.isCause(cause)).toBe(true);
			expect(Cause.isCause(cause) && Cause.hasDies(cause)).toBe(true);
		} finally {
			unsubscribe();
			await expect(Effect.runPromise(session.disposeFx)).rejects.toThrow("save defect");
		}
	});

	it.effect("debounces committed snapshots and ignores failed mutations", () => {
		const saves: StateSchema.Type[] = [];
		const core = GameRuntimeLayerFx({
			config: createJobTestConfig(),
		});
		const save = RuntimeSaveLayerFx({
			debounceMs: 15,
			save: (state) =>
				Effect.sync(() => {
					saves.push(state);
				}),
		}).pipe(Layer.provide(core));

		return Effect.gen(function* () {
			const runtimeSave = yield* RuntimeSaveFx;
			const first = yield* spawnItemFx({
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
			});
			yield* spawnItemFx({
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
			});

			yield* TestClock.adjust(15);
			expect(saves).toHaveLength(1);
			expect(saves[0]?.items).toHaveLength(2);
			for (const item of saves[0]?.items ?? []) {
				expect(item).not.toHaveProperty("revision");
			}

			const failure = yield* removeRuntimeItemForTestFx({
				itemId: first.id,
				revision: "revision:stale",
			}).pipe(Effect.flip);
			expect(failure).toBeDefined();
			yield* runtimeSave.flush;
			expect(saves).toHaveLength(1);
			yield* runtimeSave.discard;
		}).pipe(Effect.provide(Layer.merge(core, save)));
	});

	it.effect("does not let event-only traffic wake or postpone runtime autosave", () => {
		const savedItemCounts: number[] = [];
		const core = GameRuntimeLayerFx({
			config: createJobTestConfig(),
		});
		const save = RuntimeSaveLayerFx({
			debounceMs: 40,
			save: (state) =>
				Effect.sync(() => {
					savedItemCounts.push(state.items.length);
				}),
		}).pipe(Layer.provide(core));

		return Effect.gen(function* () {
			const runtimeSave = yield* RuntimeSaveFx;
			yield* TestClock.adjust(40);
			expect(savedItemCounts).toEqual([
				0,
			]);

			yield* spawnItemFx({
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
			});

			yield* TestClock.adjust(15);
			yield* emitCompletedEventFx("job:save:event:0");
			yield* TestClock.adjust(15);
			yield* emitCompletedEventFx("job:save:event:1");
			yield* TestClock.adjust(9);
			yield* emitCompletedEventFx("job:save:event:2");
			expect(savedItemCounts).toEqual([
				0,
			]);

			yield* TestClock.adjust(1);
			expect(savedItemCounts).toEqual([
				0,
				1,
			]);

			yield* emitCompletedEventFx("job:save:event:after-save");
			yield* TestClock.adjust(60);
			expect(savedItemCounts).toEqual([
				0,
				1,
			]);
			yield* runtimeSave.discard;
		}).pipe(Effect.provide(Layer.merge(core, save)));
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
		const session = await createTestGameSession({
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

			const flush = Effect.runPromise(session.flushSaveFx);
			releaseFirstSave?.();
			await flush;

			expect(savedItemCounts).toEqual([
				0,
				1,
				2,
			]);
		} finally {
			releaseFirstSave?.();
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("freezes the session exactly once after an autosave failure", async () => {
		let writes = 0;
		const releaseWrite = Effect.runSync(Deferred.make<void>());
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				write: () =>
					Effect.sync(() => {
						writes += 1;
					}).pipe(
						Effect.andThen(Deferred.await(releaseWrite)),
						Effect.andThen(Effect.fail(new Error("save failed"))),
					),
			},
		});
		let markFatalObserved: (() => void) | undefined;
		const fatalObserved = new Promise<void>((resolve) => {
			markFatalObserved = resolve;
		});
		const unsubscribe = session.subscribeFatalError(() => {
			markFatalObserved?.();
		});
		try {
			Effect.runSync(Deferred.succeed(releaseWrite, undefined));
			await fatalObserved;
			expect(writes).toBe(1);
			expect(session.getFatalError()?.source).toBe("autosave");
			await expect(session.run(Effect.void)).rejects.toMatchObject({
				_tag: "GameSessionNotRunningError",
				state: "frozen",
			});
		} finally {
			unsubscribe();
			await expect(Effect.runPromise(session.disposeFx)).rejects.toThrow("save failed");
		}
	});

	it("makes concurrent dispose callers await the same final cleanup", async () => {
		let markSaveStarted: (() => void) | undefined;
		let releaseSave: (() => void) | undefined;
		let writes = 0;
		const saveStarted = new Promise<void>((resolve) => {
			markSaveStarted = resolve;
		});
		const saveGate = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const completions: string[] = [];
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: () =>
					Effect.promise(async () => {
						writes += 1;
						markSaveStarted?.();
						await saveGate;
						completions.push("save completed");
					}),
			},
		});

		const first = Effect.runPromise(session.disposeFx);
		await saveStarted;
		const second = Effect.runPromise(session.disposeFx).then(() => {
			completions.push("second dispose completed");
		});

		try {
			expect(writes).toBe(1);
		} finally {
			releaseSave?.();
			await Promise.all([
				first,
				second,
			]);
		}
		expect(completions).toEqual([
			"save completed",
			"second dispose completed",
		]);
	});

	it("closes command admission before starting a slow final save", async () => {
		const saves: StateSchema.Type[] = [];
		const commandStarted = Effect.runSync(Deferred.make<void>());
		const releaseCommand = Effect.runSync(Deferred.make<void>());
		let markSaveStarted: (() => void) | undefined;
		let releaseSave: (() => void) | undefined;
		const saveStarted = new Promise<void>((resolve) => {
			markSaveStarted = resolve;
		});
		const saveGate = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 60_000,
				write: (state) =>
					Effect.promise(async () => {
						saves.push(state);
						markSaveStarted?.();
						await saveGate;
					}),
			},
		});
		const command = session
			.run(
				Deferred.succeed(commandStarted, undefined).pipe(
					Effect.andThen(Deferred.await(releaseCommand)),
					Effect.andThen(
						spawnItemFx({
							id: "runtime:save:command-during-flush",
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
		await Effect.runPromise(Deferred.await(commandStarted));

		const dispose = Effect.runPromise(session.disposeFx);
		await saveStarted;
		Effect.runSync(Deferred.succeed(releaseCommand, undefined));
		try {
			expect(await command).toBe("interrupted");
		} finally {
			releaseSave?.();
			await dispose;
		}

		expect(saves).toHaveLength(1);
		expect(saves[0]?.items).toHaveLength(0);
	});

	it("flushes the latest committed runtime when the session is disposed", async () => {
		const saves: StateSchema.Type[] = [];
		const session = await createTestGameSession({
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
		await Effect.runPromise(session.disposeFx);

		expect(saves).toHaveLength(1);
		expect(saves[0]?.items).toHaveLength(1);
	});
});
