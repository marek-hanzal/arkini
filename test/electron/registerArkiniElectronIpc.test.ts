import { afterEach, describe, expect, it } from "vitest";
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
});
