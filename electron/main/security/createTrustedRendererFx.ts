import type {
	BrowserWindow,
	Event,
	IpcMainEvent,
	IpcMainInvokeEvent,
	WebContents,
	WebContentsWillFrameNavigateEventParams,
	WebContentsWillNavigateEventParams,
	WebContentsWillRedirectEventParams,
} from "electron";
import { Effect } from "effect";
import { RendererDevelopmentServer } from "../../../desktop/security/RendererContentSecurityPolicy";
import { ElectronMainError } from "../ElectronMainError";
import type { TrustedRenderer } from "./TrustedRenderer";

export namespace createTrustedRendererFx {
	export interface Props {
		readonly isPackaged: boolean;
		readonly developmentRendererUrl?: string;
	}
}

const readDevelopmentRendererUrl = ({
	isPackaged,
	developmentRendererUrl,
}: createTrustedRendererFx.Props) => {
	if (isPackaged || developmentRendererUrl === undefined) return undefined;
	const parsed = new URL(developmentRendererUrl);
	if (
		parsed.username !== "" ||
		parsed.password !== "" ||
		parsed.origin !== RendererDevelopmentServer.origin
	) {
		throw new Error(
			`Electron development renderer must use ${RendererDevelopmentServer.origin}.`,
		);
	}
	return parsed.toString();
};

export const createTrustedRendererFx = Effect.fn("createTrustedRendererFx")(
	(props: createTrustedRendererFx.Props) =>
		Effect.try({
			try: (): TrustedRenderer => {
				const developmentRendererUrl = readDevelopmentRendererUrl(props);
				const trustedOrigin = new URL(developmentRendererUrl ?? "arkini://app/");
				const trustedWebContents = new Map<number, WebContents>();
				const isTrustedUrl = (candidate: string) => {
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
				const isTrustedIpcSender = (event: IpcMainEvent | IpcMainInvokeEvent) => {
					const expected = trustedWebContents.get(event.sender.id);
					const frame = event.senderFrame;
					return (
						expected === event.sender &&
						!event.sender.isDestroyed() &&
						frame !== null &&
						frame === event.sender.mainFrame &&
						isTrustedUrl(frame.url)
					);
				};
				const assertTrustedIpcSenderFx = (event: IpcMainEvent | IpcMainInvokeEvent) =>
					isTrustedIpcSender(event)
						? Effect.void
						: Effect.fail(
								new ElectronMainError({
									operation: "authorize privileged IPC from the Arkini renderer",
									cause: {
										senderId: event.sender.id,
										senderFrameUrl: event.senderFrame?.url ?? null,
									},
								}),
							);
				const registerWindowFx = (window: BrowserWindow) =>
					Effect.sync(() => {
						const { webContents } = window;
						const { session } = webContents;
						trustedWebContents.set(webContents.id, webContents);

						const preventUntrustedMainFrameNavigation = (
							event: Event<
								| WebContentsWillNavigateEventParams
								| WebContentsWillRedirectEventParams
							>,
						) => {
							if (!event.isMainFrame || !isTrustedUrl(event.url))
								event.preventDefault();
						};
						const preventSubframeOrUntrustedNavigation = (
							event: Event<WebContentsWillFrameNavigateEventParams>,
						) => {
							if (!event.isMainFrame || !isTrustedUrl(event.url))
								event.preventDefault();
						};
						const preventWebview = (event: Event) => event.preventDefault();

						webContents.setWindowOpenHandler(() => ({
							action: "deny",
						}));
						webContents.on("will-navigate", preventUntrustedMainFrameNavigation);
						webContents.on("will-redirect", preventUntrustedMainFrameNavigation);
						webContents.on("will-frame-navigate", preventSubframeOrUntrustedNavigation);
						webContents.on("will-attach-webview", preventWebview);
						session.setPermissionCheckHandler(() => false);
						session.setPermissionRequestHandler((_contents, _permission, callback) => {
							callback(false);
						});

						window.once("closed", () => {
							if (trustedWebContents.get(webContents.id) === webContents) {
								trustedWebContents.delete(webContents.id);
							}
							if (!webContents.isDestroyed()) {
								webContents.removeListener(
									"will-navigate",
									preventUntrustedMainFrameNavigation,
								);
								webContents.removeListener(
									"will-redirect",
									preventUntrustedMainFrameNavigation,
								);
								webContents.removeListener(
									"will-frame-navigate",
									preventSubframeOrUntrustedNavigation,
								);
								webContents.removeListener("will-attach-webview", preventWebview);
							}
							session.setPermissionCheckHandler(null);
							session.setPermissionRequestHandler(null);
						});
					});

				return {
					developmentRendererUrl,
					isTrustedUrl,
					isTrustedIpcSender,
					assertTrustedIpcSenderFx,
					registerWindowFx,
				};
			},
			catch: (cause) =>
				new ElectronMainError({
					operation: "configure the trusted Arkini renderer origin",
					cause,
				}),
		}),
);
