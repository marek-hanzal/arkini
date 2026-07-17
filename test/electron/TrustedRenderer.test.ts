import type { BrowserWindow, IpcMainEvent, Session, WebContents, WebFrameMain } from "electron";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createTrustedRendererFx } from "../../electron/main/security/createTrustedRendererFx";

const createWindowHarness = (mainFrameUrl: string) => {
	const listeners = new Map<string, Set<(event: never) => void>>();
	const windowListeners = new Map<string, () => void>();
	const permissionCheckHandlers: Array<unknown> = [];
	const permissionRequestHandlers: Array<unknown> = [];
	let openHandler:
		| (() => {
				action: "deny";
		  })
		| undefined;
	const mainFrameState = {
		url: mainFrameUrl,
	};
	const mainFrame = mainFrameState as WebFrameMain;
	const session = {
		setPermissionCheckHandler: (handler: unknown) => permissionCheckHandlers.push(handler),
		setPermissionRequestHandler: (handler: unknown) => permissionRequestHandlers.push(handler),
	} as unknown as Session;
	const webContents = {
		id: 17,
		isDestroyed: () => false,
		mainFrame,
		session,
		setWindowOpenHandler: (
			handler: () => {
				action: "deny";
			},
		) => {
			openHandler = handler;
		},
		on: (event: string, listener: (event: never) => void) => {
			const current = listeners.get(event) ?? new Set();
			current.add(listener);
			listeners.set(event, current);
			return webContents;
		},
		removeListener: (event: string, listener: (event: never) => void) => {
			listeners.get(event)?.delete(listener);
			return webContents;
		},
	} as unknown as WebContents;
	const window = {
		webContents,
		once: (event: string, listener: () => void) => {
			windowListeners.set(event, listener);
			return window;
		},
	} as unknown as BrowserWindow;
	const emitNavigation = (eventName: string, url: string, isMainFrame: boolean) => {
		const preventDefault = vi.fn();
		const event = {
			url,
			isMainFrame,
			preventDefault,
		};
		for (const listener of listeners.get(eventName) ?? []) {
			listener(event as never);
		}
		return preventDefault;
	};

	return {
		emitNavigation,
		mainFrame,
		setMainFrameUrl: (url: string) => {
			mainFrameState.url = url;
		},
		openHandler: () => openHandler,
		permissionCheckHandlers,
		permissionRequestHandlers,
		webContents,
		window,
		close: () => windowListeners.get("closed")?.(),
	};
};

const createIpcEvent = (webContents: WebContents, senderFrame: WebFrameMain | null): IpcMainEvent =>
	({
		sender: webContents,
		senderFrame,
	}) as IpcMainEvent;

