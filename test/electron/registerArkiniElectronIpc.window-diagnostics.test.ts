import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "./registerArkiniElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerArkiniElectronIpcFx native presentation", () => {
	it("preserves confirmed window mode and bounded directory capabilities", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;

		await expect(
			harness.invoke(ArkiniElectronApi.channels.windowModeRead, event),
		).resolves.toBe("default");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.windowModeWrite, event, "fullscreen"),
		).resolves.toBeUndefined();
		expect(harness.requestWindowMode).toHaveBeenCalledWith("fullscreen");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.windowModeRead, event),
		).resolves.toBe("fullscreen");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.windowModeWrite, event, "bordered"),
		).resolves.toBeUndefined();
		expect(harness.requestWindowMode).toHaveBeenCalledWith("bordered");
		await expect(
			harness.invoke(ArkiniElectronApi.channels.windowModeWrite, event, "floating"),
		).rejects.toThrow();

		const diagnosticRecord = {
			level: "info",
			category: [
				"game",
				"test",
			],
			event: "trusted-record",
		} as const;
		await expect(
			harness.invoke(ArkiniElectronApi.channels.diagnosticsWrite, event, diagnosticRecord),
		).resolves.toBeUndefined();
		expect(harness.writeDiagnostic).toHaveBeenCalledWith(diagnosticRecord);
		const applicationRecord = {
			level: "error",
			message: "Renderer failed",
			body: "Route: /editor",
		} as const;
		await expect(
			harness.invoke(
				ArkiniElectronApi.channels.diagnosticsWriteApplication,
				event,
				applicationRecord,
			),
		).resolves.toBeUndefined();
		expect(harness.writeApplicationLog).toHaveBeenCalledWith(applicationRecord);
		await expect(
			harness.invoke(ArkiniElectronApi.channels.diagnosticsOpenDirectory, event),
		).resolves.toBeUndefined();
		expect(harness.openDiagnosticDirectory).toHaveBeenCalledOnce();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.userDataOpenDirectory, event),
		).resolves.toBeUndefined();
		expect(harness.openPath).toHaveBeenCalledWith(harness.userDataPaths.root);
		await expect(
			harness.invoke(ArkiniElectronApi.channels.arkpackOpenUserDirectory, event),
		).resolves.toBeUndefined();
		expect(harness.openPath).toHaveBeenCalledWith(harness.userDataPaths.game.arkpacks);
		await expect(
			harness.invoke(ArkiniElectronApi.channels.diagnosticsWrite, event, {
				...diagnosticRecord,
				event: "",
			}),
		).rejects.toThrow();
		await expect(
			harness.invoke(ArkiniElectronApi.channels.diagnosticsWriteApplication, event, {
				...applicationRecord,
				message: "invalid\nheading",
			}),
		).rejects.toThrow();
	});
});
