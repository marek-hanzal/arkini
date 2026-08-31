import { createServer } from "node:net";
import { Effect } from "effect";

import type { EditorMcpPortAvailability } from "~electron/contract/editor/EditorMcpPortAvailability";
import { EditorMcpPortSchema } from "~electron/contract/editor/EditorMcpPortSchema";

/** Performs an advisory loopback bind; the future MCP listener's real bind stays authoritative. */
export const checkPortAvailabilityFx = Effect.fn("checkPortAvailabilityFx")((candidate: unknown) =>
	Effect.gen(function* () {
		const port = yield* Effect.try({
			try: () => EditorMcpPortSchema.parse(candidate),
			catch: () => undefined,
		}).pipe(Effect.option);
		if (port._tag === "None") {
			return {
				type: "unavailable",
				message: "Use a port from 1024 to 65535.",
			} satisfies EditorMcpPortAvailability;
		}
		return yield* Effect.callback<EditorMcpPortAvailability>((resumeFn) => {
			const server = createServer();
			let settled = false;
			const finishFn = (result: EditorMcpPortAvailability) => {
				if (settled) return;
				settled = true;
				resumeFn(Effect.succeed(result));
			};
			server.once("error", () =>
				finishFn({
					type: "unavailable",
					message: `Port ${port.value} is already in use or cannot be bound.`,
				}),
			);
			server.listen(
				{
					host: "127.0.0.1",
					port: port.value,
					exclusive: true,
				},
				() => {
					server.close((error) =>
						finishFn(
							error === undefined
								? {
										type: "available",
									}
								: {
										type: "unavailable",
										message: `Port ${port.value} could not be released after probing.`,
									},
						),
					);
				},
			);
			return Effect.sync(() => {
				if (!settled) server.close();
			});
		});
	}),
);
