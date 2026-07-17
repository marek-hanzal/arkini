import { GameSaveStorageError } from "~/bridge/save/GameSaveStorageError";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

const execute = async <Value>(
	operation: GameSaveStorageError["operation"],
	call: () => Promise<Value>,
): Promise<Value> => {
	try {
		return await call();
	} catch (cause) {
		throw new GameSaveStorageError({
			operation,
			cause,
		});
	}
};

/** Renderer adapter for the narrow Electron save filesystem capability. */
export class DesktopGameSaveStorage implements GameSaveStorage {
	readonly #api: NonNullable<Window["arkini"]>["save"];

	constructor(api = window.arkini.save) {
		this.#api = api;
	}

	close = () => undefined;
	read = (key: GameSaveStorage.Key) => execute("read", () => this.#api.read(key));
	clear = (key: GameSaveStorage.Key) => execute("clear", () => this.#api.clear(key));
	write = (key: GameSaveStorage.Key, bytes: Uint8Array) =>
		execute("write", () => this.#api.write(key, bytes));
}
