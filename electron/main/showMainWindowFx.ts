import type { BrowserWindow } from "electron";
import { Effect } from "effect";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";

/** Shows the black-backed window, then reports the renderer-visible timing boundary. */
export const showMainWindowFx = Effect.fn("showMainWindowFx")(
	(window: Pick<BrowserWindow, "show" | "webContents">) =>
		Effect.sync(() => {
			window.show();
			window.webContents.send(ArkiniDesktopApi.channels.windowVisible);
		}),
);
