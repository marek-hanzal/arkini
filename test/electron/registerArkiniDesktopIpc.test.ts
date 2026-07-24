import { NodeContext } from "@effect/platform-node";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IpcMainInvokeEvent, WebContents, WebFrameMain } from "electron";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";

const electronHarness = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
	const appListeners = new Map<string, () => void>();
	const nativeThemeListeners = new Map<string, () => void>();
	const setBackgroundColor = vi.fn();
	const userDataPath = {
		value: "",
	};
	return {
		appListeners,
		handlers,
		nativeThemeListeners,
		setBackgroundColor,
		userDataPath,
		module: {
			app: {
				getPath: () => userDataPath.value,
				once: (event: string, listener: () => void) => {
					appListeners.set(event, listener);
				},
			},
			BrowserWindow: {
				getAllWindows: () => [
					{
						setBackgroundColor,
					},
				],
			},
			ipcMain: {
				handle: (
					channel: string,
					listener: (event: unknown, ...args: unknown[]) => unknown,
				) => handlers.set(channel, listener),
				removeHandler: (channel: string) => handlers.delete(channel),
			},
			nativeTheme: {
				on: (event: string, listener: () => void) => {
					nativeThemeListeners.set(event, listener);
				},
				removeListener: (event: string) => {
					nativeThemeListeners.delete(event);
				},
				shouldUseDarkColors: true,
				themeSource: "dark",
			},
		},
	};
});

vi.mock("electron", () => electronHarness.module);

import { createFilesystemAppearancePreferencesFx } from "../../electron/main/appearance/createFilesystemAppearancePreferencesFx";
import { createFilesystemCheatPreferencesFx } from "../../electron/main/cheat/createFilesystemCheatPreferencesFx";
import { registerArkiniDesktopIpcFx } from "../../electron/main/registerArkiniDesktopIpcFx";

const placeholderPackageId = "a".repeat(64);
const saveKey = {
	packageId: "arkini",
	contentHash: "b".repeat(64),
} as const;
const invokeArguments = new Map<string, ReadonlyArray<unknown>>([
	[
		ArkiniDesktopApi.channels.appearanceRead,
		[],
	],
	[
		ArkiniDesktopApi.channels.appearanceWrite,
		[
			"dark",
		],
	],
	[
		ArkiniDesktopApi.channels.appearanceAccentRead,
		[],
	],
	[
		ArkiniDesktopApi.channels.appearanceAccentWrite,
		[
			"rose",
		],
	],
	[
		ArkiniDesktopApi.channels.cheatAvailabilityRead,
		[],
	],
	[
		ArkiniDesktopApi.channels.cheatAvailabilityWrite,
		[
			false,
		],
	],
	[
		ArkiniDesktopApi.channels.arkpackList,
		[],
	],
	[
		ArkiniDesktopApi.channels.arkpackRead,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniDesktopApi.channels.arkpackInstall,
		[
			{
				descriptor: {
					packageId: placeholderPackageId,
					contentHash: placeholderPackageId,
					gameId: "arkini",
					title: "Arkini",
					configVersion: "1",
					compressedSize: 0,
					trust: {
						type: "external",
						reason: "unsigned",
					} as const,
					source: "imported",
				},
				bytes: new Uint8Array(),
			},
		],
	],
	[
		ArkiniDesktopApi.channels.arkpackRemove,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniDesktopApi.channels.saveRead,
		[
			saveKey,
		],
	],
	[
		ArkiniDesktopApi.channels.saveWrite,
		[
			saveKey,
			new Uint8Array(),
		],
	],
	[
		ArkiniDesktopApi.channels.saveClear,
		[
			saveKey,
		],
	],
]);

const createInvokeEvent = (url: string): IpcMainInvokeEvent => {
	const mainFrame = {
		url,
	} as WebFrameMain;
	const sender = {
		id: 17,
		isDestroyed: () => false,
		mainFrame,
	} as WebContents;
	return {
		sender,
		senderFrame: mainFrame,
	} as IpcMainInvokeEvent;
};

const invoke = (channel: string, event: IpcMainInvokeEvent, ...args: ReadonlyArray<unknown>) => {
	const handler = electronHarness.handlers.get(channel);
	expect(handler).toBeDefined();
	return handler?.(event, ...args);
};

