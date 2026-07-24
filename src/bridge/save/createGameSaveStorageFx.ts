import { Effect } from "effect";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { invokeGameSaveTransportFx } from "~/bridge/save/invokeGameSaveTransportFx";

export namespace createGameSaveStorageFx {
	export interface Props {
		readonly api?: Window["arkini"]["save"];
	}
}

/** Adapts the typed preload Promise transport once into an Effect-native save capability. */
export const createGameSaveStorageFx = Effect.fn("createGameSaveStorageFx")(
	({ api = window.arkini.save }: createGameSaveStorageFx.Props = {}) =>
		Effect.succeed({
			readFx: Effect.fn("GameSaveStorage.readFx")((key: GameSaveStorage.Key) =>
				invokeGameSaveTransportFx("read", () => api.read(key)),
			),
			clearFx: Effect.fn("GameSaveStorage.clearFx")((key: GameSaveStorage.Key) =>
				invokeGameSaveTransportFx("clear", () => api.clear(key)),
			),
			writeFx: Effect.fn("GameSaveStorage.writeFx")(
				(key: GameSaveStorage.Key, bytes: Uint8Array) =>
					invokeGameSaveTransportFx("write", () => api.write(key, bytes)),
			),
		} satisfies GameSaveStorage),
);
