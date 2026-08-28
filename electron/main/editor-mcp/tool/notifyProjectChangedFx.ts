import { Effect } from "effect";

/** Announces a committed MCP mutation without changing its acknowledgement on renderer failure. */
export const notifyProjectChangedFx = Effect.fn("notifyProjectChangedFx")(
	(notifyProjectChanged: (projectId: string) => void, projectId: string) =>
		Effect.sync(() => notifyProjectChanged(projectId)).pipe(
			Effect.catchCause((cause) =>
				Effect.sync(() =>
					console.error(
						"Arkini editor could not announce an MCP project mutation.",
						cause,
					),
				),
			),
		),
);
