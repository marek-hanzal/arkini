import ngrok from "@ngrok/ngrok";
import { Effect } from "effect";

import type { EditorMcpTunnel } from "./EditorMcpTunnel";
import { EditorMcpTunnelProvenanceHeader } from "./EditorMcpTunnelProvenanceHeader";

const NgrokReconnectGraceMs = 10_000;

const createSafeNgrokError = (message: string, cause: unknown) => {
	const errorCode =
		typeof cause === "object" &&
		cause !== null &&
		"errorCode" in cause &&
		typeof cause.errorCode === "string" &&
		/^ERR_NGROK_\d+$/.test(cause.errorCode)
			? cause.errorCode
			: undefined;
	return new Error(`${message}${errorCode === undefined ? "." : ` (${errorCode}).`}`);
};

/** Creates the optional ngrok transport without opening a public endpoint. */
export const createNgrokEditorMcpTunnelFx = Effect.sync(
	(): EditorMcpTunnel => ({
		openFx: ({ authtoken, domain, port, provenance }) =>
			Effect.tryPromise({
				try: async () => {
					let publishClosed: () => void = () => undefined;
					let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
					let closing = false;
					const closed = new Promise<void>((resolve) => {
						publishClosed = resolve;
					});
					const clearReconnectTimer = () => {
						if (reconnectTimer === undefined) return;
						clearTimeout(reconnectTimer);
						reconnectTimer = undefined;
					};
					const listener = await ngrok.forward({
						addr: `127.0.0.1:${port}`,
						authtoken,
						domain,
						onStatusChange: (status) => {
							if (status === "connected") {
								clearReconnectTimer();
								return;
							}
							if (status !== "closed" || closing) return;
							clearReconnectTimer();
							reconnectTimer = setTimeout(() => {
								reconnectTimer = undefined;
								publishClosed();
							}, NgrokReconnectGraceMs);
						},
						request_header_remove: [
							EditorMcpTunnelProvenanceHeader,
						],
						request_header_add: [
							`${EditorMcpTunnelProvenanceHeader}:${provenance}`,
						],
						forwards_to: "arkini-editor-mcp",
					});
					const closeListener = async () => {
						closing = true;
						clearReconnectTimer();
						await listener.close();
					};
					const candidate = listener.url();
					if (candidate === null) {
						await closeListener();
						throw new Error("ngrok started without publishing an endpoint URL.");
					}
					const url = new URL(candidate);
					if (url.protocol !== "https:") {
						await closeListener();
						throw new Error("ngrok did not publish an HTTPS endpoint.");
					}
					if (url.hostname !== domain) {
						await closeListener();
						throw new Error("ngrok published an unexpected endpoint domain.");
					}
					return {
						url,
						closedFx: Effect.promise(() => closed),
						closeFx: Effect.tryPromise({
							try: closeListener,
							catch: (cause) =>
								createSafeNgrokError(
									"ngrok could not close the Remote MCP tunnel",
									cause,
								),
						}),
					};
				},
				catch: (cause) =>
					createSafeNgrokError("ngrok could not open the Remote MCP tunnel", cause),
			}),
	}),
);
