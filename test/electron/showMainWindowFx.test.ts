import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { showMainWindowFx } from "../../electron/main/showMainWindowFx";

describe("showMainWindowFx", () => {
	it("shows the black-backed window before announcing renderer visibility", () => {
		const order: Array<string> = [];
		const show = vi.fn(() => order.push("show"));
		const send = vi.fn((channel: string) => order.push(channel));
		Effect.runSync(
			showMainWindowFx({
				show,
				webContents: {
					send,
				},
			} as never),
		);

		expect(order).toEqual([
			"show",
			ArkiniElectronApi.channels.windowVisible,
		]);
	});
});
