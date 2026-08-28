import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { ChatGptViewController } from "./ChatGptViewController";
import type { ChatGptViewControllerOwnership } from "./ChatGptViewControllerOwnership";

/** Creates the Electron-main owner for ChatGPT controllers attached to exact windows. */
export const createChatGptViewControllerOwnershipFx = Effect.fn(
	"createChatGptViewControllerOwnershipFx",
)(() =>
	Effect.sync((): ChatGptViewControllerOwnership => {
		const controllers = new WeakMap<BrowserWindow, ChatGptViewController>();
		return Object.freeze({
			findController: (window: BrowserWindow) => controllers.get(window),
			attachController: (window: BrowserWindow, controller: ChatGptViewController) => {
				controllers.set(window, controller);
				window.once("closed", () => controllers.delete(window));
			},
		});
	}),
);
