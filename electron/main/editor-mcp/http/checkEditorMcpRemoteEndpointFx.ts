import { Effect, Schedule } from "effect";

const fetchRemoteEndpointFx = (url: URL) =>
	Effect.tryPromise({
		try: (signal) =>
			fetch(url, {
				signal,
			}),
		catch: (cause) => cause,
	});

/** Proves the published OAuth metadata and bearer challenge before Remote MCP becomes ready. */
export const checkEditorMcpRemoteEndpointFx = Effect.fn("checkEditorMcpRemoteEndpointFx")(
	(origin: URL) =>
		Effect.all(
			[
				fetchRemoteEndpointFx(new URL("/.well-known/oauth-authorization-server", origin)),
				fetchRemoteEndpointFx(new URL("/remote/mcp", origin)),
			],
			{
				concurrency: "unbounded",
			},
		).pipe(
			Effect.timeoutOrElse({
				duration: 1_500,
				orElse: () => Effect.fail(new Error("The operation was aborted due to timeout")),
			}),
			Effect.flatMap(([metadata, challenge]) =>
				metadata.ok && challenge.status === 401
					? Effect.void
					: Effect.fail(
							new Error(
								`metadata returned ${metadata.status} and MCP returned ${challenge.status}`,
							),
						),
			),
			Effect.retry({
				times: 7,
				schedule: Schedule.spaced(250),
			}),
			Effect.mapError(
				(cause) =>
					new Error(
						`Remote MCP public health check failed: ${cause instanceof Error ? cause.message : String(cause)}`,
					),
			),
		),
);
