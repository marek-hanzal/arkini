import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { ChatGptViewControllerOwnership } from "./ChatGptViewControllerOwnership";

export const readChatGptViewControllerFx = Effect.fn("readChatGptViewControllerFx")(
	({
		ownership,
		window,
	}: {
		readonly ownership: ChatGptViewControllerOwnership;
		readonly window: BrowserWindow;
	}) =>
		Effect.try({
			try: () => {
				const controller = ownership.findController(window);
				if (controller === undefined)
					throw new Error("The BrowserWindow has no ChatGPT view controller.");
				return controller;
			},
			catch: (cause) => cause,
		}),
);
