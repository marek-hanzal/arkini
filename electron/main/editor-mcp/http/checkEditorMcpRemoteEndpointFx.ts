import { Effect } from "effect";

/** Proves the published OAuth metadata and bearer challenge before Remote MCP becomes ready. */
export const checkEditorMcpRemoteEndpointFx = Effect.fn("checkEditorMcpRemoteEndpointFx")(
	(origin: URL) =>
		Effect.tryPromise({
			try: async () => {
				let failure: unknown;
				for (let attempt = 0; attempt < 8; attempt += 1) {
					try {
						const [metadata, challenge] = await Promise.all([
							fetch(new URL("/.well-known/oauth-authorization-server", origin), {
								signal: AbortSignal.timeout(1_500),
							}),
							fetch(new URL("/remote/mcp", origin), {
								signal: AbortSignal.timeout(1_500),
							}),
						]);
						if (metadata.ok && challenge.status === 401) return;
						failure = new Error(
							`metadata returned ${metadata.status} and MCP returned ${challenge.status}`,
						);
					} catch (cause) {
						failure = cause;
					}
					await new Promise((resolve) => setTimeout(resolve, 250));
				}
				throw failure ?? new Error("the public endpoint did not respond");
			},
			catch: (cause) =>
				new Error(
					`Remote MCP public health check failed: ${cause instanceof Error ? cause.message : String(cause)}`,
				),
		}),
);
