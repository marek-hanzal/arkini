import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";

/** Reads the saved working-copy status and immutable tree after earlier writes settle. */
export const readEditorProjectVersionHistoryFx = Effect.fn("readEditorProjectVersionHistoryFx")(
	(projectId: string) =>
		Effect.gen(function* () {
			const repository = yield* EditorProjectRepository;
			yield* repository.awaitIdleFx;
			return yield* Effect.all({
				status: repository.readVersionStatusFx(projectId),
				versions: repository.listVersionsFx(projectId),
			});
		}),
);
