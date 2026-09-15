import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "../registerArkiniElectronIpc.test/fixture";
import { createTestArkpack } from "~test/arkpack-support/fx/createTestArkpack";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerArkiniElectronIpcFx Arkpack storage", () => {
	it("preserves list, candidate read, and user removal", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;
		const packageId = "arkini-test";
		const arkpackBytes = createTestArkpack(undefined, packageId);
		await mkdir(harness.userDataPaths.game.arkpacks, {
			recursive: true,
		});
		await writeFile(
			join(harness.userDataPaths.game.arkpacks, `${packageId}.arkpack`),
			arkpackBytes,
		);
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
				config: expect.objectContaining({
					meta: expect.objectContaining({
						id: packageId,
					}),
				}),
				resources: expect.arrayContaining([
					expect.objectContaining({
						url: expect.stringMatching(/^arkini:\/\/app\/game\/resource\?/),
					}),
				]),
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
