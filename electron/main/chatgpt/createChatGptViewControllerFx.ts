import {
	type BrowserWindow,
	type DownloadItem,
	type Event,
	type Session,
	WebContentsView,
} from "electron";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import {
	ChatGptAssetCandidateFilenameMaxLength,
	ChatGptAssetCandidateMaxBytes,
	type ChatGptSurfaceSchema,
	type ChatGptViewStateSchema,
} from "../../contract/chatgpt/ChatGptSurfaceSchema";
import { ElectronMainRuntime } from "../ElectronMainRuntime";

/** Owns the isolated ChatGPT WebContentsView attached to one Arkini window. */
export interface ChatGptViewController {
	readonly setSurfaceFx: (
		surface: ChatGptSurfaceSchema.Type | null,
	) => Effect.Effect<void, unknown>;
}

const CHAT_GPT_URL = "https://chatgpt.com/";
const CHAT_GPT_ORIGIN = new URL(CHAT_GPT_URL).origin;
const CHAT_GPT_PARTITION = "persist:arkini-chatgpt";

const isWebNavigation = (candidate: string) => {
	try {
		const url = new URL(candidate);
		return url.protocol === "https:" && url.username === "" && url.password === "";
	} catch {
		return false;
	}
};

const isChatGptNavigation = (candidate: string) => {
	try {
		return new URL(candidate).origin === CHAT_GPT_ORIGIN;
	} catch {
		return false;
	}
};

const isAbortedNavigation = (cause: unknown) =>
	typeof cause === "object" &&
	cause !== null &&
	(("code" in cause && cause.code === "ERR_ABORTED") || ("errno" in cause && cause.errno === -3));

