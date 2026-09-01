import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "./registerArkiniElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerArkiniElectronIpcFx preferences", () => {
	it("preserves appearance, cheat, and launcher preference capabilities", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;

		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceRead, event),
		).resolves.toBe("dark");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceWrite, event, "light"),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceRead, event),
		).resolves.toBe("light");
		expect(harness.nativeTheme.themeSource).toBe("light");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceWrite, event, "system"),
		).resolves.toBeUndefined();
		expect(harness.nativeTheme.themeSource).toBe("system");
		harness.nativeTheme.shouldUseDarkColors = false;
		harness.nativeThemeListeners.get("updated")?.();
		expect(harness.setBackgroundColor).toHaveBeenLastCalledWith("#fbf8ff");
		harness.nativeTheme.shouldUseDarkColors = true;
		harness.nativeThemeListeners.get("updated")?.();
		expect(harness.setBackgroundColor).toHaveBeenLastCalledWith("#090711");

		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceAccentRead, event),
		).resolves.toBe("rose");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceAccentWrite, event, "blue"),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.appearanceAccentRead, event),
		).resolves.toBe("blue");

		await expect(
			harness.invoke(ArkiniElectronApi.channels.cheatAvailabilityRead, event),
		).resolves.toBe(false);
		await expect(
			harness.invoke(ArkiniElectronApi.channels.cheatAvailabilityWrite, event, true),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.cheatAvailabilityRead, event),
		).resolves.toBe(true);

		await expect(
			harness.invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead, event),
		).resolves.toBeNull();
		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.launcherLastPackageIdWrite,
				event,
				"package:last",
			),
		).resolves.toBeUndefined();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead, event),
		).resolves.toBe("package:last");

		harness.preferredSystemLanguages.value = [
			"sk-SK",
			"en-US",
		];
		await expect(
			harness.invoke(ArkiniElectronApi.channels.localizationPreferredLanguagesRead, event),
		).resolves.toEqual([
			"sk-SK",
			"en-US",
		]);
	});
});
