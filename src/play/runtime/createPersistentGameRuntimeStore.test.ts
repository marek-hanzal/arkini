import { Cause, Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import type {
	DeleteActiveGameSaveProps,
	GameSaveStorage,
	GameSaveStorageScope,
	SaveActiveGameSaveProps,
} from "~/storage/GameSaveStorage";
import { createPersistentGameRuntimeStoreFx } from "~/play/runtime/createPersistentGameRuntimeStoreFx";
import { runGameRuntimeEffect } from "~/play/runtime/runGameRuntimeEffect";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { RandomServiceLive } from "~/random/RandomServiceLive";
import { withRandomService } from "~/random/withRandomService";

const createInitialSave = async (): Promise<GameSave> => {
	const adapter = await RuntimeGameEngineAdapter.create({
		config: createEngineTestConfig(),
		nowMs: 0,
	});
	return adapter.readSave();
};

const runStartupExit = (options: createPersistentGameRuntimeStoreFx.Options) =>
	Effect.runPromiseExit(
		createPersistentGameRuntimeStoreFx(options).pipe(withRandomService(RandomServiceLive)),
	);

const readExitFailure = async (options: createPersistentGameRuntimeStoreFx.Options) => {
	const exit = await runStartupExit(options);
	if (exit._tag !== "Failure") return undefined;
	return Array.from(Cause.failures(exit.cause)).at(0);
};

class MemoryGameSaveStorage implements GameSaveStorage {
	readonly saved: GameSave[] = [];
	private save: GameSave | null;

	constructor(save: GameSave | null = null) {
		this.save = save;
	}

	async loadActiveSave(_props: GameSaveStorageScope) {
		return this.save;
	}

	async saveActiveSave({ save }: SaveActiveGameSaveProps) {
		this.save = save;
		this.saved.push(save);
	}

	async deleteActiveSave(_props?: DeleteActiveGameSaveProps) {
		this.save = null;
	}

	async wipe() {
		this.save = null;
	}
}

describe("createPersistentGameRuntimeStoreFx", () => {
	it("creates and immediately persists an initial save when storage is empty", async () => {
		const storage = new MemoryGameSaveStorage();
		const runtime = await runGameRuntimeEffect(
			createPersistentGameRuntimeStoreFx({
				config: createEngineTestConfig(),
				nowMs: 0,
				storage,
			}),
		);

		expect(storage.saved).toHaveLength(1);
		expect(storage.saved[0]).toEqual(runtime.store.getSnapshot().runtime.save);

		await runtime.destroy();
	});

	it("starts from a loaded save instead of rebuilding the initial state", async () => {
		const loadedSave = await createInitialSave();
		loadedSave.board.items["item-instance:1"] = {
			...loadedSave.board.items["item-instance:1"],
			x: 1,
		};
		const storage = new MemoryGameSaveStorage(loadedSave);
		const runtime = await runGameRuntimeEffect(
			createPersistentGameRuntimeStoreFx({
				config: createEngineTestConfig(),
				nowMs: 0,
				storage,
			}),
		);

		expect(readBoardView(runtime.store.getSnapshot()).byId["item-instance:1"]?.x).toBe(1);
		expect(storage.saved).toHaveLength(0);

		await runtime.destroy();
	});
	it("wraps startup storage load failures as tagged errors", async () => {
		const cause = new Error("load failed");
		const storage = new MemoryGameSaveStorage();
		storage.loadActiveSave = async () => {
			throw cause;
		};

		await expect(
			readExitFailure({
				config: createEngineTestConfig(),
				nowMs: 0,
				storage,
			}),
		).resolves.toMatchObject({
			_tag: "GameRuntimeStorageLoadFailed",
			cause,
		});
	});

	it("wraps startup storage save failures as tagged errors", async () => {
		const cause = new Error("save failed");
		const storage = new MemoryGameSaveStorage();
		storage.saveActiveSave = async () => {
			throw cause;
		};

		await expect(
			readExitFailure({
				config: createEngineTestConfig(),
				nowMs: 0,
				storage,
			}),
		).resolves.toMatchObject({
			_tag: "GameRuntimeStorageSaveFailed",
			cause,
		});
	});
});
