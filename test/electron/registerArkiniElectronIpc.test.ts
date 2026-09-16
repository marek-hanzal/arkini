import { afterEach, describe, expect, it } from "vitest";
import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
	invokeArguments,
} from "./registerArkiniElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerArkiniElectronIpcFx authorization", () => {
	it("registers every capability behind the trusted-renderer boundary", async () => {
		const harness = await createRegisteredIpcHarness();
		expect(Array.from(harness.handlers.keys()).sort()).toEqual(
			Array.from(invokeArguments.keys()).sort(),
		);

		for (const [channel, args] of invokeArguments) {
			await expect(harness.invoke(channel, harness.untrustedEvent, ...args)).rejects.toThrow(
				"authorize test renderer",
			);
		}
		expect(harness.assertTrustedIpcSenderFx).toHaveBeenCalledTimes(invokeArguments.size);

		await harness.dispose();
		expect(harness.handlers.size).toBe(0);
	});

	it("writes only bounded text from the trusted renderer", async () => {
		const harness = await createRegisteredIpcHarness();

		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.clipboardWriteText,
				harness.trustedEvent,
				"http://127.0.0.1:32310/editor/mcp",
			),
		).resolves.toBeUndefined();
		expect(harness.writeClipboardText).toHaveBeenCalledWith(
			"http://127.0.0.1:32310/editor/mcp",
		);

		for (const invalid of [
			new Uint8Array(),
			"x".repeat(65_537),
		]) {
			await expect(
				harness.invoke(
					ArkiniElectronApi.channels.clipboardWriteText,
					harness.trustedEvent,
					invalid,
				),
			).rejects.toThrow("Clipboard text is invalid or too large");
		}
		expect(harness.writeClipboardText).toHaveBeenCalledTimes(1);
	});

	it("persists validated application sound levels", async () => {
		const harness = await createRegisteredIpcHarness();

		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.soundWrite,
				harness.trustedEvent,
				"master",
				37,
			),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.soundRead, harness.trustedEvent),
		).resolves.toEqual({
			master: 37,
			music: 10,
			sfx: 5,
		});
		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.soundWrite,
				harness.trustedEvent,
				"unknown",
				50,
			),
		).rejects.toThrow();
	});

	it("waits for native clipboard settlement and propagates a rejected write", async () => {
		const harness = await createRegisteredIpcHarness();
		let rejectWriteFn!: (error: Error) => void;
		const write = new Promise<void>((_resolve, reject) => {
			rejectWriteFn = reject;
		});
		harness.writeClipboardText.mockReturnValueOnce(write);
		let settled = false;
		const result = Promise.resolve(
			harness.invoke(
				ArkiniElectronApi.channels.clipboardWriteText,
				harness.trustedEvent,
				"clipboard text",
			),
		);
		const rejection = expect(result).rejects.toThrow("Clipboard unavailable");
		void result.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(harness.writeClipboardText).toHaveBeenCalledOnce();
		expect(settled).toBe(false);
		rejectWriteFn(new Error("Clipboard unavailable"));
		await rejection;
	});
});
