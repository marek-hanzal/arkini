import { DesktopGameSaveStorage } from "~/bridge/save/DesktopGameSaveStorage";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { MemoryGameSaveStorage } from "~/bridge/save/MemoryGameSaveStorage";

const browserStorage = new MemoryGameSaveStorage();

/** Selects Electron filesystem saves or the explicitly non-persistent browser fallback. */
export const createGameSaveStorage = (): GameSaveStorage =>
	typeof window === "undefined" || window.arkini?.save === undefined
		? browserStorage
		: new DesktopGameSaveStorage();
