import { ArkiniElectronApi } from "../../../electron/contract/ArkiniElectronApi";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "../registerArkiniElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerArkiniElectronIpcFx Arkpack storage", () => {
	it("preserves install, list, candidate read, and user removal", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;
		const arkpackBytes = new Uint8Array([
			1,
			2,
			3,
			4,
		]);
		const packageId = "arkini-test";
		const record: ArkiniElectronApi.ArkpackInstall = {
			packageId,
			bytes: arkpackBytes,
		};

		await expect(
			harness.invoke(ArkiniElectronApi.channels.arkpackInstall, event, record),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.arkpackList, event),
		).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					packageId,
					source: "user",
				}),
			]),
		);
		await expect(
			harness.invoke(ArkiniElectronApi.channels.arkpackRead, event, packageId),
		).resolves.toEqual([
			expect.objectContaining({
				packageId,
				bytes: arkpackBytes,
				source: "user",
			}),
		]);
		await expect(
			harness.invoke(ArkiniElectronApi.channels.arkpackRemove, event, packageId),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.arkpackRead, event, packageId),
		).resolves.toEqual([]);
	});
});
