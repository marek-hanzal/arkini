import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";

const electron = vi.hoisted(() => {
	const app = {
		once: vi.fn(),
	};
	const handlers = new Map<string, (...args: Array<never>) => unknown>();
	let owner: BrowserWindow | null = null;
	return {
		app,
		handlers,
		ipcMain: {
			handle: vi.fn((channel: string, handler: (...args: Array<never>) => unknown) => {
				handlers.set(channel, handler);
			}),
			removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
		},
		BrowserWindow: {
			fromWebContents: vi.fn(() => owner),
		},
		setOwner: (window: BrowserWindow) => {
			owner = window;
		},
	};
});

vi.mock("electron", () => electron);

import { createChatGptViewControllerOwnershipFx } from "../../electron/main/chatgpt/createChatGptViewControllerOwnershipFx";
import { registerChatGptIpcFx } from "../../electron/main/chatgpt/registerChatGptIpcFx";
import { registerChatGptViewControllerFx } from "../../electron/main/chatgpt/registerChatGptViewControllerFx";
import type { TrustedRenderer } from "../../electron/main/security/TrustedRenderer";

describe("ChatGPT surface IPC", () => {
	it("admits only a trusted Arkini sender and never grants repository IPC to the foreign view", async () => {
		const setSurfaceFx = vi.fn(() => Effect.void);
		const window = {
			once: vi.fn(),
		} as unknown as BrowserWindow;
		electron.setOwner(window);
		const ownership = Effect.runSync(createChatGptViewControllerOwnershipFx());
		Effect.runSync(
			registerChatGptViewControllerFx({
				controller: {
					setSurfaceFx,
				},
				ownership,
				window,
			}),
		);
		let trusted = false;
		const trustedRenderer = {
			assertTrustedIpcSenderFx: () =>
				trusted ? Effect.void : Effect.fail(new Error("Untrusted Electron IPC sender.")),
		} as unknown as TrustedRenderer;
		Effect.runSync(
			registerChatGptIpcFx({
				ownership,
				trustedRenderer,
			}),
		);
		const handler = electron.handlers.get(ArkiniElectronApi.channels.chatGptSurfaceSet);
		if (handler === undefined) throw new Error("Expected ChatGPT IPC handler.");
		const event = {
			sender: {},
		} as IpcMainInvokeEvent;
		const surface = {
			projectId: "project-one",
			bounds: {
				x: 64,
				y: 0,
				width: 800,
				height: 600,
			},
		};

		await expect(handler(event as never, surface as never)).rejects.toThrow(
			"Untrusted Electron IPC sender",
		);
		expect(setSurfaceFx).not.toHaveBeenCalled();
		trusted = true;
		await expect(handler(event as never, surface as never)).resolves.toBeUndefined();
		expect(setSurfaceFx).toHaveBeenCalledExactlyOnceWith(surface);
	});
});
