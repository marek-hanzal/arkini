import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { WindowModeController } from "./WindowModeController";
import type { WindowModeControllerOwnership } from "./WindowModeControllerOwnership";

export namespace registerWindowModeControllerFx {
	export interface Props {
		readonly controller: WindowModeController;
		readonly ownership: WindowModeControllerOwnership;
		readonly window: BrowserWindow;
	}
}

/** Registers one controller for the exact BrowserWindow that owns it. */
export const registerWindowModeControllerFx = Effect.fn("registerWindowModeControllerFx")(
	({ controller, ownership, window }: registerWindowModeControllerFx.Props) =>
		Effect.sync(() => {
			ownership.attachController(window, controller);
		}),
);