describe("registerArkiniDesktopIpcFx", () => {
	it("rejects every untrusted sender and preserves every trusted desktop capability", async () => {
		const userDataPath = await mkdtemp(join(tmpdir(), "arkini-ipc-"));
		electronHarness.userDataPath.value = userDataPath;
		const assertTrustedIpcSenderFx = vi.fn((event: IpcMainInvokeEvent) =>
			event.senderFrame?.url.startsWith("arkini://app/")
				? Effect.void
				: Effect.fail(
						new ElectronMainError({
							operation: "authorize test renderer",
							cause: event.senderFrame?.url,
						}),
					),
		);
		const trustedRenderer: TrustedRenderer = {
			isTrustedUrl: () => true,
			isTrustedIpcSender: () => true,
			assertTrustedIpcSenderFx,
			registerWindowFx: () => Effect.void,
		};

		try {
			await Effect.runPromise(
				Effect.gen(function* () {
					const appearancePreferences = yield* createFilesystemAppearancePreferencesFx({
						userDataPath,
					});
					const cheatPreferences = yield* createFilesystemCheatPreferencesFx({
						userDataPath,
					});
					yield* registerArkiniDesktopIpcFx({
						trustedRenderer,
						appearancePreferences,
						cheatPreferences,
					});
				}).pipe(Effect.provide(NodeContext.layer)),
			);
			expect(Array.from(electronHarness.handlers.keys()).sort()).toEqual(
				Array.from(invokeArguments.keys()).sort(),
			);

			const untrustedEvent = createInvokeEvent("https://example.com/");
			for (const [channel, args] of invokeArguments) {
				await expect(invoke(channel, untrustedEvent, ...args)).rejects.toThrow(
					"authorize test renderer",
				);
			}
			expect(assertTrustedIpcSenderFx).toHaveBeenCalledTimes(invokeArguments.size);

			const trustedEvent = createInvokeEvent("arkini://app/game/arkini");
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceRead, trustedEvent),
			).resolves.toBe("dark");
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceWrite, trustedEvent, "light"),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceRead, trustedEvent),
			).resolves.toBe("light");
			expect(electronHarness.module.nativeTheme.themeSource).toBe("light");
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceWrite, trustedEvent, "system"),
			).resolves.toBeUndefined();
			expect(electronHarness.module.nativeTheme.themeSource).toBe("system");
			electronHarness.module.nativeTheme.shouldUseDarkColors = false;
			electronHarness.nativeThemeListeners.get("updated")?.();
			expect(electronHarness.setBackgroundColor).toHaveBeenLastCalledWith("#fbf8ff");
			electronHarness.module.nativeTheme.shouldUseDarkColors = true;
			electronHarness.nativeThemeListeners.get("updated")?.();
			expect(electronHarness.setBackgroundColor).toHaveBeenLastCalledWith("#090711");
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceAccentRead, trustedEvent),
			).resolves.toBe("rose");
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceAccentWrite, trustedEvent, "blue"),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.appearanceAccentRead, trustedEvent),
			).resolves.toBe("blue");
			await expect(
				invoke(ArkiniDesktopApi.channels.cheatAvailabilityRead, trustedEvent),
			).resolves.toBe(false);
			await expect(
				invoke(ArkiniDesktopApi.channels.cheatAvailabilityWrite, trustedEvent, true),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.cheatAvailabilityRead, trustedEvent),
			).resolves.toBe(true);

			const arkpackBytes = new Uint8Array([
				1,
				2,
				3,
				4,
			]);
			const packageId = createHash("sha256").update(arkpackBytes).digest("hex");
			const record: ArkiniDesktopApi.ArkpackRecord = {
				descriptor: {
					packageId,
					contentHash: packageId,
					gameId: "arkini-test",
					title: "Arkini test",
					configVersion: "1",
					compressedSize: arkpackBytes.byteLength,
					trust: {
						type: "external",
						reason: "unsigned",
					} as const,
					source: "imported",
				},
				bytes: arkpackBytes,
			};
			await expect(
				invoke(ArkiniDesktopApi.channels.arkpackInstall, trustedEvent, record),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.arkpackList, trustedEvent),
			).resolves.toEqual([
				record.descriptor,
			]);
			await expect(
				invoke(ArkiniDesktopApi.channels.arkpackRead, trustedEvent, packageId),
			).resolves.toEqual(record);
			await expect(
				invoke(ArkiniDesktopApi.channels.arkpackRemove, trustedEvent, packageId),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.arkpackRead, trustedEvent, packageId),
			).resolves.toBeNull();

			const saveBytes = new Uint8Array([
				5,
				6,
				7,
			]);
			await expect(
				invoke(ArkiniDesktopApi.channels.saveWrite, trustedEvent, saveKey, saveBytes),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.saveRead, trustedEvent, saveKey),
			).resolves.toEqual(saveBytes);
			await expect(
				invoke(ArkiniDesktopApi.channels.saveClear, trustedEvent, saveKey),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniDesktopApi.channels.saveRead, trustedEvent, saveKey),
			).resolves.toBeNull();
		} finally {
			electronHarness.appListeners.get("will-quit")?.();
			await rm(userDataPath, {
				recursive: true,
				force: true,
			});
		}
		expect(electronHarness.handlers.size).toBe(0);
	});
});
