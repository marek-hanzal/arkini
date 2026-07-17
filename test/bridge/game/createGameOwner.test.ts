import { encode } from "@msgpack/msgpack";
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameFx } from "~/bridge/game/createGameFx";
import { createGameOwnerFx } from "~/bridge/game/createGameOwnerFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";

interface TestGameOwnerProps {
	readonly create: (packageId: string) => Promise<Game>;
	readonly clearSave: (key: GameSaveStorage.Key) => Promise<void>;
}

interface FakeGameLifecycle {
	readonly dispose?: () => Promise<void>;
	readonly discard?: () => Promise<void>;
}

const createGameOwner = ({ create, clearSave }: TestGameOwnerProps) =>
	Effect.runSync(
		createGameOwnerFx({
			createFx: (packageId) =>
				Effect.tryPromise({
					try: () => create(packageId),
					catch: (cause) => cause,
				}),
			clearSaveFx: (key) =>
				Effect.tryPromise({
					try: () => clearSave(key),
					catch: (cause) => cause,
				}),
		}),
	);

const runOwnerFx = async <Value, Error>(effect: Effect.Effect<Value, Error>) => {
	const exit = await Effect.runPromiseExit(effect);
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.failureOption(exit.cause);
	if (Option.isSome(failure)) throw failure.value;
	throw Cause.squash(exit.cause);
};

