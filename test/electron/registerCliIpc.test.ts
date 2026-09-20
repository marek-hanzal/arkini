import type { IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import type { Completion } from "~electron/main/cli/createCompletionFx";
import type { Installation } from "~electron/main/cli/createInstallationFx";
import { registerCliIpcFx } from "~electron/main/cli/registerCliIpcFx";
import { ElectronMainError } from "~electron/main/ElectronMainError";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";

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
		const cliCompletion: Completion = {
			readStatusFx: Effect.succeed({
				type: "not-installed",
				completionPath: "/tmp/_serakki-cli",
				shell: "zsh",
			}),
			installFx: Effect.succeed({
				type: "installed",
				completionPath: "/tmp/_serakki-cli",
				shell: "zsh",
			}),
			replaceFx: Effect.succeed({
				type: "installed",
				completionPath: "/tmp/_serakki-cli",
				shell: "zsh",
			}),
			uninstallFx: Effect.succeed({
				type: "not-installed",
				completionPath: "/tmp/_serakki-cli",
				shell: "zsh",
			}),
		};
		const cliInstallation: Installation = {
			readStatusFx: Effect.succeed({
				type: "not-installed",
				commandPath: "/tmp/serakki-cli",
			}),
			installFx: Effect.succeed({
				type: "installed",
				commandPath: "/tmp/serakki-cli",
			}),
			replaceFx: Effect.succeed({
				type: "installed",
				commandPath: "/tmp/serakki-cli",
			}),
			uninstallFx: Effect.succeed({
				type: "not-installed",
				commandPath: "/tmp/serakki-cli",
			}),
		};
		const trustedRenderer: TrustedRenderer = {
			isTrustedUrlFn: () => false,
			isTrustedIpcSenderFn: () => false,
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
			registerCliIpcFx({
				completion: cliCompletion,
				installation: cliInstallation,
				trustedRenderer,
			}),
		);

		for (const channel of [
			SerakkiElectronApi.channels.cliStatus,
			SerakkiElectronApi.channels.cliInstall,
			SerakkiElectronApi.channels.cliReplace,
			SerakkiElectronApi.channels.cliUninstall,
			SerakkiElectronApi.channels.cliCompletionStatus,
			SerakkiElectronApi.channels.cliCompletionInstall,
			SerakkiElectronApi.channels.cliCompletionReplace,
			SerakkiElectronApi.channels.cliCompletionUninstall,
		]) {
			const handler = electron.handlers.get(channel);
			if (handler === undefined) throw new Error(`Missing ${channel}.`);
			await expect(handler({} as IpcMainInvokeEvent)).rejects.toThrow(
				"authorize CLI test renderer",
			);
		}
	});
});
