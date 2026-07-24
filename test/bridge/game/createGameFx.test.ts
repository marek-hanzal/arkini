import { encode } from "@msgpack/msgpack";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";

const trustedKeys = {
	formatVersion: 1 as const,
	keys: [],
};

const createStorages = async () => {
	const bytes = createTestArkpack();
	const loaded = await Effect.runPromise(
		readArkpackFx({
			bytes,
			filename: "bridge.arkpack",
			source: "imported",
			trustedKeys,
		}),
	);
	const record = {
		descriptor: loaded.descriptor,
		bytes: bytes.slice().buffer,
	};
	const arkpackStorage: ArkpackStorage = {
		listFx: Effect.succeed([
			record.descriptor,
		]),
		readFx: (packageId) =>
			Effect.succeed(packageId === record.descriptor.packageId ? record : undefined),
		removeFx: () => Effect.void,
		writeFx: () => Effect.void,
	};
	let saved: Uint8Array | null = null;
	const saveStorage: GameSaveStorage = {
		readFx: () => Effect.sync(() => saved?.slice() ?? null),
		clearFx: () =>
			Effect.sync(() => {
				saved = null;
			}),
		writeFx: (_key, bytes) =>
			Effect.sync(() => {
				saved = bytes.slice();
			}),
	};
	return {
		arkpackStorage,
		descriptor: record.descriptor,
		packageId: record.descriptor.packageId,
		saveKey: {
			packageId: record.descriptor.packageId,
			contentHash: record.descriptor.contentHash,
		} satisfies GameSaveStorage.Key,
		readSaved: () => saved,
		setSaved: (bytes: Uint8Array | null) => {
			saved = bytes?.slice() ?? null;
		},
		saveStorage,
	};
};

describe("createGameFx", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts one selected package, persists its state and restores it without a second start", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);

		expect(first.arkpack.packageId).toBe(storages.packageId);
		expect(first.config).toEqual(testArkpackConfig);
		expect(first.getSnapshot().items).toEqual([
			expect.objectContaining({
				item: testArkpackConfig.items.water,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
			}),
		]);
		expect(first.getResourceUrl("asset:water")).toMatch(/^blob:/);
		await Effect.runPromise(first.disposeFx);
		expect(storages.readSaved()).not.toBeNull();

		const restored = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		try {
			expect(restored.getSnapshot().items).toHaveLength(1);
			expect(restored.getSnapshot().items[0]?.item.id).toBe("water");
		} finally {
			await Effect.runPromise(restored.disposeFx);
		}
	});

	it("retries failed public game disposal without releasing its retry resources", async () => {
		const storages = await createStorages();
		const failure = new Error("disk full");
		let writes = 0;
		const saveStorage: GameSaveStorage = {
			...storages.saveStorage,
			writeFx: (key, bytes) =>
				Effect.suspend(() => {
					writes += 1;
					if (writes === 1) return Effect.fail(failure);
					return storages.saveStorage.writeFx(key, bytes);
				}),
		};
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const game = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage,
			}),
		);
		const resourceUrl = game.getResourceUrl("asset:water");
		await game.run(
			spawnItemFx({
				id: "runtime:public-disposal-retry",
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

		await expect(Effect.runPromise(game.disposeFx)).rejects.toThrow("disk full");
		expect(writes).toBe(1);
		expect(game.getResourceUrl("asset:water")).toBe(resourceUrl);
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		await expect(
			game.run(
				spawnItemFx({
					id: "runtime:must-remain-frozen",
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

		await expect(Effect.runPromise(game.disposeFx)).resolves.toBeUndefined();
		expect(writes).toBe(2);
		expect(revokeObjectUrl.mock.calls.filter(([url]) => url === resourceUrl)).toHaveLength(1);
		expect(() => game.getResourceUrl("asset:water")).toThrow(
			"Game resource asset:water is unavailable.",
		);
		const saved = storages.readSaved();
		expect(saved).not.toBeNull();
		if (saved === null) throw new Error("Expected the retried save bytes.");
		const decoded = await Effect.runPromise(decodeArkiniSaveFx(saved));
		expect(decoded.state.items.map(({ id }) => id)).toContain("runtime:public-disposal-retry");
	});

	it("releases public game resources after explicit discard of a failed save", async () => {
		const storages = await createStorages();
		const saveStorage: GameSaveStorage = {
			...storages.saveStorage,
			writeFx: () => Effect.fail(new Error("disk still full")),
		};
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const game = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage,
			}),
		);
		const resourceUrl = game.getResourceUrl("asset:water");

		await expect(Effect.runPromise(game.disposeFx)).rejects.toThrow("disk still full");
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		await expect(Effect.runPromise(game.disposeWithoutSaveFx)).resolves.toBeUndefined();
		expect(revokeObjectUrl.mock.calls.filter(([url]) => url === resourceUrl)).toHaveLength(1);
	});

	it("rejects an invalid save before constructing or starting a partial game session", async () => {
		const storages = await createStorages();
		storages.setSaved(
			encode({
				namespace: "arkini",
				format: 999,
				state: {},
			}),
		);
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");

		const exit = await Effect.runPromiseExit(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected invalid save failure.");
		const failure = Cause.failureOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected typed save failure.");
		expect(failure.value).toBeInstanceOf(GameSaveBootstrapError);
		if (!(failure.value instanceof GameSaveBootstrapError))
			throw new Error("Expected GameSaveBootstrapError.");
		expect(failure.value.saveKey).toEqual(storages.saveKey);

		expect(createObjectUrl).not.toHaveBeenCalled();
		expect(storages.readSaved()).not.toBeNull();
	});

	it("does not mark package validation failures as clearable save failures", async () => {
		const storages = await createStorages();
		const corruptStorage: ArkpackStorage = {
			...storages.arkpackStorage,
			readFx: () =>
				Effect.succeed({
					descriptor: storages.descriptor,
					bytes: Uint8Array.of(1, 2, 3).buffer,
				}),
		};
		const exit = await Effect.runPromiseExit(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: corruptStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected package validation failure.");
		const failure = Cause.failureOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected package failure.");
		expect(failure.value).not.toBeInstanceOf(GameSaveBootstrapError);
	});

	it("disposes a partial game bootstrap and revokes created resources when resource setup fails", async () => {
		const storages = await createStorages();
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:created")
			.mockImplementationOnce(() => {
				throw new Error("resource setup failed");
			});
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

		await expect(
			Effect.runPromise(
				createGameFx({
					packageId: storages.packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
			),
		).rejects.toThrow("resource setup failed");

		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:created");
	});
});
