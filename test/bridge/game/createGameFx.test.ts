import { encode } from "@msgpack/msgpack";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { createGameFx } from "~/bridge/game/createGameFx";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";

const createStorages = async () => {
	const bytes = createTestArkpack();
	const loaded = await Effect.runPromise(
		readArkpackFx({
			bytes,
			filename: "bridge.arkpack",
			source: "imported",
		}),
	);
	const record = {
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
	let saved: Uint8Array | null = null;
	const saveStorage: GameSaveStorage = {
		close: () => undefined,
		read: async () => saved?.slice() ?? null,
		clear: async () => {
			saved = null;
		},
		write: async (_key, bytes) => {
			saved = bytes.slice();
		},
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
		await first.dispose();
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
			await restored.dispose();
		}
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
			read: async () => ({
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
