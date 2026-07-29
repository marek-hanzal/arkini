import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { WindowModeController } from "./WindowModeController";

const controllers = new WeakMap<BrowserWindow, WindowModeController>();

export const registerWindowModeControllerFx = Effect.fn("registerWindowModeControllerFx")(
	({
		controller,
		window,
	}: {
		readonly controller: WindowModeController;
		readonly window: BrowserWindow;
	}) =>
		Effect.sync(() => {
			controllers.set(window, controller);
			window.once("closed", () => controllers.delete(window));
		}),
);

export const readWindowModeControllerFx = Effect.fn("readWindowModeControllerFx")(
	(window: BrowserWindow) =>
		Effect.try({
			try: () => {
				const controller = controllers.get(window);
				if (controller === undefined) {
					throw new Error("The BrowserWindow has no window-mode controller.");
				}
				return controller;
			},
			catch: (cause) => cause,
		}),
);
