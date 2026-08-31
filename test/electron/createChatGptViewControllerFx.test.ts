import { access, writeFile } from "node:fs/promises";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ChatGptAssetCandidateMaxBytes } from "~electron/contract/chatgpt/ChatGptSurfaceSchema";
import {
	chatGptElectronState,
	createDownload,
	createWindowHarness,
	TestWebContents,
} from "./createChatGptViewControllerFx.test/fixture";

vi.mock("electron", async () => {
	const { TestWebContentsView: WebContentsView } = await import(
		"./createChatGptViewControllerFx.test/fixture"
	);
	return {
		WebContentsView,
	};
});

import { createChatGptViewControllerFx } from "~electron/main/chatgpt/createChatGptViewControllerFx";

beforeEach(() => {
	chatGptElectronState.views.length = 0;
});

const attachSurface = async () => {
	const harness = createWindowHarness();
	const controller = await Effect.runPromise(createChatGptViewControllerFx(harness.window));
	await Effect.runPromise(
		controller.setSurfaceFx({
			projectId: "project-one",
			bounds: {
				x: 700,
				y: 550,
				width: 500,
				height: 500,
			},
		}),
	);
	const view = chatGptElectronState.views[0];
	if (view === undefined) throw new Error("Expected ChatGPT view.");
	expect(harness.contentView.addChildView).not.toHaveBeenCalled();
	view.webContents.emit("dom-ready");
	return {
		controller,
		harness,
		view,
	};
};

