import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import type { CliInstallation } from "../../electron/main/cli/CliInstallation";
import { registerCliInstallationIpcFx } from "../../electron/main/cli/registerCliInstallationIpcFx";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";

const electron = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown) => unknown>();
	let willQuit: (() => void) | undefined;
	return {
		handlers,
		module: {
			app: {
				once: (_event: string, listener: () => void) => {
					willQuit = listener;
				},
			},
			ipcMain: {
				handle: (channel: string, listener: (event: unknown) => unknown) =>
					handlers.set(channel, listener),
				removeHandler: (channel: string) => handlers.delete(channel),
			},
		},
		reset: () => {
			willQuit?.();
			willQuit = undefined;
			handlers.clear();
		},
	};
});

vi.mock("electron", () => electron.module);

afterEach(() => electron.reset());

describe("CLI installation IPC", () => {
	it("keeps every filesystem mutation behind the trusted renderer boundary", async () => {
		const cliInstallation: CliInstallation = {
			readStatusFx: Effect.succeed({
				type: "not-installed",
				commandPath: "/tmp/arkini-cli",
			}),
			installFx: Effect.succeed({
				type: "installed",
				commandPath: "/tmp/arkini-cli",
			}),
			uninstallFx: Effect.succeed({
				type: "not-installed",
				commandPath: "/tmp/arkini-cli",
			}),
		};
		const trustedRenderer: TrustedRenderer = {
			isTrustedUrl: () => false,
			isTrustedIpcSender: () => false,
			assertTrustedIpcSenderFx: () =>
				Effect.fail(
					new ElectronMainError({
						operation: "authorize CLI test renderer",
						cause: "untrusted",
					}),
				),
			registerWindowFx: () => Effect.void,
		};
		Effect.runSync(
			registerCliInstallationIpcFx({
				cliInstallation,
				trustedRenderer,
			}),
		);

		for (const channel of [
			ArkiniElectronApi.channels.cliStatus,
			ArkiniElectronApi.channels.cliInstall,
			ArkiniElectronApi.channels.cliUninstall,
		]) {
			const handler = electron.handlers.get(channel);
			if (handler === undefined) throw new Error(`Missing ${channel}.`);
			await expect(handler({} as IpcMainInvokeEvent)).rejects.toThrow(
				"authorize CLI test renderer",
			);
		}
	});
});
