import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent, WebContents, WebFrameMain } from "electron";
import { Effect } from "effect";
import { vi } from "vitest";
import { ElectronMainError } from "~electron/main/ElectronMainError";
import type { TrustedRenderer } from "~electron/main/security/TrustedRenderer";
import { readElectronHarness } from "./electron";
import { saveKey } from "./invokeArguments";

export { invokeArguments } from "./invokeArguments";

import { createFilesystemAppearancePreferencesFx } from "~electron/main/appearance/createFilesystemAppearancePreferencesFx";
import { createFilesystemCheatPreferencesFx } from "~electron/main/cheat/createFilesystemCheatPreferencesFx";
import { createFilesystemLauncherPreferencesFx } from "~electron/main/launcher/createFilesystemLauncherPreferencesFx";
import { registerArkiniElectronIpcFx } from "~electron/main/registerArkiniElectronIpcFx";
import { createArkiniUserDataPathsFn } from "~electron/main/user-data/fn/createArkiniUserDataPathsFn";
import { createFilesystemWindowPreferencesFx } from "~electron/main/window/createFilesystemWindowPreferencesFx";
import { createWindowModeControllerOwnershipFx } from "~electron/main/window/createWindowModeControllerOwnershipFx";

const electronHarness = readElectronHarness();

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

const disposers: Array<() => Promise<void>> = [];

export const cleanupRegisteredIpcHarnesses = async () => {
	for (const dispose of disposers.splice(0)) await dispose();
};

export const createRegisteredIpcHarness = async () => {
	vi.clearAllMocks();
	electronHarness.handlers.clear();
	electronHarness.appListeners.clear();
	electronHarness.nativeThemeListeners.clear();
	electronHarness.nativeTheme.shouldUseDarkColors = true;
	electronHarness.nativeTheme.themeSource = "dark";
	electronHarness.writeClipboardText.mockReset();

	const userDataPath = await mkdtemp(join(tmpdir(), "arkini-ipc-"));
	electronHarness.userDataPath.value = userDataPath;
	const userDataPaths = createArkiniUserDataPathsFn(userDataPath);
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
		isTrustedUrlFn: () => true,
		isTrustedIpcSenderFn: () => true,
		assertTrustedIpcSenderFx,
		registerWindowFx: () => Effect.void,
	};
	const writeDiagnostic = vi.fn();
	const openDiagnosticDirectory = vi.fn();

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
			const windowModeControllerOwnership = yield* createWindowModeControllerOwnershipFx();
			yield* windowModeControllerOwnership.attachControllerFx(
				electronHarness.browserWindow as unknown as BrowserWindow,
				{
					requestModeFx: (mode) =>
						windowPreferences
							.writeModeFx(mode)
							.pipe(
								Effect.tap(() =>
									Effect.sync(() => electronHarness.requestWindowMode(mode)),
								),
							),
				},
			);
			yield* registerArkiniElectronIpcFx({
				bundledArkpacksRoot: join(userDataPath, "bundled-arkpacks"),
				trustedRenderer,
				appearancePreferences,
				cheatPreferences,
				launcherPreferences,
				windowModeControllerOwnership,
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

	let disposed = false;
	const dispose = async () => {
		if (disposed) return;
		disposed = true;
		electronHarness.appListeners.get("will-quit")?.();
		await rm(userDataPath, {
			recursive: true,
			force: true,
		});
	};
	disposers.push(dispose);

	return {
		assertTrustedIpcSenderFx,
		dispose,
		handlers: electronHarness.handlers,
		invoke: (channel: string, event: IpcMainInvokeEvent, ...args: ReadonlyArray<unknown>) => {
			const handler = electronHarness.handlers.get(channel);
			if (handler === undefined) throw new Error(`Missing ${channel} handler.`);
			return handler(event, ...args);
		},
		nativeTheme: electronHarness.nativeTheme,
		nativeThemeListeners: electronHarness.nativeThemeListeners,
		openDiagnosticDirectory,
		openPath: electronHarness.openPath,
		requestWindowMode: electronHarness.requestWindowMode,
		saveKey,
		setBackgroundColor: electronHarness.setBackgroundColor,
		trustedEvent: createInvokeEvent("arkini://app/game/arkini"),
		untrustedEvent: createInvokeEvent("https://example.com/"),
		userDataPaths,
		writeDiagnostic,
		writeClipboardText: electronHarness.writeClipboardText,
	};
};
