import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { ArkpackStorage } from "~/arkpack-catalog/service/ArkpackStorage";
import { createGameFx as createGameFromPackageFx } from "~/installed-game/fx/createGameFx";
import { GameSaveBootstrapError } from "~/installed-game/error/GameSaveBootstrapError";
import { decodeArkiniSaveFx } from "~/game-persistence/fx/decodeArkiniSaveFx";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { testArkpackConfig } from "~test/arkpack-support/fx/createTestArkpack";
import { installTestPngDecoder } from "~test/arkpack-support/fn/createTestPngBytes";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";

const encodeJsonFn = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const createGameFx = (props: Omit<createGameFromPackageFx.Props, "runRendererEffectFn">) =>
	createGameFromPackageFx({
		...props,
		runRendererEffectFn: Effect.runSync,
	});

const createStorages = async (version = "1.0") => {
	const file: ArkpackStorage.LoadedFile = {
		packageId: testArkpackConfig.meta.id,
		filename: "test.arkpack",
		contentHash: "a".repeat(64),
		title: testArkpackConfig.meta.title,
		version,
		arkini: ArkiniAppVersion,
		config: testArkpackConfig,
		resources: [
			{
				id: "hero",
				mime: "image/png",
				url: "arkini://test/hero",
			},
			{
				id: "asset:water",
				mime: "image/png",
				url: "arkini://test/asset-water",
			},
		],
		provenance: {
			type: "community",
		},
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
		descriptor: file,
		packageId: file.packageId,
		saveKey: {
			packageId: file.packageId,
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
		expect(first.getSnapshotFn().items).toEqual([
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
		expect(first.getResourceUrlFn("asset:water")).toBe("arkini://test/asset-water");
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
			expect(restored.getSnapshotFn().items).toHaveLength(1);
			expect(restored.getSnapshotFn().items[0]?.item.id).toBe("water");
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
			encodeJsonFn({
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

	it("rejects a different gameplay major without changing its save", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				arkpackStorage: storages.arkpackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await first.runFn(
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
		const incompatibleBytes = encodeJsonFn({
			...saved,
			version: "2.0",
		});
		storages.setSaved(incompatibleBytes);

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
		expect(storages.readSaved()).toEqual(incompatibleBytes);
	});

	it("retries failed public game disposal without releasing its retry resources", async () => {
		const storages = await createStorages();
		const diagnosticWrites: Array<DiagnosticRecord> = [];
		vi.stubGlobal("window", {
			arkini: {
				diagnostics: {
					writeFn: (record: DiagnosticRecord) => {
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
		const resourceUrl = game.getResourceUrlFn("asset:water");
		await game.runFn(
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
		expect(game.getResourceUrlFn("asset:water")).toBe(resourceUrl);
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		await expect(
			game.runFn(
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
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		expect(() => game.getResourceUrlFn("asset:water")).toThrow(
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
					writeFn: () => {
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
		await expect(Effect.runPromise(game.disposeFx)).rejects.toThrow("disk still full");
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		await expect(Effect.runPromise(game.disposeWithoutSaveFx)).resolves.toBeUndefined();
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		expect(() => game.getResourceUrlFn("asset:water")).toThrow(
			"Game resource asset:water is unavailable.",
		);
	});

	it("rejects an invalid save before constructing or starting a partial game session", async () => {
		const storages = await createStorages();
		storages.setSaved(
			encodeJsonFn({
				version: "not-a-version",
				arkini: ArkiniAppVersion,
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
						...storages.descriptor,
						config: {
							...testArkpackConfig,
							meta: {
								...testArkpackConfig.meta,
								id: "wrong-package",
							},
						},
						resources: [],
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
});
