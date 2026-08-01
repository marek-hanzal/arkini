import { NodeServices } from "@effect/platform-node";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent, WebContents, WebFrameMain } from "electron";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "../../electron/main/ElectronMainError";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";

const electronHarness = vi.hoisted(() => {
	const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
	const appListeners = new Map<string, () => void>();
	const nativeThemeListeners = new Map<string, () => void>();
	const setBackgroundColor = vi.fn();
	const requestWindowMode = vi.fn();
	const openPath = vi.fn(() => Promise.resolve(""));
	const browserWindow = {
		once: vi.fn(),
	};
	const userDataPath = {
		value: "",
	};
	return {
		appListeners,
		handlers,
		nativeThemeListeners,
		setBackgroundColor,
		requestWindowMode,
		openPath,
		browserWindow,
		userDataPath,
		module: {
			app: {
				getPath: () => userDataPath.value,
				once: (event: string, listener: () => void) => {
					appListeners.set(event, listener);
				},
			},
			BrowserWindow: {
				fromWebContents: () => browserWindow,
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
			shell: {
				openPath,
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
import { createFilesystemLauncherPreferencesFx } from "../../electron/main/launcher/createFilesystemLauncherPreferencesFx";
import { registerArkiniElectronIpcFx } from "../../electron/main/registerArkiniElectronIpcFx";
import { createArkiniUserDataPathsFx } from "../../electron/main/user-data/createArkiniUserDataPathsFx";
import { createFilesystemWindowPreferencesFx } from "../../electron/main/window/createFilesystemWindowPreferencesFx";
import { registerWindowModeControllerFx } from "../../electron/main/window/WindowModeControllerRegistry";

const placeholderPackageId = "a".repeat(64);
const saveKey = {
	packageId: "arkini",
	contentHash: "b".repeat(64),
} as const;
const editorManifest = {
	projectId: "editor-test",
	title: "Editor test",
	game: "1.0",
	createdAtMs: 100,
	updatedAtMs: 100,
} as const;
const editorManifestFile = {
	path: "editor.json",
	bytes: new TextEncoder().encode(`${JSON.stringify(editorManifest)}\n`),
};
const invokeArguments = new Map<string, ReadonlyArray<unknown>>([
	[
		ArkiniElectronApi.channels.appearanceRead,
		[],
	],
	[
		ArkiniElectronApi.channels.appearanceWrite,
		[
			"dark",
		],
	],
	[
		ArkiniElectronApi.channels.appearanceAccentRead,
		[],
	],
	[
		ArkiniElectronApi.channels.appearanceAccentWrite,
		[
			"rose",
		],
	],
	[
		ArkiniElectronApi.channels.cheatAvailabilityRead,
		[],
	],
	[
		ArkiniElectronApi.channels.cheatAvailabilityWrite,
		[
			false,
		],
	],
	[
		ArkiniElectronApi.channels.launcherLastPackageIdRead,
		[],
	],
	[
		ArkiniElectronApi.channels.launcherLastPackageIdWrite,
		[
			"arkini",
		],
	],
	[
		ArkiniElectronApi.channels.windowModeRead,
		[],
	],
	[
		ArkiniElectronApi.channels.windowModeWrite,
		[
			"fullscreen",
		],
	],
	[
		ArkiniElectronApi.channels.arkpackList,
		[],
	],
	[
		ArkiniElectronApi.channels.arkpackRead,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniElectronApi.channels.arkpackInstall,
		[
			{
				descriptor: {
					packageId: placeholderPackageId,
					hash: placeholderPackageId,
					gameId: "arkini",
					title: "Arkini",
					game: "1",
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
		ArkiniElectronApi.channels.arkpackRemove,
		[
			placeholderPackageId,
		],
	],
	[
		ArkiniElectronApi.channels.editorProjectList,
		[],
	],
	[
		ArkiniElectronApi.channels.editorProjectCreate,
		[
			{
				projectId: "editor-test",
				files: [
					editorManifestFile,
					{
						path: "game.json",
						bytes: new Uint8Array([
							123,
							125,
						]),
					},
				],
			},
		],
	],
	[
		ArkiniElectronApi.channels.editorProjectRead,
		[
			"editor-test",
		],
	],
	[
		ArkiniElectronApi.channels.editorProjectWrite,
		[
			{
				projectId: "editor-test",
				expectedRevision: "0".repeat(64),
				mode: "create",
				file: {
					path: "simple/water.json",
					bytes: new TextEncoder().encode("{}"),
				},
			},
		],
	],
	[
		ArkiniElectronApi.channels.editorDirectoryOpen,
		[],
	],
	[
		ArkiniElectronApi.channels.saveRead,
		[
			saveKey,
		],
	],
	[
		ArkiniElectronApi.channels.saveWrite,
		[
			saveKey,
			new Uint8Array(),
		],
	],
	[
		ArkiniElectronApi.channels.saveClear,
		[
			saveKey,
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsWrite,
		[
			{
				schemaVersion: 1,
				level: "info",
				category: [
					"test",
				],
				event: "ipc-tested",
			},
		],
	],
	[
		ArkiniElectronApi.channels.diagnosticsOpenDirectory,
		[],
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

describe("registerArkiniElectronIpcFx", () => {
	it("rejects every untrusted sender and preserves every trusted Electron capability", async () => {
		const userDataPath = await mkdtemp(join(tmpdir(), "arkini-ipc-"));
		electronHarness.userDataPath.value = userDataPath;
		const userDataPaths = Effect.runSync(createArkiniUserDataPathsFx(userDataPath));
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
		const writeDiagnostic = vi.fn();
		const openDiagnosticDirectory = vi.fn();

		try {
			await Effect.runPromise(
				Effect.gen(function* () {
					const appearancePreferences = yield* createFilesystemAppearancePreferencesFx({
						root: userDataPaths.game.preferences,
					});
					const cheatPreferences = yield* createFilesystemCheatPreferencesFx({
						root: userDataPaths.game.preferences,
					});
					const launcherPreferences = yield* createFilesystemLauncherPreferencesFx({
						root: userDataPaths.game.preferences,
					});
					const windowPreferences = yield* createFilesystemWindowPreferencesFx({
						root: userDataPaths.game.preferences,
					});
					yield* registerWindowModeControllerFx({
						window: electronHarness.browserWindow as unknown as BrowserWindow,
						controller: {
							requestModeFx: (mode) =>
								windowPreferences
									.writeModeFx(mode)
									.pipe(
										Effect.tap(() =>
											Effect.sync(() =>
												electronHarness.requestWindowMode(mode),
											),
										),
									),
						},
					});
					yield* registerArkiniElectronIpcFx({
						trustedRenderer,
						appearancePreferences,
						cheatPreferences,
						launcherPreferences,
						windowPreferences,
						diagnostics: {
							directoryPath: userDataPaths.game.logs,
							writeFx: (record) => Effect.sync(() => writeDiagnostic(record)),
							openDirectoryFx: Effect.sync(openDiagnosticDirectory),
							closeFx: Effect.void,
						},
						userDataPaths,
					});
				}).pipe(Effect.provide(NodeServices.layer)),
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
				invoke(ArkiniElectronApi.channels.appearanceRead, trustedEvent),
			).resolves.toBe("dark");
			await expect(
				invoke(ArkiniElectronApi.channels.appearanceWrite, trustedEvent, "light"),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.appearanceRead, trustedEvent),
			).resolves.toBe("light");
			expect(electronHarness.module.nativeTheme.themeSource).toBe("light");
			await expect(
				invoke(ArkiniElectronApi.channels.appearanceWrite, trustedEvent, "system"),
			).resolves.toBeUndefined();
			expect(electronHarness.module.nativeTheme.themeSource).toBe("system");
			electronHarness.module.nativeTheme.shouldUseDarkColors = false;
			electronHarness.nativeThemeListeners.get("updated")?.();
			expect(electronHarness.setBackgroundColor).toHaveBeenLastCalledWith("#fbf8ff");
			electronHarness.module.nativeTheme.shouldUseDarkColors = true;
			electronHarness.nativeThemeListeners.get("updated")?.();
			expect(electronHarness.setBackgroundColor).toHaveBeenLastCalledWith("#090711");
			await expect(
				invoke(ArkiniElectronApi.channels.appearanceAccentRead, trustedEvent),
			).resolves.toBe("rose");
			await expect(
				invoke(ArkiniElectronApi.channels.appearanceAccentWrite, trustedEvent, "blue"),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.appearanceAccentRead, trustedEvent),
			).resolves.toBe("blue");
			await expect(
				invoke(ArkiniElectronApi.channels.cheatAvailabilityRead, trustedEvent),
			).resolves.toBe(false);
			await expect(
				invoke(ArkiniElectronApi.channels.cheatAvailabilityWrite, trustedEvent, true),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.cheatAvailabilityRead, trustedEvent),
			).resolves.toBe(true);
			await expect(
				invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead, trustedEvent),
			).resolves.toBeNull();
			await expect(
				invoke(
					ArkiniElectronApi.channels.launcherLastPackageIdWrite,
					trustedEvent,
					"package:last",
				),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead, trustedEvent),
			).resolves.toBe("package:last");
			await expect(
				invoke(ArkiniElectronApi.channels.windowModeRead, trustedEvent),
			).resolves.toBe("default");
			await expect(
				invoke(ArkiniElectronApi.channels.windowModeWrite, trustedEvent, "fullscreen"),
			).resolves.toBeUndefined();
			expect(electronHarness.requestWindowMode).toHaveBeenCalledWith("fullscreen");
			await expect(
				invoke(ArkiniElectronApi.channels.windowModeRead, trustedEvent),
			).resolves.toBe("fullscreen");
			await expect(
				invoke(ArkiniElectronApi.channels.windowModeWrite, trustedEvent, "bordered"),
			).resolves.toBeUndefined();
			expect(electronHarness.requestWindowMode).toHaveBeenCalledWith("bordered");
			await expect(
				invoke(ArkiniElectronApi.channels.windowModeWrite, trustedEvent, "floating"),
			).rejects.toThrow();
			const diagnosticRecord = {
				schemaVersion: 1,
				level: "info",
				category: [
					"game",
					"test",
				],
				event: "trusted-record",
			} as const;
			await expect(
				invoke(ArkiniElectronApi.channels.diagnosticsWrite, trustedEvent, diagnosticRecord),
			).resolves.toBeUndefined();
			expect(writeDiagnostic).toHaveBeenCalledWith(diagnosticRecord);
			await expect(
				invoke(ArkiniElectronApi.channels.diagnosticsOpenDirectory, trustedEvent),
			).resolves.toBeUndefined();
			expect(openDiagnosticDirectory).toHaveBeenCalledOnce();
			await expect(
				invoke(ArkiniElectronApi.channels.diagnosticsWrite, trustedEvent, {
					...diagnosticRecord,
					event: "",
				}),
			).rejects.toThrow();

			const arkpackBytes = new Uint8Array([
				1,
				2,
				3,
				4,
			]);
			const packageId = createHash("sha256").update(arkpackBytes).digest("hex");
			const record: ArkiniElectronApi.ArkpackRecord = {
				descriptor: {
					packageId,
					hash: packageId,
					gameId: "arkini-test",
					title: "Arkini test",
					game: "1",
					trust: {
						type: "external",
						reason: "unsigned",
					} as const,
					source: "imported",
				},
				bytes: arkpackBytes,
			};
			await expect(
				invoke(ArkiniElectronApi.channels.arkpackInstall, trustedEvent, record),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.arkpackList, trustedEvent),
			).resolves.toEqual([
				record.descriptor,
			]);
			await expect(
				invoke(ArkiniElectronApi.channels.arkpackRead, trustedEvent, packageId),
			).resolves.toEqual(record);
			await expect(
				invoke(ArkiniElectronApi.channels.arkpackRemove, trustedEvent, packageId),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.arkpackRead, trustedEvent, packageId),
			).resolves.toBeNull();

			const editorRecord = {
				projectId: "editor-test",
				files: [
					editorManifestFile,
					{
						path: "game.json",
						bytes: new Uint8Array([
							123,
							125,
						]),
					},
				],
			};
			await expect(
				invoke(ArkiniElectronApi.channels.editorProjectCreate, trustedEvent, editorRecord),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.editorProjectList, trustedEvent),
			).resolves.toEqual([
				editorManifest,
			]);
			const readEditorRecord = (await invoke(
				ArkiniElectronApi.channels.editorProjectRead,
				trustedEvent,
				"editor-test",
			)) as typeof editorRecord & {
				readonly revision: string;
			};
			expect(readEditorRecord).toEqual({
				...editorRecord,
				revision: expect.stringMatching(/^[a-f0-9]{64}$/),
			});
			await expect(
				invoke(ArkiniElectronApi.channels.editorProjectWrite, trustedEvent, {
					projectId: "editor-test",
					expectedRevision: readEditorRecord.revision,
					mode: "create",
					file: {
						path: "simple/water.json",
						bytes: new TextEncoder().encode("{}"),
					},
				}),
			).resolves.toEqual(
				expect.objectContaining({
					projectId: "editor-test",
					revision: expect.stringMatching(/^[a-f0-9]{64}$/),
					file: expect.objectContaining({
						path: "simple/water.json",
					}),
					manifest: expect.objectContaining({
						path: "editor.json",
					}),
				}),
			);
			await expect(
				invoke(ArkiniElectronApi.channels.editorDirectoryOpen, trustedEvent),
			).resolves.toBeUndefined();
			expect(electronHarness.openPath).toHaveBeenCalledWith(userDataPaths.editor);

			const saveBytes = new Uint8Array([
				5,
				6,
				7,
			]);
			await expect(
				invoke(ArkiniElectronApi.channels.saveWrite, trustedEvent, saveKey, saveBytes),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.saveRead, trustedEvent, saveKey),
			).resolves.toEqual(saveBytes);
			await expect(
				invoke(ArkiniElectronApi.channels.saveClear, trustedEvent, saveKey),
			).resolves.toBeUndefined();
			await expect(
				invoke(ArkiniElectronApi.channels.saveRead, trustedEvent, saveKey),
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
