import type { BrowserWindow } from "electron";
import { Effect } from "effect";

export const registerFullscreenShortcutsFx = Effect.fn("registerFullscreenShortcutsFx")(
	(window: BrowserWindow) =>
		Effect.sync(() => {
			window.webContents.on("before-input-event", (event, input) => {
				if (input.type !== "keyDown" || input.isAutoRepeat) return;
				const isFullscreenToggle =
					input.key === "F11" || (input.alt && input.key === "Enter");
				if (!isFullscreenToggle) return;
				event.preventDefault();
				window.setFullScreen(!window.isFullScreen());
			});
		}),
);
