import ngrok from "@ngrok/ngrok";
import { Effect } from "effect";

import type { EditorMcpTunnel } from "./EditorMcpTunnel";
import { EditorMcpTunnelProvenanceHeader } from "./EditorMcpTunnelProvenanceHeader";

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
					const listener = await ngrok.forward({
						addr: `127.0.0.1:${port}`,
						authtoken,
						request_header_remove: [
							EditorMcpTunnelProvenanceHeader,
						],
						request_header_add: [
							`${EditorMcpTunnelProvenanceHeader}:${provenance}`,
						],
						...(domain === undefined
							? {}
							: {
									domain,
								}),
						forwards_to: "arkini-editor-mcp",
					});
					const candidate = listener.url();
					if (candidate === null) {
						await listener.close();
						throw new Error("ngrok started without publishing an endpoint URL.");
					}
					const url = new URL(candidate);
					if (url.protocol !== "https:") {
						await listener.close();
						throw new Error("ngrok did not publish an HTTPS endpoint.");
					}
					return {
						url,
						joinFx: Effect.tryPromise({
							try: () => listener.join(),
							catch: (cause) =>
								createSafeNgrokError(
									"ngrok Remote MCP tunnel stopped unexpectedly",
									cause,
								),
						}),
						closeFx: Effect.tryPromise({
							try: () => listener.close(),
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
