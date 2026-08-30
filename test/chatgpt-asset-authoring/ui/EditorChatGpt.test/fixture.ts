import { vi } from "vitest";

export const pngBytes = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	),
);

export class TestResizeObserver {
	readonly disconnect = vi.fn();
	readonly observe = vi.fn();
}

export const installChatGptDom = () => {
	vi.stubGlobal("ResizeObserver", TestResizeObserver);
	vi.stubGlobal(
		"createImageBitmap",
		vi.fn(async () => ({
			width: 1,
			height: 1,
			close: vi.fn(),
		})),
	);
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:chatgpt-candidate");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		x: 64,
		y: 0,
		width: 960,
		height: 720,
		top: 0,
		right: 1_024,
		bottom: 720,
		left: 64,
		toJSON: () => undefined,
	});
};
