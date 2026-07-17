import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

const readKey = ({ packageId, contentHash }: GameSaveStorage.Key) => `${packageId}:${contentHash}`;

/** Explicit test double; never selected by product runtime. */
export class InMemoryGameSaveStorage implements GameSaveStorage {
	readonly #records = new Map<string, Uint8Array>();

	close = () => undefined;
	read = async (key: GameSaveStorage.Key) => this.#records.get(readKey(key))?.slice() ?? null;
	clear = async (key: GameSaveStorage.Key) => {
		this.#records.delete(readKey(key));
	};
	write = async (key: GameSaveStorage.Key, bytes: Uint8Array) => {
		this.#records.set(readKey(key), bytes.slice());
	};
}