const deferred = <Value>() => {
	let resolve!: (value: Value | PromiseLike<Value>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<Value>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return {
		promise,
		reject,
		resolve,
	};
};

const fromPromiseFx = (operation: () => Promise<void>) =>
	Effect.async<void, unknown>((resume) => {
		void operation().then(
			() => resume(Effect.void),
			(error) => resume(Effect.fail(error)),
		);
	});

const createFakeGame = (
	packageId: string,
	instanceKey: string,
	lifecycle: FakeGameLifecycle = {},
): Game => ({
	arkpack: {
		packageId,
		contentHash: packageId,
		gameId: `game:${packageId}`,
		title: packageId,
		configVersion: "1.0",
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	saveKey: {
		packageId,
		contentHash: packageId,
	},
	instanceKey,
	disposeFx: fromPromiseFx(lifecycle.dispose ?? (() => Promise.resolve())),
	disposeWithoutSaveFx: fromPromiseFx(lifecycle.discard ?? (() => Promise.resolve())),
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const expectReady = (owner: GameOwner) => {
	const state = owner.getSnapshot();
	expect(state.type).toBe("ready");
	if (state.type !== "ready") throw new Error("Expected a ready game owner.");
	return state.game;
};

const runCreateGame = async (props: createGameFx.Props) => {
	const exit = await Effect.runPromiseExit(createGameFx(props));
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.failureOption(exit.cause);
	if (Option.isSome(failure)) throw failure.value;
	throw Cause.squash(exit.cause);
};

const writeStoredSave = (storage: GameSaveStorage, key: GameSaveStorage.Key, bytes: Uint8Array) =>
	Effect.runPromise(storage.writeFx(key, bytes));

const readStoredSave = (storage: GameSaveStorage, key: GameSaveStorage.Key) =>
	Effect.runPromise(storage.readFx(key));

const createRealStorages = async () => {
	const secondConfig = GameConfigSchema.parse({
		...testArkpackConfig,
		meta: {
			...testArkpackConfig.meta,
			id: "game:bridge-second",
			title: "Bridge game second",
		},
	});
	const records = await Promise.all(
		[
			{
				config: testArkpackConfig,
				filename: "owner-a.arkpack",
			},
			{
				config: secondConfig,
				filename: "owner-b.arkpack",
			},
		].map(async ({ config, filename }) => {
			const bytes = createTestArkpack(config);
			const loaded = await Effect.runPromise(
				readArkpackFx({
					bytes,
					filename,
					source: "imported",
				}),
			);
			return {
				descriptor: loaded.descriptor,
				bytes: bytes.slice().buffer,
			} satisfies ArkpackStorage.LoadedRecord;
		}),
	);
	const recordsById = new Map(
		records.map((record) => [
			record.descriptor.packageId,
			record,
		]),
	);
	const arkpackStorage: ArkpackStorage = {
		listFx: Effect.succeed(records.map(({ descriptor }) => descriptor)),
		readFx: (packageId) => Effect.succeed(recordsById.get(packageId)),
		removeFx: () => Effect.void,
		writeFx: () => Effect.void,
	};
	const saveKey = ({ packageId, contentHash }: GameSaveStorage.Key) =>
		`${packageId}:${contentHash}`;
	const saves = new Map<string, Uint8Array>();
	const clearedKeys: GameSaveStorage.Key[] = [];
	const saveStorage: GameSaveStorage = {
		readFx: (key) => Effect.sync(() => saves.get(saveKey(key))?.slice() ?? null),
		clearFx: (key) =>
			Effect.sync(() => {
				clearedKeys.push({
					...key,
				});
				saves.delete(saveKey(key));
			}),
		writeFx: (key, bytes) =>
			Effect.sync(() => {
				saves.set(saveKey(key), bytes.slice());
			}),
	};
	const firstDescriptor = records[0]?.descriptor;
	const secondDescriptor = records[1]?.descriptor;
	if (firstDescriptor === undefined || secondDescriptor === undefined)
		throw new Error("Expected two real Arkpack records.");
	return {
		arkpackStorage,
		clearedKeys,
		packageId: firstDescriptor.packageId,
		secondPackageId: secondDescriptor.packageId,
		firstSaveKey: {
			packageId: firstDescriptor.packageId,
			contentHash: firstDescriptor.contentHash,
		} satisfies GameSaveStorage.Key,
		secondSaveKey: {
			packageId: secondDescriptor.packageId,
			contentHash: secondDescriptor.contentHash,
		} satisfies GameSaveStorage.Key,
		saveStorage,
	};
};

describe("createGameOwnerFx", () => {
	it("waits for the current final save before creating the replacement", async () => {
		const release = deferred<void>();
		const creates: string[] = [];
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => {
				creates.push(packageId);
				return createFakeGame(packageId, `${packageId}:${creates.length}`, {
					dispose: packageId === "A" ? () => release.promise : undefined,
				});
			},
		});

		await runOwnerFx(owner.selectPackageFx("A"));
		const replacing = runOwnerFx(owner.selectPackageFx("B"));
		await Promise.resolve();
		expect(creates).toEqual([
			"A",
		]);

		release.resolve();
		await replacing;
		expect(creates).toEqual([
			"A",
			"B",
		]);
		expect(expectReady(owner).arkpack.packageId).toBe("B");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("serializes duplicate package selections into one bootstrap", async () => {
		const createGate = deferred<Game>();
		const create = vi.fn(() => createGate.promise);
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create,
		});

		const first = runOwnerFx(owner.selectPackageFx("A"));
		const second = runOwnerFx(owner.selectPackageFx("A"));
		await Promise.resolve();
		expect(create).toHaveBeenCalledOnce();

		createGate.resolve(createFakeGame("A", "shared"));
		await Promise.all([
			first,
			second,
		]);
		expect(create).toHaveBeenCalledOnce();
		expect(expectReady(owner).instanceKey).toBe("shared");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("keeps failed final-save ownership retryable before replacement", async () => {
		const failure = new Error("final save failed");
		let disposeCalls = 0;
		const creates: string[] = [];
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => {
				creates.push(packageId);
				return createFakeGame(packageId, packageId, {
					dispose: async () => {
						if (packageId !== "A") return;
						disposeCalls += 1;
						if (disposeCalls === 1) throw failure;
					},
				});
			},
		});

		await runOwnerFx(owner.selectPackageFx("A"));
		await expect(runOwnerFx(owner.selectPackageFx("B"))).rejects.toBe(failure);
		expect(creates).toEqual([
			"A",
		]);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "select-package",
			packageId: "B",
			canRecoverSave: false,
		});

		await runOwnerFx(owner.selectPackageFx("B"));
		expect(disposeCalls).toBe(2);
		expect(creates).toEqual([
			"A",
			"B",
		]);
		expect(expectReady(owner).arkpack.packageId).toBe("B");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("publishes distinct route-release and application-shutdown failures", async () => {
		const failure = new Error("disk full");
		const dispose = vi.fn(() => Promise.reject(failure));
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) =>
				createFakeGame(packageId, packageId, {
					dispose,
				}),
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		await expect(runOwnerFx(owner.releaseRouteGameFx())).rejects.toBe(failure);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "route-release",
			game: {
				instanceKey: "A",
			},
			canRecoverSave: false,
		});

		await runOwnerFx(owner.selectPackageFx("A"));
		await expect(runOwnerFx(owner.shutdownFx())).rejects.toBe(failure);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "shutdown",
			packageId: "A",
			canRecoverSave: false,
		});
		expect(dispose).toHaveBeenCalledTimes(2);
	});

	it("retries the same shutdown save obligation after a failure", async () => {
		const failure = new Error("final save failed");
		let disposeCalls = 0;
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) =>
				createFakeGame(packageId, packageId, {
					dispose: async () => {
						disposeCalls += 1;
						if (disposeCalls === 1) throw failure;
					},
				}),
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		await expect(runOwnerFx(owner.shutdownFx())).rejects.toBe(failure);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "shutdown",
			packageId: "A",
		});

		await runOwnerFx(owner.shutdownFx());
		expect(disposeCalls).toBe(2);
		expect(owner.getSnapshot()).toEqual({
			type: "loading",
			packageId: null,
		});
	});

	it("completes repeated shutdown requests through one successful final save", async () => {
		const release = deferred<void>();
		const dispose = vi.fn(() => release.promise);
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) =>
				createFakeGame(packageId, packageId, {
					dispose,
				}),
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		const first = runOwnerFx(owner.shutdownFx());
		const second = runOwnerFx(owner.shutdownFx());
		await Promise.resolve();
		expect(dispose).toHaveBeenCalledOnce();

		release.resolve();
		await Promise.all([
			first,
			second,
		]);
		expect(dispose).toHaveBeenCalledOnce();
		expect(owner.getSnapshot()).toEqual({
			type: "loading",
			packageId: null,
		});
	});

	it("discards an interrupted unpublished bootstrap without final save and unblocks the next package", async () => {
		const createA = Effect.runSync(Deferred.make<Game>());
		const staleDispose = vi.fn(() => Promise.resolve());
		const staleDiscard = vi.fn(() => Promise.resolve());
		const owner = Effect.runSync(
			createGameOwnerFx({
				clearSaveFx: () => Effect.void,
				createFx: (packageId) =>
					packageId === "A"
						? Deferred.await(createA)
						: Effect.succeed(createFakeGame(packageId, packageId)),
			}),
		);

		const interrupted = await Effect.runPromise(
			Effect.gen(function* () {
				const first = yield* Effect.fork(owner.selectPackageFx("A"));
				yield* Effect.yieldNow();
				const interruption = yield* Effect.fork(Fiber.interrupt(first));
				const second = yield* Effect.fork(owner.selectPackageFx("B"));
				yield* Deferred.succeed(
					createA,
					createFakeGame("A", "stale", {
						dispose: staleDispose,
						discard: staleDiscard,
					}),
				);
				const firstExit = yield* Fiber.join(interruption);
				yield* Fiber.join(second);
				return firstExit;
			}),
		);

		expect(Exit.isFailure(interrupted)).toBe(true);
		if (Exit.isFailure(interrupted)) {
			expect(Cause.isInterruptedOnly(interrupted.cause)).toBe(true);
		}
		expect(staleDispose).not.toHaveBeenCalled();
		expect(staleDiscard).toHaveBeenCalledOnce();
		expect(expectReady(owner).arkpack.packageId).toBe("B");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("isolates subscriber defects from lifecycle work and later subscribers", async () => {
		const listenerFailure = new Error("observer failed");
		const asyncFailure = new Error("async observer failed");
		const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const deliveries: GameOwner.State["type"][] = [];
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => createFakeGame(packageId, packageId),
		});
		owner.subscribe(() => {
			throw listenerFailure;
		});
		owner.subscribe(() => Promise.reject(asyncFailure));
		owner.subscribe(() => {
			deliveries.push(owner.getSnapshot().type);
		});

		await runOwnerFx(owner.selectPackageFx("A"));
		await runOwnerFx(owner.releaseRouteGameFx());
		await Promise.resolve();

		expect(deliveries).toEqual([
			"loading",
			"ready",
			"loading",
		]);
		expect(report).toHaveBeenCalledWith(
			"Arkini game-owner listener failed; authoritative lifecycle continues.",
			listenerFailure,
		);
		expect(report).toHaveBeenCalledWith(
			"Arkini game-owner listener failed; authoritative lifecycle continues.",
			asyncFailure,
		);
		report.mockRestore();
	});

	it("hard resets by discarding, clearing the exact save and creating one fresh game", async () => {
		const sequence: string[] = [];
		let creates = 0;
		const owner = createGameOwner({
			clearSave: async (key) => {
				sequence.push(`clear:${key.packageId}:${key.contentHash}`);
			},
			create: async (packageId) => {
				creates += 1;
				const instanceKey = `${packageId}:${creates}`;
				sequence.push(`create:${instanceKey}`);
				return createFakeGame(packageId, instanceKey, {
					discard: async () => {
						sequence.push(`discard:${instanceKey}`);
					},
				});
			},
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		await runOwnerFx(owner.hardResetFx());

		expect(sequence).toEqual([
			"create:A:1",
			"discard:A:1",
			"clear:A:A",
			"create:A:2",
		]);
		expect(expectReady(owner).instanceKey).toBe("A:2");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("retries a hard-reset discard failure without clearing or replacing early", async () => {
		const failure = new Error("discard failed");
		const clearSave = vi.fn(() => Promise.resolve());
		let discardCalls = 0;
		let creates = 0;
		const owner = createGameOwner({
			clearSave,
			create: async (packageId) => {
				creates += 1;
				return createFakeGame(packageId, String(creates), {
					discard: async () => {
						discardCalls += 1;
						if (discardCalls === 1) throw failure;
					},
				});
			},
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		await expect(runOwnerFx(owner.hardResetFx())).rejects.toBe(failure);
		expect(clearSave).not.toHaveBeenCalled();
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "hard-reset",
			packageId: "A",
			game: {
				instanceKey: "1",
			},
		});

		await runOwnerFx(owner.hardResetFx());
		expect(discardCalls).toBe(2);
		expect(clearSave).toHaveBeenCalledOnce();
		expect(creates).toBe(2);
		expect(expectReady(owner).instanceKey).toBe("2");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("retries hard-reset clearing without discarding the game twice", async () => {
		const failure = new Error("clear failed");
		let creates = 0;
		let clearCalls = 0;
		const discard = vi.fn(() => Promise.resolve());
		const owner = createGameOwner({
			clearSave: async () => {
				clearCalls += 1;
				if (clearCalls === 1) throw failure;
			},
			create: async (packageId) => {
				creates += 1;
				return createFakeGame(packageId, String(creates), {
					discard,
				});
			},
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		await expect(runOwnerFx(owner.hardResetFx())).rejects.toBe(failure);
		expect(creates).toBe(1);
		expect(discard).toHaveBeenCalledOnce();
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "hard-reset",
			packageId: "A",
			game: null,
		});

		await runOwnerFx(owner.hardResetFx());
		expect(clearCalls).toBe(2);
		expect(discard).toHaveBeenCalledOnce();
		expect(creates).toBe(2);
		expect(expectReady(owner).instanceKey).toBe("2");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("retries hard-reset recreation without discarding or clearing twice", async () => {
		const failure = new Error("fresh create failed");
		let creates = 0;
		const clearSave = vi.fn(() => Promise.resolve());
		const discard = vi.fn(() => Promise.resolve());
		const owner = createGameOwner({
			clearSave,
			create: async (packageId) => {
				creates += 1;
				if (creates === 2) throw failure;
				return createFakeGame(packageId, String(creates), {
					discard,
				});
			},
		});
		await runOwnerFx(owner.selectPackageFx("A"));

		await expect(runOwnerFx(owner.hardResetFx())).rejects.toBe(failure);
		expect(clearSave).toHaveBeenCalledOnce();
		expect(discard).toHaveBeenCalledOnce();
		expect(creates).toBe(2);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "hard-reset",
			packageId: "A",
			game: null,
			canRecoverSave: false,
		});

		await runOwnerFx(owner.hardResetFx());
		expect(clearSave).toHaveBeenCalledOnce();
		expect(discard).toHaveBeenCalledOnce();
		expect(creates).toBe(3);
		expect(expectReady(owner).instanceKey).toBe("3");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("hard resets a real selected package without restoring discarded progress", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
			clearSave: (key) => Effect.runPromise(storages.saveStorage.clearFx(key)),
			create: (packageId) =>
				runCreateGame({
					packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
		});
		await runOwnerFx(owner.selectPackageFx(storages.packageId));
		const beforeReset = expectReady(owner);
		await beforeReset.run(
			spawnItemFx({
				id: "runtime:reset-progress",
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

		await runOwnerFx(owner.hardResetFx());
		const afterReset = expectReady(owner);
		expect(afterReset.instanceKey).not.toBe(beforeReset.instanceKey);
		expect(afterReset.getSnapshot().items).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:reset-progress",
				}),
			]),
		);
		expect(storages.clearedKeys).toEqual([
			storages.firstSaveKey,
		]);
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("keeps invalid-save recovery identity private and clears only its exact key", async () => {
		const storages = await createRealStorages();
		const otherHashKey: GameSaveStorage.Key = {
			packageId: storages.packageId,
			contentHash: "other-content-hash",
		};
		const untouchedBytes = Uint8Array.of(1, 2, 3, 4);
		await writeStoredSave(
			storages.saveStorage,
			storages.firstSaveKey,
			encode({
				namespace: "arkini",
				format: 999,
				state: {},
			}),
		);
		await writeStoredSave(storages.saveStorage, otherHashKey, untouchedBytes);
		await writeStoredSave(storages.saveStorage, storages.secondSaveKey, untouchedBytes);
		const owner = createGameOwner({
			clearSave: (key) => Effect.runPromise(storages.saveStorage.clearFx(key)),
			create: (packageId) =>
				runCreateGame({
					packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
		});

		await expect(runOwnerFx(owner.selectPackageFx(storages.packageId))).rejects.toMatchObject({
			saveKey: storages.firstSaveKey,
		});
		const failed = owner.getSnapshot();
		expect(failed).toMatchObject({
			type: "failed",
			operation: "select-package",
			packageId: storages.packageId,
			canRecoverSave: true,
		});
		expect(failed).not.toHaveProperty("saveRecoveryKey");

		await runOwnerFx(owner.clearFailedSaveAndRetryFx());
		expect(storages.clearedKeys).toEqual([
			storages.firstSaveKey,
		]);
		expect(expectReady(owner).arkpack.packageId).toBe(storages.packageId);
		expect(await readStoredSave(storages.saveStorage, otherHashKey)).toEqual(untouchedBytes);
		expect(await readStoredSave(storages.saveStorage, storages.secondSaveKey)).toEqual(
			untouchedBytes,
		);
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("keeps failed recovery clearing truthful and does not create a fresh game", async () => {
		const saveKey: GameSaveStorage.Key = {
			packageId: "A",
			contentHash: "hash-a",
		};
		const bootstrapFailure = new GameSaveBootstrapError({
			cause: new Error("invalid save"),
			saveKey,
		});
		const clearFailure = new Error("clear failed");
		const clearSave = vi.fn(() => Promise.reject(clearFailure));
		const create = vi.fn(() => Promise.reject(bootstrapFailure));
		const owner = createGameOwner({
			clearSave,
			create,
		});

		await expect(runOwnerFx(owner.selectPackageFx("A"))).rejects.toBe(bootstrapFailure);
		await expect(runOwnerFx(owner.clearFailedSaveAndRetryFx())).rejects.toBe(clearFailure);

		expect(clearSave).toHaveBeenCalledOnce();
		expect(create).toHaveBeenCalledOnce();
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "recover-save",
			packageId: "A",
			error: clearFailure,
			canRecoverSave: true,
		});
	});

	it("retries a failed post-clear create without clearing the save twice", async () => {
		const saveKey: GameSaveStorage.Key = {
			packageId: "A",
			contentHash: "hash-a",
		};
		const bootstrapFailure = new GameSaveBootstrapError({
			cause: new Error("invalid save"),
			saveKey,
		});
		const createFailure = new Error("fresh create failed");
		let creates = 0;
		const clearSave = vi.fn(() => Promise.resolve());
		const owner = createGameOwner({
			clearSave,
			create: async (packageId) => {
				creates += 1;
				if (creates === 1) throw bootstrapFailure;
				if (creates === 2) throw createFailure;
				return createFakeGame(packageId, String(creates));
			},
		});

		await expect(runOwnerFx(owner.selectPackageFx("A"))).rejects.toBe(bootstrapFailure);
		await expect(runOwnerFx(owner.clearFailedSaveAndRetryFx())).rejects.toBe(createFailure);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "recover-save",
			packageId: "A",
			canRecoverSave: true,
		});

		await runOwnerFx(owner.clearFailedSaveAndRetryFx());
		expect(clearSave).toHaveBeenCalledOnce();
		expect(expectReady(owner).arkpack.packageId).toBe("A");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("does not expose save recovery when package identity was never verified", async () => {
		const packageFailure = new Error("invalid package bytes");
		const clearSave = vi.fn(() => Promise.resolve());
		const owner = createGameOwner({
			clearSave,
			create: async () => Promise.reject(packageFailure),
		});

		await expect(runOwnerFx(owner.selectPackageFx("unverified"))).rejects.toBe(packageFailure);
		expect(owner.getSnapshot()).toMatchObject({
			type: "failed",
			operation: "select-package",
			packageId: "unverified",
			canRecoverSave: false,
		});
		await expect(runOwnerFx(owner.clearFailedSaveAndRetryFx())).rejects.toThrow(
			"A verified failed save is required for recovery.",
		);
		expect(clearSave).not.toHaveBeenCalled();
	});

	it("keeps real package save ownership isolated across serialized switching", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
			clearSave: (key) => Effect.runPromise(storages.saveStorage.clearFx(key)),
			create: (packageId) =>
				runCreateGame({
					packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
		});
		await runOwnerFx(owner.selectPackageFx(storages.packageId));
		await expectReady(owner).run(
			spawnItemFx({
				id: "runtime:first-package",
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
		await runOwnerFx(owner.selectPackageFx(storages.secondPackageId));
		await expectReady(owner).run(
			spawnItemFx({
				id: "runtime:second-package",
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

		await runOwnerFx(owner.selectPackageFx(storages.packageId));
		const firstRestoredIds = expectReady(owner)
			.getSnapshot()
			.items.map(({ id }) => id);
		expect(firstRestoredIds).toContain("runtime:first-package");
		expect(firstRestoredIds).not.toContain("runtime:second-package");

		await runOwnerFx(owner.selectPackageFx(storages.secondPackageId));
		const secondRestoredIds = expectReady(owner)
			.getSnapshot()
			.items.map(({ id }) => id);
		expect(secondRestoredIds).toContain("runtime:second-package");
		expect(secondRestoredIds).not.toContain("runtime:first-package");
		await runOwnerFx(owner.releaseRouteGameFx());
	});

	it("restores the latest saved runtime only after route release completes", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: (packageId) =>
				runCreateGame({
					packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
		});
		await runOwnerFx(owner.selectPackageFx(storages.packageId));
		const first = expectReady(owner);
		await first.run(
			spawnItemFx({
				id: "runtime:newer-progress",
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

		const release = runOwnerFx(owner.releaseRouteGameFx());
		const restore = runOwnerFx(owner.selectPackageFx(storages.packageId));
		await Promise.all([
			release,
			restore,
		]);
		const restored = expectReady(owner);
		expect(restored.instanceKey).not.toBe(first.instanceKey);
		expect(restored.getSnapshot().items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:newer-progress",
				}),
			]),
		);
		await runOwnerFx(owner.releaseRouteGameFx());
	});
});
