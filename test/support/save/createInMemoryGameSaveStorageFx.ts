import { Effect } from "effect";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

/** Creates an explicit in-memory save capability for tests only. */
export const createInMemoryGameSaveStorageFx = Effect.fn("createInMemoryGameSaveStorageFx")(() =>
	Effect.sync(() => {
		const records = new Map<string, Uint8Array>();
		const readKey = ({ packageId, contentHash }: GameSaveStorage.Key) =>
			`${packageId}:${contentHash}`;
		return {
			readFx: (key) => Effect.sync(() => records.get(readKey(key))?.slice() ?? null),
			clearFx: (key) =>
				Effect.sync(() => {
					records.delete(readKey(key));
				}),
			writeFx: (key, bytes) =>
				Effect.sync(() => {
					records.set(readKey(key), bytes.slice());
				}),
		} satisfies GameSaveStorage;
	}),
);
