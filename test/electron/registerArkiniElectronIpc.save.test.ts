import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "./registerArkiniElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerArkiniElectronIpcFx save storage", () => {
	it("preserves exact save write, read, and clear", async () => {
		const harness = await createRegisteredIpcHarness();
		const saveBytes = new Uint8Array([
			5,
			6,
			7,
		]);

		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.saveWrite,
				harness.trustedEvent,
				harness.saveKey,
				saveBytes,
			),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.saveRead,
				harness.trustedEvent,
				harness.saveKey,
			),
		).resolves.toEqual(saveBytes);
		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.saveClear,
				harness.trustedEvent,
				harness.saveKey,
			),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.saveRead,
				harness.trustedEvent,
				harness.saveKey,
			),
		).resolves.toBeNull();
	});
});
