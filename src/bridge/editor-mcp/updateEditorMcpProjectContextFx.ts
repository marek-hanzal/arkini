import { Effect } from "effect";

import { EditorMcpProjectContextSchema } from "../../../electron/contract/editor/EditorMcpProjectContextSchema";

export const updateEditorMcpProjectContextFx = Effect.fn("updateEditorMcpProjectContextFx")(
	(projectIdCandidate: unknown, update: (projectId: string) => Promise<void>) =>
		Effect.try({
			try: () => EditorMcpProjectContextSchema.parse(projectIdCandidate),
			catch: (cause) => cause,
		}).pipe(
			Effect.flatMap((projectId) =>
				Effect.tryPromise({
					try: () => update(projectId),
					catch: (cause) => cause,
				}),
			),
		),
);
