import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import type { Game } from "~/bridge/game/Game";
import { createGameFx } from "~/bridge/game/createGameFx";
import { createGameOwner } from "~/bridge/game/createGameOwner";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
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
	const bytes = createTestArkpack();
	const loaded = await Effect.runPromise(
		readArkpackFx({
			bytes,
			filename: "owner.arkpack",
			source: "imported",
		}),
	);
	const record: ArkpackStorage.LoadedRecord = {
		descriptor: loaded.descriptor,
		bytes: bytes.slice().buffer,
	};
	const arkpackStorage: ArkpackStorage = {
		close: () => undefined,
		list: async () => [
			record.descriptor,
		],
		read: async (packageId) => (packageId === record.descriptor.packageId ? record : undefined),
		remove: async () => undefined,
		write: async () => undefined,
	};
	let saved: StateSchema.Type | null = null;
	const saveStorage: GameSaveStorage = {
		close: () => undefined,
		read: async () => saved,
		remove: async () => {
			saved = null;
		},
		write: async ({ state }) => {
			saved = state;
		},
	};
	return {
		arkpackStorage,
		packageId: record.descriptor.packageId,
		saveStorage,
	};
};

describe("createGameOwner", () => {
	it("waits for the current final disposal before creating the replacement", async () => {
		const release = deferred<void>();
		const creates: string[] = [];
		const owner = createGameOwner({
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
		});
	});

	it("restores the latest real saved runtime only after the previous owner releases it", async () => {
		const storages = await createRealStorages();
		const owner = createGameOwner({
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
