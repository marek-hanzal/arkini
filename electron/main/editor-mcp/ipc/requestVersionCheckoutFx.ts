import { MessageChannelMain, type WebContents } from "electron";
import { Effect } from "effect";

import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";

const readResponseFn = (candidate: unknown): ArkiniElectronApi.EditorMcpVersionCheckoutResponse => {
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
		Effect.callback<void, Error>((resumeFn) => {
			if (sender.isDestroyed()) {
				resumeFn(Effect.fail(new Error("The open editor renderer is unavailable.")));
				return;
			}
			const { port1, port2 } = new MessageChannelMain();
			let settled = false;
			let onDestroyedFn: () => void = () => undefined;
			const finishFn = (result: Effect.Effect<void, Error, never>) => {
				if (settled) return;
				settled = true;
				sender.removeListener("destroyed", onDestroyedFn);
				port1.close();
				resumeFn(result);
			};
			onDestroyedFn = () =>
				finishFn(Effect.fail(new Error("The open editor renderer was closed.")));
			sender.once("destroyed", onDestroyedFn);
			port1.once("message", ({ data }) => {
				try {
					const response = readResponseFn(data);
					finishFn(
						response.type === "success"
							? Effect.void
							: Effect.fail(new Error(response.message)),
					);
				} catch (cause) {
					finishFn(
						Effect.fail(cause instanceof Error ? cause : new Error(String(cause))),
					);
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
				finishFn(Effect.fail(cause instanceof Error ? cause : new Error(String(cause))));
			}
			return Effect.sync(() => {
				if (settled) return;
				settled = true;
				sender.removeListener("destroyed", onDestroyedFn);
				port1.close();
			});
		}),
);
