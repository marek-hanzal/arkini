import { Effect } from "effect";
import { DesktopGameSaveStorage } from "~/bridge/save/DesktopGameSaveStorage";

/** Creates the renderer adapter for Arkini's mandatory Electron save capability. */
export const createGameSaveStorageFx = Effect.fn("createGameSaveStorageFx")(() =>
	Effect.sync(() => new DesktopGameSaveStorage()),
);
