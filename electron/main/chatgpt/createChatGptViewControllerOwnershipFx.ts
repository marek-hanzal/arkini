import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { ChatGptViewController } from "./createChatGptViewControllerFx";

export interface ChatGptViewControllerOwnership {
	readonly attachControllerFx: (
		window: BrowserWindow,
		controller: ChatGptViewController,
	) => Effect.Effect<void, never, never>;
	readonly readControllerFx: (
		window: BrowserWindow,
	) => Effect.Effect<ChatGptViewController, unknown, never>;
}

/** Creates the Electron-main owner for ChatGPT controllers attached to exact windows. */
export const createChatGptViewControllerOwnershipFx = Effect.fn(
	"createChatGptViewControllerOwnershipFx",
)(() =>
	Effect.sync((): ChatGptViewControllerOwnership => {
		const controllers = new WeakMap<BrowserWindow, ChatGptViewController>();
		return Object.freeze({
			attachControllerFx: (window: BrowserWindow, controller: ChatGptViewController) =>
				Effect.sync(() => {
					controllers.set(window, controller);
					window.once("closed", () => controllers.delete(window));
				}),
			readControllerFx: (window: BrowserWindow) =>
				Effect.try({
					try: () => {
						const controller = controllers.get(window);
						if (controller === undefined)
							throw new Error("The BrowserWindow has no ChatGPT view controller.");
						return controller;
					},
					catch: (cause) => cause,
				}),
		});
	}),
);
