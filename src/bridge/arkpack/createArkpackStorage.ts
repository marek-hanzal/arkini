import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { DesktopArkpackStorage } from "~/bridge/arkpack/DesktopArkpackStorage";
import { MemoryArkpackStorage } from "~/bridge/arkpack/MemoryArkpackStorage";

const browserStorage = new MemoryArkpackStorage();

/** Selects Electron filesystem storage or the explicitly non-persistent browser fallback. */
export const createArkpackStorage = (): ArkpackStorage =>
	typeof window === "undefined" || window.arkini?.arkpack === undefined
		? browserStorage
		: new DesktopArkpackStorage();
