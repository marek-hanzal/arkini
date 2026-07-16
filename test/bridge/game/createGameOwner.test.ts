import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import type { Game } from "~/bridge/game/Game";
import { createGameFx } from "~/bridge/game/createGameFx";
import { createGameOwner } from "~/bridge/game/createGameOwner";
import { shutdownGameOwner } from "~/bridge/game/shutdownGameOwner";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";

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

const createFakeGame = (
	packageId: string,
	instanceKey: string,
	dispose: () => Promise<void> = () => Promise.resolve(),
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
	dispose,
	disposeWithoutSave: dispose,
	flushSave: () => Promise.resolve(),
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const expectReady = (owner: createGameOwner.Owner) => {
	const state = owner.getSnapshot();
	expect(state.type).toBe("ready");
	if (state.type !== "ready") throw new Error("Expected a ready game owner.");
	return state.game;
};

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
		close: () => undefined,
		list: async () => records.map(({ descriptor }) => descriptor),
		read: async (packageId) => recordsById.get(packageId),
		remove: async () => undefined,
		write: async () => undefined,
	};
	const saveKey = ({ packageId, contentHash }: GameSaveStorage.Key) =>
		`${packageId}:${contentHash}`;
	const saves = new Map<string, Uint8Array>();
	const saveStorage: GameSaveStorage = {
		close: () => undefined,
		read: async (key) => saves.get(saveKey(key))?.slice() ?? null,
		clear: async (key) => {
			saves.delete(saveKey(key));
		},
		write: async (key, bytes) => {
			saves.set(saveKey(key), bytes.slice());
		},
	};
	return {
		arkpackStorage,
		packageId: records[0]?.descriptor.packageId ?? "",
		secondPackageId: records[1]?.descriptor.packageId ?? "",
		saveStorage,
	};
};

