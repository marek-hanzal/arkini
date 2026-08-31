import { MessageChannelMain, type WebContents } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";

const readResponse = (candidate: unknown): ArkiniElectronApi.EditorMcpVersionCheckoutResponse => {
	if (typeof candidate !== "object" || candidate === null || !("type" in candidate))
		throw new Error("The editor returned an invalid version checkout response.");
	if (candidate.type === "success")
		return {
			type: "success",
		};
	if (
		candidate.type === "failure" &&
		"message" in candidate &&
		typeof candidate.message === "string"
	)
		return {
			type: "failure",
			message: candidate.message,
		};
	throw new Error("The editor returned an invalid version checkout response.");
};

/** Requests the renderer-owned destructive checkout and waits for its terminal reload. */
export const requestVersionCheckoutFx = Effect.fn("requestVersionCheckoutFx")(
	(sender: WebContents, request: ArkiniElectronApi.EditorMcpVersionCheckoutRequest) =>
		Effect.callback<void, Error>((resume) => {
			if (sender.isDestroyed()) {
				resume(Effect.fail(new Error("The open editor renderer is unavailable.")));
				return;
			}
			const { port1, port2 } = new MessageChannelMain();
			let settled = false;
			let onDestroyed: () => void = () => undefined;
			const finish = (result: Effect.Effect<void, Error>) => {
				if (settled) return;
				settled = true;
				sender.removeListener("destroyed", onDestroyed);
				port1.close();
				resume(result);
			};
			onDestroyed = () =>
				finish(Effect.fail(new Error("The open editor renderer was closed.")));
			sender.once("destroyed", onDestroyed);
			port1.once("message", ({ data }) => {
				try {
					const response = readResponse(data);
					finish(
						response.type === "success"
							? Effect.void
							: Effect.fail(new Error(response.message)),
					);
				} catch (cause) {
					finish(Effect.fail(cause instanceof Error ? cause : new Error(String(cause))));
				}
			});
			port1.start();
			try {
				sender.postMessage(
					ArkiniElectronApi.channels.editorMcpVersionCheckoutRequest,
					request,
					[
						port2,
					],
				);
			} catch (cause) {
				finish(Effect.fail(cause instanceof Error ? cause : new Error(String(cause))));
			}
			return Effect.sync(() => {
				if (settled) return;
				settled = true;
				sender.removeListener("destroyed", onDestroyed);
				port1.close();
			});
		}),
);
