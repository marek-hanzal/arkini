import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { WindowModeController } from "./createWindowModeControllerFx";

export interface WindowModeControllerOwnership {
	readonly attachControllerFx: (
		window: BrowserWindow,
		controller: WindowModeController,
	) => Effect.Effect<void>;
	readonly readControllerFx: (
		window: BrowserWindow,
	) => Effect.Effect<WindowModeController, unknown>;
}

/** Creates the Electron-main owner for controllers attached to BrowserWindow instances. */
export const createWindowModeControllerOwnershipFx = Effect.fn(
	"createWindowModeControllerOwnershipFx",
)(() =>
	Effect.sync((): WindowModeControllerOwnership => {
		const controllersByWindow = new WeakMap<BrowserWindow, WindowModeController>();
		return Object.freeze({
			attachControllerFx: (window: BrowserWindow, controller: WindowModeController) =>
				Effect.sync(() => {
					controllersByWindow.set(window, controller);
					window.once("closed", () => controllersByWindow.delete(window));
				}),
			readControllerFx: (window: BrowserWindow) =>
				Effect.try({
					try: () => {
						const controller = controllersByWindow.get(window);
						if (controller === undefined)
							throw new Error("The BrowserWindow has no window-mode controller.");
						return controller;
					},
					catch: (cause) => cause,
				}),
		});
	}),
);