describe("trusted Electron renderer policy", () => {
	it("allows only the packaged Arkini origin in production", async () => {
		const policy = await Effect.runPromise(
			createTrustedRendererFx({
				isPackaged: true,
				developmentRendererUrl: "https://example.com/",
			}),
		);

		expect(policy.isTrustedUrl("arkini://app/")).toBe(true);
		expect(policy.isTrustedUrl("arkini://app/game/arkini?x=1#tile")).toBe(true);
		expect(policy.isTrustedUrl("arkini://other/")).toBe(false);
		expect(policy.isTrustedUrl("https://example.com/")).toBe(false);
		expect(policy.isTrustedUrl("file:///tmp/index.html")).toBe(false);
		expect(policy.isTrustedUrl("data:text/html,Arkini")).toBe(false);
		expect(policy.isTrustedUrl("arkini://user@app/")).toBe(false);
	});

	it("allows only the exact configured development origin", async () => {
		const policy = await Effect.runPromise(
			createTrustedRendererFx({
				isPackaged: false,
				developmentRendererUrl: "http://127.0.0.1:4040/",
			}),
		);

		expect(policy.isTrustedUrl("http://127.0.0.1:4040/game/arkini")).toBe(true);
		expect(policy.isTrustedUrl("http://127.0.0.1:4041/")).toBe(false);
		expect(policy.isTrustedUrl("http://localhost:4040/")).toBe(false);
		expect(policy.isTrustedUrl("https://127.0.0.1:4040/")).toBe(false);
		expect(policy.isTrustedUrl("arkini://app/")).toBe(false);
	});

	it("rejects development URLs outside the exact configured loopback origin", async () => {
		for (const developmentRendererUrl of [
			"http://localhost:4040/",
			"http://127.0.0.1:4041/",
			"http://192.168.1.50:4040/",
			"http://127.0.0.1:4040/game",
		]) {
			await expect(
				Effect.runPromise(
					createTrustedRendererFx({
						isPackaged: false,
						developmentRendererUrl,
					}),
				),
			).rejects.toThrow("configure the trusted Arkini renderer origin");
		}
	});

	it("blocks external navigation, redirects, subframes, webviews, and permissions", async () => {
		const policy = await Effect.runPromise(
			createTrustedRendererFx({
				isPackaged: true,
			}),
		);
		const harness = createWindowHarness("arkini://app/");
		Effect.runSync(policy.registerWindowFx(harness.window));

		expect(
			harness.emitNavigation("will-navigate", "arkini://app/game/arkini", true),
		).not.toHaveBeenCalled();
		expect(
			harness.emitNavigation("will-navigate", "https://example.com/", true),
		).toHaveBeenCalledOnce();
		expect(
			harness.emitNavigation("will-redirect", "file:///tmp/index.html", true),
		).toHaveBeenCalledOnce();
		expect(
			harness.emitNavigation("will-frame-navigate", "arkini://app/", false),
		).toHaveBeenCalledOnce();
		expect(
			harness.emitNavigation("will-attach-webview", "arkini://app/", false),
		).toHaveBeenCalledOnce();
		expect(harness.openHandler()?.()).toEqual({
			action: "deny",
		});

		const permissionCheck = harness.permissionCheckHandlers[0] as () => boolean;
		expect(permissionCheck()).toBe(false);
		const permissionCallback = vi.fn();
		const permissionRequest = harness.permissionRequestHandlers[0] as (
			contents: WebContents,
			permission: string,
			callback: (allowed: boolean) => void,
		) => void;
		permissionRequest(harness.webContents, "media", permissionCallback);
		expect(permissionCallback).toHaveBeenCalledWith(false);
	});

	it("accepts only a registered trusted main frame as an IPC sender", async () => {
		const policy = await Effect.runPromise(
			createTrustedRendererFx({
				isPackaged: true,
			}),
		);
		const harness = createWindowHarness("arkini://app/game/arkini");
		Effect.runSync(policy.registerWindowFx(harness.window));

		expect(
			policy.isTrustedIpcSender(createIpcEvent(harness.webContents, harness.mainFrame)),
		).toBe(true);
		expect(
			policy.isTrustedIpcSender(
				createIpcEvent(harness.webContents, {
					url: "arkini://app/",
				} as WebFrameMain),
			),
		).toBe(false);
		expect(
			policy.isTrustedIpcSender(
				createIpcEvent(
					{
						...harness.webContents,
						id: 99,
					} as WebContents,
					harness.mainFrame,
				),
			),
		).toBe(false);

		harness.setMainFrameUrl("https://example.com/");
		expect(
			policy.isTrustedIpcSender(createIpcEvent(harness.webContents, harness.mainFrame)),
		).toBe(false);
	});

	it("removes destroyed windows from the trusted sender registry", async () => {
		const policy = await Effect.runPromise(
			createTrustedRendererFx({
				isPackaged: true,
			}),
		);
		const harness = createWindowHarness("arkini://app/");
		Effect.runSync(policy.registerWindowFx(harness.window));
		const event = createIpcEvent(harness.webContents, harness.mainFrame);
		expect(policy.isTrustedIpcSender(event)).toBe(true);

		harness.close();
		expect(policy.isTrustedIpcSender(event)).toBe(false);
		expect(harness.permissionCheckHandlers.at(-1)).toBeNull();
		expect(harness.permissionRequestHandlers.at(-1)).toBeNull();
	});
});
