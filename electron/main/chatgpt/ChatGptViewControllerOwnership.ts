import type { BrowserWindow } from "electron";
import type { ChatGptViewController } from "./ChatGptViewController";

export interface ChatGptViewControllerOwnership {
	readonly findController: (window: BrowserWindow) => ChatGptViewController | undefined;
	readonly attachController: (window: BrowserWindow, controller: ChatGptViewController) => void;
}
