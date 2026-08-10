import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import type { WindowModeControllerOwnership } from "./WindowModeControllerOwnership";

export namespace readWindowModeControllerFx {
	export interface Props {
		readonly ownership: WindowModeControllerOwnership;
		readonly window: BrowserWindow;
	}
}

/** Reads the controller owned by one exact BrowserWindow. */
export const readWindowModeControllerFx = Effect.fn("readWindowModeControllerFx")(
	({ ownership, window }: readWindowModeControllerFx.Props) =>
		Effect.try({
			try: () => {
				const controller = ownership.findController(window);
				if (controller === undefined)
					throw new Error("The BrowserWindow has no window-mode controller.");
				return controller;
			},
			catch: (cause) => cause,
		}),
);
