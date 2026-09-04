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
import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import type { EditorMcpNgrokDomainSchema } from "~/authoring-mcp/schema/EditorMcpNgrokDomainSchema";
import {
	ChatGptAssetCandidateFilenameMaxLength,
	ChatGptAssetCandidateMaxBytes,
	type ChatGptSurfaceSchema,
	type ChatGptViewStateSchema,
} from "~electron/contract/chatgpt/ChatGptSurfaceSchema";
import { ElectronMainRuntime } from "../ElectronMainRuntime";

/** Owns the isolated ChatGPT WebContentsView attached to one Arkini window. */
export interface ChatGptViewController {
	readonly setSurfaceFx: (
		surface: ChatGptSurfaceSchema.Type | null,
	) => Effect.Effect<void, unknown, never>;
}

export namespace createChatGptViewControllerFx {
	export interface Props {
		readonly readMcpNgrokDomainFx: Effect.Effect<
			EditorMcpNgrokDomainSchema.Type | undefined,
			unknown,
			never
		>;
		readonly window: BrowserWindow;
	}
}

const CHAT_GPT_URL = "https://chatgpt.com/";
const CHAT_GPT_ORIGIN = new URL(CHAT_GPT_URL).origin;
const CHAT_GPT_PARTITION = "persist:arkini-chatgpt";

const isWebNavigationFn = (candidate: string) => {
	try {
		const url = new URL(candidate);
		return url.protocol === "https:" && url.username === "" && url.password === "";
	} catch {
		return false;
	}
};

const isRetainedNavigationFn = (
	candidate: string,
	ngrokDomain: EditorMcpNgrokDomainSchema.Type | undefined,
) => {
	try {
		const origin = new URL(candidate).origin;
		return (
			origin === CHAT_GPT_ORIGIN ||
			(ngrokDomain !== undefined && origin === `https://${ngrokDomain}`)
		);
	} catch {
		return false;
	}
};

const isAbortedNavigationFn = (cause: unknown) =>
	typeof cause === "object" &&
	cause !== null &&
	(("code" in cause && cause.code === "ERR_ABORTED") || ("errno" in cause && cause.errno === -3));