describe("createGameOwner", () => {
	it("waits for the current final disposal before creating the replacement", async () => {
		const release = deferred<void>();
		const creates: string[] = [];
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => {
				creates.push(packageId);
				return createFakeGame(
					packageId,
					`${packageId}:${creates.length}`,
					packageId === "A" ? () => release.promise : undefined,
				);
			},
		});

		await owner.replace("A");
		const replacing = owner.replace("B");
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
		await owner.replace(null);
	});

	it("coalesces rapid A to B to A requests without creating B or overlapping owners", async () => {
		const release = deferred<void>();
		const creates: string[] = [];
		let firstDisposeCalls = 0;
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => {
				creates.push(packageId);
				return createFakeGame(packageId, `${packageId}:${creates.length}`, async () => {
					if (creates.length !== 1) return;
					firstDisposeCalls += 1;
					await release.promise;
				});
			},
		});

		await owner.replace("A");
		const toB = owner.replace("B");
		const backToA = owner.replace("A");
		await Promise.resolve();
		expect(creates).toEqual([
			"A",
		]);

		release.resolve();
		await Promise.all([
			toB,
			backToA,
		]);
		expect(creates).toEqual([
			"A",
			"A",
		]);
		expect(firstDisposeCalls).toBe(1);
		expect(expectReady(owner).instanceKey).toBe("A:2");
		await owner.replace(null);
	});

	it("disposes a stale bootstrap exactly once before publishing the latest request", async () => {
		const firstCreate = deferred<Game>();
		const staleDispose = vi.fn(() => Promise.resolve());
		const creates: string[] = [];
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => {
				creates.push(packageId);
				if (packageId === "A") return firstCreate.promise;
				return createFakeGame(packageId, packageId);
			},
		});

		const first = owner.replace("A");
		const second = owner.replace("B");
		firstCreate.resolve(createFakeGame("A", "stale", staleDispose));
		await Promise.all([
			first,
			second,
		]);

		expect(staleDispose).toHaveBeenCalledTimes(1);
		expect(creates).toEqual([
			"A",
			"B",
		]);
		expect(expectReady(owner).arkpack.packageId).toBe("B");
		await owner.replace(null);
	});

	it("blocks replacement and publishes a truthful failure when final disposal rejects", async () => {
		const failure = new Error("final save failed");
		const creates: string[] = [];
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => {
				creates.push(packageId);
				return createFakeGame(packageId, packageId, () => Promise.reject(failure));
			},
		});

		await owner.replace("A");
		await owner.replace("B");

		expect(creates).toEqual([
			"A",
		]);
		expect(owner.getSnapshot()).toEqual({
			type: "failed",
			packageId: "B",
			error: failure,
			canForceShutdown: false,
		});
	});

	it("runs hard reset as one shared discard, exact clear and fresh boot", async () => {
		const calls: string[] = [];
		let generation = 0;
		const owner = createGameOwner({
			clearSave: async (game) => {
				calls.push(`clear:${game.instanceKey}`);
			},
			create: async (packageId) => {
				generation += 1;
				const instanceKey = `${packageId}:${generation}`;
				calls.push(`create:${instanceKey}`);
				return {
					...createFakeGame(packageId, instanceKey),
					dispose: async () => {
						calls.push(`save:${instanceKey}`);
					},
					disposeWithoutSave: async () => {
						calls.push(`discard:${instanceKey}`);
					},
				};
			},
		});

		await owner.replace("A");
		const first = owner.hardReset();
		const second = owner.hardReset();
		expect(second).toBe(first);
		await first;

		expect(calls).toEqual([
			"create:A:1",
			"discard:A:1",
			"clear:A:1",
			"create:A:2",
		]);
		expect(expectReady(owner).instanceKey).toBe("A:2");
		await owner.replace(null);
	});

	it("does not boot a replacement when hard-reset clearing fails", async () => {
		const failure = new Error("clear failed");
		let creates = 0;
		const owner = createGameOwner({
			clearSave: async () => Promise.reject(failure),
			create: async (packageId) => {
				creates += 1;
				return createFakeGame(packageId, String(creates));
			},
		});
		await owner.replace("A");
		await owner.hardReset();
		expect(creates).toBe(1);
		expect(owner.getSnapshot()).toEqual({
			type: "failed",
			packageId: "A",
			error: failure,
			canForceShutdown: false,
		});
	});

	it("hard resets a real selected package by discarding, clearing its exact save and booting fresh", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
			clearSave: (game) => storages.saveStorage.clear(game.saveKey),
			create: (packageId) =>
				Effect.runPromise(
					createGameFx({
						packageId,
						arkpackStorage: storages.arkpackStorage,
						saveStorage: storages.saveStorage,
					}),
				),
		});
		await owner.replace(storages.packageId);
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

		await owner.hardReset();
		const afterReset = expectReady(owner);
		expect(afterReset.instanceKey).not.toBe(beforeReset.instanceKey);
		expect(afterReset.getSnapshot().items).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:reset-progress",
				}),
			]),
		);
		expect(afterReset.getSnapshot().items).toHaveLength(1);
		await owner.replace(null);
	});

	it("keeps real package saves isolated while switching through one serialized owner", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
			clearSave: (game) => storages.saveStorage.clear(game.saveKey),
			create: (packageId) =>
				Effect.runPromise(
					createGameFx({
						packageId,
						arkpackStorage: storages.arkpackStorage,
						saveStorage: storages.saveStorage,
					}),
				),
		});
		await owner.replace(storages.packageId);
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
		await owner.replace(storages.secondPackageId);
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

		await owner.replace(storages.packageId);
		const firstRestoredIds = expectReady(owner)
			.getSnapshot()
			.items.map(({ id }) => id);
		expect(firstRestoredIds).toContain("runtime:first-package");
		expect(firstRestoredIds).not.toContain("runtime:second-package");

		await owner.replace(storages.secondPackageId);
		const secondRestoredIds = expectReady(owner)
			.getSnapshot()
			.items.map(({ id }) => id);
		expect(secondRestoredIds).toContain("runtime:second-package");
		expect(secondRestoredIds).not.toContain("runtime:first-package");
		await owner.replace(null);
	});

	it("shares one in-flight final save across repeated close requests", async () => {
		const release = deferred<void>();
		const dispose = vi.fn(() => release.promise);
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => createFakeGame(packageId, packageId, dispose),
		});
		await owner.replace("A");

		const first = shutdownGameOwner(owner);
		const second = shutdownGameOwner(owner);
		await Promise.resolve();
		expect(dispose).toHaveBeenCalledOnce();

		release.resolve();
		await Promise.all([
			first,
			second,
		]);
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("closes cleanly through the same protocol when no game is active", async () => {
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => createFakeGame(packageId, packageId),
		});

		await expect(shutdownGameOwner(owner)).resolves.toBeUndefined();
		expect(owner.getSnapshot()).toEqual({
			type: "loading",
			packageId: null,
		});
	});

	it("retries the same final save obligation after a controlled shutdown failure", async () => {
		const failure = new Error("final save failed");
		let disposeCalls = 0;
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) =>
				createFakeGame(packageId, packageId, async () => {
					disposeCalls += 1;
					if (disposeCalls === 1) throw failure;
				}),
		});
		await owner.replace("A");

		await expect(shutdownGameOwner(owner)).rejects.toBe(failure);
		expect(owner.getSnapshot()).toEqual({
			type: "failed",
			packageId: null,
			error: failure,
			canForceShutdown: true,
		});

		await expect(shutdownGameOwner(owner)).resolves.toBeUndefined();
		expect(disposeCalls).toBe(2);
		expect(owner.getSnapshot()).toEqual({
			type: "loading",
			packageId: null,
		});
	});

	it("never converts a repeated final-save failure into a successful shutdown", async () => {
		const failure = new Error("disk remains full");
		const dispose = vi.fn(() => Promise.reject(failure));
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => createFakeGame(packageId, packageId, dispose),
		});
		await owner.replace("A");

		await expect(shutdownGameOwner(owner)).rejects.toBe(failure);
		await expect(shutdownGameOwner(owner)).rejects.toBe(failure);
		expect(dispose).toHaveBeenCalledTimes(2);
		expect(owner.getSnapshot()).toEqual({
			type: "failed",
			packageId: null,
			error: failure,
			canForceShutdown: true,
		});
	});

	it("discards the retained game only after an explicit force-shutdown decision", async () => {
		const failure = new Error("final save failed");
		const dispose = vi.fn(() => Promise.reject(failure));
		const discard = vi.fn(() => Promise.resolve());
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: async (packageId) => ({
				...createFakeGame(packageId, packageId, dispose),
				disposeWithoutSave: discard,
			}),
		});
		await owner.replace("A");
		await expect(shutdownGameOwner(owner)).rejects.toBe(failure);

		await expect(owner.forceShutdown()).resolves.toBeUndefined();
		expect(dispose).toHaveBeenCalledOnce();
		expect(discard).toHaveBeenCalledOnce();
		expect(owner.getSnapshot()).toEqual({
			type: "loading",
			packageId: null,
		});
	});

	it("restores the latest real saved runtime only after the previous owner releases it", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
			clearSave: async () => undefined,
			create: (packageId) =>
				Effect.runPromise(
					createGameFx({
						packageId,
						arkpackStorage: storages.arkpackStorage,
						saveStorage: storages.saveStorage,
					}),
				),
		});

		await owner.replace(storages.packageId);
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

		const release = owner.replace(null);
		const restore = owner.replace(storages.packageId);
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
		await owner.replace(null);
	});
});
