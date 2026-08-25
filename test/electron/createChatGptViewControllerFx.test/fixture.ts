import type { BrowserWindow, DownloadItem, Session, WebContents } from "electron";
import { EventEmitter } from "node:events";
import { vi } from "vitest";

export class TestSession extends EventEmitter {
	readonly setPermissionCheckHandler = vi.fn();
	readonly setPermissionRequestHandler = vi.fn();
}

export class TestWebContents extends EventEmitter {
	private currentUrl = "";
	private destroyed = false;
	private loadingMainFrame = false;
	readonly loadURL = vi.fn(async (url: string) => {
		this.currentUrl = url;
	});
	readonly session = new TestSession() as unknown as Session;
	readonly setWindowOpenHandler = vi.fn();
	readonly close = vi.fn(() => {
		this.destroyed = true;
	});

	isDestroyed() {
		return this.destroyed;
	}

	isLoadingMainFrame() {
		return this.loadingMainFrame;
	}

	getURL() {
		return this.currentUrl;
	}

	setCurrentUrl(url: string) {
		this.currentUrl = url;
	}

	setLoadingMainFrame(loading: boolean) {
		this.loadingMainFrame = loading;
	}
}

export const chatGptElectronState = {
	views: [] as TestWebContentsView[],
};

export class TestWebContentsView {
	readonly setBounds = vi.fn();
	readonly webContents = new TestWebContents() as unknown as WebContents;

	constructor(readonly options: unknown) {
		chatGptElectronState.views.push(this);
	}
}

export const createWindowHarness = () => {
	const listeners = new Map<string, () => void>();
	const contentView = {
		addChildView: vi.fn(),
		removeChildView: vi.fn(),
	};
	const webContents = Object.assign(new EventEmitter(), {
		isDestroyed: vi.fn(() => false),
		send: vi.fn(),
	});
	const window = {
		contentView,
		getContentSize: vi.fn(() => [
			800,
			600,
		]),
		once: vi.fn((event: string, listener: () => void) => {
			listeners.set(event, listener);
		}),
		webContents,
	} as unknown as BrowserWindow;
	return {
		close: () => listeners.get("closed")?.(),
		contentView,
		webContents,
		window,
	};
};

export const createDownload = ({
	filename = "generated.png",
	mime = "image/png",
	totalBytes = 64,
}: {
	readonly filename?: string;
	readonly mime?: string;
	readonly totalBytes?: number;
} = {}) => {
	const emitter = new EventEmitter();
	let savePath: string | undefined;
	let receivedBytes = totalBytes;
	const item = Object.assign(emitter, {
		cancel: vi.fn(),
		getFilename: () => filename,
		getMimeType: () => mime,
		getReceivedBytes: () => receivedBytes,
		getTotalBytes: () => totalBytes,
		setSavePath: vi.fn((path: string) => {
			savePath = path;
		}),
	}) as unknown as DownloadItem;
	return {
		finish: (state: "cancelled" | "completed" | "interrupted") =>
			emitter.emit("done", undefined, state),
		item,
		readSavePath: () => savePath,
		setReceivedBytes: (bytes: number) => {
			receivedBytes = bytes;
			emitter.emit("updated");
		},
	};
};
