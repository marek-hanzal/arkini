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
			readFx: (key) => invokeGameSaveTransportFx("read", () => api.read(key)),
			clearFx: (key) => invokeGameSaveTransportFx("clear", () => api.clear(key)),
			writeFx: (key, bytes) =>
				invokeGameSaveTransportFx("write", () => api.write(key, bytes)),
		} satisfies GameSaveStorage),
);
