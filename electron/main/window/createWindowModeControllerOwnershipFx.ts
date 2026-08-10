import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { WindowModeController } from "./WindowModeController";
import type { WindowModeControllerOwnership } from "./WindowModeControllerOwnership";

/** Creates the Electron-main owner for controllers attached to BrowserWindow instances. */
export const createWindowModeControllerOwnershipFx = Effect.fn(
	"createWindowModeControllerOwnershipFx",
)(() =>
	Effect.sync((): WindowModeControllerOwnership => {
		const controllersByWindow = new WeakMap<BrowserWindow, WindowModeController>();
		return Object.freeze({
			findController: (window: BrowserWindow) => controllersByWindow.get(window),
			attachController: (window: BrowserWindow, controller: WindowModeController) => {
				controllersByWindow.set(window, controller);
				window.once("closed", () => controllersByWindow.delete(window));
			},
		});
	}),
);
