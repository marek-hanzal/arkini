import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { afterEach, describe, expect, it } from "vitest";
import {
	cleanupRegisteredIpcHarnesses,
	createRegisteredIpcHarness,
} from "./registerSerakkiElectronIpc.test/fixture";

afterEach(cleanupRegisteredIpcHarnesses);

describe("registerSerakkiElectronIpcFx native presentation", () => {
	it("only trusted renderers can request the destructive restart", async () => {
		const harness = await createRegisteredIpcHarness();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.userDataHardReset, harness.untrustedEvent),
		).rejects.toThrow();
		expect(harness.relaunch).not.toHaveBeenCalled();
		expect(harness.exit).not.toHaveBeenCalled();
		await harness.invoke(
			SerakkiElectronApi.channels.userDataHardReset,
			harness.trustedEvent,
			"/untrusted-path",
		);
		expect(harness.relaunch).toHaveBeenCalledWith({
			args: [
				...process.argv.slice(1),
				"--serakki-hard-reset",
			],
		});
		expect(harness.exit).toHaveBeenCalledWith(0);
	});

	it("preserves confirmed window mode and bounded directory capabilities", async () => {
		const harness = await createRegisteredIpcHarness();
		const event = harness.trustedEvent;

		await expect(
			harness.invoke(SerakkiElectronApi.channels.windowModeRead, event),
		).resolves.toBe("default");
		await expect(
			harness.invoke(SerakkiElectronApi.channels.windowModeWrite, event, "fullscreen"),
		).resolves.toBeUndefined();
		expect(harness.requestWindowMode).toHaveBeenCalledWith("fullscreen");
		await expect(
			harness.invoke(SerakkiElectronApi.channels.windowModeRead, event),
		).resolves.toBe("fullscreen");
		await expect(
			harness.invoke(SerakkiElectronApi.channels.windowModeWrite, event, "bordered"),
		).resolves.toBeUndefined();
		expect(harness.requestWindowMode).toHaveBeenCalledWith("bordered");
		await expect(
			harness.invoke(SerakkiElectronApi.channels.windowModeWrite, event, "floating"),
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
			harness.invoke(SerakkiElectronApi.channels.diagnosticsWrite, event, diagnosticRecord),
		).resolves.toBeUndefined();
		expect(harness.writeDiagnostic).toHaveBeenCalledWith(diagnosticRecord);
		const applicationRecord = {
			level: "error",
			message: "Renderer failed",
			body: "Route: /editor",
		} as const;
		await expect(
			harness.invoke(
				SerakkiElectronApi.channels.diagnosticsWriteApplication,
				event,
				applicationRecord,
			),
		).resolves.toBeUndefined();
		expect(harness.writeApplicationLog).toHaveBeenCalledWith(applicationRecord);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.diagnosticsOpenDirectory, event),
		).resolves.toBeUndefined();
		expect(harness.openDiagnosticDirectory).toHaveBeenCalledOnce();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.userDataOpenDirectory, event),
		).resolves.toBeUndefined();
		expect(harness.openPath).toHaveBeenCalledWith(harness.userDataPaths.root);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.serapackOpenUserDirectory, event),
		).resolves.toBeUndefined();
		expect(harness.openPath).toHaveBeenCalledWith(harness.userDataPaths.game.serapacks);
		await expect(
			harness.invoke(SerakkiElectronApi.channels.diagnosticsWrite, event, {
				...diagnosticRecord,
				event: "",
			}),
		).rejects.toThrow();
		await expect(
			harness.invoke(SerakkiElectronApi.channels.diagnosticsWriteApplication, event, {
				...applicationRecord,
				message: "invalid\nheading",
			}),
		).rejects.toThrow();
	});
});
