import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "./registerSerakkiElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerSerakkiElectronIpcFx preferences", () => {
	it("preserves accent, cheat, and launcher preference capabilities", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;

		await expect(
			harness.invoke(SerakkiElectronApi.channels.appearanceAccentRead, event),
		).resolves.toBe("rose");
		await expect(
			harness.invoke(SerakkiElectronApi.channels.appearanceAccentWrite, event, "blue"),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.appearanceAccentRead, event),
		).resolves.toBe("blue");

		await expect(
			harness.invoke(SerakkiElectronApi.channels.cheatAvailabilityRead, event),
		).resolves.toBe(false);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.cheatAvailabilityWrite, event, true),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.cheatAvailabilityRead, event),
		).resolves.toBe(true);

		await expect(
			harness.invoke(SerakkiElectronApi.channels.launcherLastPackageIdRead, event),
		).resolves.toBeNull();
		await expect(
			harness.invoke(
				SerakkiElectronApi.channels.launcherLastPackageIdWrite,
				event,
				"package:last",
			),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.launcherLastPackageIdRead, event),
		).resolves.toBe("package:last");

		harness.preferredSystemLanguages.value = [
			"sk-SK",
			"en-US",
		];
		await expect(
			harness.invoke(SerakkiElectronApi.channels.localizationPreferredLanguagesRead, event),
		).resolves.toEqual([
			"sk-SK",
			"en-US",
		]);
	});
});
