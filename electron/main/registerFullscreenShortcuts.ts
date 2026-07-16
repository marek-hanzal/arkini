import type { BrowserWindow } from "electron";

export function registerFullscreenShortcuts(window: BrowserWindow): void {
	window.webContents.on("before-input-event", (event, input) => {
		if (input.type !== "keyDown" || input.isAutoRepeat) return;

		const isFullscreenToggle = input.key === "F11" || (input.alt && input.key === "Enter");
		if (!isFullscreenToggle) return;

		event.preventDefault();
		window.setFullScreen(!window.isFullScreen());
	});
}
