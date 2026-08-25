import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { ChatGptViewController } from "./ChatGptViewController";
import type { ChatGptViewControllerOwnership } from "./ChatGptViewControllerOwnership";

export const registerChatGptViewControllerFx = Effect.fn("registerChatGptViewControllerFx")(
	({
		controller,
		ownership,
		window,
	}: {
		readonly controller: ChatGptViewController;
		readonly ownership: ChatGptViewControllerOwnership;
		readonly window: BrowserWindow;
	}) => Effect.sync(() => ownership.attachController(window, controller)),
);
