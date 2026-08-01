import { Effect } from "effect";

import { readEditorProjectMutationLaneFx } from "~/bridge/editor/readEditorProjectMutationLaneFx";

/** Opens canonical write admission for one editor project. */
export const openEditorProjectMutationLaneFx = Effect.fn("openEditorProjectMutationLaneFx")(
	(projectId: string) =>
		readEditorProjectMutationLaneFx(projectId).pipe(
			Effect.tap((lane) =>
				Effect.sync(() => {
					lane.accepting = true;
				}),
			),
			Effect.asVoid,
		),
);
