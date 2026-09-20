import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "../registerSerakkiElectronIpc.test/fixture";
import { createTestSerapack } from "~test/serapack-support/fx/createTestSerapack";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerSerakkiElectronIpcFx Serapack storage", () => {
	it("preserves list, candidate read, and user removal", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;
		const packageId = "serakki-test";
		const serapackBytes = createTestSerapack(undefined, packageId);
		await mkdir(harness.userDataPaths.game.serapacks, {
			recursive: true,
		});
		await writeFile(
			join(harness.userDataPaths.game.serapacks, `${packageId}.serapack`),
			serapackBytes,
		);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.serapackList, event),
		).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					packageId,
					source: "user",
				}),
			]),
		);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.serapackRead, event, packageId),
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
						url: expect.stringMatching(/^serakki:\/\/app\/game\/resource\?/),
					}),
				]),
				source: "user",
			}),
		]);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.serapackRemove, event, packageId),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.serapackRead, event, packageId),
		).resolves.toEqual([]);
	});
});
