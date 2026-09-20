import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiagnosticRecord } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { SerapackStorage } from "~/serapack-catalog/service/SerapackStorage";
import { createGameFx as createGameFromPackageFx } from "~/installed-game/fx/createGameFx";
import { GameSaveBootstrapError } from "~/installed-game/error/GameSaveBootstrapError";
import { decodeSerakkiSaveFx } from "~/game-persistence/fx/decodeSerakkiSaveFx";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { testSerapackConfig } from "~test/serapack-support/fx/createTestSerapack";
import { installTestPngDecoder } from "~test/serapack-support/fn/createTestPngBytes";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

const encodeJsonFn = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const createGameFx = (props: Omit<createGameFromPackageFx.Props, "runRendererEffectFn">) =>
	createGameFromPackageFx({
		...props,
		runRendererEffectFn: Effect.runSync,
	});

const createStorages = async (version = "1.0", introduction?: string) => {
	const file: SerapackStorage.LoadedFile = {
		packageId: testSerapackConfig.meta.id,
		filename: "test.serapack",
		contentHash: "a".repeat(64),
		title: testSerapackConfig.meta.title,
		version,
		serakki: SerakkiAppVersion,
		config: {
			...testSerapackConfig,
			meta: {
				...testSerapackConfig.meta,
				introduction,
			},
		},
		resources: [
			{
				id: "hero",
				type: "image",
				url: "serakki://test/hero",
			},
			{
				id: "artwork:water",
				type: "artwork",
				url: "serakki://test/asset-water",
			},
		],
		provenance: {
			type: "community",
		},
		source: "user",
		overridesBundled: false,
	};
	const serapackStorage: SerapackStorage = {
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
		serapackStorage,
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
				serapackStorage: storages.serapackStorage,
				saveStorage: storages.saveStorage,
			}),
		);

		expect(first.serapack.packageId).toBe(storages.packageId);
		expect(first.config).toEqual(testSerapackConfig);
		expect(first.getSnapshotFn().items).toEqual([
			expect.objectContaining({
				item: testSerapackConfig.items.water,
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
		expect(first.getResourceUrlFn("artwork:water")).toBe("serakki://test/asset-water");
		await Effect.runPromise(first.disposeFx);
		expect(storages.readSaved()).not.toBeNull();

		const restored = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				serapackStorage: storages.serapackStorage,
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

	it("keeps a welcome unsaved until Continue, starts once and skips it when restoring", async () => {
		const content = "# Welcome\n\nBuild **something**.\n\n- Have fun";
		const storages = await createStorages("1.0", content);
		const loadFn = () =>
			Effect.runPromise(
				createGameFx({
					packageId: storages.packageId,
					serapackStorage: storages.serapackStorage,
					saveStorage: storages.saveStorage,
				}),
			);
		const abandoned = await loadFn();
		expect(abandoned.introduction?.readFn()).toBe(content);
		expect(abandoned.getSnapshotFn().items).toEqual([]);
		await Effect.runPromise(abandoned.flushSaveFx);
		expect(storages.readSaved()).toBeNull();
		await Effect.runPromise(abandoned.disposeFx);
		expect(storages.readSaved()).toBeNull();

		const game = await loadFn();
		try {
			expect(game.introduction?.readFn()).toBe(content);
			const introduction = game.introduction!;
			await Promise.all([
				Effect.runPromise(introduction.continueFx),
				Effect.runPromise(introduction.continueFx),
			]);
			expect(introduction.readFn()).toBeUndefined();
			expect(game.getSnapshotFn().items).toHaveLength(1);
			expect(storages.readSaved()).not.toBeNull();
		} finally {
			await Effect.runPromise(game.disposeFx);
		}
		const restored = await loadFn();
		try {
			expect(restored.introduction).toBeUndefined();
			expect(restored.getSnapshotFn().items).toHaveLength(1);
		} finally {
			await Effect.runPromise(restored.disposeFx);
		}
	});

	it("starts immediately when the authored introduction contains only whitespace", async () => {
		const storages = await createStorages("1.0", " \n\t");
		const game = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				serapackStorage: storages.serapackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		try {
			expect(game.introduction).toBeUndefined();
			expect(game.getSnapshotFn().items).toHaveLength(1);
		} finally {
			await Effect.runPromise(game.disposeFx);
		}
		expect(storages.readSaved()).not.toBeNull();
	});

	it("restores an older compatible minor save and stamps the current serapack version", async () => {
		const storages = await createStorages("1.1");
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				serapackStorage: storages.serapackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await Effect.runPromise(first.disposeFx);
		const bytes = storages.readSaved();
		if (bytes === null) throw new Error("Expected a save.");
		const saved = await Effect.runPromise(decodeSerakkiSaveFx(bytes));
		storages.setSaved(
			encodeJsonFn({
				...saved,
				version: "1.0",
			}),
		);

		const restored = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				serapackStorage: storages.serapackStorage,
				saveStorage: storages.saveStorage,
			}),
		);
		await Effect.runPromise(restored.disposeFx);
		const upgradedBytes = storages.readSaved();
		if (upgradedBytes === null) throw new Error("Expected an upgraded save.");
		expect((await Effect.runPromise(decodeSerakkiSaveFx(upgradedBytes))).version).toBe("1.1");
	});

	it("rejects a different gameplay major without changing its save", async () => {
		const storages = await createStorages();
		const first = await Effect.runPromise(
			createGameFx({
				packageId: storages.packageId,
				serapackStorage: storages.serapackStorage,
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
		const saved = await Effect.runPromise(decodeSerakkiSaveFx(bytes));
		const incompatibleBytes = encodeJsonFn({
			...saved,
			version: "2.0",
		});
		storages.setSaved(incompatibleBytes);

		await expect(
			Effect.runPromise(
				createGameFx({
					packageId: storages.packageId,
					serapackStorage: storages.serapackStorage,
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
			serakki: {
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
				serapackStorage: storages.serapackStorage,
				saveStorage,
			}),
		);
		const resourceUrl = game.getResourceUrlFn("artwork:water");
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
		expect(game.getResourceUrlFn("artwork:water")).toBe(resourceUrl);
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
		expect(() => game.getResourceUrlFn("artwork:water")).toThrow(
			"Game resource artwork:water is unavailable.",
		);
		const saved = storages.readSaved();
		expect(saved).not.toBeNull();
		if (saved === null) throw new Error("Expected the retried save bytes.");
		const decoded = await Effect.runPromise(decodeSerakkiSaveFx(saved));
		expect(decoded.state.items.map(({ id }) => id)).toContain("runtime:public-disposal-retry");
	});

	it("releases public game resources after explicit discard of a failed save", async () => {
		const storages = await createStorages();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.stubGlobal("window", {
			serakki: {
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
				serapackStorage: storages.serapackStorage,
				saveStorage,
			}),
		);
		await expect(Effect.runPromise(game.disposeFx)).rejects.toThrow("disk still full");
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		await expect(Effect.runPromise(game.disposeWithoutSaveFx)).resolves.toBeUndefined();
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		expect(() => game.getResourceUrlFn("artwork:water")).toThrow(
			"Game resource artwork:water is unavailable.",
		);
	});

	it("rejects an invalid save before constructing or starting a partial game session", async () => {
		const storages = await createStorages();
		storages.setSaved(
			encodeJsonFn({
				version: "not-a-version",
				serakki: SerakkiAppVersion,
				state: {},
			}),
		);
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");

		const exit = await Effect.runPromiseExit(
			createGameFx({
				packageId: storages.packageId,
				serapackStorage: storages.serapackStorage,
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
		const corruptStorage: SerapackStorage = {
			...storages.serapackStorage,
			readFx: () =>
				Effect.succeed([
					{
						...storages.descriptor,
						config: {
							...testSerapackConfig,
							meta: {
								...testSerapackConfig.meta,
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
				serapackStorage: corruptStorage,
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
