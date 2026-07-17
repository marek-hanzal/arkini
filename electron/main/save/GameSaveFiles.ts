import type { Effect } from "effect";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";

/** Effect-native main-process capability for exact package/hash save persistence. */
export interface GameSaveFiles {
	readonly readFx: (key: ArkiniDesktopApi.SaveKey) => Effect.Effect<Uint8Array | null, unknown>;
	readonly writeFx: (
		key: ArkiniDesktopApi.SaveKey,
		bytes: Uint8Array,
	) => Effect.Effect<void, unknown>;
	readonly clearFx: (key: ArkiniDesktopApi.SaveKey) => Effect.Effect<void, unknown>;
}
