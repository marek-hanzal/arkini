import type {
	Event,
	IpcMainEvent,
	IpcMainInvokeEvent,
	WebContents,
	WebContentsWillFrameNavigateEventParams,
	WebContentsWillNavigateEventParams,
	WebContentsWillRedirectEventParams,
} from "electron";
import { Effect } from "effect";
import { RendererDevelopmentServer } from "~electron/security/RendererDevelopmentUrl";
import { parseRendererDevelopmentUrlFx } from "~electron/security/parseRendererDevelopmentUrlFx";
import { ElectronMainError } from "../ElectronMainError";
import type { TrustedRenderer } from "./TrustedRenderer";

export namespace createTrustedRendererFx {
	export interface Props {
		readonly isPackaged: boolean;
		readonly developmentRendererUrl?: string;
	}
}

export const createTrustedRendererFx = Effect.fn("createTrustedRendererFx")(
	(props: createTrustedRendererFx.Props) =>
		Effect.gen(function* () {
			const developmentRendererUrl =
				props.isPackaged || props.developmentRendererUrl === undefined
					? undefined
					: (yield* parseRendererDevelopmentUrlFx(props.developmentRendererUrl)).href;
			if (
				developmentRendererUrl !== undefined &&
				new URL(developmentRendererUrl).origin !== RendererDevelopmentServer.origin
			) {
				return yield* Effect.fail(
					new Error(
						`Electron development renderer must use ${RendererDevelopmentServer.origin}.`,
					),
				);
			}
			return yield* Effect.try({
				try: (): TrustedRenderer => {
					const trustedOrigin = new URL(developmentRendererUrl ?? "arkini://app/");
					const trustedWebContents = new Map<number, WebContents>();
					const isTrustedUrlFn = (candidate: string) => {
						try {
							const parsed = new URL(candidate);
							if (parsed.username !== "" || parsed.password !== "") return false;
							if (developmentRendererUrl !== undefined) {
								return (
									(parsed.protocol === "http:" || parsed.protocol === "https:") &&
									parsed.origin === trustedOrigin.origin
								);
							}
							return (
								parsed.protocol === "arkini:" &&
								parsed.hostname === "app" &&
								parsed.port === "" &&
								parsed.origin === trustedOrigin.origin
							);
						} catch {
							return false;
						}
					};
					const isTrustedIpcSenderFn = (event: IpcMainEvent | IpcMainInvokeEvent) => {
						const expected = trustedWebContents.get(event.sender.id);
						const frame = event.senderFrame;
						return (
							expected === event.sender &&
							!event.sender.isDestroyed() &&
							frame !== null &&
							frame === event.sender.mainFrame &&
							isTrustedUrlFn(frame.url)
						);
					};
					const assertTrustedIpcSenderFx: TrustedRenderer["assertTrustedIpcSenderFx"] =
						Effect.fn("TrustedRenderer.assertTrustedIpcSenderFx")(function* (event) {
							if (isTrustedIpcSenderFn(event)) return;
							return yield* Effect.fail(
								new ElectronMainError({
									operation: "authorize privileged IPC from the Arkini renderer",
									cause: {
										senderId: event.sender.id,
										senderFrameUrl: event.senderFrame?.url ?? null,
									},
								}),
							);
						});
					const registerWindowFx: TrustedRenderer["registerWindowFx"] = Effect.fn(
						"TrustedRenderer.registerWindowFx",
					)((window) =>
						Effect.sync(() => {
							const { webContents } = window;
							const { session } = webContents;
							trustedWebContents.set(webContents.id, webContents);

							const preventUntrustedMainFrameNavigationFn = (
								event: Event<
									| WebContentsWillNavigateEventParams
									| WebContentsWillRedirectEventParams
								>,
							) => {
								if (!event.isMainFrame || !isTrustedUrlFn(event.url))
									event.preventDefault();
							};
							const preventSubframeOrUntrustedNavigationFn = (
								event: Event<WebContentsWillFrameNavigateEventParams>,
							) => {
								if (!event.isMainFrame || !isTrustedUrlFn(event.url))
									event.preventDefault();
							};
							const preventWebviewFn = (event: Event) => event.preventDefault();

							webContents.setWindowOpenHandler(() => ({
								action: "deny",
							}));
							webContents.on("will-navigate", preventUntrustedMainFrameNavigationFn);
							webContents.on("will-redirect", preventUntrustedMainFrameNavigationFn);
							webContents.on(
								"will-frame-navigate",
								preventSubframeOrUntrustedNavigationFn,
							);
							webContents.on("will-attach-webview", preventWebviewFn);
							session.setPermissionCheckHandler(() => false);
							session.setPermissionRequestHandler(
								(_contents, _permission, callbackFn) => {
									callbackFn(false);
								},
							);

							window.once("closed", () => {
								if (trustedWebContents.get(webContents.id) === webContents) {
									trustedWebContents.delete(webContents.id);
								}
								if (!webContents.isDestroyed()) {
									webContents.removeListener(
										"will-navigate",
										preventUntrustedMainFrameNavigationFn,
									);
									webContents.removeListener(
										"will-redirect",
										preventUntrustedMainFrameNavigationFn,
									);
									webContents.removeListener(
										"will-frame-navigate",
										preventSubframeOrUntrustedNavigationFn,
									);
									webContents.removeListener(
										"will-attach-webview",
										preventWebviewFn,
									);
								}
								session.setPermissionCheckHandler(null);
								session.setPermissionRequestHandler(null);
							});
						}),
					);

					return {
						developmentRendererUrl,
						isTrustedUrlFn,
						isTrustedIpcSenderFn,
						assertTrustedIpcSenderFx,
						registerWindowFx,
					};
				},
				catch: (cause) => cause,
			});
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "configure the trusted Arkini renderer origin",
						cause,
					}),
			),
		),
);