describe("ChatGPT WebContentsView controller", () => {
	it("keeps one sandboxed view alive while enforcing bounds, navigation and close ownership", async () => {
		const { controller, harness, view } = await attachSurface();
		expect(view.options).toEqual({
			webPreferences: {
				partition: "persist:arkini-chatgpt",
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
				navigateOnDragDrop: false,
			},
		});
		expect(harness.contentView.addChildView).toHaveBeenCalledExactlyOnceWith(view);
		expect(view.setBounds).toHaveBeenCalledWith({
			x: 700,
			y: 550,
			width: 100,
			height: 50,
		});

		const contents = view.webContents as unknown as TestWebContents;
		const removalsBeforeSubframe = harness.contentView.removeChildView.mock.calls.length;
		contents.emit("did-start-navigation", {}, "https://cdn.example.com/frame", false, false);
		expect(harness.contentView.removeChildView).toHaveBeenCalledTimes(removalsBeforeSubframe);
		const attachmentsBeforeAbort = harness.contentView.addChildView.mock.calls.length;
		contents.emit("did-start-navigation", {}, "https://example.com/aborted", false, true);
		const admittedAfterDetach = {
			isMainFrame: true,
			url: "https://example.com/aborted",
			preventDefault: vi.fn(),
		};
		contents.emit("will-navigate", admittedAfterDetach);
		expect(admittedAfterDetach.preventDefault).not.toHaveBeenCalled();
		contents.setCurrentUrl("https://chatgpt.com/auth/login");
		contents.emit("did-fail-load", {}, -3, "ERR_ABORTED", "", true);
		expect(harness.contentView.addChildView).toHaveBeenCalledTimes(attachmentsBeforeAbort + 1);
		const openHandler = vi.mocked(contents.setWindowOpenHandler).mock.calls[0]?.[0];
		const loadsBeforePopup = contents.loadURL.mock.calls.length;
		expect(
			openHandler?.({
				url: "https://appleid.apple.com/auth/authorize",
			} as never),
		).toEqual({
			action: "deny",
		});
		expect(contents.loadURL).toHaveBeenCalledTimes(loadsBeforePopup);
		await vi.waitFor(() =>
			expect(contents.loadURL).toHaveBeenLastCalledWith(
				"https://appleid.apple.com/auth/authorize",
			),
		);
		contents.setCurrentUrl("https://chatgpt.com/auth/login");
		await Effect.runPromise(controller.setSurfaceFx(null));
		contents.setLoadingMainFrame(true);
		await Effect.runPromise(
			controller.setSurfaceFx({
				projectId: "project-one",
				bounds: {
					x: 0,
					y: 0,
					width: 500,
					height: 350,
				},
			}),
		);
		expect(contents.loadURL).toHaveBeenLastCalledWith("https://chatgpt.com/");
		const attachmentsBeforeStaleAbort = harness.contentView.addChildView.mock.calls.length;
		contents.emit("did-fail-load", {}, -3, "ERR_ABORTED", "", true);
		expect(harness.contentView.addChildView).toHaveBeenCalledTimes(attachmentsBeforeStaleAbort);
		contents.setLoadingMainFrame(false);
		contents.emit("dom-ready");
		const loadsBeforeSecondPopup = contents.loadURL.mock.calls.length;
		openHandler?.({
			url: "https://appleid.apple.com/auth/authorize",
		} as never);
		await vi.waitFor(() =>
			expect(contents.loadURL).toHaveBeenCalledTimes(loadsBeforeSecondPopup + 1),
		);
		contents.emit("dom-ready");
		const external = {
			isMainFrame: true,
			url: "https://example.com/",
			preventDefault: vi.fn(),
		};
		contents.emit("will-navigate", external);
		expect(external.preventDefault).not.toHaveBeenCalled();
		const local = {
			isMainFrame: true,
			url: "file:///tmp/private",
			preventDefault: vi.fn(),
		};
		contents.emit("will-redirect", local);
		expect(local.preventDefault).toHaveBeenCalledOnce();
		const subresource = {
			isMainFrame: false,
			url: "https://cdn.example.com/script.js",
			preventDefault: vi.fn(),
		};
		contents.emit("will-frame-navigate", subresource);
		expect(subresource.preventDefault).not.toHaveBeenCalled();
		const localSubframe = {
			isMainFrame: false,
			url: "file:///tmp/private-frame",
			preventDefault: vi.fn(),
		};
		contents.emit("will-frame-navigate", localSubframe);
		expect(localSubframe.preventDefault).toHaveBeenCalledOnce();

		contents.setCurrentUrl("https://appleid.apple.com/auth/authorize");
		const loadsBeforeResize = contents.loadURL.mock.calls.length;
		await Effect.runPromise(
			controller.setSurfaceFx({
				projectId: "project-one",
				bounds: {
					x: 0,
					y: 0,
					width: 500,
					height: 350,
				},
			}),
		);
		expect(contents.loadURL).toHaveBeenCalledTimes(loadsBeforeResize);
		await Effect.runPromise(controller.setSurfaceFx(null));
		const detachedExternal = {
			isMainFrame: true,
			url: "https://example.com/delayed",
			preventDefault: vi.fn(),
		};
		contents.emit("will-navigate", detachedExternal);
		expect(detachedExternal.preventDefault).toHaveBeenCalledOnce();
		await Effect.runPromise(
			controller.setSurfaceFx({
				projectId: "project-one",
				bounds: {
					x: 0,
					y: 0,
					width: 400,
					height: 300,
				},
			}),
		);
		expect(chatGptElectronState.views).toHaveLength(1);
		expect(contents.loadURL).toHaveBeenLastCalledWith("https://chatgpt.com/");
		expect(harness.contentView.addChildView).toHaveBeenCalledTimes(4);
		contents.emit("dom-ready");
		expect(harness.contentView.addChildView).toHaveBeenCalledTimes(5);
		harness.contentView.removeChildView.mockImplementation(() => {
			throw new Error("Object has been destroyed");
		});
		expect(() => harness.close()).not.toThrow();
		expect(contents.close).toHaveBeenCalledOnce();
	});

	it("revokes detached admission and restores the committed page after rejecting navigation", async () => {
		const { controller, harness, view } = await attachSurface();
		const contents = view.webContents as unknown as TestWebContents;
		const attachmentsBeforeRejection = harness.contentView.addChildView.mock.calls.length;

		contents.emit("did-start-navigation", {}, "file:///tmp/private", false, true);
		const rejected = {
			isMainFrame: true,
			url: "file:///tmp/private",
			preventDefault: vi.fn(),
		};
		contents.emit("will-navigate", rejected);

		expect(rejected.preventDefault).toHaveBeenCalledOnce();
		expect(harness.contentView.addChildView).toHaveBeenCalledTimes(
			attachmentsBeforeRejection + 1,
		);

		await Effect.runPromise(controller.setSurfaceFx(null));
		const hiddenExternal = {
			isMainFrame: true,
			url: "https://example.com/hidden",
			preventDefault: vi.fn(),
		};
		contents.emit("will-navigate", hiddenExternal);
		expect(hiddenExternal.preventDefault).toHaveBeenCalledOnce();
		harness.close();
	});

	it("admits one bounded PNG download, cleans it and rejects every concurrent candidate", async () => {
		const { harness, view } = await attachSurface();
		const contents = view.webContents as unknown as TestWebContents;
		const session = contents.session;
		const accepted = createDownload();
		const acceptedEvent = {
			preventDefault: vi.fn(),
		};
		session.emit("will-download", acceptedEvent, accepted.item, contents);
		expect(acceptedEvent.preventDefault).not.toHaveBeenCalled();
		const savePath = accepted.readSavePath();
		if (savePath === undefined) throw new Error("Expected a temporary download path.");

		const concurrent = createDownload();
		const concurrentEvent = {
			preventDefault: vi.fn(),
		};
		session.emit("will-download", concurrentEvent, concurrent.item, contents);
		expect(concurrentEvent.preventDefault).toHaveBeenCalledOnce();
		await writeFile(savePath, Uint8Array.of(1, 2, 3));
		accepted.finish("completed");
		const afterDone = createDownload();
		const afterDoneEvent = {
			preventDefault: vi.fn(),
		};
		session.emit("will-download", afterDoneEvent, afterDone.item, contents);
		expect(afterDoneEvent.preventDefault).toHaveBeenCalledOnce();
		await vi.waitFor(() =>
			expect(harness.webContents.send).toHaveBeenCalledWith(
				ArkiniElectronApi.channels.chatGptAssetCandidate,
				expect.objectContaining({
					projectId: "project-one",
					filename: "generated.png",
					bytes: Uint8Array.of(1, 2, 3),
				}),
			),
		);
		await expect(access(savePath)).rejects.toThrow();

		const second = createDownload();
		const secondEvent = {
			preventDefault: vi.fn(),
		};
		session.emit("will-download", secondEvent, second.item, contents);
		expect(secondEvent.preventDefault).toHaveBeenCalledOnce();
		expect(
			harness.webContents.send.mock.calls.filter(
				([channel]) => channel === ArkiniElectronApi.channels.chatGptAssetCandidate,
			),
		).toHaveLength(1);

		for (const rejected of [
			createDownload({
				mime: "image/jpeg",
			}),
			createDownload({
				totalBytes: ChatGptAssetCandidateMaxBytes + 1,
			}),
		]) {
			const event = {
				preventDefault: vi.fn(),
			};
			session.emit("will-download", event, rejected.item, contents);
			expect(event.preventDefault).toHaveBeenCalledOnce();
		}
		harness.close();
	});

	it("invalidates an admitted download when the same project surface is reattached", async () => {
		const { controller, harness, view } = await attachSurface();
		const contents = view.webContents as unknown as TestWebContents;
		const accepted = createDownload();
		const event = {
			preventDefault: vi.fn(),
		};
		contents.session.emit("will-download", event, accepted.item, contents);
		const savePath = accepted.readSavePath();
		if (savePath === undefined) throw new Error("Expected a temporary download path.");
		await writeFile(savePath, Uint8Array.of(1, 2, 3));

		await Effect.runPromise(controller.setSurfaceFx(null));
		await Effect.runPromise(
			controller.setSurfaceFx({
				projectId: "project-one",
				bounds: {
					x: 0,
					y: 0,
					width: 400,
					height: 300,
				},
			}),
		);
		accepted.finish("completed");

		await vi.waitFor(() => expect(access(savePath)).rejects.toThrow());
		expect(harness.webContents.send).not.toHaveBeenCalledWith(
			ArkiniElectronApi.channels.chatGptAssetCandidate,
			expect.anything(),
		);
		harness.close();
	});

	it("rejects a download that completes after its surface becomes physically hidden", async () => {
		const { controller, harness, view } = await attachSurface();
		const contents = view.webContents as unknown as TestWebContents;
		const accepted = createDownload();
		contents.session.emit(
			"will-download",
			{
				preventDefault: vi.fn(),
			},
			accepted.item,
			contents,
		);
		const savePath = accepted.readSavePath();
		if (savePath === undefined) throw new Error("Expected a temporary download path.");
		await writeFile(savePath, Uint8Array.of(1, 2, 3));

		await Effect.runPromise(
			controller.setSurfaceFx({
				projectId: "project-one",
				bounds: {
					x: 0,
					y: 0,
					width: 0,
					height: 0,
				},
			}),
		);
		accepted.finish("completed");

		await vi.waitFor(() => expect(access(savePath)).rejects.toThrow());
		expect(harness.webContents.send).not.toHaveBeenCalledWith(
			ArkiniElectronApi.channels.chatGptAssetCandidate,
			expect.anything(),
		);
		harness.close();
	});
});
