import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

/** Reads the saved working-copy status and immutable tree after earlier writes settle. */
export const readProjectVersionHistoryFx = Effect.fn("readEditorProjectVersionHistoryFx")(
	(projectId: string) =>
		Effect.gen(function* () {
			const repository = yield* ProjectRepository;
			yield* repository.awaitIdleFx;
			return yield* Effect.all({
				status: repository.readVersionStatusFx(projectId),
				versions: repository.listVersionsFx(projectId),
			});
		}),
);
