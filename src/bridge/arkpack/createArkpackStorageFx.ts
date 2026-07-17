import { Effect } from "effect";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { DesktopArkpackStorage } from "~/bridge/arkpack/DesktopArkpackStorage";
import { MemoryArkpackStorage } from "~/bridge/arkpack/MemoryArkpackStorage";

const browserStorage = new MemoryArkpackStorage();

/** Selects Electron filesystem storage or the explicitly non-persistent browser fallback. */
export const createArkpackStorageFx = Effect.fn("createArkpackStorageFx")(() =>
	Effect.sync(
		(): ArkpackStorage =>
			typeof window === "undefined" || window.arkini?.arkpack === undefined
				? browserStorage
				: new DesktopArkpackStorage(),
	),
);
