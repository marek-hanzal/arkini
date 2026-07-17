import { Effect } from "effect";
import { DesktopArkpackStorage } from "~/bridge/arkpack/DesktopArkpackStorage";

/** Creates the renderer adapter for Arkini's mandatory Electron Arkpack capability. */
export const createArkpackStorageFx = Effect.fn("createArkpackStorageFx")(() =>
	Effect.sync(() => new DesktopArkpackStorage()),
);
