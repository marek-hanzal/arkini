import { encode } from "@msgpack/msgpack";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiagnosticRecord } from "../../../electron/contract/diagnostics/DiagnosticRecord";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { createGameFx as createGameFromPackageFx } from "~/bridge/game/createGameFx";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { decodeArkiniSaveFx } from "~/bridge/save/decodeArkiniSaveFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	createTestArkpack,
	testArkpackConfig,
} from "~test/bridge/arkpack/support/createTestArkpack";
import { installTestPngDecoder } from "~test/bridge/arkpack/support/createTestPngBytes";

const trustedKeys = {
	keys: [],
};

const createGameFx = (props: Omit<createGameFromPackageFx.Props, "runRendererEffect">) =>
	createGameFromPackageFx({
		...props,
		runRendererEffect: Effect.runSync,
	});

const createStorages = async (version = "1.0") => {
	const bytes = createTestArkpack(testArkpackConfig, "package:bridge", version);
	const loaded = await Effect.runPromise(
		readArkpackFx({
			bytes,
			filename: "bridge.arkpack",
			signature: {
				trustedKeys,
			},
			source: "user",
		}),
	);
	const file: ArkpackStorage.File = {
		packageId: loaded.descriptor.packageId,
		filename: "bridge.game.arkpack",
		bytes: bytes.slice().buffer,
		source: "user",
		overridesBundled: false,
	};
	const arkpackStorage: ArkpackStorage = {
		listFx: Effect.succeed([
			file,
		]),
		readFx: (packageId) =>
			Effect.succeed(
				packageId === file.packageId
					? [
							file,
						]
					: [],
			),
		removeFx: () => Effect.void,
		writeFx: () => Effect.void,
		openUserDirectoryFx: Effect.void,
	};
	let saved: Uint8Array | null = null;
	let clears = 0;
	const saveStorage: GameSaveStorage = {
		readFx: () => Effect.sync(() => saved?.slice() ?? null),
		clearFx: () =>
			Effect.sync(() => {
				clears += 1;
				saved = null;
			}),
		writeFx: (_key, bytes) =>
			Effect.sync(() => {
				saved = bytes.slice();
			}),
	};
	return {
		arkpackStorage,
		descriptor: loaded.descriptor,
		packageId: loaded.descriptor.packageId,
		saveKey: {
			packageId: loaded.descriptor.packageId,
		} satisfies GameSaveStorage.Key,
		readSaved: () => saved,
		readClearCount: () => clears,
		setSaved: (bytes: Uint8Array | null) => {
			saved = bytes?.slice() ?? null;
		},
		saveStorage,
	};
};

describe("createGameFx", () => {
	beforeEach(() => {
		installTestPngDecoder();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
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

	it("restores an older compatible minor save and stamps the current arkpack version", async () => {
		const storages = await createStorages("1.1");
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await Effect.runPromise(first.disposeFx);
		const bytes = storages.readSaved();
		if (bytes === null) throw new Error("Expected a save.");
		const saved = await Effect.runPromise(decodeArkiniSaveFx(bytes));
		storages.setSaved(
			encode({
				...saved,
				version: "1.0",
			}),
		);

		const restored = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await Effect.runPromise(restored.disposeFx);
		const upgradedBytes = storages.readSaved();
		if (upgradedBytes === null) throw new Error("Expected an upgraded save.");
		expect((await Effect.runPromise(decodeArkiniSaveFx(upgradedBytes))).version).toBe("1.1");
	});

	it("clears a different-major save before starting fresh gameplay", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await first.run(
			spawnItemFx({
				id: "runtime:old-major",
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
		await Effect.runPromise(first.disposeFx);
		const bytes = storages.readSaved();
		if (bytes === null) throw new Error("Expected a save.");
		const saved = await Effect.runPromise(decodeArkiniSaveFx(bytes));
		storages.setSaved(
			encode({
				...saved,
				version: "2.0",
			}),
		);

		const fresh = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		try {
			expect(fresh.getSnapshot().items.map(({ id }) => id)).not.toContain(
				"runtime:old-major",
			);
			expect(storages.readClearCount()).toBe(1);
		} finally {
			await Effect.runPromise(fresh.disposeWithoutSaveFx);
		}
	});

	it("rejects an unsupported writer for a same-major save without clearing it", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await Effect.runPromise(first.disposeFx);
		const bytes = storages.readSaved();
		if (bytes === null) throw new Error("Expected a save.");
		const saved = await Effect.runPromise(decodeArkiniSaveFx(bytes));
		const unsupportedBytes = encode({
			...saved,
			game: "0.4.0",
		});
		storages.setSaved(unsupportedBytes);

		await expect(
			Effect.runPromise(
				createGameFx({
					packageId: storages.packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
			),
		).rejects.toBeInstanceOf(GameSaveBootstrapError);
		expect(storages.readClearCount()).toBe(0);
		expect(storages.readSaved()).toEqual(unsupportedBytes);
	});

	it("rejects a future minor save without clearing or overwriting it", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await Effect.runPromise(first.disposeFx);
		const bytes = storages.readSaved();
		if (bytes === null) throw new Error("Expected a save.");
		const saved = await Effect.runPromise(decodeArkiniSaveFx(bytes));
		const futureBytes = encode({
			...saved,
			version: "1.1",
		});
		storages.setSaved(futureBytes);

		await expect(
			Effect.runPromise(
				createGameFx({
					packageId: storages.packageId,
					arkpackStorage: storages.arkpackStorage,
					saveStorage: storages.saveStorage,
				}),
			),
		).rejects.toBeInstanceOf(GameSaveBootstrapError);
		expect(storages.readClearCount()).toBe(0);
		expect(storages.readSaved()).toEqual(futureBytes);
	});

	it("retries failed public game disposal without releasing its retry resources", async () => {
		const storages = await createStorages();
		const diagnosticWrites: Array<DiagnosticRecord> = [];
		vi.stubGlobal("window", {
			arkini: {
				diagnostics: {
					write: (record: DiagnosticRecord) => {
						diagnosticWrites.push(record);
						return Promise.resolve();
					},
				},
			},
		});
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
		expect(diagnosticWrites.some(({ event }) => event === "session-ended")).toBe(false);
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
		expect(diagnosticWrites.filter(({ event }) => event === "session-ended")).toEqual([
			expect.objectContaining({
				data: expect.objectContaining({
					reason: "saved",
				}),
			}),
		]);
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
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.stubGlobal("window", {
			arkini: {
				diagnostics: {
					write: () => {
						throw new Error("logger unavailable");
					},
				},
			},
		});
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
				version: "not-a-version",
				game: "0.5.0",
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
		const failure = Cause.findErrorOption(exit.cause);
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
				Effect.succeed([
					{
						packageId: storages.packageId,
						filename: "bridge.game.arkpack",
						bytes: Uint8Array.of(1, 2, 3).buffer,
						source: "user",
						overridesBundled: false,
					},
				]),
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
		const failure = Cause.findErrorOption(exit.cause);
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
