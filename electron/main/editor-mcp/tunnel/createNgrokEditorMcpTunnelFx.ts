import ngrok from "@ngrok/ngrok";
import { Deferred, Effect, Exit, FiberHandle, Scope } from "effect";

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
			Effect.gen(function* () {
				const reconnectScope = yield* Scope.make();
				const closed = yield* Deferred.make<void>();
				const runReconnectFx = yield* FiberHandle.makeRuntime<never, never>().pipe(
					Effect.provideService(Scope.Scope, reconnectScope),
				);
				return yield* Effect.tryPromise({
					try: async () => {
						const listener = await ngrok.forward({
							addr: `127.0.0.1:${port}`,
							authtoken,
							domain,
							onStatusChange: (status) => {
								if (status === "connected") {
									runReconnectFx(Effect.void);
									return;
								}
								if (status !== "closed") return;
								runReconnectFx(
									Deferred.succeed(closed, undefined).pipe(
										Effect.delay(NgrokReconnectGraceMs),
									),
								);
							},
							request_header_remove: [
								EditorMcpTunnelProvenanceHeader,
							],
							request_header_add: [
								`${EditorMcpTunnelProvenanceHeader}:${provenance}`,
							],
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
						if (url.hostname !== domain) {
							await listener.close();
							throw new Error("ngrok published an unexpected endpoint domain.");
						}
						return {
							url,
							closedFx: Deferred.await(closed),
							closeFx: Scope.close(reconnectScope, Exit.void).pipe(
								Effect.andThen(
									Effect.tryPromise({
										try: async () => listener.close(),
										catch: (cause) =>
											createSafeNgrokError(
												"ngrok could not close the Remote MCP tunnel",
												cause,
											),
									}),
								),
							),
						};
					},
					catch: (cause) =>
						createSafeNgrokError("ngrok could not open the Remote MCP tunnel", cause),
				}).pipe(Effect.onError(() => Scope.close(reconnectScope, Exit.void)));
			}),
	}),
);