/** Creates the isolated browser surface and bounded download owner for one window. */
export const createChatGptViewControllerFx = Effect.fn("createChatGptViewControllerFx")(
	(window: BrowserWindow) =>
		Effect.gen(function* () {
			let view: WebContentsView | undefined;
			let viewSession: Session | undefined;
			let attached = false;
			let surface: ChatGptSurfaceSchema.Type | null = null;
			let state: ChatGptViewStateSchema.Type = {
				type: "loading",
			};
			let allowDetachedMainFrameNavigation = false;
			let surfaceGeneration = 0;
			let candidatePending = false;
			let activeDownload:
				| {
						readonly item: DownloadItem;
						readonly path: string;
				  }
				| undefined;
			const sendState = () => {
				if (window.webContents.isDestroyed()) return;
				window.webContents.send(ArkiniElectronApi.channels.chatGptStateChanged, state);
			};
			const setState = (next: ChatGptViewStateSchema.Type) => {
				state = next;
				sendState();
			};
			const detach = () => {
				if (!attached || view === undefined) return;
				window.contentView.removeChildView(view);
				attached = false;
			};
			const invalidateAttachment = () => {
				surfaceGeneration += 1;
				activeDownload?.item.cancel();
				detach();
			};
			const clearSurface = () => {
				allowDetachedMainFrameNavigation = false;
				surface = null;
				candidatePending = false;
				invalidateAttachment();
			};
			const readBounds = (candidate: ChatGptSurfaceSchema.Type["bounds"]) => {
				const [contentWidth, contentHeight] = window.getContentSize();
				const x = Math.min(candidate.x, contentWidth);
				const y = Math.min(candidate.y, contentHeight);
				return {
					x,
					y,
					width: Math.min(candidate.width, contentWidth - x),
					height: Math.min(candidate.height, contentHeight - y),
				};
			};
			const attach = (candidate: ChatGptSurfaceSchema.Type) => {
				if (view === undefined || candidatePending) return;
				const bounds = readBounds(candidate.bounds);
				if (bounds.width === 0 || bounds.height === 0) {
					invalidateAttachment();
					return;
				}
				if (!attached) {
					window.contentView.addChildView(view);
					attached = true;
				}
				view.setBounds(bounds);
			};
			const restoreCurrentPage = (contents: WebContentsView["webContents"]) => {
				allowDetachedMainFrameNavigation = false;
				if (surface === null || !isWebNavigation(contents.getURL())) return;
				attach(surface);
				setState({
					type: "ready",
				});
			};
			const recoverCurrentPage = (contents: WebContentsView["webContents"]) => {
				if (contents.isLoadingMainFrame()) return;
				restoreCurrentPage(contents);
			};
			const load = (contents: WebContentsView["webContents"], url = CHAT_GPT_URL) => {
				allowDetachedMainFrameNavigation = true;
				invalidateAttachment();
				setState({
					type: "loading",
				});
				void contents.loadURL(url).catch((cause) => {
					if (contents.isDestroyed()) return;
					if (isAbortedNavigation(cause)) {
						recoverCurrentPage(contents);
						return;
					}
					allowDetachedMainFrameNavigation = false;
					setState({
						type: "unavailable",
						message: cause instanceof Error ? cause.message : String(cause),
					});
					invalidateAttachment();
				});
			};
			const onDownload = (
				event: Event,
				item: DownloadItem,
				contents: WebContentsView["webContents"],
			) => {
				const currentSurface = surface;
				const currentSurfaceGeneration = surfaceGeneration;
				const filename = item.getFilename();
				const mime = item.getMimeType().toLowerCase();
				const totalBytes = item.getTotalBytes();
				if (
					view === undefined ||
					contents !== view.webContents ||
					!attached ||
					currentSurface === null ||
					candidatePending ||
					activeDownload !== undefined ||
					mime !== "image/png" ||
					filename.length > ChatGptAssetCandidateFilenameMaxLength ||
					!filename.toLowerCase().endsWith(".png") ||
					totalBytes > ChatGptAssetCandidateMaxBytes
				) {
					event.preventDefault();
					return;
				}
				const path = join(tmpdir(), `arkini-chatgpt-${randomUUID()}`);
				activeDownload = {
					item,
					path,
				};
				item.setSavePath(path);
				item.on("updated", () => {
					if (item.getReceivedBytes() > ChatGptAssetCandidateMaxBytes) item.cancel();
				});
				item.once("done", (_doneEvent, downloadState) => {
					void ElectronMainRuntime.runPromise(
						Effect.gen(function* () {
							if (
								activeDownload?.item !== item ||
								!attached ||
								downloadState !== "completed" ||
								surface?.projectId !== currentSurface.projectId ||
								surfaceGeneration !== currentSurfaceGeneration
							) {
								return;
							}
							const bytes = yield* Effect.tryPromise({
								try: () => readFile(path),
								catch: (cause) => cause,
							});
							if (
								activeDownload?.item !== item ||
								!attached ||
								bytes.byteLength > ChatGptAssetCandidateMaxBytes ||
								surface?.projectId !== currentSurface.projectId ||
								surfaceGeneration !== currentSurfaceGeneration ||
								window.webContents.isDestroyed()
							)
								return;
							candidatePending = true;
							detach();
							window.webContents.send(
								ArkiniElectronApi.channels.chatGptAssetCandidate,
								{
									projectId: currentSurface.projectId,
									filename,
									bytes: new Uint8Array(bytes),
								},
							);
						}).pipe(
							Effect.ensuring(
								Effect.sync(() => {
									if (activeDownload?.item === item) activeDownload = undefined;
								}).pipe(
									Effect.andThen(
										Effect.promise(() =>
											rm(path, {
												force: true,
											}),
										),
									),
								),
							),
						),
					).catch((cause) => {
						console.error("ChatGPT image download could not be staged.", cause);
					});
				});
			};
			const ensureView = () => {
				if (view !== undefined) return view;
				const created = new WebContentsView({
					webPreferences: {
						partition: CHAT_GPT_PARTITION,
						contextIsolation: true,
						nodeIntegration: false,
						sandbox: true,
						navigateOnDragDrop: false,
					},
				});
				const { webContents } = created;
				const session = webContents.session;
				view = created;
				viewSession = session;
				webContents.setWindowOpenHandler(({ url }) => {
					if (attached && isWebNavigation(url))
						setImmediate(() => {
							if (webContents.isDestroyed() || !attached || surface === null) return;
							load(webContents, url);
						});
					return {
						action: "deny",
					};
				});
				const preventNonWebNavigation = (
					event: Event & {
						readonly isMainFrame: boolean;
						readonly url: string;
					},
				) => {
					if (!isWebNavigation(event.url)) {
						event.preventDefault();
						if (event.isMainFrame) restoreCurrentPage(webContents);
						return;
					}
					if (event.isMainFrame && attached) {
						allowDetachedMainFrameNavigation = true;
						return;
					}
					if (
						event.isMainFrame &&
						!allowDetachedMainFrameNavigation &&
						!isChatGptNavigation(event.url)
					)
						event.preventDefault();
				};
				webContents.on("will-navigate", preventNonWebNavigation);
				webContents.on("will-redirect", preventNonWebNavigation);
				webContents.on("will-frame-navigate", preventNonWebNavigation);
				webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
					if (!isMainFrame || isInPlace) return;
					if (attached) {
						allowDetachedMainFrameNavigation = true;
						invalidateAttachment();
					}
					setState({
						type: "loading",
					});
				});
				webContents.on("dom-ready", () => {
					allowDetachedMainFrameNavigation = false;
					if (!isWebNavigation(webContents.getURL())) return;
					if (surface !== null && !attached) attach(surface);
					setState({
						type: "ready",
					});
				});
				webContents.on(
					"did-fail-load",
					(_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
						if (!isMainFrame) return;
						if (errorCode === -3) {
							recoverCurrentPage(webContents);
							return;
						}
						allowDetachedMainFrameNavigation = false;
						setState({
							type: "unavailable",
							message: errorDescription,
						});
						invalidateAttachment();
					},
				);
				session.setPermissionCheckHandler(() => false);
				session.setPermissionRequestHandler((_contents, _permission, callback) =>
					callback(false),
				);
				session.on("will-download", onDownload);
				load(webContents);
				return created;
			};

			const onArkiniNavigation = (
				_event: Event,
				_url: string,
				_isInPlace: boolean,
				isMainFrame: boolean,
			) => {
				if (isMainFrame) clearSurface();
			};
			const onArkiniRendererGone = () => clearSurface();
			window.webContents.on("did-start-navigation", onArkiniNavigation);
			window.webContents.on("render-process-gone", onArkiniRendererGone);
			window.once("closed", () => {
				const temporaryPath = activeDownload?.path;
				activeDownload?.item.cancel();
				activeDownload = undefined;
				attached = false;
				surface = null;
				if (viewSession !== undefined) {
					viewSession.removeListener("will-download", onDownload);
					viewSession.setPermissionCheckHandler(null);
					viewSession.setPermissionRequestHandler(null);
				}
				if (view !== undefined && !view.webContents.isDestroyed()) {
					view.webContents.close({
						waitForBeforeUnload: false,
					});
				}
				if (temporaryPath !== undefined)
					void ElectronMainRuntime.runPromise(
						Effect.promise(() =>
							rm(temporaryPath, {
								force: true,
							}),
						),
					).catch((cause) => {
						console.error("ChatGPT temporary download could not be removed.", cause);
					});
			});

			return {
				setSurfaceFx: (candidate) => {
					const updateFx = Effect.sync(() => {
						if (candidate === null) {
							clearSurface();
							return;
						}
						const reenteringSurface = surface === null;
						if (surface !== null && surface.projectId !== candidate.projectId)
							surfaceGeneration += 1;
						surface = candidate;
						const existing = view !== undefined;
						const currentView = ensureView();
						const mustResetBeforeAttach =
							existing &&
							reenteringSurface &&
							(state.type === "loading" ||
								state.type === "unavailable" ||
								!isChatGptNavigation(currentView.webContents.getURL()));
						if (mustResetBeforeAttach) {
							load(currentView.webContents);
							sendState();
							return;
						}
						if (state.type === "loading") {
							sendState();
							return;
						}
						attach(candidate);
						sendState();
					});
					return updateFx;
				},
			} satisfies ChatGptViewController;
		}),
);
