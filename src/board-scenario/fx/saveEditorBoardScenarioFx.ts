import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import type { EditorBoardGame } from "~/board-scenario/type/EditorBoardGame";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";

export namespace saveEditorBoardScenarioFx {
	export interface Props {
		readonly game: EditorBoardGame;
		readonly name: string;
		readonly project: EditorProject;
	}
}

/** Persists one explicit snapshot of the exact canonical editor game. */
export const saveEditorBoardScenarioFx = Effect.fn("saveEditorBoardScenarioFx")(function* ({
	game,
	name,
	project,
}: saveEditorBoardScenarioFx.Props) {
	const state = fromRuntimeFn({
		runtime: game.getSnapshot(),
	});
	const bytes = encodeArkiniSaveFn({
		version: project.version,
		state,
	});
	const repository = yield* EditorProjectRepository;
	return yield* repository.writeBoardScenarioFx({
		projectId: project.projectId,
		expectedRevision: project.revision,
		name,
		bytes,
	});
});
