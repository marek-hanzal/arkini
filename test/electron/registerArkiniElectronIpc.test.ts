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
});
