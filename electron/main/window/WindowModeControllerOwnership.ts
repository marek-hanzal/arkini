import type { BrowserWindow } from "electron";
import type { WindowModeController } from "./WindowModeController";

export interface WindowModeControllerOwnership {
	readonly findController: (window: BrowserWindow) => WindowModeController | undefined;
	readonly attachController: (window: BrowserWindow, controller: WindowModeController) => void;
}