/** Creates the isolated browser surface and bounded download owner for one window. */
export const createChatGptViewControllerFx = Effect.fn("createChatGptViewControllerFx")(
	({ readMcpNgrokDomainFx, window }: createChatGptViewControllerFx.Props) =>
		Effect.gen(function* () {
			let view: WebContentsView | undefined;
			let viewSession: Session | undefined;
			let attached = false;
			let surface: ChatGptSurfaceSchema.Type | null = null;
			let state: ChatGptViewStateSchema.Type = {
				type: "loading",
			};
			let allowDetachedMainFrameNavigation = false;
			let configuredNgrokDomain: EditorMcpNgrokDomainSchema.Type | undefined;
			let surfaceRequestGeneration = 0;
			let surfaceGeneration = 0;
			let candidatePending = false;
			let activeDownload:
				| {
						readonly item: DownloadItem;
						readonly path: string;
				  }
				| undefined;
			const sendStateFn = () => {
				if (window.webContents.isDestroyed()) return;
				window.webContents.send(ArkiniElectronApi.channels.chatGptStateChanged, state);
			};
			const setStateFn = (next: ChatGptViewStateSchema.Type) => {
				state = next;
				sendStateFn();
			};
			const detachFn = () => {
				if (!attached || view === undefined) return;
				window.contentView.removeChildView(view);
				attached = false;
			};
			const invalidateAttachmentFn = () => {
				surfaceGeneration += 1;
				activeDownload?.item.cancel();
				detachFn();
			};
			const clearSurfaceFn = () => {
				surfaceRequestGeneration += 1;
				allowDetachedMainFrameNavigation = false;
				surface = null;
				candidatePending = false;
				invalidateAttachmentFn();
			};
			const readBoundsFn = (candidate: ChatGptSurfaceSchema.Type["bounds"]) => {
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
			const attachFn = (candidate: ChatGptSurfaceSchema.Type) => {
				if (view === undefined || candidatePending) return;
				const bounds = readBoundsFn(candidate.bounds);
				if (bounds.width === 0 || bounds.height === 0) {
					invalidateAttachmentFn();
					return;
				}
				if (!attached) {
					window.contentView.addChildView(view);
					attached = true;
				}
				view.setBounds(bounds);
			};
			const restoreCurrentPageFn = (contents: WebContentsView["webContents"]) => {
				allowDetachedMainFrameNavigation = false;
				if (surface === null || !isWebNavigationFn(contents.getURL())) return;
				attachFn(surface);
				setStateFn({
					type: "ready",
				});
			};
			const recoverCurrentPageFn = (contents: WebContentsView["webContents"]) => {
				if (contents.isLoadingMainFrame()) return;
				restoreCurrentPageFn(contents);
			};
			const loadFn = (contents: WebContentsView["webContents"], url = CHAT_GPT_URL) => {
				allowDetachedMainFrameNavigation = true;
				invalidateAttachmentFn();
				setStateFn({
					type: "loading",
				});
				void contents.loadURL(url).catch((cause) => {
					if (contents.isDestroyed()) return;
					if (isAbortedNavigationFn(cause)) {
						recoverCurrentPageFn(contents);
						return;
					}
					allowDetachedMainFrameNavigation = false;
					setStateFn({
						type: "unavailable",
						message: cause instanceof Error ? cause.message : String(cause),
					});
					invalidateAttachmentFn();
				});
			};
			const onDownloadFn = (
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
							detachFn();
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
			const ensureViewFn = () => {
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
					if (attached && isWebNavigationFn(url))
						setImmediate(() => {
							if (webContents.isDestroyed() || !attached || surface === null) return;
							loadFn(webContents, url);
						});
					return {
						action: "deny",
					};
				});
				const preventNonWebNavigationFn = (
					event: Event & {
						readonly isMainFrame: boolean;
						readonly url: string;
					},
				) => {
					if (!isWebNavigationFn(event.url)) {
						event.preventDefault();
						if (event.isMainFrame) restoreCurrentPageFn(webContents);
						return;
					}
					if (event.isMainFrame && attached) {
						allowDetachedMainFrameNavigation = true;
						return;
					}
					if (
						event.isMainFrame &&
						!allowDetachedMainFrameNavigation &&
						!isRetainedNavigationFn(event.url, configuredNgrokDomain)
					)
						event.preventDefault();
				};
				webContents.on("will-navigate", preventNonWebNavigationFn);
				webContents.on("will-redirect", preventNonWebNavigationFn);
				webContents.on("will-frame-navigate", preventNonWebNavigationFn);
				webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
					if (!isMainFrame || isInPlace) return;
					if (attached) {
						allowDetachedMainFrameNavigation = true;
						invalidateAttachmentFn();
					}
					setStateFn({
						type: "loading",
					});
				});
				webContents.on("dom-ready", () => {
					allowDetachedMainFrameNavigation = false;
					if (!isWebNavigationFn(webContents.getURL())) return;
					if (surface !== null && !attached) attachFn(surface);
					setStateFn({
						type: "ready",
					});
				});
				webContents.on(
					"did-fail-load",
					(_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
						if (!isMainFrame) return;
						if (errorCode === -3) {
							recoverCurrentPageFn(webContents);
							return;
						}
						allowDetachedMainFrameNavigation = false;
						setStateFn({
							type: "unavailable",
							message: errorDescription,
						});
						invalidateAttachmentFn();
					},
				);
				session.setPermissionCheckHandler(() => false);
				session.setPermissionRequestHandler((_contents, _permission, callbackFn) =>
					callbackFn(false),
				);
				session.on("will-download", onDownloadFn);
				loadFn(webContents);
				return created;
			};

			const onArkiniNavigationFn = (
				_event: Event,
				_url: string,
				_isInPlace: boolean,
				isMainFrame: boolean,
			) => {
				if (isMainFrame) clearSurfaceFn();
			};
			const onArkiniRendererGoneFn = () => clearSurfaceFn();
			window.webContents.on("did-start-navigation", onArkiniNavigationFn);
			window.webContents.on("render-process-gone", onArkiniRendererGoneFn);
			window.once("closed", () => {
				surfaceRequestGeneration += 1;
				const temporaryPath = activeDownload?.path;
				activeDownload?.item.cancel();
				activeDownload = undefined;
				attached = false;
				surface = null;
				if (viewSession !== undefined) {
					viewSession.removeListener("will-download", onDownloadFn);
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
				setSurfaceFx: (candidate) =>
					candidate === null
						? Effect.sync(clearSurfaceFn)
						: Effect.gen(function* () {
								const request = yield* Effect.sync(() => {
									surfaceRequestGeneration += 1;
									return {
										generation: surfaceRequestGeneration,
										refreshNgrokDomain: surface === null,
									};
								});
								const ngrokDomain = request.refreshNgrokDomain
									? yield* readMcpNgrokDomainFx.pipe(
											Effect.catch(() => Effect.succeed(undefined)),
										)
									: configuredNgrokDomain;
								yield* Effect.sync(() => {
									if (request.generation !== surfaceRequestGeneration) return;
									configuredNgrokDomain = ngrokDomain;
									const reenteringSurface = surface === null;
									if (
										surface !== null &&
										surface.projectId !== candidate.projectId
									)
										surfaceGeneration += 1;
									surface = candidate;
									const existing = view !== undefined;
									const currentView = ensureViewFn();
									const mustResetBeforeAttach =
										existing &&
										reenteringSurface &&
										(state.type === "loading" ||
											state.type === "unavailable" ||
											!isRetainedNavigationFn(
												currentView.webContents.getURL(),
												configuredNgrokDomain,
											));
									if (mustResetBeforeAttach) {
										loadFn(currentView.webContents);
										sendStateFn();
										return;
									}
									if (state.type === "loading") {
										sendStateFn();
										return;
									}
									attachFn(candidate);
									sendStateFn();
								});
							}),
			} satisfies ChatGptViewController;
		}),
);
